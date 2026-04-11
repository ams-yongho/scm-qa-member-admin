import { afterEach, describe, expect, it } from "vitest"

import {
  assertWritableTarget,
  getDatabaseUrlForTarget,
  resolveServerTarget,
} from "@/lib/db/targets"

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key]
    }
  }

  Object.assign(process.env, originalEnv)
})

describe("db target helpers", () => {
  it("maps release to staging", () => {
    process.env.STAGING_DATABASE_URL =
      "mysql://user:pass@staging.example.com:3306/sym"
    process.env.PRODUCTION_DATABASE_URL =
      "mysql://user:pass@production.example.com:3306/scm"

    expect(resolveServerTarget("release")).toBe("staging")
    expect(getDatabaseUrlForTarget("release")).toContain("staging.example.com")
  })

  it("rejects product writes", () => {
    expect(() => assertWritableTarget("product")).toThrowError(
      "product target is read-only"
    )
  })
})
