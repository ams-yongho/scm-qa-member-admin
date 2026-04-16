import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/db/audit/client";
import { prismaAudit } from "@/lib/db/audit";
import { auditListQuerySchema } from "@/app/api/_lib/schemas";
import { fromZodError, serverError } from "@/app/api/_lib/responses";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = auditListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) return fromZodError(parsed.error);

  const { buyerId, operator, page, size } = parsed.data;

  const where: Prisma.AuditLogWhereInput = {};
  if (buyerId) where.buyerId = buyerId;
  if (operator) where.operator = { contains: operator };

  try {
    const [total, items] = await Promise.all([
      prismaAudit.auditLog.count({ where }),
      prismaAudit.auditLog.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return NextResponse.json({ items, total, page, size });
  } catch (err) {
    console.error("[GET /api/audit]", err);
    return serverError("Failed to query audit log");
  }
}
