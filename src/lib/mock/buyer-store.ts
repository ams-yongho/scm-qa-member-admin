import "server-only"

import type { BuyerDetail, BuyerSearchField, BuyerSummary, UpdateBuyerInput } from "@/types/buyer"
import type { ServerTarget } from "@/types/server-target"
import { resolveServerTarget } from "@/lib/db/targets"

declare global {
  var __scmQaMockBuyerStore:
    | Record<string, Map<number, BuyerDetail>>
    | undefined
}

function formatTimestamp(date: Date) {
  const iso = date.toISOString().replace("T", " ").replace("Z", "")
  return `${iso}000`
}

function cloneBuyer(buyer: BuyerDetail): BuyerDetail {
  return structuredClone(buyer)
}

function createBuyer(
  buyer: Omit<BuyerDetail, "createdAt" | "updatedAt"> & {
    createdAt: string
    updatedAt: string
  }
): BuyerDetail {
  return { ...buyer }
}

function createStagingSeed() {
  return [
    createBuyer({
      id: 101,
      type: "PERSONAL",
      loginId: "qa-member-01",
      name: "김테스트",
      phoneNumber: "01012345678",
      email: "qa.member01@partsfit.co.kr",
      status: "ACTIVE",
      updatedAt: "2026-04-11 10:20:00.000000",
      bankName: "국민은행",
      bankNumber: "110-233-445566",
      bankHolder: "김테스트",
      marketingUse: true,
      smsUse: true,
      emailUse: true,
      carUnlimited: false,
      maxCarLimit: 3,
      createdAt: "2026-03-01 09:00:00.000000",
      createdBy: 1,
      updatedBy: 1,
    }),
    createBuyer({
      id: 102,
      type: "BUSINESS",
      loginId: "qa-biz-77",
      name: "테크상사",
      phoneNumber: "0212345678",
      email: "ops@techcorp.co.kr",
      status: "INACTIVE",
      updatedAt: "2026-04-11 09:10:00.000000",
      bankName: "신한은행",
      bankNumber: "555-22-778899",
      bankHolder: "테크상사",
      marketingUse: false,
      smsUse: false,
      emailUse: true,
      carUnlimited: true,
      maxCarLimit: null,
      createdAt: "2026-02-13 13:45:00.000000",
      createdBy: 3,
      updatedBy: 3,
    }),
    createBuyer({
      id: 103,
      type: null,
      loginId: null,
      name: "소셜회원",
      phoneNumber: "01099887766",
      email: "social.user@partsfit.co.kr",
      status: "SUSPENDED",
      updatedAt: "2026-04-10 17:30:00.000000",
      bankName: null,
      bankNumber: null,
      bankHolder: null,
      marketingUse: false,
      smsUse: false,
      emailUse: false,
      carUnlimited: false,
      maxCarLimit: 1,
      createdAt: "2026-01-22 11:12:00.000000",
      createdBy: null,
      updatedBy: 7,
    }),
    createBuyer({
      id: 104,
      type: "PERSONAL",
      loginId: "withdraw-candidate",
      name: "탈퇴예정",
      phoneNumber: "01055556666",
      email: "withdraw.soon@partsfit.co.kr",
      status: "WITHDRAWN",
      updatedAt: "2026-04-09 14:00:00.000000",
      bankName: null,
      bankNumber: null,
      bankHolder: null,
      marketingUse: false,
      smsUse: false,
      emailUse: false,
      carUnlimited: false,
      maxCarLimit: 0,
      createdAt: "2025-12-31 08:20:00.000000",
      createdBy: 2,
      updatedBy: 5,
    }),
  ]
}

function createProductSeed() {
  return [
    createBuyer({
      id: 9001,
      type: "PERSONAL",
      loginId: "prod-member-01",
      name: "운영회원",
      phoneNumber: "01033334444",
      email: "prod.member01@partsfit.co.kr",
      status: "ACTIVE",
      updatedAt: "2026-04-11 08:40:00.000000",
      bankName: "하나은행",
      bankNumber: "777-88-990011",
      bankHolder: "운영회원",
      marketingUse: true,
      smsUse: false,
      emailUse: true,
      carUnlimited: false,
      maxCarLimit: 2,
      createdAt: "2026-01-05 10:00:00.000000",
      createdBy: 9,
      updatedBy: 9,
    }),
    createBuyer({
      id: 9002,
      type: "BUSINESS",
      loginId: "prod-biz-main",
      name: "운영상사",
      phoneNumber: "0317654321",
      email: "admin@prod-biz.co.kr",
      status: "ACTIVE",
      updatedAt: "2026-04-10 16:20:00.000000",
      bankName: "기업은행",
      bankNumber: "991-22-334455",
      bankHolder: "운영상사",
      marketingUse: false,
      smsUse: false,
      emailUse: false,
      carUnlimited: true,
      maxCarLimit: null,
      createdAt: "2025-11-21 15:20:00.000000",
      createdBy: 11,
      updatedBy: 11,
    }),
  ]
}

function createSeedMap(target: ServerTarget) {
  const resolvedTarget = resolveServerTarget(target)
  const source = resolvedTarget === "product" ? createProductSeed() : createStagingSeed()

  return new Map(source.map((buyer) => [buyer.id, cloneBuyer(buyer)]))
}

function getStore(target: ServerTarget) {
  const resolvedTarget = resolveServerTarget(target)
  const store = globalThis.__scmQaMockBuyerStore ?? {}

  if (!store[resolvedTarget]) {
    store[resolvedTarget] = createSeedMap(target)
    globalThis.__scmQaMockBuyerStore = store
  }

  return store[resolvedTarget] as Map<number, BuyerDetail>
}

function toSummary(buyer: BuyerDetail): BuyerSummary {
  return {
    id: buyer.id,
    loginId: buyer.loginId,
    name: buyer.name,
    phoneNumber: buyer.phoneNumber,
    email: buyer.email,
    status: buyer.status,
    updatedAt: buyer.updatedAt,
  }
}

function matchesSearch(
  buyer: BuyerDetail,
  field: BuyerSearchField,
  query: string
) {
  if (field === "id") {
    return buyer.id === Number(query)
  }

  const value =
    field === "login_id"
      ? buyer.loginId
      : field === "email"
        ? buyer.email
        : buyer.phoneNumber

  return value?.toLowerCase().includes(query.toLowerCase()) ?? false
}

export function getMockHealth() {
  return {
    serverTime: formatTimestamp(new Date()),
    version: "mock-data-v1",
  }
}

export async function searchMockBuyers(
  target: ServerTarget,
  options: {
    field: BuyerSearchField
    query: string
    limit: number
  }
) {
  const buyers = Array.from(getStore(target).values())
    .filter((buyer) => matchesSearch(buyer, options.field, options.query))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, options.limit)

  return buyers.map((buyer) => toSummary(cloneBuyer(buyer)))
}

export async function getMockBuyerById(target: ServerTarget, buyerId: number) {
  const buyer = getStore(target).get(buyerId)
  return buyer ? cloneBuyer(buyer) : null
}

export async function updateMockBuyer(
  target: ServerTarget,
  buyerId: number,
  input: UpdateBuyerInput
) {
  const store = getStore(target)
  const current = store.get(buyerId)

  if (!current) {
    return null
  }

  const nextBuyer: BuyerDetail = {
    ...current,
    ...input,
    maxCarLimit: input.carUnlimited ? null : input.maxCarLimit,
    updatedAt: formatTimestamp(new Date()),
  }

  store.set(buyerId, nextBuyer)

  return cloneBuyer(nextBuyer)
}

export function getMockSearchPresets() {
  return [
    { field: "login_id" as const, value: "qa-member-01", label: "qa-member-01" },
    { field: "email" as const, value: "ops@techcorp.co.kr", label: "ops@techcorp.co.kr" },
    { field: "phone_number" as const, value: "01099887766", label: "01099887766" },
    { field: "id" as const, value: "101", label: "101" },
  ]
}
