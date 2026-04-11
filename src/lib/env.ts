import "server-only"

import { z } from "zod"

import { serverTargetSchema } from "@/types/server-target"

export const appDataModeSchema = z.enum(["mock", "database"])
export type AppDataMode = z.infer<typeof appDataModeSchema>

const mysqlUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("mysql://"), {
    message: "MySQL connection URLs must start with mysql://",
  })

const optionalStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  },
  z.string().optional()
)

const runtimeEnvSchema = z.object({
  APP_DATA_MODE: appDataModeSchema.default("mock"),
  DEFAULT_SERVER_TARGET: serverTargetSchema.default("staging"),
  MYSQL_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  MYSQL_SSL_ENABLED: z.stringbool().default(true),
  MYSQL_SSL_CA_PATH: optionalStringSchema,
})

const databaseEnvSchema = runtimeEnvSchema.extend({
  STAGING_DATABASE_URL: mysqlUrlSchema,
  PRODUCTION_DATABASE_URL: mysqlUrlSchema,
})

export function getRuntimeEnv() {
  return runtimeEnvSchema.parse({
    APP_DATA_MODE: process.env.APP_DATA_MODE ?? "mock",
    DEFAULT_SERVER_TARGET: process.env.DEFAULT_SERVER_TARGET,
    MYSQL_CONNECT_TIMEOUT_MS: process.env.MYSQL_CONNECT_TIMEOUT_MS ?? "5000",
    MYSQL_SSL_ENABLED: process.env.MYSQL_SSL_ENABLED ?? "true",
    MYSQL_SSL_CA_PATH: process.env.MYSQL_SSL_CA_PATH,
  })
}

export function getDatabaseEnv() {
  return databaseEnvSchema.parse({
    APP_DATA_MODE: process.env.APP_DATA_MODE ?? "mock",
    DEFAULT_SERVER_TARGET: process.env.DEFAULT_SERVER_TARGET,
    MYSQL_CONNECT_TIMEOUT_MS: process.env.MYSQL_CONNECT_TIMEOUT_MS ?? "5000",
    MYSQL_SSL_ENABLED: process.env.MYSQL_SSL_ENABLED ?? "true",
    MYSQL_SSL_CA_PATH: process.env.MYSQL_SSL_CA_PATH,
    STAGING_DATABASE_URL: process.env.STAGING_DATABASE_URL,
    PRODUCTION_DATABASE_URL: process.env.PRODUCTION_DATABASE_URL,
  })
}
