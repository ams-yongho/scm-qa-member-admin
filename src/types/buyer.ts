export const buyerTypeValues = ["PERSONAL", "BUSINESS"] as const
export type BuyerType = (typeof buyerTypeValues)[number]

export const buyerStatusValues = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "WITHDRAWN",
] as const
export type BuyerStatus = (typeof buyerStatusValues)[number]

export const buyerSearchFieldValues = [
  "id",
  "login_id",
  "email",
  "phone_number",
] as const
export type BuyerSearchField = (typeof buyerSearchFieldValues)[number]

export interface BuyerSummary {
  id: number
  loginId: string | null
  name: string | null
  phoneNumber: string | null
  email: string | null
  status: BuyerStatus
  updatedAt: string
}

export interface BuyerDetail extends BuyerSummary {
  type: BuyerType | null
  bankName: string | null
  bankNumber: string | null
  bankHolder: string | null
  marketingUse: boolean
  smsUse: boolean
  emailUse: boolean
  carUnlimited: boolean
  maxCarLimit: number | null
  createdAt: string
  createdBy: number | null
  updatedBy: number | null
}

export interface UpdateBuyerInput {
  type: BuyerType | null
  name: string | null
  phoneNumber: string | null
  email: string | null
  bankName: string | null
  bankNumber: string | null
  bankHolder: string | null
  status: BuyerStatus
  marketingUse: boolean
  smsUse: boolean
  emailUse: boolean
  carUnlimited: boolean
  maxCarLimit: number | null
}
