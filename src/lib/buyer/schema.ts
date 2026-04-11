import { z } from "zod"

import {
  buyerSearchFieldValues,
  buyerStatusValues,
  buyerTypeValues,
} from "@/types/buyer"
import { serverTargetSchema } from "@/types/server-target"

function emptyStringToNull(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function nullableString(maxLength: number) {
  return z.preprocess(
    emptyStringToNull,
    z.union([z.string().max(maxLength), z.null()])
  )
}

const nullableEmail = z.preprocess(
  emptyStringToNull,
  z.union([z.string().email().max(255), z.null()])
)

const nullableInteger = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null
    }

    if (typeof value === "string") {
      return Number(value)
    }

    return value
  },
  z.union([z.number().int().nonnegative(), z.null()])
)

export const targetQuerySchema = z.object({
  target: serverTargetSchema,
})

export const buyerSearchQuerySchema = z.object({
  target: serverTargetSchema,
  field: z.enum(buyerSearchFieldValues).default("login_id"),
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().positive().max(20).default(20),
})

export const buyerIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const updateBuyerSchema = z
  .object({
    type: z.preprocess(
      emptyStringToNull,
      z.union([z.enum(buyerTypeValues), z.null()])
    ),
    name: nullableString(30),
    phoneNumber: nullableString(20),
    email: nullableEmail,
    bankName: nullableString(255),
    bankNumber: nullableString(30),
    bankHolder: nullableString(30),
    status: z.enum(buyerStatusValues),
    marketingUse: z.boolean(),
    smsUse: z.boolean(),
    emailUse: z.boolean(),
    carUnlimited: z.boolean(),
    maxCarLimit: nullableInteger,
  })
  .transform((value) => ({
    ...value,
    maxCarLimit: value.carUnlimited ? null : value.maxCarLimit,
  }))
