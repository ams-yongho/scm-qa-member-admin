import { beforeEach, describe, expect, it } from "vitest"

import {
  getMockBuyerById,
  getMockHealth,
  searchMockBuyers,
  updateMockBuyer,
} from "@/lib/mock/buyer-store"

describe("mock buyer store", () => {
  beforeEach(() => {
    delete globalThis.__scmQaMockBuyerStore
  })

  it("returns seeded staging buyers by login id", async () => {
    const result = await searchMockBuyers("staging", {
      field: "login_id",
      query: "qa-member-01",
      limit: 20,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(101)
  })

  it("shares release data with staging", async () => {
    const stagingBuyer = await getMockBuyerById("staging", 101)
    const releaseBuyer = await getMockBuyerById("release", 101)

    expect(stagingBuyer?.loginId).toBe("qa-member-01")
    expect(releaseBuyer?.loginId).toBe("qa-member-01")
  })

  it("updates a mock buyer in memory", async () => {
    const updated = await updateMockBuyer("staging", 101, {
      type: "PERSONAL",
      name: "변경된 이름",
      phoneNumber: "01000001111",
      email: "changed@partsfit.co.kr",
      bankName: null,
      bankNumber: null,
      bankHolder: null,
      status: "ACTIVE",
      marketingUse: false,
      smsUse: false,
      emailUse: true,
      carUnlimited: true,
      maxCarLimit: 5,
    })

    expect(updated?.name).toBe("변경된 이름")
    expect(updated?.carUnlimited).toBe(true)
    expect(updated?.maxCarLimit).toBeNull()

    const persisted = await getMockBuyerById("staging", 101)
    expect(persisted?.email).toBe("changed@partsfit.co.kr")
  })

  it("returns mock health metadata", () => {
    const health = getMockHealth()

    expect(health.version).toBe("mock-data-v1")
    expect(health.serverTime).toContain("-")
  })
})
