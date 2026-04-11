import "server-only"

import fs from "node:fs"

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise"

import { getRuntimeEnv } from "@/lib/env"
import { getDatabaseUrlForTarget, resolveServerTarget } from "@/lib/db/targets"
import type { ResolvedServerTarget, ServerTarget } from "@/types/server-target"

declare global {
  var __scmQaMysqlPools: Partial<Record<ResolvedServerTarget, Pool>> | undefined
}

function buildSslConfig() {
  const env = getRuntimeEnv()

  if (!env.MYSQL_SSL_ENABLED) {
    return undefined
  }

  return {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
    ...(env.MYSQL_SSL_CA_PATH
      ? { ca: fs.readFileSync(env.MYSQL_SSL_CA_PATH, "utf8") }
      : {}),
  }
}

function buildPoolOptions(target: ServerTarget) {
  const env = getRuntimeEnv()
  const connectionUrl = new URL(getDatabaseUrlForTarget(target))
  const port = connectionUrl.port ? Number(connectionUrl.port) : 3306

  return {
    host: connectionUrl.hostname,
    port: Number.isNaN(port) ? 3306 : port,
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database: connectionUrl.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 5,
    idleTimeout: 60_000,
    queueLimit: 0,
    connectTimeout: env.MYSQL_CONNECT_TIMEOUT_MS,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true,
    decimalNumbers: true,
    ssl: buildSslConfig(),
  }
}

export function getDbPool(target: ServerTarget) {
  const resolvedTarget = resolveServerTarget(target)
  const globalPools = globalThis.__scmQaMysqlPools ?? {}

  if (!globalPools[resolvedTarget]) {
    globalPools[resolvedTarget] = mysql.createPool(buildPoolOptions(target))
    globalThis.__scmQaMysqlPools = globalPools
  }

  return globalPools[resolvedTarget] as Pool
}

interface HealthRow extends RowDataPacket {
  server_time: string
  version: string
}

export async function pingDatabase(target: ServerTarget) {
  const pool = getDbPool(target)
  const [rows] = await pool.query<HealthRow[]>(
    "SELECT NOW(6) AS server_time, @@version AS version"
  )

  return {
    serverTime: rows[0]?.server_time ?? "",
    version: rows[0]?.version ?? "",
  }
}
