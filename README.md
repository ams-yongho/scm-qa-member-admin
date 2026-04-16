# scm-qa-member-admin

자사몰(partsfit_mall) QA 챕터 셀프서비스 회원 관리 도구.

테스트 진행 중 회원 정보 수정·삭제를 매번 개발팀에 요청해야 하는 상황을 해소하기 위한 사내 도구입니다. 사내망 한정으로 인증 없이 접근하며, 모든 변경은 별도 SQLite 감사 로그 DB 에 기록됩니다.

## 기능

- 회원 검색·조회 (login_id / 이름 / 이메일 / 연락처 LIKE)
- 개인정보 수정 (name, email, phone_number)
- 계좌 정보 수정 (bank_name, bank_holder, bank_number)
- 회원 구분 변경 (PERSONAL ↔ BUSINESS)
- 차량 등록 한도 변경 (car_unlimited / max_car_limit)
- 회원 삭제 (typed-confirm — login_id 일치 확인 후 삭제, 연관 oauth/address/car CASCADE + withdraw 잔여행 정리)
- 모든 변경 감사 로그 (operator + before/after 스냅샷)

명시적으로 **제외**: 마케팅 동의 토글, 시드 계정 생성, 탈퇴 복구, status 변경, 인증 상태 리셋, biz/fp 자사몰, 인증/로그인.

## 환경

- Node 22 · pnpm
- 사내망 한정 (인증 없음 — 첫 진입 시 operator 이름만 입력)
- 대상 DB: staging `sym` (Azure MySQL) — 운영 DB 차단 가드 내장

## 빠른 시작 (로컬)

```sh
cp .env.example .env.local           # SYM_DATABASE_URL 등 채우기
cp .env.local .env                   # Prisma CLI 용 (.env 만 인식)
pnpm install
pnpm prisma:generate
pnpm prisma:push:audit               # 최초 1회: SQLite 스키마 생성
pnpm dev                             # http://localhost:3000
```

## 배포 (Docker)

```sh
cp .env.example .env.local
docker compose -f docker/docker-compose.yml up -d --build
```

audit log 는 프로젝트 루트의 `./data/audit.db` (SQLite). Docker 에서는 호스트 `./data/` 가 컨테이너 `/data/` 로 mount 됩니다.

## 환경 변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `SYM_DATABASE_URL` | ✓ | sym DB 접속 URL. **호스트에 `staging` 키워드가 없으면 부팅 거부** (가드) |
| `AUDIT_DATABASE_URL` | ✓ | SQLite 파일 경로. **로컬: `file:../../data/audit.db`** (schema 기준 상대경로 → 프로젝트 루트의 `data/`). **Docker: `file:/data/audit.db`** (절대경로) |
| `READ_ONLY` | | `true` 시 모든 mutation 403 (관전/데모용) |
| `ALLOW_NON_STAGING` | | `true` 시 staging 가드 해제 (특수한 경우만) |

## 안전 장치

- **운영 DB 차단**: `SYM_DATABASE_URL` 호스트가 `staging` 을 포함해야 부팅
- **operator 미설정 시**: mutation API 가 412 응답, UI 가 강제 다이얼로그
- **삭제 typed-confirm**: 클라이언트·서버 양쪽에서 `login_id` 정확 일치 검증
- **읽기 전용 모드**: `READ_ONLY=true` 환경변수
- **감사 로그**: 모든 변경/삭제는 operator 이름과 함께 SQLite 에 영구 기록

## 아키텍처

```
Next.js 15 (App Router) ─┐
  • React Query + axios   │ Prisma (sym, mysql)  → Azure MySQL  sym DB
  • TanStack Table        │ Prisma (audit, sqlite) → /data/audit.db
  • react-hook-form + Zod │
  • shadcn/ui             │
  • Sonner toasts         │
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 (standalone) |
| `pnpm start` | 빌드 결과 실행 |
| `pnpm prisma:generate` | 두 Prisma 클라이언트 생성 |
| `pnpm prisma:pull:sym` | sym 스키마 introspect 후 재 prune 필요 |
| `pnpm prisma:push:audit` | audit 스키마 적용 (SQLite) |
| `pnpm test` | vitest 실행 |
