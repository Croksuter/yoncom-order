# KB Bank Deposit Webhook Bridge

별도 실행되는 Python Selenium 서비스입니다. 사용자가 Chrome에서 KB 로그인을 직접 완료하고 계좌 조회 화면까지 이동한 뒤 `y`를 입력하면, 자동화가 실제 화면의 `조회` 버튼을 주기적으로 누르고 `거래상세내역` DOM 테이블을 파싱합니다. 입금 거래만 Yoncom 앱의 `/api/admin/deposit` route로 보냅니다.

이 앱은 은행 인증을 자동화하지 않습니다. 비밀번호, 공동인증서, OTP, MFA, 보안 프로그램 우회 코드는 넣지 않습니다. 로그인과 조회 화면 진입은 항상 사용자가 브라우저에서 직접 완료합니다.

## Setup

```bash
cd apps/kb-bank-webhook
cp .env.example .env
uv sync
```

`.env`에 `YONCOM_APP_BASE_URL`, `YONCOM_ADMIN_EMAIL`, `YONCOM_ADMIN_PASSWORD`를 채웁니다. `.env`와 Chrome profile, 로그, state 파일은 gitignored입니다.

## Run

루트에서 실행:

```bash
pnpm run kb-webhook
```

앱 디렉터리에서 직접 실행:

```bash
uv run python -m kb_bank_webhook --env-file .env
```

1. 열린 Chrome 창에서 KB 로그인을 직접 완료합니다.
2. `국민은행 계좌조회 > 예금 > 간편조회` 화면까지 이동하고 거래내역 테이블이 보이는지 확인합니다.
3. 터미널에서 `y`를 입력합니다.
4. 첫 cycle은 기존 화면에 이미 있던 입금 row를 baseline으로만 기록하고 Yoncom API로 보내지 않습니다.
5. 이후 cycle부터 앱이 화면의 `조회` 버튼을 주기적으로 누릅니다.
6. 조회 결과 DOM 테이블을 파싱하고, `KB_DRY_RUN=false`일 때 새 입금 거래만 Yoncom `/api/admin/deposit`로 전송합니다.

한 번만 조회하려면:

```bash
uv run python -m kb_bank_webhook --env-file .env --once
```

`--once`를 붙이면 한 cycle 후 종료합니다. 계속 감시하려면 `--once` 없이 실행하세요. `KB_DRY_RUN=true`에서는 거래를 Yoncom으로 보내지 않고 state 파일도 갱신하지 않습니다. 단, 실행 중 같은 거래를 반복해서 새 입금으로 세지 않도록 process memory에는 dedupe key를 기록합니다.

## Browser Reuse

기본값은 앱 내부 `.chrome-profile`을 Chrome user data dir로 사용하고, Selenium 종료 후에도 브라우저를 남깁니다.

```bash
KB_CHROME_USER_DATA_DIR=.chrome-profile
KB_CHROME_PROFILE_DIRECTORY=Default
KB_CHROME_DETACH=true
KB_CHROME_REMOTE_DEBUGGING_PORT=9222
```

이미 remote debugging port로 떠 있는 Chrome에 붙으려면:

```bash
KB_CHROME_DEBUGGER_ADDRESS=127.0.0.1:9222
```

은행 서버 세션이 만료되면 브라우저가 남아 있어도 다시 로그인해야 합니다. 이 기능은 브라우저/프로필 재사용을 돕는 것이고, 은행의 server-side 자동 로그아웃을 우회하지 않습니다.

## DOM Contract

자동화는 아래 구조만 의존합니다.

- 조회 버튼: `form[name="IBF"] button.btn-com.c2`
- 결과 테이블: `summary` 또는 `caption`에 `거래상세내역`이 포함된 `table`
- 컬럼: `거래일시`, `적요`, `보낸분/받는분`, `출금액(원)`, `입금액(원)`, `잔액(원)`, `송금메모`, `거래점`

`입금액(원)`이 0보다 큰 row만 deposit payload로 변환합니다.

## Logs

콘솔 로그는 timestamp, level, event, cycle id, counts가 한 줄에 보이도록 출력됩니다.

```text
2026-05-27 01:23:45 | INFO    | deposit baseline | at=2026-05-27T00:15:22 | name=홍길동 | amount=1 | balance=2 | branch=하나은행 | key=KB:...
2026-05-27 01:23:46 | INFO    | cycle complete | cycle=2026-05-26T16-23-46-000Z-0001 | total=1 | deposits=1 | new=0 | mode=posted | skipped=0 | baseline=1 | elapsed=1.20s
```

각 cycle의 DOM snapshot과 파싱 결과는 기본적으로 `.logs`에 저장됩니다. JSON 로그에는 `loggedAt`과 `cycleId`가 같이 들어갑니다.

```bash
KB_LOG_DIR=.logs
KB_SAVE_DOM=true
```

저장 파일은 cycle id prefix를 공유합니다.

- `*-kb-dom.html`: 현재 KB 화면 HTML snapshot
- `*-kb-rows.json`: 테이블에서 읽은 raw row
- `*-parse-summary.json`: 파싱된 거래 요약과 deposit dedupe key
- `*-yoncom-sign-in-*`, `*-yoncom-deposit-*`: dry-run이 아닐 때 Yoncom API 요청/응답

Yoncom 로그인 password, cookie, CSRF header는 로그에서 마스킹합니다.

## Yoncom Contract

전송 payload는 기존 `packages/shared/types/requests/admin/deposit.ts` 계약을 따릅니다.

```json
{
  "amount": 10000,
  "bank": "KB",
  "timestamp": 1770000000000,
  "name": "입금자명",
  "rawText": "2026.05.27 00:15:22 입금 입금자명 전자금융 10,000",
  "source": "SELENIUM",
  "dedupeKey": "KB:..."
}
```

Yoncom route는 admin session, CSRF token, `Idempotency-Key`를 요구합니다. 이 앱은 `YONCOM_ADMIN_EMAIL/PASSWORD`로 `/api/auth/sign-in`을 호출해 session과 CSRF cookie를 받은 뒤 deposit route를 호출합니다.

## Test

```bash
pnpm run kb-webhook:test
```
