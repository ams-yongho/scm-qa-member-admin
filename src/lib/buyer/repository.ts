import "server-only"

import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise"

import type {
  BuyerDetail,
  BuyerSearchField,
  BuyerStatus,
  BuyerSummary,
  BuyerType,
  UpdateBuyerInput,
} from "@/types/buyer"

export type BuyerDbExecutor = Pick<Pool, "execute">

interface BuyerSummaryRow extends RowDataPacket {
  id: number
  login_id: string | null
  name: string | null
  phone_number: string | null
  email: string | null
  status: BuyerStatus
  updated_at: string
}

interface BuyerDetailRow extends BuyerSummaryRow {
  type: BuyerType | null
  bank_name: string | null
  bank_number: string | null
  bank_holder: string | null
  marketing_use: number | boolean | null
  sms_use: number | boolean | null
  email_use: number | boolean | null
  car_unlimited: number | boolean | null
  max_car_limit: number | null
  created_at: string
  created_by: number | null
  updated_by: number | null
}

const SEARCH_COLUMN_MAP: Record<BuyerSearchField, string> = {
  id: "id",
  login_id: "login_id",
  email: "email",
  phone_number: "phone_number",
}

function toBoolean(value: number | boolean | null) {
  return value === true || value === 1
}

function mapSummaryRow(row: BuyerSummaryRow): BuyerSummary {
  return {
    id: row.id,
    loginId: row.login_id,
    name: row.name,
    phoneNumber: row.phone_number,
    email: row.email,
    status: row.status,
    updatedAt: String(row.updated_at),
  }
}

function mapDetailRow(row: BuyerDetailRow): BuyerDetail {
  return {
    ...mapSummaryRow(row),
    type: row.type,
    bankName: row.bank_name,
    bankNumber: row.bank_number,
    bankHolder: row.bank_holder,
    marketingUse: toBoolean(row.marketing_use),
    smsUse: toBoolean(row.sms_use),
    emailUse: toBoolean(row.email_use),
    carUnlimited: toBoolean(row.car_unlimited),
    maxCarLimit: row.max_car_limit,
    createdAt: String(row.created_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  }
}

function toMysqlBoolean(value: boolean) {
  return value ? 1 : 0
}

export async function searchBuyers(
  db: BuyerDbExecutor,
  options: {
    field: BuyerSearchField
    query: string
    limit: number
  }
) {
  if (options.field === "id") {
    const parsedId = Number(options.query)

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return []
    }

    const [rows] = await db.execute<BuyerSummaryRow[]>(
      `
        SELECT
          id,
          login_id,
          name,
          phone_number,
          email,
          status,
          updated_at
        FROM partsfit_mall_buyer
        WHERE id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `,
      [parsedId, options.limit]
    )

    return rows.map(mapSummaryRow)
  }

  const column = SEARCH_COLUMN_MAP[options.field]
  const [rows] = await db.execute<BuyerSummaryRow[]>(
    `
      SELECT
        id,
        login_id,
        name,
        phone_number,
        email,
        status,
        updated_at
      FROM partsfit_mall_buyer
      WHERE ${column} LIKE CONCAT('%', ?, '%')
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
    `,
    [options.query, options.limit]
  )

  return rows.map(mapSummaryRow)
}

export async function getBuyerById(db: BuyerDbExecutor, buyerId: number) {
  const [rows] = await db.execute<BuyerDetailRow[]>(
    `
      SELECT
        id,
        type,
        login_id,
        name,
        phone_number,
        email,
        bank_name,
        bank_number,
        bank_holder,
        status,
        marketing_use,
        sms_use,
        email_use,
        car_unlimited,
        max_car_limit,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM partsfit_mall_buyer
      WHERE id = ?
      LIMIT 1
    `,
    [buyerId]
  )

  const row = rows[0]
  return row ? mapDetailRow(row) : null
}

export async function updateBuyer(
  db: BuyerDbExecutor,
  buyerId: number,
  input: UpdateBuyerInput
) {
  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE partsfit_mall_buyer
      SET
        type = ?,
        name = ?,
        phone_number = ?,
        email = ?,
        bank_name = ?,
        bank_number = ?,
        bank_holder = ?,
        status = ?,
        marketing_use = ?,
        sms_use = ?,
        email_use = ?,
        car_unlimited = ?,
        max_car_limit = ?,
        updated_at = NOW(6)
      WHERE id = ?
    `,
    [
      input.type,
      input.name,
      input.phoneNumber,
      input.email,
      input.bankName,
      input.bankNumber,
      input.bankHolder,
      input.status,
      toMysqlBoolean(input.marketingUse),
      toMysqlBoolean(input.smsUse),
      toMysqlBoolean(input.emailUse),
      toMysqlBoolean(input.carUnlimited),
      input.carUnlimited ? null : input.maxCarLimit,
      buyerId,
    ]
  )

  if (!result.affectedRows) {
    return null
  }

  return getBuyerById(db, buyerId)
}
