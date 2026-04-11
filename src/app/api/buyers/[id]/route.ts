import { NextRequest } from "next/server"

import {
  errorResponse,
  notFoundResponse,
  okResponse,
} from "@/lib/api/errors"
import { getBuyerById, updateBuyer } from "@/lib/buyer/repository"
import {
  buyerIdParamsSchema,
  targetQuerySchema,
  updateBuyerSchema,
} from "@/lib/buyer/schema"
import { resolveDataSourceMode } from "@/lib/data-source"
import { getDbPool } from "@/lib/db/mysql"
import { assertWritableTarget, resolveServerTarget } from "@/lib/db/targets"
import { getMockBuyerById, updateMockBuyer } from "@/lib/mock/buyer-store"
import type { BuyerDetailData } from "@/types/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getRouteContext(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = buyerIdParamsSchema.parse(await context.params)
  const query = targetQuerySchema.parse({
    target: request.nextUrl.searchParams.get("target") ?? "staging",
  })

  return {
    buyerId: params.id,
    target: query.target,
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeContext = await getRouteContext(request, context)
    const dataSource = resolveDataSourceMode()
    const item =
      dataSource === "database"
        ? await getBuyerById(getDbPool(routeContext.target), routeContext.buyerId)
        : await getMockBuyerById(routeContext.target, routeContext.buyerId)

    if (!item) {
      return notFoundResponse("회원 정보를 찾을 수 없습니다.")
    }

    return okResponse<BuyerDetailData>({
      target: routeContext.target,
      resolvedTarget: resolveServerTarget(routeContext.target),
      dataSource,
      item,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeContext = await getRouteContext(request, context)
    assertWritableTarget(routeContext.target)

    const payload = updateBuyerSchema.parse(await request.json())
    const dataSource = resolveDataSourceMode()
    const item =
      dataSource === "database"
        ? await updateBuyer(
            getDbPool(routeContext.target),
            routeContext.buyerId,
            payload
          )
        : await updateMockBuyer(
            routeContext.target,
            routeContext.buyerId,
            payload
          )

    if (!item) {
      return notFoundResponse("수정할 회원 정보를 찾을 수 없습니다.")
    }

    return okResponse<BuyerDetailData>({
      target: routeContext.target,
      resolvedTarget: resolveServerTarget(routeContext.target),
      dataSource,
      item,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
