import { NextRequest } from "next/server"

import { errorResponse, okResponse } from "@/lib/api/errors"
import { targetQuerySchema } from "@/lib/buyer/schema"
import { resolveDataSourceMode } from "@/lib/data-source"
import { pingDatabase } from "@/lib/db/mysql"
import { resolveServerTarget } from "@/lib/db/targets"
import { getMockHealth } from "@/lib/mock/buyer-store"
import type { DatabaseHealthData } from "@/types/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const parsed = targetQuerySchema.parse({
      target: request.nextUrl.searchParams.get("target") ?? "staging",
    })

    const startedAt = Date.now()
    const dataSource = resolveDataSourceMode()
    const health =
      dataSource === "database"
        ? await pingDatabase(parsed.target)
        : getMockHealth()

    return okResponse<DatabaseHealthData>({
      target: parsed.target,
      resolvedTarget: resolveServerTarget(parsed.target),
      dataSource,
      connected: true,
      latencyMs: Date.now() - startedAt,
      serverTime: health.serverTime,
      version: health.version,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
