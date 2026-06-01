import { prismaAudit } from "@/lib/db/audit";

export type AuditAction =
  | "buyer.update"
  | "buyer.delete"
  | "car.softDelete"
  | "product.statusUpdate";

export type EntityType = "buyer" | "product";

interface WithAuditOptions<T, R> {
  action: AuditAction;
  entityType: EntityType;
  entityId: number;
  entityLabel: string;
  operator?: string;
  /** before/after 스냅샷을 캡처하는 함수. mutate 전후로 호출된다. */
  snapshot: () => Promise<T | null>;
  /** 실제 sym DB 변경. 반환값이 호출자에게 전달된다. */
  mutate: () => Promise<R>;
  /** false면 after를 캡처하지 않고 null로 기록 (삭제). 기본 true. */
  captureAfter?: boolean;
}

interface AuditResult<R> {
  data: R;
  auditFailed: boolean;
}

/**
 * sym DB mutation을 audit 로깅으로 감싼다.
 * - snapshot()으로 before 캡처
 * - mutate() 실행
 * - captureAfter면 snapshot()으로 after 캡처 (삭제는 null)
 * - audit row insert
 *
 * 두 DB라 분산 트랜잭션 불가. audit insert 실패해도 mutation 성공은 보존하고
 * auditFailed=true로 알린다 (호출자가 응답 헤더로 노출).
 */
export async function withAudit<T, R>({
  action,
  entityType,
  entityId,
  entityLabel,
  operator,
  snapshot,
  mutate,
  captureAfter = true,
}: WithAuditOptions<T, R>): Promise<AuditResult<R>> {
  const before = await snapshot();
  const data = await mutate();
  const after = captureAfter ? await snapshot() : null;

  const auditFailed = !(await insertAuditLog({
    operator: operator ?? "",
    action,
    entityType,
    entityId,
    entityLabel,
    before,
    after,
  }));

  return { data, auditFailed };
}

/**
 * 범용 audit insert. before/after 스냅샷을 호출자가 직접 제공.
 * 성공 시 true, 실패 시 false (예외 삼킴).
 */
export async function insertAuditLog(opts: {
  operator: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: number;
  entityLabel: string;
  before: unknown;
  after: unknown | null;
}): Promise<boolean> {
  try {
    await prismaAudit.auditLog.create({
      data: {
        operator: opts.operator,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        entityLabel: opts.entityLabel,
        before: JSON.stringify(opts.before, replacer),
        after: opts.after != null ? JSON.stringify(opts.after, replacer) : null,
      },
    });
    return true;
  } catch (err) {
    console.error("[audit] insert failed", err);
    return false;
  }
}

// Prisma는 Date/bigint/Decimal 객체를 반환 — 깔끔히 직렬화.
function replacer(_key: string, value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}
