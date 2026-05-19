# Festival POS Critical Issues

작성일: 2026-05-20

이 문서는 현재 Next.js 마이그레이션된 주문/POS 시스템을 **하루짜리 대학 축제 부스 운영** 기준으로 다시 평가한 핵심 문제 목록이다. 일반 상용 POS의 세금, 팁, 복잡한 정산, 장기 분쟁 처리, 좌석별 분리결제, 코스 운영 같은 범위는 의도적으로 후순위로 내렸다.

목표는 축제 당일 러시 타임에 다음 사고를 막는 것이다.

- 주문 누락
- 중복 주문
- 같은 금액 주문의 결제 오매칭
- 테이블 번호 기반 입금액 편법의 구조적 한계
- 고객이 안내 금액을 무시하고 원금액으로 입금한 경우의 처리 누락
- 품절/재고 과판매
- 조리 완료와 고객 수령 완료의 혼동
- 결제된 주문 취소/환불 필요 상태의 손실
- 관리자 API 오남용

## 현재 전제

- 주요 스키마 위치: `packages/db/schema.ts`
- 주요 mutation 위치: `apps/next/lib/server/d1-mutations.ts`
- 고객 주문 생성 API: `apps/next/app/api/order/route.ts`
- 관리자 결제/취소 API: `apps/next/app/api/admin/order/route.ts`, `apps/next/app/api/admin/deposit/route.ts`
- 조리 완료 API: `apps/next/app/api/admin/order/complete/route.ts`
- 조리 화면: `apps/next/app/admin/cooker/*`
- POS 화면: `apps/next/app/admin/pos/*`
- 고객 테이블 화면: `apps/next/app/client/table/[id]/*`

현재 도메인 모델은 대략 `tables`, `tableContexts`, `orders`, `payments`, `menuOrders`, `menus` 중심이다. 하루 부스 운영에는 이 정도가 출발점으로는 충분하지만, 아래 상태와 제약은 반드시 추적한다.

## 2026-05-20 P0 구현 현황

P0 계획은 `apps/next`를 source of truth로 두고 구현했다. 레거시 `apps/api`, `apps/web`는 새 결제/주문 정책에 연결하지 않는다.

| 영역 | 상태 | 해결 내용 | 남은 주의점 |
| --- | --- | --- | --- |
| 금액 단독 결제 매칭 제거 | 완료 | 입금 이벤트는 `bankTransactions`에 저장하고, 정확히 1건만 `expectedTransferAmount`와 일치할 때 자동 매칭한다. 원금액 입금, 100원 미만 오차, 복수 후보는 POS 확인이 필요하다. | 실제 은행 크롤러/수동 입력기가 `/api/admin/deposit` 새 계약만 사용해야 한다. |
| 테이블 번호 기반 입금액 편법 제거 | 완료 | 주문별 `paymentCode`와 `paymentCodeLeases`를 도입했다. 입금 요청 금액은 `expectedTransferAmount = originalAmount - paymentCode`다. | 고객 안내 문구는 모두 새 정책 기준으로 갱신했다. 현장 안내판/구두 안내도 같은 문구로 맞춰야 한다. |
| 가장 작은 paymentCode 발급 | 완료 | 활성 미결제 주문 기준으로 `1..99`를 오름차순 탐색하고 lease unique constraint로 확보한다. 결제/취소/만료 후 재사용 가능하다. | 99개 고갈 시 `409 Payment Code Exhausted`가 난다. 러시 타임 전 운영자가 이 메시지를 볼 수 있어야 한다. |
| 조건부 재고 차감 | 완료 | 주문 생성 시 `quantity >= ?`, `available = 1`, `deletedAt IS NULL` 조건부 update를 수행하고 changed row를 확인한다. 실패 시 부분 생성 데이터를 보상 복구한다. | D1 HTTP 결과의 changed row/meta 해석이 중요하므로 관련 helper 변경을 유지해야 한다. |
| 미결제 주문 TTL | 부분 완료 | `orders.expiresAt`, `payments.expiresAt`, `expireStalePendingOrders(now)`를 추가했고 주문 생성/paymentCode 발급 경로에서 만료 미결제 주문을 정리한다. | 백그라운드 cron/주기적 sweep은 아직 없다. 주문이 오래 방치될 수 있는 화면 진입/관리자 작업 시 sweep 호출을 더 늘리는 것이 좋다. |
| 주문 생성 idempotency | 완료 | `clientOrderId UNIQUE`를 추가했고 같은 `clientOrderId` 재시도는 기존 order/payment를 반환한다. 재고와 메뉴 주문을 중복 생성하지 않는다. | 클라이언트가 새 주문마다 안정적인 `clientOrderId`를 유지해야 한다. |
| 조리/수령 상태 분리 | 완료 | `menuOrders.status`를 `PENDING -> READY -> PICKED_UP`로 분리했다. 기존 `SERVED`는 migration/backfill에서 `PICKED_UP` 의미로 해석한다. | 운영 화면에서 `준비 완료`와 `수령 완료` 버튼을 혼동하지 않도록 라벨을 유지해야 한다. |
| 관리자 API guard | 완료 | `/api/admin/*` route에 `requireAdmin()`을 적용하고 비로그인, `USER`, `UNVERIFIED` 접근 거부 테스트를 추가했다. | 운영 전 관리자 계정/세션 생성 절차를 고정해야 한다. |
| 결제 후보 POS 처리 | 완료 | POS에 `입금 확인 필요` 패널을 추가했고 후보 확정/무시 API를 연결했다. | 원금액 입금이나 100원 미만 오차는 자동 확정하지 않고 운영자 판단이 필요하다. |
| paid 주문 취소/환불 추적 | 부분 완료 | 결제 완료 주문을 단순 삭제하지 않도록 상태 기반 취소 흐름과 안내 문구를 정리했다. | 별도 `refundNeeded`, `refundCompleted`, `cancelReason`, 환불 확인 UI/로그는 아직 남아 있다. |
| 고객 주문 조회 route 마이그레이션 | 남음 | 현재 고객 화면은 새 table 조회 데이터로 필요한 상태를 표시한다. | 기존 placeholder 성격의 `GET /api/order/[tableId]`류 조회 route가 남아 있으면 제거하거나 새 계약으로 마이그레이션해야 한다. |

### 구현 반영 파일

- 스키마/마이그레이션: `packages/db/schema.ts`, `packages/db/.migrations/0001_p0_troubleshooting.sql`
- 서버 mutation: `apps/next/lib/server/d1-mutations.ts`
- 주문/입금 API: `apps/next/app/api/order/*`, `apps/next/app/api/admin/order/*`, `apps/next/app/api/admin/deposit/*`
- 관리자 guard: `apps/next/lib/server/auth.ts`, `/api/admin/*` route handlers
- 조회 데이터: `apps/next/lib/server/table-queries.ts`
- 고객 UI 문구: `apps/next/app/client/table/[id]/components/*`
- POS/조리 UI: `apps/next/app/admin/pos/*`, `apps/next/app/admin/cooker/*`
- 테스트: `apps/next/lib/server/__tests__/*`
- 더미 데이터: `apps/next/scripts/seed-dummy-data.ts`

### 검증 현황

- `pnpm test`: 통과. API/unit 테스트 25개 통과.
- `pnpm typecheck:next`: 통과.
- `pnpm build`: 통과.
- `pnpm seed:dummy`: 새 스키마 기준 더미 데이터 생성 확인.
- Codex Browser: 고객 주문/입금 안내, POS 입금 후보 패널 문구와 상태 표시 확인.
- 참고: 로컬 migration CLI는 `drizzle-kit`, `wrangler` 설치/설정 부재로 실패했으나, migration SQL은 저장되어 있고 현재 D1 테스트 DB에는 D1 HTTP 경로로 idempotent schema 적용을 완료했다.

## P0. 결제 매칭을 금액 기준으로 하지 않기

### 현재 문제

`markDepositPaid()`는 `amount`가 같은 미결제 payment 중 최신 1건을 찾아 결제 완료 처리한다.

관련 위치:

- `apps/next/lib/server/d1-mutations.ts`의 `markDepositPaid(amount, bank, name, timestamp)`
- `apps/next/app/api/admin/deposit/route.ts`

축제 부스에서는 같은 금액 주문이 매우 자주 발생한다. 예를 들어 9,000원 주문이 여러 개 밀려 있으면, 실제 입금자와 다른 주문이 결제 완료될 수 있다.

### 원하는 흐름

1. 주문 생성 시 고객에게 짧은 주문번호를 보여준다.
2. POS 화면의 미결제 주문 카드에서 관리자가 특정 주문을 선택한다.
3. 결제 완료 API는 `amount`만 받지 않고 `orderId` 또는 `paymentId`를 필수로 받는다.
4. 계좌이체 매칭 보조 기능이 필요하면 `amount + depositor + displayNumber`로 후보를 좁히되, 자동 확정하지 않는다.

### 구현 포인트

- `markDepositPaid()`를 금액 검색 방식에서 `markPaymentPaid({ orderId | paymentId, method, depositor?, bank?, paidAt? })` 형태로 바꾼다.
- `/api/admin/deposit` 요청 스키마도 `orderId` 또는 `paymentId` 중심으로 변경한다.
- POS UI에서 "결제" 버튼은 선택된 주문의 id를 서버에 보낸다.
- 같은 금액 미결제 주문이 여러 개 있어도 API가 임의 주문을 선택하지 못하게 한다.

### 검증

- 같은 금액 주문 3개를 생성한다.
- 두 번째 주문만 결제 처리한다.
- DB에서 두 번째 주문의 payment만 `paid = true`인지 확인한다.
- POS 화면에서 결제 완료된 주문과 미결제 주문이 분리되어 보이는지 확인한다.

## P0. 테이블 번호 기반 입금액 편법을 주문별 paymentCode로 교체

### 현재 문제

레거시 시스템은 테이블 생성 시 `table.key`를 붙이고, 주문 생성 시 결제 금액을 `메뉴 합계 - table.key`로 저장한다. 이후 은행 입금내역 금액을 보고 `% 100` 또는 100원 미만 차이를 이용해 테이블 번호를 역산하는 방식으로 같은 금액 주문을 구분해왔다.

관련 위치:

- 레거시 주문 생성: `apps/api/src/controller/order.controller.ts`의 `payment.amount = menu total - table.key`
- Next 이식 코드: `apps/next/lib/server/d1-mutations.ts`의 `createClientOrder()`에서 `amount = menu total - table.key`
- 레거시 입금 API: `apps/api/src/routes/admin/deposit.ts`
- Next 입금 API: `apps/next/app/api/admin/deposit/route.ts`
- 입금 request 타입: `packages/shared/types/requests/admin/deposit.ts`
- 고객 입금 안내 모달: `apps/next/app/client/table/[id]/components/order/order.payment.modal.tsx`

이 방식은 결제 식별자가 테이블 구조에 묶여 있다. 같은 테이블에서 여러 주문이 생기거나, 테이블 이름/id/key가 바뀌거나, 픽업형 주문번호를 도입하면 결제 식별 규칙이 깨진다. 또한 사용자가 안내 금액을 확인하지 않고 원금액 그대로 입금하면 자동 매칭이 실패하거나 잘못된 주문에 붙을 수 있다.

### 원하는 흐름

1. 주문 생성 시 `originalAmount`를 메뉴 합계로 계산한다.
2. 현재 활성 미결제 payment 사이에서 `1..99` 중 가장 작은 사용 가능 `paymentCode`를 발급한다.
3. `expectedTransferAmount = originalAmount - paymentCode`로 저장한다.
4. 고객에게는 원금액, 식별코드, 실제 입금액을 함께 보여준다.
5. 은행 입금내역은 먼저 `bankTransactions`에 저장한다.
6. matcher가 자동 확정 가능한 입금만 결제 완료 처리한다.
7. 애매한 입금은 POS의 후보 리스트에서 직원이 수동 확정한다.

### 코드 발급 정책

- `paymentCode`는 `1..99` 범위에서만 발급한다.
- 항상 가장 작은 빈 코드를 선택한다.
- 빈 코드 판단 기준은 `PENDING` 또는 미결제 상태의 활성 payment다.
- 결제 완료, 주문 취소, 결제 만료 시 코드를 즉시 반환한다.
- 코드 고갈 시 새 주문을 `409 Payment Code Exhausted`로 막거나 현장 수동 결제로 유도한다.
- 가능하면 `paymentCodeLeases` 같은 별도 테이블을 두고 `code`를 primary key로 잡아 동시 주문 경쟁을 막는다.

권장 lease 테이블:

```txt
paymentCodeLeases
- code
- paymentId
- expiresAt
- createdAt
```

권장 payment 필드:

```txt
payments
- orderId
- paymentCode
- originalAmount
- expectedTransferAmount
- depositorHint
- status: PENDING | PAID | MANUAL_REVIEW | EXPIRED | CANCELLED
- expiresAt
- paidAt
- matchedBankTransactionId
- matchedBy
```

권장 입금내역 테이블:

```txt
bankTransactions
- id
- amount
- depositor
- receivedAt
- rawText
- source: KB_PUSH | KB_SMS | SELENIUM | MANUAL
- matchedPaymentId
- status: UNMATCHED | AUTO_MATCHED | NEEDS_REVIEW | IGNORED
- createdAt
```

### 입금 매칭 규칙

자동 확정 가능한 경우:

- `amount == expectedTransferAmount`인 활성 미결제 후보가 정확히 1건이다.
- 또는 `amount == originalAmount`인 활성 미결제 후보가 정확히 1건이고, 같은 입금액에 대한 `expectedTransferAmount` exact 후보가 없다.

POS 확인이 필요한 경우:

- `abs(amount - expectedTransferAmount) < 100`인 후보가 1건 이상이다.
- 고객이 원금액 그대로 입금했고 `originalAmount` 후보가 여러 건이다.
- 입금자명에 주문번호나 코드가 포함되어 있지만 금액 후보가 복수다.
- 입금액은 비슷하지만 원금액/요청금액 차이가 운영자가 확인해야 할 수준이다.

자동 매칭하면 안 되는 경우:

- 후보가 2건 이상인데 우선순위를 결정할 근거가 없다.
- 이미 결제 완료된 payment와만 매칭된다.
- 만료/취소된 주문과만 매칭된다.
- 입금액이 모든 후보와 100원 이상 차이 난다.

### POS 후보 리스트

POS에는 `입금 확인 필요` 패널을 둔다.

각 입금내역 행에는 다음 정보를 보여준다.

- 실제 입금액
- 입금자명
- 입금 시각
- 후보 주문번호 또는 테이블명
- 주문 원금액
- 요청 입금액
- 실제 입금액과 요청 입금액의 차이
- 매칭 사유: exact amount, original amount, within 100, depositor hint

직원이 선택할 수 있는 액션:

- 이 주문으로 매칭
- 보류
- 무시
- 수동 결제 완료 처리

### 구현 포인트

- `createClientOrder()`에서 `table.key` 차감을 제거한다.
- `allocatePaymentCode(originalAmount)` 유틸을 만든다.
- 만료된 미결제 payment와 lease를 먼저 정리한 뒤 1부터 99까지 순회한다.
- `expectedTransferAmount`도 활성 미결제 payment 사이에서 중복되지 않도록 가능한 코드를 고른다.
- `INSERT OR IGNORE` 또는 equivalent 방식으로 lease 획득 경쟁을 처리한다.
- `/api/admin/deposit`는 바로 payment를 paid로 바꾸지 말고, 먼저 `bankTransactions`에 저장한 뒤 matcher 결과에 따라 처리한다.
- 기존 `amount` 컬럼은 migration 중 `expectedTransferAmount`와 같은 값으로 유지해 UI/테스트 호환을 확보한다.
- 고객 입금 안내 모달은 `amount` 하나만 받지 말고 `originalAmount`, `paymentCode`, `expectedTransferAmount`를 표시한다.

### 검증

- 미결제 주문이 없을 때 첫 주문은 `paymentCode = 1`을 받는다.
- 1, 2, 3번 코드가 사용 중이면 다음 주문은 4번을 받는다.
- 1번 주문이 결제 완료되면 다음 신규 주문은 다시 1번을 받을 수 있다.
- 같은 원금액 주문 2건이 있을 때 원금액 그대로 입금되면 자동 매칭되지 않고 POS 확인으로 간다.
- `expectedTransferAmount`와 정확히 일치하는 입금 후보가 단건이면 자동 결제 완료된다.
- 100원 미만 오차 후보는 POS 후보 리스트에 뜨고 자동 확정되지 않는다.
- 테이블 key를 바꿔도 결제 식별이 깨지지 않는다.

## P0. 재고 차감 race condition 막기

### 현재 문제

주문 생성 시 현재 재고를 먼저 조회한 뒤, 이후 `UPDATE menus SET quantity = quantity - ?`로 차감한다.

관련 위치:

- `apps/next/lib/server/d1-mutations.ts`의 `createClientOrder()`

동시 주문이 들어오면 두 요청이 모두 "재고 있음"으로 판단한 뒤 과판매될 수 있다.

### 원하는 흐름

1. 서버가 주문 생성 요청을 받는다.
2. 각 메뉴에 대해 `quantity >= requestedQuantity`와 `available = 1`을 조건으로 원자적 차감을 시도한다.
3. 하나라도 차감 실패하면 주문을 생성하지 않는다.
4. 앞에서 이미 차감한 항목이 있으면 즉시 복구한다.
5. 성공한 경우에만 order, menuOrders, payment를 생성한다.

### 구현 포인트

- 가능하면 D1 transaction/batch로 묶는다.
- 최소 방어선으로 다음 형태의 조건부 update를 사용한다.

```sql
UPDATE menus
SET quantity = quantity - ?, updatedAt = ?
WHERE id = ?
  AND deletedAt IS NULL
  AND available = 1
  AND quantity >= ?
```

- update result의 changed row 수를 확인한다.
- 실패 시 사용자에게 "방금 품절되었습니다" 수준의 명확한 메시지를 반환한다.
- 주문 생성 중복 방지 idempotency와 같이 구현하는 것이 좋다.

### 검증

- 재고 1개 메뉴에 대해 동시에 2개 주문을 보낸다.
- 성공은 1건만이어야 한다.
- 실패 주문은 order/payment/menuOrders를 남기면 안 된다.
- 최종 재고는 음수가 되면 안 된다.

## P0. 미결제 주문이 재고를 영구 점유하지 않게 하기

### 현재 문제

현재는 고객이 주문을 만들면 결제 전이어도 재고가 차감된다. 고객이 결제를 하지 않고 이탈하면 재고가 묶인다.

관련 위치:

- `apps/next/lib/server/d1-mutations.ts`의 `createClientOrder()`
- POS 결제 흐름

### 운영 정책 선택지

축제 부스 기준 추천 정책은 둘 중 하나다.

1. **결제 확인 후 주문 확정**
   - 고객 장바구니 제출은 "대기 주문"을 만들고, 재고는 확정 시 차감한다.
   - POS 직원이 결제 확인 버튼을 누를 때 order/payment/menuOrders를 확정한다.
   - 과판매 방지를 위해 결제 확인 순간에도 재고 조건부 차감을 해야 한다.

2. **주문 생성 시 재고 예약 + 짧은 TTL**
   - 지금 구조와 가까운 방식이다.
   - 미결제 주문은 3~5분 뒤 자동 취소하고 재고를 복구한다.
   - POS 화면에 "결제 대기 남은 시간"을 표시한다.

하루 부스에서는 구현 난이도와 운영 속도를 고려해 2번이 현실적이다. 다만 타이머/만료 처리가 반드시 필요하다.

### 구현 포인트

- `orders` 또는 `payments`에 `expiresAt`, `status`를 추가한다.
- 미결제 주문은 `PAYMENT_PENDING` 상태로 둔다.
- 만료된 미결제 주문은 자동 또는 관리자 버튼으로 취소하고 재고를 복구한다.
- 주문 생성 API, POS 목록 API, 조리 화면 모두 만료/미결제 주문을 다르게 취급해야 한다.
- 조리 화면에는 결제 완료 주문만 들어가야 한다.

### 검증

- 미결제 주문 생성 후 POS에 결제 대기로 표시된다.
- TTL이 지난 주문은 조리 화면에 나타나지 않는다.
- 만료 처리 후 재고가 복구된다.
- 결제 완료된 주문은 만료 처리 대상에서 제외된다.

## P0. 주문 생성 idempotency 추가

### 현재 문제

고객이 "주문하기"를 더블 클릭하거나 네트워크 재시도로 같은 요청이 두 번 들어가면 중복 주문이 생길 수 있다.

관련 위치:

- `apps/next/app/client/table/[id]/components/cart/cart.modal.tsx`
- `apps/next/app/api/order/route.ts`
- `apps/next/lib/server/d1-mutations.ts`

### 원하는 흐름

1. 클라이언트가 장바구니 주문 시 `clientOrderId`를 생성한다.
2. 서버는 `clientOrderId`를 unique하게 저장한다.
3. 같은 `clientOrderId` 요청이 다시 오면 기존 주문 결과를 반환하고 새 주문을 만들지 않는다.

### 구현 포인트

- `orders`에 `clientOrderId` 컬럼을 추가하거나, 별도 `requestIdempotencyKeys` 테이블을 둔다.
- 하루짜리 시스템에서는 `orders.clientOrderId UNIQUE`가 가장 간단하다.
- 클라이언트는 모달 열 때가 아니라 실제 주문 제출 직전에 id를 만들고, 요청 성공/실패 정책을 명확히 한다.
- 이미 성공한 요청의 재시도는 성공 응답을 재반환한다.
- 실패한 요청의 재시도는 새 id를 쓰거나 실패 상태를 명확히 저장해야 한다.

### 검증

- 같은 `clientOrderId`로 `/api/order`를 두 번 호출한다.
- order/payment/menuOrders는 한 세트만 생긴다.
- 재고도 한 번만 차감된다.

## P0. 조리 완료와 수령/서빙 완료 상태 분리

### 현재 문제

`menuOrderStatus`는 `PENDING`, `SERVED`, `CANCELLED`뿐이다. 조리 화면의 "조리 완료"가 바로 `SERVED`로 저장된다.

관련 위치:

- `packages/db/schema.ts`의 `menuOrderStatus`
- `apps/next/app/api/admin/order/complete/route.ts`
- `apps/next/app/admin/cooker/components/menu.instance.tsx`
- `apps/next/app/admin/pos/components/table/table.instance.tsx`

축제 부스에서는 "조리 완료"와 "고객이 가져감"이 다르다. 특히 픽업형 운영이면 준비 완료 주문이 쌓이고, 고객 호출/수령 확인이 필요하다.

### 추천 상태

최소 상태:

- `PENDING`: 결제 완료 후 조리 대기/조리 중
- `READY`: 조리 완료, 고객 수령 대기
- `PICKED_UP` 또는 `SERVED`: 고객 수령/서빙 완료
- `CANCELLED`: 취소

테이블 서빙 중심이면 `SERVED`, 픽업 중심이면 `PICKED_UP`이 더 명확하다. 대학 축제 부스는 보통 픽업형이므로 `PICKED_UP`을 추천한다.

### 원하는 흐름

1. 결제 완료 주문만 cooker 화면에 표시된다.
2. cooker의 "조리 완료"는 `PENDING -> READY`로만 변경한다.
3. POS 또는 픽업 화면에서 "수령 완료"를 누르면 `READY -> PICKED_UP`으로 변경한다.
4. 테이블/주문 목록은 상태별로 색상과 카운트를 다르게 표시한다.

### 구현 포인트

- `menuOrderStatus` enum 확장.
- `/api/admin/order/complete`는 이름을 유지하더라도 내부적으로 `READY`로 바꾸거나, 새 route `/api/admin/order/ready`를 추가한다.
- 별도 route `/api/admin/order/pick-up` 또는 `/api/admin/order/serve`를 추가한다.
- `TableInstance`의 완료 아이콘/금액/진행 상태 계산을 새 상태에 맞게 수정한다.
- 주문 전체가 모두 `PICKED_UP`이면 table vacate 가능 조건에 반영한다.

### 검증

- 결제 완료 주문이 cooker에 뜬다.
- 조리 완료 버튼 클릭 후 cooker pending 목록에서 빠지고 POS ready 목록에 표시된다.
- 수령 완료 클릭 후 주문이 완료 영역으로 이동한다.
- 아직 `READY`인 주문이 있으면 테이블 정리/퇴장 처리 정책이 의도대로 동작한다.

## P1. 관리자 API guard 추가

### 현재 문제

관리자 mutation route들이 공통적으로 세션/권한 확인을 강제하는 구조인지 확인 및 보강이 필요하다. 축제장 QR/공용 네트워크에서는 admin API가 직접 호출되면 주문 취소, 결제 완료, 메뉴/테이블 변경이 가능해질 수 있다.

대상:

- `/api/admin/*`의 POST/PUT/DELETE
- 특히 `/api/admin/order`, `/api/admin/deposit`, `/api/admin/order/complete`, `/api/admin/table/*`, `/api/admin/menu*`

### 하루 부스 기준 최소 정책

- 복잡한 RBAC는 필요 없다.
- `ADMIN` 세션만 관리자 mutation 가능하게 한다.
- 운영 편의를 위해 관리자 계정 하나 또는 PIN 기반 간단 로그인도 가능하다.

### 구현 포인트

- `apps/next/lib/server/auth-session.ts` 또는 새 guard에 `requireAdmin()` 추가.
- 모든 admin mutation route 시작 지점에서 호출한다.
- 실패 시 401/403을 명확히 반환한다.
- 관리자 화면은 세션 없으면 `/auth` 또는 홈으로 보낸다.

### 검증

- 비로그인 상태에서 `/api/admin/order` 호출 시 실패한다.
- `USER`/`UNVERIFIED` 역할이면 실패한다.
- `ADMIN`이면 기존 mutation이 성공한다.

## P1. 결제된 주문 취소를 삭제가 아닌 취소 상태로 기록

### 현재 문제

`admin/order DELETE`는 `allowPaid: true`로 결제된 주문도 soft delete하고 재고를 복구한다.

관련 위치:

- `apps/next/app/api/admin/order/route.ts`
- `apps/next/lib/server/d1-mutations.ts`의 `cancelOrder(orderId, { allowPaid: true })`

하루 부스에서도 결제된 주문 취소는 "환불 필요/환불 완료/음식 폐기 여부"가 남아야 한다. soft delete만 하면 운영자가 나중에 현금/계좌 환불 여부를 확인하기 어렵다.

### 원하는 흐름

1. 미결제 주문 취소는 기존처럼 재고 복구 후 취소 처리한다.
2. 결제된 주문 취소는 주문을 숨기지 말고 `CANCELLED` 상태와 사유를 남긴다.
3. 환불이 필요한 경우 `refundNeeded = true` 또는 payment 상태를 `REFUND_PENDING`으로 둔다.
4. 실제 환불 완료 후 `REFUNDED`로 표시한다.

### 구현 포인트

- 하루 부스에서는 완전한 refund ledger 대신 다음 최소 컬럼이면 충분하다.
  - `orders.status`: `ACTIVE | CANCELLED`
  - `orders.cancelReason`
  - `orders.cancelledAt`
  - `payments.status`: `PENDING | PAID | REFUND_PENDING | REFUNDED`
- 또는 기존 컬럼 변경을 최소화하려면 `deletedAt`을 쓰지 말고 `menuOrders.status = CANCELLED`와 payment 메모 컬럼을 추가한다.
- POS UI에 "결제됨 취소"와 "미결제 취소"를 분리해서 표시한다.

### 검증

- paid 주문 취소 후 목록에서 취소 기록이 보인다.
- 재고 복구 정책이 결제 취소/환불 정책과 일치한다.
- 환불 필요 주문 수를 POS에서 확인할 수 있다.

## P1. 주문번호 displayNumber 도입

### 현재 문제

시스템은 테이블 중심이고 내부 id는 사람이 읽기 어렵다. 축제 부스 운영에서는 고객에게 "12번 주문 준비 완료"처럼 짧은 주문번호가 필요하다.

### 원하는 흐름

1. 주문 생성 시 당일 증가 번호를 생성한다.
2. 고객 주문 완료 화면, POS 주문 목록, cooker 화면, 픽업 화면에 같은 번호를 표시한다.
3. 결제/수령/취소 처리도 주문번호로 찾을 수 있게 한다.

### 구현 포인트

- `orders.displayNumber` 컬럼 추가.
- 하루짜리 운영이면 날짜별 reset까지 복잡하게 하지 않아도 된다. seed/reset 스크립트에서 초기화하면 충분하다.
- 동시 생성 충돌을 막기 위해 sequence 테이블 또는 DB max+1 lock 정책이 필요하다.
- 단기 구현은 `createdAt` 순번 표시로 시작할 수 있으나, 운영 중 번호가 바뀌면 안 되므로 DB 컬럼 저장이 더 안전하다.

### 검증

- 주문 1, 2, 3 생성 시 displayNumber가 고정된다.
- 새로고침해도 번호가 바뀌지 않는다.
- POS/cooker/client 화면에서 같은 번호가 보인다.

## P1. 고객 주문 조회 route 마이그레이션

### 현재 문제

고객 주문 목록/상세 조회 route가 아직 notMigrated 상태다.

관련 위치:

- `apps/next/app/api/order/[tableId]/route.ts`
- `apps/next/app/api/order/[tableId]/[orderId]/route.ts`

고객이 주문 상태를 다시 확인할 수 없으면, 축제 현장에서 "내 주문 들어갔나요?" 문의가 늘어난다.

### 원하는 흐름

1. 고객 테이블 화면에서 현재 테이블/주문번호 기준으로 주문 상태를 확인한다.
2. 미결제, 결제 완료, 조리 중, 준비 완료, 수령 완료 상태가 보인다.
3. 취소/만료 주문도 명확히 표시한다.

### 구현 포인트

- 기존 `getTablePageData`/`table-queries`를 재사용해 read route를 구현한다.
- response 타입을 현재 client UI가 기대하는 형태에 맞춘다.
- paid 여부와 menuOrder status를 함께 내려준다.

### 검증

- 주문 직후 client 화면에서 주문 상태를 조회할 수 있다.
- 조리 완료/수령 완료 상태 변경 후 client 조회 결과가 바뀐다.
- 취소/만료 주문이 잘못해서 진행 중처럼 보이지 않는다.

## 후순위로 미룰 항목

하루 축제 부스 운영 기준으로 당장 구현하지 않아도 된다.

- 복잡한 세금 계산
- 팁
- 카드 settlement/batch 정산
- 장기 감사 로그
- 좌석별 split check
- 코스/hold/fire
- 복잡한 modifier pricing/tax
- 다단계 직원 권한
- 영수증 재발행/회계 리포트
- 장기 분쟁 해결 워크플로

단, 아래 최소 기록은 하루 운영에서도 필요하다.

- 주문 생성 시각
- 결제 완료 시각
- 조리 완료 시각
- 수령/서빙 완료 시각
- 취소 시각과 사유
- 환불 필요 여부

## 구현 순서별 현황

1. [완료] `displayNumber`와 `clientOrderId` 추가
2. [완료] 주문별 `paymentCode`, `originalAmount`, `expectedTransferAmount` 추가
3. [완료] `paymentCodeLeases`와 `bankTransactions` 추가
4. [완료] 주문 생성 idempotency 적용
5. [완료] 재고 조건부 차감 적용
6. [부분 완료] 미결제 주문 TTL 적용. 주문 생성/코드 발급 경로의 stale cleanup은 있으나 cron 또는 관리자 sweep은 추가 필요
7. [완료] 결제 처리 API를 `orderId/paymentId` 기준으로 변경하고 `/api/admin/deposit`를 입금내역 ingestion + matcher로 변경
8. [완료] POS 입금 후보 확인 UI 추가
9. [완료] `PENDING -> READY -> PICKED_UP` 상태 전이 추가
10. [남음] 고객 주문 조회 route 마이그레이션. 현재 화면 동작은 table 조회 데이터로 커버되지만 placeholder route 정리가 필요
11. [완료] 관리자 API guard 추가
12. [부분 완료] paid 주문 취소/환불 필요 상태 기록. 삭제 방지는 반영했지만 환불 ledger와 확인 UI는 남음

## 다음 작업 시작 시 체크리스트

- live D1 schema와 migration SQL이 동일한지 운영 전 한 번 더 확인한다. 특히 수동 D1 HTTP 적용과 migration CLI 적용이 섞이지 않게 한다.
- `drizzle-kit`, `wrangler` 기반 migration 명령을 복구해 같은 schema를 재현 가능하게 만든다.
- 실제 KB 국민은행 ingestion 또는 수동 입금 입력 흐름이 `/api/admin/deposit` 새 계약만 호출하는지 확인한다.
- 현장 고객 안내 문구, 계좌 안내 이미지, 운영자 구두 안내를 모두 `주문금액 - 결제코드 = 입금금액`으로 통일한다.
- Browser로 실제 UI 클릭, API 호출, DB 반영, 새로고침 후 UI 반영까지 다시 확인한다.
- 같은 금액 주문, paymentCode 고갈, 원금액 그대로 입금, 100원 미만 오차 입금, 동시 주문, 더블 클릭, 미결제 방치, 조리 완료 후 수령 미완료 케이스를 반드시 시뮬레이션한다.
- 환불 필요 주문의 운영 기록 방식(`refundNeeded`, `refundCompleted`, `cancelReason`, 담당자)을 정한 뒤 paid 취소 흐름을 마저 닫는다.
- 레거시 `apps/api`, `apps/web`가 같은 DB를 건드릴 가능성이 있으면 배포/실행에서 비활성화하거나 동일 정책으로 별도 이식한다.
