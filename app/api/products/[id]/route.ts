import { NextRequest, NextResponse } from "next/server";
import { prismaSym } from "@/lib/db/sym";
import { badRequest, notFound, serverError } from "@/app/api/_lib/responses";

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
