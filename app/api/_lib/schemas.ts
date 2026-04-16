import { z } from "zod";

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
  buyerId: z.coerce.number().int().optional(),
  operator: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(50),
});
