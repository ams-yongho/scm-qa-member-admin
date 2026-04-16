import { prismaSym } from "@/lib/db/sym";
import { prismaAudit } from "@/lib/db/audit";

export type AuditAction = "buyer.update" | "buyer.delete";

interface WithAuditOptions<T> {
  action: AuditAction;
  buyerId: number;
  operator: string;
  mutate: () => Promise<T>;
}

interface AuditResult<T> {
  data: T;
  auditFailed: boolean;
}

/**
 * Wraps a sym DB mutation with audit logging.
 * - snapshot buyer BEFORE mutation
 * - run mutation
 * - snapshot buyer AFTER mutation (null for delete)
 * - insert audit row
 *
 * Distributed transaction is impossible (two DBs). Mutation success is
 * preserved even if audit insert fails — caller should surface the failure
 * via response header so the UI can warn.
 */
export async function withAudit<T>({
  action,
  buyerId,
  operator,
  mutate,
}: WithAuditOptions<T>): Promise<AuditResult<T>> {
  const before = await prismaSym.partsfit_mall_buyer.findUnique({
    where: { id: buyerId },
  });
  if (!before) {
    throw new Error(`buyer ${buyerId} not found`);
  }

  const data = await mutate();

  const after =
    action === "buyer.delete"
      ? null
      : await prismaSym.partsfit_mall_buyer.findUnique({
          where: { id: buyerId },
        });

  let auditFailed = false;
  try {
    await prismaAudit.auditLog.create({
      data: {
        operator,
        action,
        buyerId,
        buyerLoginId: before.login_id ?? "",
        before: JSON.stringify(before, replacer),
        after: after ? JSON.stringify(after, replacer) : null,
      },
    });
  } catch (err) {
    auditFailed = true;
    console.error("[audit] insert failed", err);
  }

  return { data, auditFailed };
}

// Prisma returns Date objects and bigints; serialize cleanly.
function replacer(_key: string, value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}
