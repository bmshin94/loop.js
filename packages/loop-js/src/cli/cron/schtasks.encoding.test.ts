import { expect, test } from "bun:test"
import { buildTaskXml, taskXmlBytes, wrapperCommand } from "./schtasks.ts"

test("Task Scheduler XML declaration and bytes agree on UTF-16", () => {
  const xml = buildTaskXml({
    expr: "0 8 * * *",
    dir: "C:\\proj",
    command: wrapperCommand("C:\\proj\\.loop\\cron\\abc123.cmd"),
    until: { settled: false },
  })
  const bytes = taskXmlBytes(xml)

  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-16"?>')).toBe(true)
  expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe])
  expect(bytes.toString("utf16le").startsWith('\uFEFF<?xml version="1.0" encoding="UTF-16"?>')).toBe(true)
})
