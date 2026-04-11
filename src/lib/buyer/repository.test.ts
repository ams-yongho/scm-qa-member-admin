import { describe, expect, it, vi } from "vitest"

import {
  getBuyerById,
  searchBuyers,
  updateBuyer,
  type BuyerDbExecutor,
} from "@/lib/buyer/repository"

function createDbMock() {
  return {
    execute: vi.fn(),
  } as unknown as BuyerDbExecutor & {
    execute: ReturnType<typeof vi.fn>
  }
}

describe("buyer repository", () => {
  it("returns an empty array for invalid id searches", async () => {
    const db = createDbMock()

    const result = await searchBuyers(db, {
      field: "id",
      query: "abc",
      limit: 20,
    })

    expect(result).toEqual([])
    expect(db.execute).not.toHaveBeenCalled()
  })

  it("uses the requested searchable column", async () => {
    const db = createDbMock()

    db.execute.mockResolvedValueOnce([
      [
        {
          id: 1,
          login_id: "qa-user",
          name: "QA User",
          phone_number: "01000000000",
          email: "qa@example.com",
          status: "ACTIVE",
          updated_at: "2026-04-11 13:00:00.000000",
        },
      ],
      undefined,
    ])

    const result = await searchBuyers(db, {
      field: "email",
      query: "qa@example.com",
      limit: 20,
    })

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE email LIKE"),
      ["qa@example.com", 20]
    )
    expect(result[0]?.loginId).toBe("qa-user")
  })

  it("updates a buyer and nulls maxCarLimit when carUnlimited is true", async () => {
    const db = createDbMock()

    db.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([
        [
          {
            id: 7,
            type: "PERSONAL",
            login_id: "buyer-7",
            name: "Kim QA",
            phone_number: "01011112222",
            email: "kim@example.com",
            bank_name: null,
            bank_number: null,
            bank_holder: null,
            status: "ACTIVE",
            marketing_use: 0,
            sms_use: 0,
            email_use: 1,
            car_unlimited: 1,
            max_car_limit: null,
            created_at: "2026-04-11 13:00:00.000000",
            updated_at: "2026-04-11 14:00:00.000000",
            created_by: null,
            updated_by: null,
          },
        ],
        undefined,
      ])

    const result = await updateBuyer(db, 7, {
      type: "PERSONAL",
      name: "Kim QA",
      phoneNumber: "01011112222",
      email: "kim@example.com",
      bankName: null,
      bankNumber: null,
      bankHolder: null,
      status: "ACTIVE",
      marketingUse: false,
      smsUse: false,
      emailUse: true,
      carUnlimited: true,
      maxCarLimit: 3,
    })

    expect(db.execute.mock.calls[0]?.[1]?.[12]).toBeNull()
    expect(result?.carUnlimited).toBe(true)
  })

  it("maps detail fields without exposing a password", async () => {
    const db = createDbMock()

    db.execute.mockResolvedValueOnce([
      [
        {
          id: 3,
          type: "BUSINESS",
          login_id: "buyer-3",
          name: "Buyer 3",
          phone_number: "01055557777",
          email: "buyer3@example.com",
          bank_name: "Azure Bank",
          bank_number: "123-456",
          bank_holder: "Buyer 3",
          status: "SUSPENDED",
          marketing_use: 1,
          sms_use: 0,
          email_use: 1,
          car_unlimited: 0,
          max_car_limit: 2,
          created_at: "2026-04-10 13:00:00.000000",
          updated_at: "2026-04-11 13:00:00.000000",
          created_by: 1,
          updated_by: 2,
        },
      ],
      undefined,
    ])

    const result = await getBuyerById(db, 3)

    expect(result).toMatchObject({
      id: 3,
      loginId: "buyer-3",
      carUnlimited: false,
    })
    expect(result).not.toHaveProperty("password")
  })
})
