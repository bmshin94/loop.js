import { expect, test } from "bun:test"
import { dirname, join, resolve } from "node:path"
import { assertFreshable } from "./loop.ts"

const root = resolve("fresh-safety-project")

test("fresh refuses the project root and any ancestor that contains it", () => {
  expect(() => assertFreshable({ root, workspaceDir: root })).toThrow(/project root/)
  expect(() => assertFreshable({ root, workspaceDir: dirname(root) })).toThrow(/contains the project root/)
})

test("fresh still allows a child workspace and an external sibling workspace", () => {
  expect(() => assertFreshable({ root, workspaceDir: join(root, "workspace") })).not.toThrow()
  expect(() => assertFreshable({ root, workspaceDir: join(dirname(root), "other-workspace") })).not.toThrow()
})
