import { describe, expect, it } from "vitest"

import { buyerSearchQuerySchema, updateBuyerSchema } from "@/lib/buyer/schema"

describe("buyer schema", () => {
  it("validates search query values", () => {
    const parsed = buyerSearchQuerySchema.parse({
      target: "release",
      field: "email",
      q: "qa@partsfit.co.kr",
    })

    expect(parsed.limit).toBe(20)
    expect(parsed.target).toBe("release")
  })

  it("normalizes blank optional values and clears maxCarLimit when unlimited", () => {
    const parsed = updateBuyerSchema.parse({
      type: "",
      name: "  ",
      phoneNumber: "01012341234",
      email: "",
      bankName: "",
      bankNumber: "",
      bankHolder: "",
      status: "ACTIVE",
      marketingUse: false,
      smsUse: true,
      emailUse: false,
      carUnlimited: true,
      maxCarLimit: 5,
    })

    expect(parsed.type).toBeNull()
    expect(parsed.name).toBeNull()
    expect(parsed.email).toBeNull()
    expect(parsed.maxCarLimit).toBeNull()
  })
})
