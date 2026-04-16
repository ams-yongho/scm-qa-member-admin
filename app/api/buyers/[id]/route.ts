import { NextRequest, NextResponse } from "next/server";
import { prismaSym } from "@/lib/db/sym";
import { env } from "@/lib/env";
import { withAudit } from "@/app/api/_lib/audit";
import { getOperator } from "@/app/api/_lib/operator";
import { buyerUpdateSchema, buyerDeleteSchema } from "@/app/api/_lib/schemas";
import {
  badRequest,
  forbidden,
  fromZodError,
  notFound,
  preconditionFailed,
  serverError,
} from "@/app/api/_lib/responses";

export const dynamic = "force-dynamic";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (!id) return badRequest("Invalid id");

  try {
    const buyer = await prismaSym.partsfit_mall_buyer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            partsfit_mall_buyer_oauth: true,
            partsfit_mall_buyer_address: true,
            partsfit_mall_buyer_car: true,
          },
        },
        partsfit_mall_buyer_oauth: { select: { provider: true } },
      },
    });
    if (!buyer) return notFound("Buyer not found");
    return NextResponse.json(buyer);
  } catch (err) {
    console.error("[GET /api/buyers/:id]", err);
    return serverError("Failed to fetch buyer");
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (env.READ_ONLY) return forbidden("Server is in read-only mode");

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (!id) return badRequest("Invalid id");

  const operator = await getOperator();
  if (!operator) return preconditionFailed("Operator name not set");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = buyerUpdateSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  // car_unlimited=true → clear max_car_limit by convention
  const data = { ...parsed.data };
  if (data.car_unlimited === true) data.max_car_limit = null;

  try {
    const result = await withAudit({
      action: "buyer.update",
      buyerId: id,
      operator,
      mutate: () =>
        prismaSym.partsfit_mall_buyer.update({
          where: { id },
          data,
        }),
    });

    const res = NextResponse.json(result.data);
    if (result.auditFailed) res.headers.set("X-Audit-Failed", "true");
    return res;
  } catch (err) {
    console.error("[PATCH /api/buyers/:id]", err);
    const message = err instanceof Error ? err.message : "Update failed";
    if (message.includes("not found")) return notFound("Buyer not found");
    return serverError(message);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (env.READ_ONLY) return forbidden("Server is in read-only mode");

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (!id) return badRequest("Invalid id");

  const operator = await getOperator();
  if (!operator) return preconditionFailed("Operator name not set");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = buyerDeleteSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  const buyer = await prismaSym.partsfit_mall_buyer.findUnique({
    where: { id },
    select: { id: true, login_id: true },
  });
  if (!buyer) return notFound("Buyer not found");

  if (parsed.data.confirmLoginId !== (buyer.login_id ?? "")) {
    return badRequest("confirmLoginId does not match buyer.login_id");
  }

  try {
    const result = await withAudit({
      action: "buyer.delete",
      buyerId: id,
      operator,
      mutate: () =>
        prismaSym.$transaction(async (tx) => {
          // Manual cleanup: withdraw has no FK
          await tx.partsfit_mall_buyer_withdraw.deleteMany({ where: { buyer_id: id } });
          // CASCADE handles oauth/address/car
          return tx.partsfit_mall_buyer.delete({ where: { id } });
        }),
    });

    const res = NextResponse.json({ ok: true, deletedId: id });
    if (result.auditFailed) res.headers.set("X-Audit-Failed", "true");
    return res;
  } catch (err) {
    console.error("[DELETE /api/buyers/:id]", err);
    return serverError(err instanceof Error ? err.message : "Delete failed");
  }
}
