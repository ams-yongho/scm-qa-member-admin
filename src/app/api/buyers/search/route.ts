import { NextRequest } from "next/server"

import { errorResponse, okResponse } from "@/lib/api/errors"
import { searchBuyers } from "@/lib/buyer/repository"
import { buyerSearchQuerySchema } from "@/lib/buyer/schema"
import { resolveDataSourceMode } from "@/lib/data-source"
import { getDbPool } from "@/lib/db/mysql"
import { resolveServerTarget } from "@/lib/db/targets"
import { searchMockBuyers } from "@/lib/mock/buyer-store"
import type { BuyerSearchData } from "@/types/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const parsed = buyerSearchQuerySchema.parse({
      target: request.nextUrl.searchParams.get("target") ?? "staging",
      field: request.nextUrl.searchParams.get("field") ?? "login_id",
      q: request.nextUrl.searchParams.get("q"),
      limit: request.nextUrl.searchParams.get("limit") ?? "20",
    })

    const dataSource = resolveDataSourceMode()
    const items =
      dataSource === "database"
        ? await searchBuyers(getDbPool(parsed.target), {
            field: parsed.field,
            query: parsed.q,
            limit: parsed.limit,
          })
        : await searchMockBuyers(parsed.target, {
            field: parsed.field,
            query: parsed.q,
            limit: parsed.limit,
          })

    return okResponse<BuyerSearchData>({
      target: parsed.target,
      resolvedTarget: resolveServerTarget(parsed.target),
      dataSource,
      items,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
