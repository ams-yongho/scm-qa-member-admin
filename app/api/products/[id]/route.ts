import { NextRequest, NextResponse } from "next/server";
import { prismaSym } from "@/lib/db/sym";
import { env } from "@/lib/env";
import { withAudit } from "@/app/api/_lib/audit";
import { getOperator } from "@/app/api/_lib/operator";
import { productStatusUpdateSchema } from "@/app/api/_lib/schemas";
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
    const product = await prismaSym.product.findUnique({
      where: { id },
      select: {
        id: true,
        part_number: true,
        sales_status: true,
        scope: true,
        thumbnail: true,
        created_at: true,
        updated_at: true,
        product_partsfit: {
          select: {
            id: true,
            mall_product_code: true,
            product_name: true,
            status: true,
            quantity: true,
            price: true,
            display_at: true,
            selling_at: true,
            updated_at: true,
          },
        },
      },
    });
    if (!product) return notFound("Product not found");

    return NextResponse.json({
      ...product,
      product_partsfit: product.product_partsfit
        ? { ...product.product_partsfit, price: product.product_partsfit.price?.toString() ?? null }
        : null,
    });
  } catch (err) {
    console.error("[GET /api/products/:id]", err);
    return serverError("Failed to fetch product");
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

  const parsed = productStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);
  const { status } = parsed.data;

  try {
    const product = await prismaSym.product.findUnique({
      where: { id },
      select: {
        scope: true,
        part_number: true,
        product_partsfit: {
          select: { id: true, status: true, mall_product_code: true },
        },
      },
    });
    if (!product) return notFound("Product not found");
    if (product.scope !== "PARTSFIT") return forbidden("partsfit 상품만 변경할 수 있습니다");
    if (!product.product_partsfit) return notFound("product_partsfit row not found");
    if (product.product_partsfit.status === status) {
      return badRequest("이미 해당 상태입니다");
    }

    const partsfitId = product.product_partsfit.id;
    const entityLabel =
      product.product_partsfit.mall_product_code ?? product.part_number ?? String(id);

    const result = await withAudit({
      action: "product.statusUpdate",
      entityType: "product",
      entityId: id,
      entityLabel,
      operator,
      snapshot: () =>
        prismaSym.product_partsfit.findUnique({ where: { id: partsfitId } }),
      mutate: () =>
        prismaSym.product_partsfit.update({
          where: { id: partsfitId },
          data: { status, updated_at: new Date() },
        }),
    });

    const res = NextResponse.json({
      ...result.data,
      price: result.data.price?.toString() ?? null,
    });
    if (result.auditFailed) res.headers.set("X-Audit-Failed", "true");
    return res;
  } catch (err) {
    console.error("[PATCH /api/products/:id]", err);
    return serverError(err instanceof Error ? err.message : "Status update failed");
  }
}
