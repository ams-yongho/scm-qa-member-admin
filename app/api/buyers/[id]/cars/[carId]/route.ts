import { NextRequest, NextResponse } from "next/server";
import { prismaSym } from "@/lib/db/sym";
import { env } from "@/lib/env";
import { insertAuditLog } from "@/app/api/_lib/audit";
import { getOperator } from "@/app/api/_lib/operator";
import {
  badRequest,
  forbidden,
  notFound,
  preconditionFailed,
  serverError,
} from "@/app/api/_lib/responses";

export const dynamic = "force-dynamic";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * DELETE /api/buyers/[id]/cars/[carId]
 * Soft-delete: sets deleted_at = now()
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; carId: string }> },
) {
  if (env.READ_ONLY) return forbidden("Server is in read-only mode");

  const { id: buyerIdStr, carId: carIdStr } = await ctx.params;
  const buyerId = parseId(buyerIdStr);
  const carId = parseId(carIdStr);
  if (!buyerId) return badRequest("Invalid buyer id");
  if (!carId) return badRequest("Invalid car id");

  const operator = await getOperator();
  if (!operator) return preconditionFailed("Operator name not set");

  try {
    // Verify buyer exists and get login_id for audit
    const buyer = await prismaSym.partsfit_mall_buyer.findUnique({
      where: { id: buyerId },
      select: { id: true, login_id: true },
    });
    if (!buyer) return notFound("Buyer not found");

    // Verify car belongs to this buyer and is not already soft-deleted
    const car = await prismaSym.partsfit_mall_buyer_car.findFirst({
      where: { id: carId, buyer_id: buyerId, deleted_at: null },
    });
    if (!car) return notFound("Car not found or already deleted");

    // Soft-delete
    const updated = await prismaSym.partsfit_mall_buyer_car.update({
      where: { id: carId },
      data: { deleted_at: new Date() },
    });

    // Audit log
    const auditOk = await insertAuditLog({
      operator,
      action: "car.softDelete",
      buyerId,
      buyerLoginId: buyer.login_id ?? "",
      before: car,
      after: updated,
    });

    const res = NextResponse.json({ ok: true, carId, deletedAt: updated.deleted_at });
    if (!auditOk) res.headers.set("X-Audit-Failed", "true");
    return res;
  } catch (err) {
    console.error("[DELETE /api/buyers/:id/cars/:carId]", err);
    return serverError(err instanceof Error ? err.message : "Car soft-delete failed");
  }
}
