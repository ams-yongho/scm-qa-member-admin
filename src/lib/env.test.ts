import { afterEach, describe, expect, it } from "vitest"

import { getDatabaseEnv, getRuntimeEnv } from "@/lib/env"

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key]
    }
  }

  Object.assign(process.env, originalEnv)
})

describe("env", () => {
  it("applies runtime defaults", () => {
    delete process.env.APP_DATA_MODE
    delete process.env.DEFAULT_SERVER_TARGET
    delete process.env.MYSQL_CONNECT_TIMEOUT_MS
    delete process.env.MYSQL_SSL_ENABLED

    const env = getRuntimeEnv()

    expect(env.APP_DATA_MODE).toBe("mock")
    expect(env.DEFAULT_SERVER_TARGET).toBe("staging")
    expect(env.MYSQL_CONNECT_TIMEOUT_MS).toBe(5000)
    expect(env.MYSQL_SSL_ENABLED).toBe(true)
  })

  it("parses database connection URLs", () => {
    process.env.STAGING_DATABASE_URL =
      "mysql://user:pass%40word@staging.example.com:3306/sym"
    process.env.PRODUCTION_DATABASE_URL =
      "mysql://user:pass@production.example.com:3306/scm"

    const env = getDatabaseEnv()

    expect(env.STAGING_DATABASE_URL).toContain("%40")
    expect(env.PRODUCTION_DATABASE_URL).toContain("production.example.com")
  })
})
