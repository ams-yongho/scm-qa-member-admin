import "server-only"

import { appDataModeSchema, getRuntimeEnv, type AppDataMode } from "@/lib/env"
import type { DataSourceMode } from "@/types/api"

export function getAppDataMode(): AppDataMode {
  return appDataModeSchema.parse(getRuntimeEnv().APP_DATA_MODE)
}

export function resolveDataSourceMode(): DataSourceMode {
  return getAppDataMode() === "database" ? "database" : "mock"
}

export function isMockMode() {
  return resolveDataSourceMode() === "mock"
}
