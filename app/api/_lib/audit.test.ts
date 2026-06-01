import { describe, it, expect, vi, beforeEach } from "vitest";

// prismaAudit를 모킹: auditLog.create만 사용
const createMock = vi.fn();
vi.mock("@/lib/db/audit", () => ({
  prismaAudit: { auditLog: { create: (args: unknown) => createMock(args) } },
}));
// prismaSym은 헬퍼가 더 이상 직접 쓰지 않아야 하므로 빈 객체
vi.mock("@/lib/db/sym", () => ({ prismaSym: {} }));

import { withAudit, insertAuditLog } from "./audit";

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ id: 1 });
});

describe("withAudit", () => {
  it("snapshot을 before/after로 캡처하고 entity 필드로 audit를 기록한다", async () => {
    let n = 0;
    const snapshot = vi.fn(async () => ({ status: n++ === 0 ? "SALE" : "STOP" }));
    const mutate = vi.fn(async () => ({ ok: true }));

    const result = await withAudit({
      action: "product.statusUpdate",
      entityType: "product",
      entityId: 42,
      entityLabel: "MALL-1",
      snapshot,
      mutate,
    });

    expect(mutate).toHaveBeenCalledOnce();
    expect(snapshot).toHaveBeenCalledTimes(2); // before + after
    expect(result.data).toEqual({ ok: true });
    expect(result.auditFailed).toBe(false);

    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.entityType).toBe("product");
    expect(arg.data.entityId).toBe(42);
    expect(arg.data.entityLabel).toBe("MALL-1");
    expect(arg.data.action).toBe("product.statusUpdate");
    expect(JSON.parse(arg.data.before as string)).toEqual({ status: "SALE" });
    expect(JSON.parse(arg.data.after as string)).toEqual({ status: "STOP" });
  });

  it("captureAfter=false면 after를 null로 기록한다 (삭제)", async () => {
    const snapshot = vi.fn(async () => ({ id: 1 }));
    const mutate = vi.fn(async () => ({ deleted: true }));

    await withAudit({
      action: "buyer.delete",
      entityType: "buyer",
      entityId: 7,
      entityLabel: "user@x.com",
      snapshot,
      mutate,
      captureAfter: false,
    });

    expect(snapshot).toHaveBeenCalledOnce(); // before만
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.after).toBeNull();
  });

  it("audit insert 실패 시에도 mutation 결과는 보존하고 auditFailed=true", async () => {
    createMock.mockRejectedValueOnce(new Error("disk full"));
    const result = await withAudit({
      action: "buyer.update",
      entityType: "buyer",
      entityId: 1,
      entityLabel: "x",
      snapshot: async () => ({ a: 1 }),
      mutate: async () => ({ done: true }),
    });
    expect(result.data).toEqual({ done: true });
    expect(result.auditFailed).toBe(true);
  });
});

describe("insertAuditLog", () => {
  it("주어진 before/after로 audit를 기록하고 true 반환", async () => {
    const ok = await insertAuditLog({
      operator: "kim",
      action: "car.softDelete",
      entityType: "buyer",
      entityId: 5,
      entityLabel: "u5",
      before: { id: 9 },
      after: { id: 9, deleted_at: "x" },
    });
    expect(ok).toBe(true);
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.entityType).toBe("buyer");
    expect(arg.data.entityId).toBe(5);
    expect(arg.data.entityLabel).toBe("u5");
  });

  it("insert 실패 시 false 반환", async () => {
    createMock.mockRejectedValueOnce(new Error("x"));
    const ok = await insertAuditLog({
      operator: "kim",
      action: "car.softDelete",
      entityType: "buyer",
      entityId: 5,
      entityLabel: "u5",
      before: {},
      after: null,
    });
    expect(ok).toBe(false);
  });
});
