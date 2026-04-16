import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/db/sym/client";
import { prismaSym } from "@/lib/db/sym";
import { buyerListQuerySchema } from "@/app/api/_lib/schemas";
import { fromZodError, serverError } from "@/app/api/_lib/responses";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = buyerListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) return fromZodError(parsed.error);

  const { q, type, page, size } = parsed.data;

  const where: Prisma.partsfit_mall_buyerWhereInput = {};
  if (type) where.type = type;
  if (q) {
    where.OR = [
      { login_id: { contains: q } },
      { email: { contains: q } },
      { phone_number: { contains: q } },
      { name: { contains: q } },
    ];
  }

  try {
    const [total, items] = await Promise.all([
      prismaSym.partsfit_mall_buyer.count({ where }),
      prismaSym.partsfit_mall_buyer.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
        select: {
          id: true,
          type: true,
          login_id: true,
          name: true,
          email: true,
          phone_number: true,
          status: true,
          created_at: true,
        },
      }),
    ]);

    return NextResponse.json({ items, total, page, size });
  } catch (err) {
    console.error("[GET /api/buyers]", err);
    return serverError("Failed to query buyers");
  }
}
