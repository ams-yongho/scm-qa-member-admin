import "server-only"

import { getDatabaseEnv } from "@/lib/env"
import type { ResolvedServerTarget, ServerTarget } from "@/types/server-target"

export class ReadOnlyTargetError extends Error {
  target: ServerTarget

  constructor(target: ServerTarget) {
    super(`${target} target is read-only`)
    this.name = "ReadOnlyTargetError"
    this.target = target
  }
}

export function resolveServerTarget(
  target: ServerTarget
): ResolvedServerTarget {
  return target === "product" ? "product" : "staging"
}

export function isWritableTarget(target: ServerTarget) {
  return target !== "product"
}

export function assertWritableTarget(target: ServerTarget) {
  if (!isWritableTarget(target)) {
    throw new ReadOnlyTargetError(target)
  }
}

export function getDatabaseUrlForTarget(target: ServerTarget) {
  const env = getDatabaseEnv()
  return resolveServerTarget(target) === "product"
    ? env.PRODUCTION_DATABASE_URL
    : env.STAGING_DATABASE_URL
}
