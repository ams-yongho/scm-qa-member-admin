# 상품 판매 상태 변경 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** QA가 partsfit 상품의 판매 상태(`product_partsfit.status`, 7종)를 단건으로 직접 변경할 수 있는 셀프서비스 화면을 추가하고, 그 전제로 audit 로그를 엔티티 범용으로 일반화한다.

**Architecture:** 기존 회원 도구의 패턴을 그대로 재사용한다 — Next.js 15 App Router API routes(`/api/products`), react-query 클라이언트, staging sym DB 직접 쓰기(Prisma), 모든 mutation은 별도 SQLite audit DB에 기록. `product_partsfit.status` 단일 컬럼만 변경하며 부수효과(cafe24/ES/SQS)는 호출하지 않는다.

**Tech Stack:** Next.js 15, TypeScript, Prisma 5.22 (MySQL sym + SQLite audit), TanStack Query/Table, react-hook-form + Zod, shadcn/ui, vitest 2.1.5, pnpm.

---

## 참고: 사전 지식 (구현자가 반드시 알아야 할 코드베이스 사실)

- **두 Prisma 스키마**: `prisma/sym/schema.prisma`(MySQL, read/write, 운영 DB라 절대 `migrate`/`push` 금지 — 손으로 모델만 추가), `prisma/audit/schema.prisma`(SQLite, 이 앱 소유, `prisma db push`로 반영).
- **생성 클라이언트 출력 경로**: sym → `lib/db/sym/client`, audit → `lib/db/audit/client`. 래퍼 `lib/db/sym/index.ts`(export `prismaSym`), `lib/db/audit/index.ts`(export `prismaAudit`)는 **git에 추적되지 않음**(Task 0에서 생성).
- **경로 alias**: `@/` → 프로젝트 루트.
- **응답 헬퍼**: `app/api/_lib/responses.ts` — `badRequest/notFound/forbidden/preconditionFailed/serverError/fromZodError`.
- **operator**: `app/api/_lib/operator.ts` — 쿠키 `operator` 값(사람 이름 문자열). mutation 전 필수.
- **가드**: `lib/env.ts` — `env.READ_ONLY`(true면 mutation 차단), staging 호스트 가드(boot 시).
- **audit 정책**: sym 쓰기 성공 + audit 쓰기 실패 시 → mutation은 성공으로 두고 응답 헤더 `X-Audit-Failed: true`로 알림. 클라이언트는 `res.headers["x-audit-failed"] === "true"` 확인.
- **DB 규모**: `product` 테이블 약 33만 건. 검색어 없이 전체 노출 금지.
- **상태 값** (`product_partsfit.status`, varchar50). QA 노출 7종: `SALE`(판매중), `STOP`(판매중지), `SOLD_OUT`(품절), `ONSITE`(현장판매), `READY`(판매준비), `EXAMINE`(검토), `REJECT`(반려).

---

## File Structure

**생성(Create):**
- `vitest.config.ts` — 테스트 러너 설정(현재 없음)
- `lib/db/sym/index.ts`, `lib/db/audit/index.ts` — Prisma 래퍼(미추적, Task 0에서 복원)
- `app/api/_lib/status.ts` — 상품 상태 enum/라벨/색상 단일 출처
- `app/api/_lib/status.test.ts`, `app/api/_lib/audit.test.ts`, `app/api/_lib/schemas.test.ts` — 단위 테스트
- `app/api/products/route.ts` — 목록 검색
- `app/api/products/[id]/route.ts` — 상세 + 상태 변경(PATCH)
- `lib/queries/products.ts` — react-query 훅
- `app/products/page.tsx`
- `app/products/_components/product-search-form.tsx`
- `app/products/_components/product-table.tsx`
- `app/products/_components/product-status-sheet.tsx`

**수정(Modify):**
- `prisma/audit/schema.prisma` — AuditLog 일반화
- `prisma/sym/schema.prisma` — product / product_partsfit 모델 추가
- `app/api/_lib/audit.ts` — withAudit/insertAuditLog 일반화
- `app/api/_lib/schemas.ts` — productStatusUpdateSchema 추가, auditListQuerySchema 일반화
- `app/api/buyers/[id]/route.ts`, `app/api/buyers/[id]/cars/[carId]/route.ts` — 새 audit 시그니처로 이전
- `app/api/audit/route.ts` — entityType/entityId 필터
- `lib/queries/audit.ts` — 타입 일반화
- `app/audit/page.tsx`, `app/audit/_components/audit-detail-sheet.tsx` — entityType UI
- `app/_components/top-nav.tsx` — 상품 관리 탭

---

## Task 0: 워크트리 환경 셋업 & 베이스라인

이 워크트리에는 `node_modules`와 `lib/db`(미추적 래퍼)가 없어 빌드/테스트가 불가능하다. 먼저 복구한다.

**Files:**
- Create: `lib/db/sym/index.ts`
- Create: `lib/db/audit/index.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: 의존성 설치**

Run: `pnpm install`
Expected: 설치 완료(경고 무관), exit 0.

- [ ] **Step 2: audit DB가 가리킬 데이터 디렉터리 확인 / .env.local 복사**

Run:
```bash
test -f .env.local || cp /Users/yonghokim/Documents/GitHub/amass/scm-qa-member-admin/.env.local .env.local
mkdir -p data
grep -c staging .env.local
```
Expected: `.env.local` 존재, `SYM_DATABASE_URL`에 "staging" 포함(출력 ≥1). (자격증명은 절대 출력/커밋 금지)

- [ ] **Step 3: Prisma 래퍼 파일 생성 (`lib/db/sym/index.ts`)**

```ts
import { env } from "@/lib/env";
import { PrismaClient } from "./client";

const globalForPrisma = globalThis as unknown as { prismaSym: PrismaClient };

export const prismaSym =
  globalForPrisma.prismaSym ??
  new PrismaClient({
    datasources: { db: { url: env.SYM_DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaSym = prismaSym;
```

- [ ] **Step 4: Prisma 래퍼 파일 생성 (`lib/db/audit/index.ts`)**

```ts
import { env } from "@/lib/env";
import { PrismaClient } from "./client";

const globalForPrisma = globalThis as unknown as { prismaAudit: PrismaClient };

export const prismaAudit =
  globalForPrisma.prismaAudit ??
  new PrismaClient({
    datasources: { db: { url: env.AUDIT_DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaAudit = prismaAudit;
```

- [ ] **Step 5: Prisma 클라이언트 생성**

Run: `pnpm prisma:generate`
Expected: sym + audit 두 클라이언트 생성 완료(`lib/db/sym/client`, `lib/db/audit/client` 존재).

- [ ] **Step 6: audit SQLite DB 생성/동기화**

Run: `pnpm prisma:push:audit`
Expected: `data/audit.db` 생성, "Your database is now in sync" 류 메시지.

- [ ] **Step 7: vitest 설정 생성 (`vitest.config.ts`)**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
```

- [ ] **Step 8: 베이스라인 검증 (빌드/린트)**

Run: `pnpm lint && pnpm test --run`
Expected: 린트 통과. 테스트는 "no test files found"(테스트 아직 없음) — 정상. 빌드 가능 상태 확인을 위해 `pnpm build`는 sym DB 연결이 필요하므로 생략하고, 타입 체크만: `pnpm exec tsc --noEmit` → 에러 0.

- [ ] **Step 9: Commit**

```bash
git add lib/db/sym/index.ts lib/db/audit/index.ts vitest.config.ts
git commit -m "chore: 워크트리 환경 셋업 (prisma 래퍼 + vitest 설정)"
```

---

## Task 1: AuditLog 스키마 일반화 (1단계 — 새 컬럼 추가, 구 컬럼 nullable)

구 컬럼을 nullable로 바꿔 헬퍼 이전과 데이터 백필을 디커플링한다. 이 단계 후에도 앱은 컴파일된다(새 필드는 optional, 구 필드 유지).

**Files:**
- Modify: `prisma/audit/schema.prisma`

- [ ] **Step 1: AuditLog 모델 교체**

`prisma/audit/schema.prisma`의 `model AuditLog { ... }` 블록을 아래로 교체:

```prisma
model AuditLog {
  id           Int      @id @default(autoincrement())
  createdAt    DateTime @default(now())
  operator     String
  action       String // "buyer.update" | "buyer.delete" | "car.softDelete" | "product.statusUpdate"
  // 신규(일반화) 필드 — 1단계에서는 nullable, Task 2 백필 후 Task 6에서 required 전환
  entityType   String? // "buyer" | "product"
  entityId     Int?
  entityLabel  String?
  // 구 필드 — Task 2 백필 소스, Task 6에서 제거
  buyerId      Int?
  buyerLoginId String?
  before       String // JSON snapshot before mutation
  after        String? // JSON snapshot after mutation; null for delete

  @@index([entityType, entityId])
  @@index([buyerId])
  @@index([createdAt])
}
```

- [ ] **Step 2: audit DB에 반영 + 클라이언트 재생성**

Run: `pnpm prisma:push:audit && pnpm prisma:generate`
Expected: 컬럼 추가 성공. 기존 행 보존(새 컬럼은 NULL). 데이터 손실 경고 없음.

- [ ] **Step 3: 타입 체크 (앱 여전히 컴파일되는지)**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0 (기존 코드는 buyerId/buyerLoginId를 계속 사용, 둘 다 아직 존재).

- [ ] **Step 4: Commit**

```bash
git add prisma/audit/schema.prisma
git commit -m "feat(audit): entityType/entityId/entityLabel 컬럼 추가 (구 컬럼 nullable화)"
```

---

## Task 2: 기존 buyer audit 행 백필

**Files:** (코드 변경 없음 — 데이터 마이그레이션)

- [ ] **Step 1: 백필 SQL 실행 (prisma db execute)**

Run:
```bash
echo 'UPDATE "AuditLog" SET "entityType" = '"'"'buyer'"'"', "entityId" = "buyerId", "entityLabel" = COALESCE("buyerLoginId", '"'"''"'"') WHERE "entityType" IS NULL;' \
  | pnpm prisma db execute --schema=prisma/audit/schema.prisma --stdin
```
Expected: 실행 성공(exit 0).

- [ ] **Step 2: 백필 검증**

Run:
```bash
echo 'SELECT COUNT(*) AS unfilled FROM "AuditLog" WHERE "entityType" IS NULL OR "entityId" IS NULL;' \
  | pnpm prisma db execute --schema=prisma/audit/schema.prisma --stdin
```
Expected: 명령 성공. (행이 있었다면 unfilled=0이어야 함. db execute가 결과를 출력하지 않으면 다음 보조 검증 사용.)

보조 검증 — 스크립트로 카운트 확인:
```bash
node --input-type=module -e '
import { createRequire } from "module";
const require = createRequire(import.meta.url);
process.env.AUDIT_DATABASE_URL ||= "file:./data/audit.db";
const { PrismaClient } = require("./lib/db/audit/client");
const p = new PrismaClient();
const bad = await p.auditLog.count({ where: { OR: [{ entityType: null }, { entityId: null }] } });
const total = await p.auditLog.count();
console.log(JSON.stringify({ total, unfilled: bad }));
await p.$disconnect();
if (bad > 0) process.exit(1);
'
```
Expected: `{"total":N,"unfilled":0}` (N≥0). exit 0.

- [ ] **Step 3: Commit** (데이터 변경이라 커밋할 코드 없음 — 빈 커밋으로 마일스톤 표시)

```bash
git commit --allow-empty -m "chore(audit): 기존 buyer 행 entityType=buyer 백필 완료"
```

---

## Task 3: withAudit / insertAuditLog 헬퍼 일반화 (TDD)

헬퍼에서 buyer 종속(내부 `partsfit_mall_buyer` 조회)을 제거하고, 호출자가 스냅샷·라벨을 주입하는 범용 형태로 바꾼다.

**Files:**
- Test: `app/api/_lib/audit.test.ts`
- Modify: `app/api/_lib/audit.ts`

- [ ] **Step 1: 실패하는 테스트 작성 (`app/api/_lib/audit.test.ts`)**

```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test --run app/api/_lib/audit.test.ts`
Expected: FAIL — 새 시그니처(`snapshot`, `entityType` 등)가 아직 없어 타입/런타임 에러.

- [ ] **Step 3: `app/api/_lib/audit.ts` 전체 교체**

```ts
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
```

> 참고: `withAudit`는 더 이상 `operator`를 직접 받지 않아도 동작하지만, 호출자가 operator를 넘기면 기록한다. 기존 buyer 호출자는 operator를 넘기므로 유지된다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test --run app/api/_lib/audit.test.ts`
Expected: PASS (7개 테스트 모두 통과).

- [ ] **Step 5: Commit**

```bash
git add app/api/_lib/audit.ts app/api/_lib/audit.test.ts
git commit -m "feat(audit): withAudit/insertAuditLog 엔티티 범용화 + 단위 테스트"
```

---

## Task 4: 기존 buyer 호출자를 새 audit 시그니처로 이전

**Files:**
- Modify: `app/api/buyers/[id]/route.ts`
- Modify: `app/api/buyers/[id]/cars/[carId]/route.ts`

- [ ] **Step 1: `app/api/buyers/[id]/route.ts` PATCH 핸들러의 withAudit 호출부 교체**

기존 PATCH 내 `try { const result = await withAudit({ ... }) ... }` 블록을 아래로 교체:

```ts
  try {
    const existing = await prismaSym.partsfit_mall_buyer.findUnique({
      where: { id },
      select: { login_id: true },
    });
    if (!existing) return notFound("Buyer not found");

    const result = await withAudit({
      action: "buyer.update",
      entityType: "buyer",
      entityId: id,
      entityLabel: existing.login_id ?? "",
      operator,
      snapshot: () => prismaSym.partsfit_mall_buyer.findUnique({ where: { id } }),
      mutate: () => prismaSym.partsfit_mall_buyer.update({ where: { id }, data }),
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
```

- [ ] **Step 2: 같은 파일 DELETE 핸들러의 withAudit 호출부 교체**

기존 DELETE 내 `const result = await withAudit({ action: "buyer.delete", ... })` 호출을 아래로 교체(주변 try/catch·confirmLoginId 검증은 유지):

```ts
    const result = await withAudit({
      action: "buyer.delete",
      entityType: "buyer",
      entityId: id,
      entityLabel: buyer.login_id ?? "",
      operator,
      captureAfter: false,
      snapshot: () => prismaSym.partsfit_mall_buyer.findUnique({ where: { id } }),
      mutate: () =>
        prismaSym.$transaction(async (tx) => {
          await tx.partsfit_mall_buyer_withdraw.deleteMany({ where: { buyer_id: id } });
          return tx.partsfit_mall_buyer.delete({ where: { id } });
        }),
    });
```

- [ ] **Step 3: `app/api/buyers/[id]/cars/[carId]/route.ts`의 insertAuditLog 호출부 교체**

기존 `const auditOk = await insertAuditLog({ ... })` 호출을 아래로 교체:

```ts
    const auditOk = await insertAuditLog({
      operator,
      action: "car.softDelete",
      entityType: "buyer",
      entityId: buyerId,
      entityLabel: buyer.login_id ?? "",
      before: car,
      after: updated,
    });
```

- [ ] **Step 4: 타입 체크 + 회귀(audit 테스트)**

Run: `pnpm exec tsc --noEmit && pnpm test --run`
Expected: 타입 에러 0, audit 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/buyers
git commit -m "refactor(buyers): audit 호출을 entity 범용 시그니처로 이전"
```

---

## Task 5: audit 목록 API·쿼리·UI를 entityType 기준으로 일반화

**Files:**
- Modify: `app/api/_lib/schemas.ts`
- Modify: `app/api/audit/route.ts`
- Modify: `lib/queries/audit.ts`
- Modify: `app/audit/page.tsx`
- Modify: `app/audit/_components/audit-detail-sheet.tsx`

- [ ] **Step 1: `app/api/_lib/schemas.ts`의 `auditListQuerySchema` 교체**

```ts
export const auditListQuerySchema = z.object({
  entityType: z.enum(["buyer", "product"]).optional(),
  entityId: z.coerce.number().int().optional(),
  operator: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(50),
});
```

- [ ] **Step 2: `app/api/audit/route.ts` where 절 교체**

`const { buyerId, operator, page, size } = parsed.data;` 이후 where 구성 블록을 교체:

```ts
  const { entityType, entityId, operator, page, size } = parsed.data;

  const where: Prisma.AuditLogWhereInput = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (operator) where.operator = { contains: operator };
```

- [ ] **Step 3: `lib/queries/audit.ts`의 `AuditLogItem`·`AuditFilters` 교체**

`AuditLogItem` 인터페이스의 `buyerId`/`buyerLoginId` 두 필드를 아래로 교체:

```ts
  entityType: string;
  entityId: number;
  entityLabel: string;
```

`AuditFilters` 인터페이스를 교체:

```ts
export interface AuditFilters {
  entityType?: "buyer" | "product";
  entityId?: number;
  operator?: string;
  page?: number;
  size?: number;
}
```

- [ ] **Step 4: `app/audit/page.tsx` 필터/컬럼 일반화**

(a) `buyerIdInput` state를 `entityIdInput`으로, filters state 타입을 `{ operator?: string; entityType?: "buyer" | "product"; entityId?: number }`로 변경.
(b) `submit` 핸들러를 아래로 교체:

```ts
  const [entityType, setEntityType] = React.useState<"buyer" | "product" | "">("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = entityIdInput.trim() ? Number(entityIdInput.trim()) : undefined;
    setFilters({
      operator: operatorInput.trim() || undefined,
      entityType: entityType || undefined,
      entityId: idNum && Number.isInteger(idNum) ? idNum : undefined,
    });
    setPage(1);
  };
```

(c) 검색 폼에 엔티티 종류 Select 추가(operator 입력 옆). 기존 `import { Select, ... }`는 members 페이지와 동일하게 추가:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

폼 내부 buyerId Input을 아래 두 컨트롤로 교체:

```tsx
        <Select
          value={entityType === "" ? "__all__" : entityType}
          onValueChange={(v) => setEntityType(v === "__all__" ? "" : (v as "buyer" | "product"))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="전체 종류" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">전체 종류</SelectItem>
            <SelectItem value="buyer">회원</SelectItem>
            <SelectItem value="product">상품</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={entityIdInput}
          onChange={(e) => setEntityIdInput(e.target.value)}
          placeholder="entity id"
          className="w-32"
          type="number"
          min={1}
        />
```

(d) 테이블 헤더/행의 `buyer id`/`buyer login_id` 컬럼을 교체:

헤더:
```tsx
              <TableHead className="w-20">종류</TableHead>
              <TableHead className="w-24">entity id</TableHead>
              <TableHead>라벨</TableHead>
```

행(기존 `<TableCell>{row.buyerId}</TableCell>` 및 login_id 셀 교체):
```tsx
                  <TableCell>
                    <Badge variant="outline">
                      {row.entityType === "product" ? "상품" : "회원"}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.entityId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.entityLabel}</TableCell>
```

> colSpan은 컬럼 수가 5로 동일하게 유지되므로 기존 `colSpan={5}` 그대로 둔다.

- [ ] **Step 5: `app/audit/_components/audit-detail-sheet.tsx` 라벨 일반화**

(a) `const isDelete = item?.action === "buyer.delete";` 는 그대로 둔다(삭제 스냅샷 분기).
(b) `SheetDescription` 내 `· buyer #{item.buyerId} ({item.buyerLoginId})` 를 교체:

```tsx
                {new Date(item.createdAt).toLocaleString("ko-KR")} · {item.operator}{" "}
                · {item.entityType === "product" ? "상품" : "회원"} #{item.entityId} ({item.entityLabel})
```

(c) `<h4 ...>삭제된 회원 스냅샷</h4>` 텍스트는 "삭제된 스냅샷"으로 변경(상품엔 delete 액션이 없지만 일반화).

- [ ] **Step 6: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 7: Commit**

```bash
git add app/api/_lib/schemas.ts app/api/audit/route.ts lib/queries/audit.ts app/audit
git commit -m "feat(audit): 목록/상세 UI entityType 기준으로 일반화"
```

---

## Task 6: 구 audit 컬럼 제거 (마이그레이션 마무리)

모든 코드가 새 필드를 쓰므로 구 컬럼을 제거하고 신규 필드를 required로 전환한다.

**Files:**
- Modify: `prisma/audit/schema.prisma`

- [ ] **Step 1: 코드에 구 컬럼 잔존 참조 없는지 확인**

Run: `git grep -nE 'buyerLoginId|\.buyerId' -- 'app/**' 'lib/**' || echo "clean"`
Expected: `clean` (또는 결과 없음). 결과가 나오면 해당 참조를 먼저 정리.

- [ ] **Step 2: AuditLog 모델을 최종 형태로 교체**

```prisma
model AuditLog {
  id          Int      @id @default(autoincrement())
  createdAt   DateTime @default(now())
  operator    String
  action      String // "buyer.update" | "buyer.delete" | "car.softDelete" | "product.statusUpdate"
  entityType  String // "buyer" | "product"
  entityId    Int
  entityLabel String
  before      String // JSON snapshot before mutation
  after       String? // JSON snapshot after mutation; null for delete

  @@index([entityType, entityId])
  @@index([createdAt])
}
```

- [ ] **Step 3: audit DB 반영 (데이터 손실 수락 — 구 컬럼 drop)**

Run: `pnpm prisma db push --schema=prisma/audit/schema.prisma --accept-data-loss && pnpm prisma:generate`
Expected: `buyerId`/`buyerLoginId` 컬럼 제거, 신규 컬럼 NOT NULL 전환. 백필 완료 상태라 entity 데이터는 보존.

- [ ] **Step 4: 검증 — 기존 행 entityType 보존 확인**

Run:
```bash
node --input-type=module -e '
import { createRequire } from "module";
const require = createRequire(import.meta.url);
process.env.AUDIT_DATABASE_URL ||= "file:./data/audit.db";
const { PrismaClient } = require("./lib/db/audit/client");
const p = new PrismaClient();
const total = await p.auditLog.count();
const buyers = await p.auditLog.count({ where: { entityType: "buyer" } });
console.log(JSON.stringify({ total, buyers }));
await p.$disconnect();
'
```
Expected: `buyers === total` (기존 행 전부 buyer). exit 0.

- [ ] **Step 5: 전체 테스트 + 타입 체크**

Run: `pnpm test --run && pnpm exec tsc --noEmit`
Expected: PASS, 에러 0.

- [ ] **Step 6: Commit**

```bash
git add prisma/audit/schema.prisma
git commit -m "feat(audit): 구 buyer 전용 컬럼 제거, 일반화 마무리"
```

---

## Task 7: sym 스키마에 product / product_partsfit 모델 추가

운영 MySQL이므로 절대 push/migrate 하지 않는다. 클라이언트 타입 생성용으로 모델만 손으로 추가한다.

**Files:**
- Modify: `prisma/sym/schema.prisma`

- [ ] **Step 1: 두 모델을 파일 끝에 추가**

```prisma
model product {
  id               Int               @id @default(autoincrement())
  part_number      String?           @db.VarChar(100)
  sales_status     String?           @db.VarChar(30)
  scope            String?           @db.VarChar(20)
  thumbnail        String?           @db.VarChar(250)
  created_at       DateTime?         @default(now()) @db.Timestamp(0)
  updated_at       DateTime?         @default(now()) @db.Timestamp(0)
  product_partsfit product_partsfit?
}

model product_partsfit {
  id                Int       @id @default(autoincrement())
  product_id        Int       @unique
  mall_product_code String?   @db.VarChar(30)
  product_name      String?   @db.VarChar(100)
  status            String?   @db.VarChar(50)
  quantity          Int?
  price             Decimal?  @db.Decimal(12, 2)
  display_at        DateTime? @db.Timestamp(0)
  selling_at        DateTime? @db.Timestamp(0)
  updated_at        DateTime? @default(now()) @db.Timestamp(0)
  updated_by        Int?
  product           product   @relation(fields: [product_id], references: [id])
}
```

> `@relation`은 클라이언트 전용 모델 관계다(실제 DB FK 유무와 무관, sym은 push하지 않음). `product_id @unique`로 1:1을 표현.

- [ ] **Step 2: sym 클라이언트 재생성**

Run: `pnpm prisma:generate`
Expected: sym 클라이언트에 `product`/`product_partsfit` 델리게이트 생성, 에러 0.

- [ ] **Step 3: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 4: Commit**

```bash
git add prisma/sym/schema.prisma
git commit -m "feat(sym): product/product_partsfit 모델 추가 (1:1)"
```

---

## Task 8: 상품 상태 상수 + 검증 스키마 (TDD)

**Files:**
- Create: `app/api/_lib/status.ts`
- Test: `app/api/_lib/status.test.ts`
- Test: `app/api/_lib/schemas.test.ts`
- Modify: `app/api/_lib/schemas.ts`

- [ ] **Step 1: 실패 테스트 작성 (`app/api/_lib/status.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import {
  PRODUCT_STATUS_VALUES,
  PRODUCT_STATUS_OPTIONS,
  getStatusMeta,
} from "./status";

describe("product status 상수", () => {
  it("QA 노출 7종을 정의한다", () => {
    expect(PRODUCT_STATUS_VALUES).toEqual([
      "SALE",
      "STOP",
      "SOLD_OUT",
      "ONSITE",
      "READY",
      "EXAMINE",
      "REJECT",
    ]);
  });

  it("모든 값에 한글 라벨과 className이 있다", () => {
    for (const v of PRODUCT_STATUS_VALUES) {
      const meta = getStatusMeta(v);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.className.length).toBeGreaterThan(0);
    }
    expect(getStatusMeta("SALE").label).toBe("판매중");
    expect(getStatusMeta("STOP").label).toBe("판매중지");
  });

  it("옵션 배열은 value/label 쌍 7개", () => {
    expect(PRODUCT_STATUS_OPTIONS).toHaveLength(7);
    expect(PRODUCT_STATUS_OPTIONS[0]).toEqual({ value: "SALE", label: "판매중" });
  });

  it("알 수 없는 상태는 회색 fallback 메타를 반환한다", () => {
    const meta = getStatusMeta("RELEASE_COMPLETED");
    expect(meta.label).toBe("RELEASE_COMPLETED");
    expect(meta.className).toContain("gray");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test --run app/api/_lib/status.test.ts`
Expected: FAIL — `./status` 모듈 없음.

- [ ] **Step 3: `app/api/_lib/status.ts` 작성**

```ts
export const PRODUCT_STATUS_VALUES = [
  "SALE",
  "STOP",
  "SOLD_OUT",
  "ONSITE",
  "READY",
  "EXAMINE",
  "REJECT",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUS_VALUES)[number];

interface StatusMeta {
  label: string;
  /** Badge용 tailwind className */
  className: string;
}

const META: Record<ProductStatus, StatusMeta> = {
  SALE: { label: "판매중", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  STOP: { label: "판매중지", className: "bg-orange-100 text-orange-700 border-orange-200" },
  SOLD_OUT: { label: "품절", className: "bg-gray-100 text-gray-600 border-gray-200" },
  ONSITE: { label: "현장판매", className: "bg-blue-100 text-blue-700 border-blue-200" },
  READY: { label: "판매준비", className: "bg-sky-100 text-sky-700 border-sky-200" },
  EXAMINE: { label: "검토", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  REJECT: { label: "반려", className: "bg-red-100 text-red-700 border-red-200" },
};

const FALLBACK_CLASS = "bg-gray-100 text-gray-500 border-gray-200";

export const PRODUCT_STATUS_OPTIONS = PRODUCT_STATUS_VALUES.map((value) => ({
  value,
  label: META[value].label,
}));

/** 7종이 아닌 값(시스템 상태 등)도 표시 가능하도록 fallback 제공. */
export function getStatusMeta(status: string): StatusMeta {
  if ((PRODUCT_STATUS_VALUES as readonly string[]).includes(status)) {
    return META[status as ProductStatus];
  }
  return { label: status, className: FALLBACK_CLASS };
}
```

- [ ] **Step 4: status 테스트 통과 확인**

Run: `pnpm test --run app/api/_lib/status.test.ts`
Expected: PASS.

- [ ] **Step 5: `app/api/_lib/schemas.ts`에 상품 스키마 추가**

파일 끝에 추가:

```ts
import { PRODUCT_STATUS_VALUES } from "./status";

export const productStatusUpdateSchema = z
  .object({
    status: z.enum(PRODUCT_STATUS_VALUES),
  })
  .strict();

export type ProductStatusUpdate = z.infer<typeof productStatusUpdateSchema>;

export const productListQuerySchema = z.object({
  q: z.string().trim().min(2, "검색어는 2글자 이상").optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
```

> `z.enum(PRODUCT_STATUS_VALUES)`는 readonly 튜플을 받는다(zod 3.23 지원). import는 파일 상단 `import { z } from "zod";` 아래에 두어도 되고, 위처럼 사용처 근처에 두어도 동작하나, 린트 일관성 위해 **상단으로** 옮긴다.

- [ ] **Step 6: 스키마 테스트 작성 (`app/api/_lib/schemas.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { productStatusUpdateSchema, productListQuerySchema } from "./schemas";

describe("productStatusUpdateSchema", () => {
  it("허용된 상태를 통과시킨다", () => {
    expect(productStatusUpdateSchema.safeParse({ status: "STOP" }).success).toBe(true);
  });
  it("7종 외 상태는 거부한다", () => {
    expect(productStatusUpdateSchema.safeParse({ status: "RELEASE_COMPLETED" }).success).toBe(false);
  });
  it("알 수 없는 키는 strict로 거부한다", () => {
    expect(
      productStatusUpdateSchema.safeParse({ status: "SALE", foo: 1 }).success,
    ).toBe(false);
  });
});

describe("productListQuerySchema", () => {
  it("1글자 검색어는 거부한다", () => {
    expect(productListQuerySchema.safeParse({ q: "a" }).success).toBe(false);
  });
  it("기본 page/size를 채운다", () => {
    const r = productListQuerySchema.parse({ q: "abc" });
    expect(r.page).toBe(1);
    expect(r.size).toBe(20);
    expect(r.includeDeleted).toBe(false);
  });
});
```

- [ ] **Step 7: 전체 테스트 통과 확인**

Run: `pnpm test --run`
Expected: PASS (audit + status + schemas).

- [ ] **Step 8: Commit**

```bash
git add app/api/_lib/status.ts app/api/_lib/status.test.ts app/api/_lib/schemas.ts app/api/_lib/schemas.test.ts
git commit -m "feat(products): 상태 상수 + 검증 스키마 (TDD)"
```

---

## Task 9: GET /api/products — 목록 검색

**Files:**
- Create: `app/api/products/route.ts`

- [ ] **Step 1: 라우트 작성 (`app/api/products/route.ts`)**

```ts
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
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: 수동 검증 (staging 연결 필요)**

Run:
```bash
pnpm dev &  # 백그라운드 기동, 잠시 대기
sleep 6
curl -s 'http://localhost:3000/api/products?q=네이버' | head -c 400; echo
curl -s 'http://localhost:3000/api/products' | head -c 200; echo  # q 없음 → 빈 결과
kill %1 2>/dev/null
```
Expected: 첫 호출은 `{"items":[...],"total":N,...}` 형태(0건이어도 정상), 둘째 호출은 `{"items":[],"total":0,...}`.
(staging 연결 불가 환경이면 이 스텝은 건너뛰고 Task 16 통합 검증에서 수행 — 그렇게 기록.)

- [ ] **Step 4: Commit**

```bash
git add app/api/products/route.ts
git commit -m "feat(products): GET /api/products 목록 검색"
```

---

## Task 10: GET /api/products/[id] — 상세

**Files:**
- Create: `app/api/products/[id]/route.ts`

- [ ] **Step 1: 라우트 작성 (GET 부분만 — PATCH는 Task 11에서 추가)**

```ts
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
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/products/[id]/route.ts
git commit -m "feat(products): GET /api/products/[id] 상세"
```

---

## Task 11: PATCH /api/products/[id] — 상태 변경 + audit

**Files:**
- Modify: `app/api/products/[id]/route.ts`

- [ ] **Step 1: import 보강 + PATCH 핸들러 추가**

파일 상단 import 블록을 아래로 교체:

```ts
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
```

파일 끝(GET 다음)에 PATCH 추가:

```ts
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
```

> `product.sales_status`와 `updated_by`는 건드리지 않는다(설계 결정). 부수효과(cafe24/ES/SQS) 호출 없음.

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0. (`result.data`는 `product_partsfit | null`이 아니라 update 반환값이므로 non-null. `price` 접근이 문제되면 `result.data.price?.toString?.() ?? null`로 안전 처리.)

- [ ] **Step 3: 수동 검증 (staging 연결 필요, 선택)**

Run:
```bash
# operator 쿠키와 실제 product id가 필요. Task 16에서 UI로 통합 검증해도 됨.
echo "manual: UI에서 검증 예정 (Task 16)"
```

- [ ] **Step 4: Commit**

```bash
git add app/api/products/[id]/route.ts
git commit -m "feat(products): PATCH 상태 변경 + audit (부수효과 없음)"
```

---

## Task 12: products 쿼리 레이어

**Files:**
- Create: `lib/queries/products.ts`

- [ ] **Step 1: 작성 (`lib/queries/products.ts`)**

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http/api-client";
import type { ProductStatusUpdate } from "@/app/api/_lib/schemas";

export interface ProductListItem {
  id: number;
  part_number: string | null;
  sales_status: string | null;
  thumbnail: string | null;
  mall_product_code: string | null;
  product_name: string | null;
  status: string | null;
  quantity: number | null;
  price: string | null;
}

export interface ProductListResponse {
  items: ProductListItem[];
  total: number;
  page: number;
  size: number;
}

export interface ProductPartsfitDetail {
  id: number;
  mall_product_code: string | null;
  product_name: string | null;
  status: string | null;
  quantity: number | null;
  price: string | null;
  display_at: string | null;
  selling_at: string | null;
  updated_at: string | null;
}

export interface ProductDetail {
  id: number;
  part_number: string | null;
  sales_status: string | null;
  scope: string | null;
  thumbnail: string | null;
  created_at: string | null;
  updated_at: string | null;
  product_partsfit: ProductPartsfitDetail | null;
}

export interface ProductListFilters {
  q?: string;
  includeDeleted?: boolean;
  page?: number;
  size?: number;
}

export const productKeys = {
  all: ["products"] as const,
  list: (filters: ProductListFilters) => ["products", "list", filters] as const,
  detail: (id: number) => ["products", "detail", id] as const,
};

export function useProductsQuery(filters: ProductListFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<ProductListResponse>("/products", { params: filters });
      return data;
    },
  });
}

export function useProductQuery(id: number | null) {
  return useQuery({
    queryKey: id ? productKeys.detail(id) : ["products", "detail", "none"],
    queryFn: async () => {
      const { data } = await api.get<ProductDetail>(`/products/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateProductStatusMutation(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProductStatusUpdate) => {
      const res = await api.patch(`/products/${id}`, body);
      return {
        data: res.data,
        auditFailed: res.headers["x-audit-failed"] === "true",
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/products.ts
git commit -m "feat(products): react-query 훅 (목록/상세/상태변경)"
```

---

## Task 13: 상품 테이블 컴포넌트

**Files:**
- Create: `app/products/_components/product-table.tsx`

- [ ] **Step 1: 작성 (`app/products/_components/product-table.tsx`)**

```tsx
"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusMeta } from "@/app/api/_lib/status";
import type { ProductListItem } from "@/lib/queries/products";

interface ProductTableProps {
  data: ProductListItem[];
  loading?: boolean;
  selectedId?: number | null;
  onSelect: (id: number) => void;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const meta = getStatusMeta(status);
  return <Badge variant="outline" className={cn("font-medium", meta.className)}>{meta.label}</Badge>;
}

const columns: ColumnDef<ProductListItem>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  { accessorKey: "mall_product_code", header: "몰코드" },
  { accessorKey: "product_name", header: "상품명" },
  { accessorKey: "part_number", header: "품번" },
  {
    accessorKey: "status",
    header: "판매상태",
    cell: ({ getValue }) => <StatusBadge status={getValue<string | null>()} />,
  },
  {
    accessorKey: "sales_status",
    header: "원장상태",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (
        <span className="text-xs text-muted-foreground">{v}</span>
      ) : null;
    },
  },
  { accessorKey: "quantity", header: "수량", size: 70 },
];

export function ProductTable({ data, loading, selectedId, onSelect }: ProductTableProps) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} style={{ width: h.column.getSize() || undefined }}>
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                불러오는 중…
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                결과 없음 (검색어 2글자 이상)
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.original.id === selectedId ? "selected" : undefined}
                onClick={() => onSelect(row.original.id)}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
git add app/products/_components/product-table.tsx
git commit -m "feat(products): 상품 목록 테이블 컴포넌트"
```

---

## Task 14: 상품 상태 변경 시트 컴포넌트

**Files:**
- Create: `app/products/_components/product-status-sheet.tsx`

- [ ] **Step 1: 작성 (`app/products/_components/product-status-sheet.tsx`)**

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  PRODUCT_STATUS_OPTIONS,
  getStatusMeta,
  type ProductStatus,
} from "@/app/api/_lib/status";
import {
  useProductQuery,
  useUpdateProductStatusMutation,
} from "@/lib/queries/products";

interface Props {
  productId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductStatusSheet({ productId, open, onOpenChange }: Props) {
  const query = useProductQuery(productId);
  const product = query.data;
  const update = useUpdateProductStatusMutation(productId ?? 0);

  const current = product?.product_partsfit?.status ?? null;
  const [next, setNext] = React.useState<ProductStatus | "">("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    setNext("");
  }, [productId]);

  const dirty = next !== "" && next !== current;

  const doUpdate = async () => {
    if (!dirty || next === "") return;
    try {
      const { auditFailed } = await update.mutateAsync({ status: next });
      if (auditFailed) {
        toast.warning("상태는 변경됐지만 감사 로그 기록에 실패했습니다.");
      } else {
        toast.success("판매 상태를 변경했습니다.");
      }
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full">
          {!product ? (
            <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>
          ) : (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span>#{product.id}</span>
                  {current && (
                    <Badge variant="outline" className={cn(getStatusMeta(current).className)}>
                      {getStatusMeta(current).label}
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {product.product_partsfit?.product_name ?? "(상품명 없음)"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4 text-sm">
                <dl className="grid grid-cols-3 gap-y-2">
                  <dt className="text-muted-foreground">몰코드</dt>
                  <dd className="col-span-2 font-mono">{product.product_partsfit?.mall_product_code ?? "-"}</dd>
                  <dt className="text-muted-foreground">품번</dt>
                  <dd className="col-span-2 font-mono">{product.part_number ?? "-"}</dd>
                  <dt className="text-muted-foreground">원장상태</dt>
                  <dd className="col-span-2">{product.sales_status ?? "-"}</dd>
                  <dt className="text-muted-foreground">수량</dt>
                  <dd className="col-span-2">{product.product_partsfit?.quantity ?? "-"}</dd>
                </dl>

                <Separator />

                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    이 변경은 sym DB의 판매 상태값만 바꿉니다. 쇼핑몰 게시(cafe24)·검색색인(ES)·재고
                    이벤트는 연동되지 않습니다.
                  </span>
                </div>

                <div className="space-y-2">
                  <Label>변경할 상태</Label>
                  <Select value={next} onValueChange={(v) => setNext(v as ProductStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} disabled={o.value === current}>
                          {o.label}
                          {o.value === current ? " (현재)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SheetFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  취소
                </Button>
                <Button disabled={!dirty || update.isPending} onClick={() => setConfirmOpen(true)}>
                  상태 변경
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>판매 상태 변경</AlertDialogTitle>
            <AlertDialogDescription>
              {current ? getStatusMeta(current).label : "(없음)"} →{" "}
              {next ? getStatusMeta(next).label : ""} 로 변경합니다. 계속할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={doUpdate}>변경</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0. (`@/components/ui/alert-dialog`, `select`, `separator`는 이미 존재 — Task 0의 `ls components/ui`로 확인됨.)

- [ ] **Step 3: Commit**

```bash
git add app/products/_components/product-status-sheet.tsx
git commit -m "feat(products): 상태 변경 시트 (부수효과 경고 + 확인 다이얼로그)"
```

---

## Task 15: 상품 검색 폼 + /products 페이지 + 네비게이션

**Files:**
- Create: `app/products/_components/product-search-form.tsx`
- Create: `app/products/page.tsx`
- Modify: `app/_components/top-nav.tsx`

- [ ] **Step 1: 검색 폼 (`app/products/_components/product-search-form.tsx`)**

```tsx
"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  onSearch: (q: string, includeDeleted: boolean) => void;
}

export function ProductSearchForm({ onSearch }: Props) {
  const [q, setQ] = React.useState("");
  const [includeDeleted, setIncludeDeleted] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(q.trim(), includeDeleted);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="몰코드 / 상품명 / 품번 / ID (2글자 이상)"
          className="pl-8"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="incl-del" checked={includeDeleted} onCheckedChange={setIncludeDeleted} />
        <Label htmlFor="incl-del" className="text-sm text-muted-foreground">
          삭제재고 포함
        </Label>
      </div>
      <Button type="submit" variant="secondary">
        검색
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 페이지 (`app/products/page.tsx`)**

```tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useProductsQuery } from "@/lib/queries/products";
import { ProductSearchForm } from "./_components/product-search-form";
import { ProductTable } from "./_components/product-table";
import { ProductStatusSheet } from "./_components/product-status-sheet";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">불러오는 중…</div>}>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedIdRaw = searchParams.get("id");
  const selectedId = selectedIdRaw ? Number(selectedIdRaw) : null;

  const [submittedQ, setSubmittedQ] = React.useState("");
  const [includeDeleted, setIncludeDeleted] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const query = useProductsQuery({
    q: submittedQ || undefined,
    includeDeleted,
    page,
    size: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  const updateSelected = (id: number | null) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (id == null) params.delete("id");
    else params.set("id", String(id));
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products");
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">상품 관리</h1>
        <p className="text-sm text-muted-foreground">
          partsfit_mall 상품 판매 상태 변경 (staging DB · 부수효과 없음)
        </p>
      </header>

      <ProductSearchForm
        onSearch={(q, incl) => {
          setSubmittedQ(q);
          setIncludeDeleted(incl);
          setPage(1);
        }}
      />

      {query.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(query.error as Error).message}
        </div>
      )}

      <ProductTable
        data={query.data?.items ?? []}
        loading={query.isLoading}
        selectedId={selectedId}
        onSelect={updateSelected}
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          총 {(query.data?.total ?? 0).toLocaleString()}건
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            이전
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            다음
          </Button>
        </div>
      </div>

      <ProductStatusSheet
        productId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => {
          if (!o) updateSelected(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: 네비게이션 탭 추가 (`app/_components/top-nav.tsx`)**

(a) import에 아이콘 추가:
```tsx
import { Users, Package, ScrollText } from "lucide-react";
```
(b) `tabs` 배열을 교체:
```tsx
const tabs = [
  { href: "/members", label: "회원 관리", icon: Users },
  { href: "/products", label: "상품 관리", icon: Package },
  { href: "/audit", label: "감사 로그", icon: ScrollText },
];
```
(c) 헤더 타이틀 텍스트를 교체:
```tsx
            SCM QA · 회원/상품 관리
```

- [ ] **Step 4: 타입 체크 + 린트**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 에러 0.

- [ ] **Step 5: Commit**

```bash
git add app/products app/_components/top-nav.tsx
git commit -m "feat(products): 검색 폼 + /products 페이지 + 네비게이션 탭"
```

---

## Task 16: 통합 검증 (staging 연결)

전체 흐름을 실제 staging sym DB로 확인한다.

**Files:** (코드 변경 없음)

- [ ] **Step 1: 전체 단위 테스트 + 타입 체크 + 린트**

Run: `pnpm test --run && pnpm exec tsc --noEmit && pnpm lint`
Expected: 모두 PASS / 에러 0.

- [ ] **Step 2: 빌드**

Run: `pnpm build`
Expected: 빌드 성공.

- [ ] **Step 3: 개발 서버 기동 + 수동 시나리오**

Run: `pnpm dev` (별도 터미널) 후 브라우저에서:
1. 우상단 OperatorPicker에 이름 입력(쿠키 설정).
2. `상품 관리` 탭 → 실제 몰코드/품번 일부로 검색 → 결과 표시 확인.
3. 한 행 클릭 → 시트 열림, 현재 상태/경고 배너 표시 확인.
4. 상태를 `판매중지(STOP)` 등으로 변경 → 확인 다이얼로그 → 변경 → 성공 toast.
5. `감사 로그` 탭 → 종류=상품 필터 → 방금 변경이 `product.statusUpdate`로 기록됐는지, before/after에 status 변화가 보이는지 확인.
6. 같은 상태로 재변경 시도 시 "이미 해당 상태입니다" 에러 확인.

Expected: 위 6개 모두 정상.

- [ ] **Step 4: 상태 원복 (테스트로 바꾼 상품)**

검증 중 바꾼 상품을 원래 상태로 되돌려 staging 오염을 최소화한다(같은 UI로 원복).

- [ ] **Step 5: 최종 커밋(필요 시) 및 정리**

```bash
git status   # 미커밋 변경 없는지 확인
```
Expected: clean tree.

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지**: §4.1 audit 일반화→Task 1–6 / §4.2 sym 스키마→Task 7 / §5 API(목록·상세·PATCH·검색정책·no-op·updated_by 미변경·sales_status 미변경·부수효과 없음)→Task 8–11 / §6 UI(네비·테이블·시트·경고배너·뱃지색·감사필터)→Task 13–15, 5 / §7 에러처리(403/404/412/400/X-Audit-Failed/scope)→Task 9·11 / §8 테스트→Task 3·8·16 / §9 구현순서→Task 순서 일치. 누락 없음.
- **플레이스홀더**: 없음(모든 코드/명령 구체화). staging 의존 수동 검증만 "선택/Task 16 이관"으로 명시.
- **타입 일관성**: `withAudit`/`insertAuditLog` 시그니처(entityType/entityId/entityLabel/snapshot/mutate/captureAfter)가 Task 3 정의 ↔ Task 4·11 호출부 일치. `ProductStatus`/`PRODUCT_STATUS_*`(Task 8) ↔ schemas/queries/components 사용 일치. `ProductListItem`/`ProductDetail`(Task 12) ↔ table/sheet 사용 일치. audit `AuditLogItem` 필드(Task 5) ↔ page/detail-sheet 사용 일치.
