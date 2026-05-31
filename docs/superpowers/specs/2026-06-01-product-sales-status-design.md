# 상품 판매 상태 변경 기능 설계

- **작성일**: 2026-06-01
- **대상 프로젝트**: scm-qa-member-admin (partsfit_mall QA 셀프서비스 도구)
- **상태**: 설계 승인됨, 구현 계획 작성 대기

## 1. 배경 & 문제

QA 챕터가 테스트 중 **상품의 판매 상태 변경**을 개발팀에 자주 요청한다. SCM 어드민(scm-front)에 정식 상태 변경 경로가 있긴 하나, 임의 상태 지정이 안 되거나 다소 복잡해서 결국 개발자 DB 수정으로 이어진다. 회원 정보 수정에 대해 이미 셀프서비스 도구를 만든 것과 동일한 동기로, 상품 판매 상태도 QA가 직접 바꿀 수 있게 한다.

## 2. 도메인 조사 결과 (sym DB / 운영 코드)

판매 상태가 들어있는 테이블은 두 곳이며 `product.id = product_partsfit.product_id` 로 1:1 연결된다.

| 테이블.컬럼 | enum | 값 |
|---|---|---|
| `product.sales_status` (varchar30) | `ProductStatus` (4종) | SALE(판매관리), ONSITE(현장판매), RELEASE(출고관리), DELETE(삭제재고) |
| `product_partsfit.status` (varchar50) | `SalesStatus` (14종) | ALL, IN_STOCK, READY, STOP, CAUTION, EXAMINE, REJECT, SALE, ONSITE, DELETE, READY_FOR_RELEASE, RELEASE_COMPLETED, LOST_AND_DAMAGED, SOLD_OUT |

핵심 발견:

- **두 컬럼은 데이터상 사실상 독립적**이다. 교차표 결과 거의 모든 조합이 존재한다(예: `product.sales_status=SALE` 아래 12종 partsfit 상태가 공존). 따라서 lockstep 동기화는 불필요하고 부정확하다.
- 운영 코드(partsfit-mall-api)의 엔티티 커플링(`markAsSale`/`markAsRelease`)은 **주문/환불의 수량 변화에서만** 발동하는 특수 케이스다. 자사몰 API에는 상태를 직접 바꾸는 admin 엔드포인트가 없다.
- SCM 어드민(scm-front)은 `sales-stop`/`sales-resume` 등으로 `product_partsfit.status`를 바꾸며, 상태 변경 시 **부수효과**(쇼핑몰 게시 cafe24 연동, elasticsearch 색인, SQS 재고 이벤트)가 발생한다. UI는 버튼 기반 전이(주로 SALE↔STOP)만 노출한다.
- 따라서 **QA가 말하는 "판매 상태" = `product_partsfit.status`** 단일 컬럼이며, QA에게 의미 있는 값은 7종이다.

## 3. 범위 (Scope)

### In scope
- partsfit 상품(`product.scope = 'PARTSFIT'`)의 `product_partsfit.status` 를 **단건**으로 변경.
- 변경 가능한 상태 7종: `SALE`(판매중), `STOP`(판매중지), `SOLD_OUT`(품절), `ONSITE`(현장판매), `READY`(판매준비), `EXAMINE`(검토), `REJECT`(반려).
- 모든 변경은 audit 로그 기록.
- 검색(코드/품번/상품명/ID) → 상세 조회 → 상태 변경 화면.

### Out of scope (의도적 제외)
- `product.sales_status`(4종) 변경 — 건드리지 않음.
- 시스템성 상태(`READY_FOR_RELEASE`, `RELEASE_COMPLETED`, `LOST_AND_DAMAGED`, `DELETE`, `CAUTION`, `IN_STOCK`, `ALL`) 세팅.
- 벌크(다건) 변경 — 추후 추가 가능.
- 부수효과 연동(cafe24 / elasticsearch / SQS) — 명시적으로 호출하지 않음.
- 상품 정보(가격/수량/이미지 등) 수정 — 상태만.
- gparts(납품몰) 대상 — partsfit 전용.

## 4. 아키텍처

기존 회원 도구의 패턴·가드를 그대로 재사용한다(REST + react-query + axios + zustand + TanStack Table + RHF + shadcn). staging sym DB 직접 쓰기, 인증 없음(사내망 + 쿠키 operator), audit 별도 SQLite DB.

### 4.1 Audit 로그 일반화 (핵심 리팩터)

현재 `AuditLog`는 buyer 전용(`buyerId`, `buyerLoginId` NOT NULL)이다. 엔티티가 둘로 늘어나므로 범용화한다.

```prisma
model AuditLog {
  id          Int      @id @default(autoincrement())
  createdAt   DateTime @default(now())
  operator    String
  action      String      // "buyer.update" | "buyer.delete" | "car.softDelete" | "product.statusUpdate"
  entityType  String      // "buyer" | "product"
  entityId    Int
  entityLabel String      // buyer=login_id, product=mall_product_code ?? part_number
  before      String      // JSON 스냅샷
  after       String?     // JSON 스냅샷; delete는 null
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

**마이그레이션 (SQLite, 데이터 보존)**:
1. 새 컬럼 추가(`entityType`, `entityId`, `entityLabel`).
2. 기존 행 백필: `entityType='buyer'`, `entityId=buyerId`, `entityLabel=buyerLoginId`.
3. 구 컬럼(`buyerId`, `buyerLoginId`) 드롭.

**`withAudit` 헬퍼 재설계**: 현재 내부에서 `partsfit_mall_buyer`를 직접 조회(buyer 종속). 호출자가 before/after 스냅샷과 라벨을 주입하는 범용 시그니처로 변경한다.

```ts
withAudit({
  action, entityType, entityId, entityLabel,
  snapshot: () => Promise<T | null>,   // before/after 캡처에 사용
  mutate: () => Promise<R>,
})
```

회원 쪽 기존 호출부(`/api/buyers/[id]` PATCH/DELETE, car soft-delete)도 새 시그니처로 이전한다. 동작은 동일하고 인자만 바뀐다. 회귀 테스트로 보호한다.

### 4.2 sym Prisma 스키마 추가

`prisma/sym/schema.prisma`에 `product`, `product_partsfit` 두 모델을 손으로 추가하고 1:1 relation을 건다. 도구가 실제 읽고 쓰는 컬럼만 포함(전체 db pull 후 prune 방침 유지).

- `product`: `id`, `part_number`, `sales_status`, `scope`, `thumbnail`, `created_at` 등 표시 최소 컬럼 + `product_partsfit?` relation.
- `product_partsfit`: `id`, `product_id @unique`, `mall_product_code`, `product_name`, `status`(★ 변경 대상), `quantity`, `price`, `updated_at`, `updated_by` + `product` relation.

## 5. API

| Method | Path | 용도 |
|---|---|---|
| `GET` | `/api/products?q=&page=&size=&includeDeleted=` | 목록 검색 |
| `GET` | `/api/products/[id]` | 상세 (product + product_partsfit join) |
| `PATCH` | `/api/products/[id]` | 상태 변경 |

**검색 정책**:
- 검색어(`q`) 최소 2글자 필수(없으면 빈 결과) — product 33만 건 규모 보호.
- `q`는 `mall_product_code` / `part_number` / `product_name` 부분일치 OR + `product.id` 정확일치.
- `scope = 'PARTSFIT'` 만 노출.
- `sales_status = 'DELETE'`(삭제재고)는 기본 숨김, `includeDeleted=true` 토글로만 노출.
- 페이지네이션: size 기본 20, 최대 100.

**PATCH 본문 (Zod)**:
```ts
productStatusUpdateSchema = z.object({
  status: z.enum(["SALE","STOP","SOLD_OUT","ONSITE","READY","EXAMINE","REJECT"]),
}).strict()
```

**변경 동작**:
- `product_partsfit.status` 단일 컬럼만 업데이트(+ `updated_at = now()`).
- `product.sales_status` 는 변경하지 않음.
- `updated_by` 는 정수 user id를 기대하는 컬럼이라, operator가 사람 이름 문자열인 본 도구에서는 이 컬럼에 쓰지 않는다(기존 값 그대로 유지). operator 식별은 audit 로그로만 남긴다.
- 부수효과(cafe24 / ES / SQS) 호출 없음.
- audit: `action="product.statusUpdate"`, `entityType="product"`, `entityId=product.id`, `entityLabel=mall_product_code ?? part_number`, before/after = `product_partsfit` 스냅샷.

**전이 규칙**: QA 목적상 7종 임의 전이 허용. 단 현재 상태와 동일 값 변경은 no-op으로 거부(400).

## 6. UI / 컴포넌트

- **네비게이션**(`top-nav.tsx`): `회원 관리 | 상품 관리 | 감사 로그`. 헤더 타이틀 `SCM QA · 회원/상품 관리`.
- **`/products` 페이지** (회원 페이지 구조 동일):
  - `_components/product-search-form.tsx` — `q` 입력 + `삭제재고 포함` 토글. 2글자 미만 안내.
  - `_components/product-table.tsx` (TanStack Table) — 썸네일, mall_product_code, product_name, part_number, 현재 status 뱃지, sales_status 보조 뱃지(회색), quantity, 가격. 행 클릭 → 시트.
  - `_components/product-status-sheet.tsx` (Sheet + RHF) — 상세 + 상태 변경.
- **상태 변경 UX**:
  - 7종 드롭다운(한글 라벨 / 내부 영문 enum).
  - **부수효과 없음 경고 배너**: "이 변경은 sym DB의 상태값만 바꿉니다. 쇼핑몰 게시(cafe24)·검색색인(ES)·재고 이벤트는 연동되지 않습니다."
  - 저장 시 현재→목표 상태 명시 확인 다이얼로그(단순 confirm, typed-confirm 불필요).
  - `X-Audit-Failed` 헤더 시 toast 경고(회원 패턴 동일).
- **상태 뱃지 색상**: SALE=초록, STOP=주황, SOLD_OUT=회색, ONSITE=파랑, READY=하늘, EXAMINE=노랑, REJECT=빨강.
- **감사 로그 페이지**: `entityType` 필터(전체/회원/상품) 추가, 컬럼 라벨 buyerId→entity로 일반화.
- **쿼리 레이어**: `lib/queries/products.ts` (`useProductsQuery`, `useProductQuery`, `useUpdateProductStatusMutation`) — buyers.ts 패턴.

## 7. 에러 처리

`app/api/_lib/responses.ts` 헬퍼 재사용.

- 잘못된 id / enum 외 status → `400`.
- 존재하지 않는 product 또는 `product_partsfit` 행 없음 → `404`.
- `READ_ONLY` 모드 → `403`, operator 미설정 → `412`.
- 현재 상태와 동일 값 변경 → `400`("이미 해당 상태입니다").
- sym 쓰기 성공 + audit 쓰기 실패 → 성공 + `X-Audit-Failed: true` 헤더(mutation 우선).
- `scope != 'PARTSFIT'` 상품 변경 시도 → `403`(대상 외).

## 8. 테스트 (vitest)

- `productStatusUpdateSchema` 단위 테스트 — 유효/무효 enum, strict 위반.
- no-op 거부 로직 단위 테스트.
- **`withAudit` 일반화 후 회원 기존 테스트 회귀 통과** — 마이그레이션 안전장치.
- audit 백필 마이그레이션 검증(기존 buyer 행 → entityType='buyer').
- API route 통합 테스트는 sym DB 의존이라 staging 연결 가능 시에만(기존 방침).

## 9. 구현 순서 (리스크 낮은 것부터)

1. Audit 스키마 일반화 + 마이그레이션 + 회원 코드 이전 (회귀 테스트 보호).
2. sym 스키마에 `product` / `product_partsfit` 추가 + `prisma generate`.
3. products API (GET 목록/상세, PATCH).
4. products 쿼리 레이어 + UI.
5. 감사 로그 페이지 `entityType` 필터.
6. 네비게이션 탭.
