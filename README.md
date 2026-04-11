# SCM QA Member Admin

QA 챕터에서 `partsfit_mall_buyer` 회원 정보를 조회/수정하기 위한 내부용 Next.js 서비스입니다.

## Phase 1 Status

1차 범위 구현 완료.

- 기본 실행 모드는 `mock`
- Next.js App Router 기반 QA 관리 화면 구축
- 서버 선택 UI (`staging`, `release`, `product`)
- `partsfit_mall_buyer` 검색 및 상세 수정
- 더미 데이터 기반 조회/수정 플로우 확인 가능
- 실제 전환용 Next.js 서버 전용 MySQL 연결 코드 유지
- `product` 읽기 전용 처리
- 다크모드 기본 적용
- API / env / repository / validation / 기본 테스트 추가

검증 결과:

- `pnpm lint` 통과
- `pnpm test` 통과
- `pnpm build` 통과

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- @tanstack/react-query
- react-hook-form
- zod
- mysql2/promise

## Run

```bash
pnpm install
pnpm dev
```

기본 페이지는 `/` 이고, API는 모두 Next.js 서버에서만 MySQL에 연결합니다.
현재 기본 모드는 `APP_DATA_MODE=mock` 이라 DB 연결 없이도 화면과 저장 플로우를 확인할 수 있습니다.

추가 검증:

```bash
pnpm lint
pnpm test
pnpm build
```

## Environment

`.env.local` 예시는 아래와 같고, 같은 내용을 `.env.example` 에도 반영해 두었습니다.

```dotenv
APP_DATA_MODE=mock
STAGING_DATABASE_URL=mysql://amassadminmysqlsym:z2ZY2W%40DQdpY4dcxpq@amass-staging-mysql-sym-01.mysql.database.azure.com:3306/sym
PRODUCTION_DATABASE_URL=mysql://amass-scm-user:afosDK9LO9RKb6UwkH@amass-production-mysql-scm-01.mysql.database.azure.com:3306/scm
DEFAULT_SERVER_TARGET=staging
MYSQL_CONNECT_TIMEOUT_MS=5000
MYSQL_SSL_ENABLED=true
MYSQL_SSL_CA_PATH=
```

규칙:

- `APP_DATA_MODE=mock` 이 기본값이며, 1차 목표는 더미 데이터로 화면과 플로우를 검증하는 것입니다.
- 실제 DB 연결을 쓰려면 `APP_DATA_MODE=database` 로 변경합니다.
- `release` 환경은 별도 DB를 쓰지 않고 staging DB를 재사용합니다.
- `staging / release` DB는 회사 네트워크 내부에서만 접근 가능합니다.
- DB URL은 `NEXT_PUBLIC_*` 가 아니라 서버 전용 env만 사용합니다.
- staging 비밀번호의 `@` 문자는 URL에서 `%40` 으로 인코딩되어야 합니다.
- `product` 선택은 조회 전용이고 저장은 `403` 으로 차단됩니다.

## Phase 1 Scope

포함:

- mock health / search / detail / save 플로우
- 서버 연결 상태 확인
- 회원 검색: `id`, `login_id`, `email`, `phone_number`
- 회원 상세 조회
- 회원 수정:
  - `type`
  - `name`
  - `phone_number`
  - `email`
  - `bank_name`
  - `bank_number`
  - `bank_holder`
  - `status`
  - `marketing_use`
  - `sms_use`
  - `email_use`
  - `car_unlimited`
  - `max_car_limit`

제외:

- `password` 조회/수정
- `partsfit_mall_buyer_address`
- `partsfit_mall_buyer_oauth`
- `partsfit_mall_buyer_withdraw`
- 인증/권한 처리
- 페이지네이션

## API

- `GET /api/health/db?target=staging|release|product`
- `GET /api/buyers/search?target=...&field=id|login_id|email|phone_number&q=...&limit=20`
- `GET /api/buyers/:id?target=...`
- `PUT /api/buyers/:id?target=...`

응답 원칙:

- 성공 시 `{ ok: true, data: ... }`
- 실패 시 `{ ok: false, error: { code, message, hint?, details? } }`
- 성공 응답에는 `dataSource: "mock" | "database"` 가 포함됩니다.
- DB timeout / 연결 오류는 Azure 방화벽/VNet 점검 힌트를 함께 반환

## Project Structure

- `src/app/page.tsx`: 메인 진입 페이지
- `src/components/member-admin-page.tsx`: 검색/목록/상세 화면
- `src/components/buyer-detail-form.tsx`: 회원 수정 폼
- `src/app/api/health/db/route.ts`: DB 연결 확인 API
- `src/app/api/buyers/search/route.ts`: 회원 검색 API
- `src/app/api/buyers/[id]/route.ts`: 회원 상세 조회/수정 API
- `src/lib/env.ts`: 서버 전용 env 파싱
- `src/lib/data-source.ts`: mock / database 모드 해석
- `src/lib/db/mysql.ts`: mysql2 pool 생성
- `src/lib/db/targets.ts`: `release -> staging` 매핑 및 쓰기 제한
- `src/lib/buyer/schema.ts`: zod validation
- `src/lib/buyer/repository.ts`: buyer SQL repository
- `src/lib/mock/buyer-store.ts`: mock buyer 메모리 저장소

## DB Connection Notes

- `APP_DATA_MODE=mock` 에서는 DB에 연결하지 않고 메모리 기반 더미 데이터를 사용합니다.
- `APP_DATA_MODE=database` 일 때만 실제 `mysql2/promise` pool을 사용합니다.
- DB 연결은 `src/lib/db/mysql.ts` 에서 `mysql2/promise` pool로 생성합니다.
- TLS는 기본 활성화되며 `MYSQL_SSL_CA_PATH` 를 주면 CA 파일도 사용할 수 있습니다.
- `connectTimeout` 기본값은 `5000ms` 입니다.
- 클라이언트 번들에서는 DB 모듈을 직접 import 하지 않습니다.
- DB target 해석은 서버에서만 수행되며 `release` 는 staging pool을 재사용합니다.
- 회사 네트워크 외부에서 실행하면 `staging / release` 연결 실패가 정상일 수 있습니다.

## Data Handling Notes

- mock 저장 결과는 프로세스 메모리에만 유지되며 서버 재시작 시 초기화됩니다.
- `release` 는 mock 모드에서도 staging 더미 데이터를 재사용합니다.
- `product` 는 mock 모드에서도 읽기 전용입니다.
- `password` 는 어떤 API 응답에도 포함하지 않습니다.
- `login_id` 는 검색/표시만 가능하고 1차에서는 수정하지 않습니다.
- 빈 문자열은 서버에서 `NULL` 로 정규화합니다.
- `car_unlimited = true` 이면 `max_car_limit = NULL` 로 저장합니다.
- 저장 시 `updated_at = NOW(6)` 로 갱신합니다.
- 인증이 아직 없어서 `updated_by` 는 이번 단계에서 변경하지 않습니다.

## Troubleshooting

`2026-04-11` 기준 현재 네트워크에서 두 Azure MySQL 호스트 모두 `3306` 포트 연결이 timeout 되었습니다. 특히 `staging / release` 는 회사 네트워크 전용이라 사외 환경에서는 접속 실패가 정상일 수 있습니다. 실제 접속이 안 되면 아래를 순서대로 확인해야 합니다.

1. Azure MySQL이 `Public access` 인지 `Private access (VNet Integration)` 인지 확인합니다.
2. `Public access` 면 실행 환경의 공인 IP를 방화벽 규칙에 허용합니다.
3. `Private access` 면 앱 실행 환경이 같은 VNet에서 접근 가능한지 확인합니다.
4. 실행 환경에서 outbound `3306` 이 열려 있는지 확인합니다.
5. TLS 1.2+ 연결이 활성화되어 있는지 확인합니다.
6. host / username / database / connection URL 인코딩이 올바른지 재확인합니다.

참고 문서:

- https://learn.microsoft.com/en-us/azure/mysql/flexible-server/security-tls-how-to-connect
- https://learn.microsoft.com/en-us/azure/mysql/flexible-server/security-how-to-manage-firewall-portal
- https://learn.microsoft.com/en-us/azure/mysql/flexible-server/how-to-troubleshoot-common-connection-issues

## Mock Sample Queries

mock 모드에서 바로 확인할 수 있는 예시:

- `staging / release`
  - `login_id = qa-member-01`
  - `email = ops@techcorp.co.kr`
  - `phone_number = 01099887766`
  - `id = 101`
- `product`
  - `login_id = prod-member-01`
  - `email = admin@prod-biz.co.kr`
  - `id = 9001`
