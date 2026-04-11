import type { BuyerDetail, BuyerSummary } from "@/types/buyer"
import type { ResolvedServerTarget, ServerTarget } from "@/types/server-target"

export type DataSourceMode = "database" | "mock"

export interface ApiErrorPayload {
  code: string
  message: string
  hint?: string
  details?: string
}

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: ApiErrorPayload
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

interface TargetContext {
  target: ServerTarget
  resolvedTarget: ResolvedServerTarget
  dataSource: DataSourceMode
}

export interface DatabaseHealthData extends TargetContext {
  connected: true
  latencyMs: number
  serverTime: string
  version: string
}

export interface BuyerSearchData extends TargetContext {
  items: BuyerSummary[]
}

export interface BuyerDetailData extends TargetContext {
  item: BuyerDetail
}
