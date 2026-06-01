import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/db/sym/client";
import { prismaSym } from "@/lib/db/sym";
import { productListQuerySchema } from "@/app/api/_lib/schemas";
import { fromZodError, serverError } from "@/app/api/_lib/responses";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = productListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) return fromZodError(parsed.error);

  const { q, includeDeleted, page, size } = parsed.data;

  // 검색어 없으면 빈 결과 (33만 건 전체 노출 방지)
  if (!q) {
    return NextResponse.json({ items: [], total: 0, page, size });
  }

  const where: Prisma.productWhereInput = { scope: "PARTSFIT" };
  if (!includeDeleted) where.sales_status = { not: "DELETE" };

  const idNum = /^\d+$/.test(q) ? Number(q) : null;
  where.OR = [
    { part_number: { contains: q } },
    { product_partsfit: { is: { mall_product_code: { contains: q } } } },
    { product_partsfit: { is: { product_name: { contains: q } } } },
    ...(idNum ? [{ id: idNum }] : []),
  ];

  try {
    const [total, rows] = await Promise.all([
      prismaSym.product.count({ where }),
      prismaSym.product.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
        select: {
          id: true,
          part_number: true,
          sales_status: true,
          thumbnail: true,
          product_partsfit: {
            select: {
              mall_product_code: true,
              product_name: true,
              status: true,
              quantity: true,
              price: true,
            },
          },
        },
      }),
    ]);

    // 평탄화: 클라이언트가 쓰기 쉬운 형태
    const items = rows.map((r) => ({
      id: r.id,
      part_number: r.part_number,
      sales_status: r.sales_status,
      thumbnail: r.thumbnail,
      mall_product_code: r.product_partsfit?.mall_product_code ?? null,
      product_name: r.product_partsfit?.product_name ?? null,
      status: r.product_partsfit?.status ?? null,
      quantity: r.product_partsfit?.quantity ?? null,
      price: r.product_partsfit?.price?.toString() ?? null,
    }));

    return NextResponse.json({ items, total, page, size });
  } catch (err) {
    console.error("[GET /api/products]", err);
    return serverError("Failed to query products");
  }
}
