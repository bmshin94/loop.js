import { describe, expect, test } from "bun:test"
import { ERROR_CAP } from "./config.ts"
import { drivePhase, withErrorCap, type Guards } from "./guard.ts"
import { Interruption, type ExecutorEvent, type PhaseStream } from "./executor.ts"

const usage = (usd: number) => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  usd,
})

const makeGuards = (budget = 100): Guards => ({
  cancel: new AbortController().signal,
  controller: new AbortController(),
  budget: { spent: 0, cap: budget },
})

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe("drivePhase guard race table", () => {
  test("cuts off a phase whose next step hangs when the timer fires", async () => {
    const guards = makeGuards()
    guards.roundDeadline = Date.now() + 10
    const phase: PhaseStream<{ reason: "done" }> = (async function* () {
      await new Promise<void>(() => {})
      return { reason: "done" }
    })()

    await expect(drivePhase(phase, guards, async () => {})).rejects.toMatchObject({
      cause: "error",
      detail: "round timeout",
    })
    expect(guards.controller.signal.aborted).toBe(true)
  }, 10_000)

  test("lets cancel beat a clean result while the final step drains", async () => {
    const cancel = new AbortController()
    const guards = makeGuards()
    guards.cancel = cancel.signal
    const phase: PhaseStream<{ reason: "done" }> = (async function* () {
      await wait(10)
      return { reason: "done" }
    })()
    setTimeout(() => cancel.abort(), 1)

    await expect(drivePhase(phase, guards, async () => {})).rejects.toMatchObject({
      cause: "cancel",
      detail: "aborted",
    })
  })

  test("stops after one budget-overshooting step", async () => {
    const guards = makeGuards(5)
    let returned = false
    const phase: PhaseStream<{ reason: "done" }> = (async function* () {
      yield { kind: "cost", usage: usage(3) } satisfies ExecutorEvent
      yield { kind: "cost", usage: usage(4) } satisfies ExecutorEvent
      returned = true
      return { reason: "done" }
    })()

    await expect(drivePhase(phase, guards, async () => {})).rejects.toMatchObject({
      cause: "budget",
      detail: "usd 7.00 > cap 5",
    })
    expect(guards.budget.spent).toBe(7)
    expect(returned).toBe(false)
  })
})

test("retries only ERROR_CAP consecutive errors before rethrowing the last one", async () => {
  const guards = makeGuards()
  let attempts = 0

  await expect(
    withErrorCap(
      guards,
      1,
      async () => {
        attempts++
        throw new Interruption("error", `failure ${attempts}`)
      },
    ),
  ).rejects.toMatchObject({ cause: "error", detail: `failure ${ERROR_CAP}` })
  expect(attempts).toBe(ERROR_CAP)
})
