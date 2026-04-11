import { z } from "zod"

export const serverTargetValues = ["staging", "release", "product"] as const
export const serverTargetSchema = z.enum(serverTargetValues)

export type ServerTarget = z.infer<typeof serverTargetSchema>

export const resolvedServerTargetValues = ["staging", "product"] as const
export const resolvedServerTargetSchema = z.enum(resolvedServerTargetValues)

export type ResolvedServerTarget = z.infer<typeof resolvedServerTargetSchema>

export const serverTargetLabels: Record<ServerTarget, string> = {
  staging: "STAGING",
  release: "RELEASE",
  product: "PRODUCT",
}
