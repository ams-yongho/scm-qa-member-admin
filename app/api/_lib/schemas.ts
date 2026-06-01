import { z } from "zod";
import { PRODUCT_STATUS_VALUES } from "./status";

export const buyerTypeSchema = z.enum(["PERSONAL", "BUSINESS"]);

// PATCH body — all fields optional, but at least one required.
export const buyerUpdateSchema = z
  .object({
    name: z.string().min(1).max(50).nullable().optional(),
    email: z.string().email().max(255).nullable().optional(),
    phone_number: z.string().min(1).max(100).nullable().optional(),
    bank_name: z.string().max(100).nullable().optional(),
    bank_number: z.string().max(255).nullable().optional(),
    bank_holder: z.string().max(100).nullable().optional(),
    type: buyerTypeSchema.nullable().optional(),
    car_unlimited: z.boolean().nullable().optional(),
    max_car_limit: z.number().int().min(0).max(9999).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export type BuyerUpdate = z.infer<typeof buyerUpdateSchema>;

export const buyerDeleteSchema = z.object({
  confirmLoginId: z.string().min(1),
});

export const buyerListQuerySchema = z.object({
  q: z.string().trim().optional(),
  type: buyerTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditListQuerySchema = z.object({
  entityType: z.enum(["buyer", "product"]).optional(),
  entityId: z.coerce.number().int().optional(),
  operator: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(50),
});

export const productStatusUpdateSchema = z
  .object({
    status: z.enum(PRODUCT_STATUS_VALUES),
  })
  .strict();

export type ProductStatusUpdate = z.infer<typeof productStatusUpdateSchema>;

export const productListQuerySchema = z.object({
  q: z.string().trim().min(2, "검색어는 2글자 이상").optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
