# yoncom-order 시스템 Mermaid 다이어그램 모음집

이 문서는 현재 `apps/next` 코드베이스 기준으로 연컴 오더(yoncom-order)의 **화면/모달 전환 흐름**, **데이터 상태 수명 주기**, **실시간 동기화 경계**, **최단 검증 시퀀스**를 정리한 Mermaid 소스 모음입니다. 고객 화면은 `useTranslation`과 `language.store`로 한국어/영어 런타임 전환을 지원하고, 메뉴/카테고리는 기본 한국어 필드와 선택 영문 필드를 함께 사용합니다.

공통 색상 규칙:

- 성공 토스트: 초록색
- 실패 토스트: 빨간색
- 로딩중 오버레이가 뜨는 API 호출: 보라색
- 모달: 노란색

---

## 1. 고객용 화면 및 모달 전환 흐름도 (Client-Side Transitions)

고객은 이미 관리자에 의해 활성화된 테이블 컨텍스트가 있는 QR URL(`/client/table/:id`)에 진입해야 합니다. QR 스캔 자체는 테이블 점유를 만들지 않고, `POST /api/table/session`은 활성 테이블 컨텍스트가 없으면 실패합니다.

```mermaid
flowchart TD
    classDef page fill:#e0f2fe,stroke:#0369a1,stroke-width:1.5px;
    classDef modal fill:#fff2cc,stroke:#d97706,stroke-width:1.5px,stroke-dasharray:5 5;
    classDef loading fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px;
    classDef error fill:#fee2e2,stroke:#dc2626,stroke-width:2px;
    classDef success fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef state fill:#f8fafc,stroke:#475569,stroke-width:1.5px;

    Loading[로딩 스켈레톤 화면]:::page --> StartSession["POST /api/table/session<br/>테이블 세션 시작"]:::loading
    StartSession -->|활성 tableContext 없음| InvalidTable["존재하지 않거나<br/>활성화되지 않은 테이블"]:::error
    StartSession -->|세션 쿠키 발급| SyncSnapshot["GET /api/sync/table?afterRevision=0<br/>초기 스냅샷 동기화"]:::loading
    SyncSnapshot --> HydrateLanguage["language.store localStorage<br/>ko/en 선호값 로드"]:::state
    HydrateLanguage --> LoadMenu["GET /api/menu<br/>메뉴 로드"]:::loading
    LoadMenu --> DecisionOrder{활성 미해결 결제 주문?}:::state

    DecisionOrder -->|없음| MenuTab["메뉴 탐색 화면 <Menus>"]:::page
    MenuTab -->|헤더 언어 버튼| LanguageToggle["언어 전환<br/>useTranslation + language.store"]:::state
    LanguageToggle --> MenuTab
    DecisionOrder -->|PENDING + 금액 확인 전| AmountVerify["입금 금액 확인 모달 <OrderModal>"]:::modal
    DecisionOrder -->|PENDING + 금액 확인 완료| PayPanel["결제 안내 화면 <OrderPaymentPanel><br/>⏱️#2"]:::page
    DecisionOrder -->|MANUAL_REVIEW| ReviewState["메뉴/주문내역 화면<br/>하단 '입금 확인 중' 표시"]:::page
    AmountVerify -->|정확한 입금액 입력 후 확인| PayPanel
    AmountVerify -->|주문 취소| CancelPending["DELETE /api/order<br/>입금 전 주문 취소"]:::loading
    CancelPending --> CancelSuccess["주문 취소 완료 토스트"]:::success
    CancelPending --> CancelFail["주문 취소 실패 토스트"]:::error
    CancelSuccess --> MenuTab

    MenuTab -->|하단 '주문내역' 클릭| OrderHistory["주문 내역 화면 <OrderHistoryPanel><br/>⏱️#1"]:::page
    OrderHistory -->|하단 '메뉴' 클릭| MenuTab
    OrderHistory -->|주문 카드 클릭| OrderDetail["주문 상세 모달 <OrderDetailModal>"]:::modal

    MenuTab -->|메뉴 카드 클릭| RefreshMenu["GET /api/menu<br/>최신 재고 재조회"]:::loading
    RefreshMenu -->|판매 가능| CartAdd["메뉴 담기/수량 변경 모달 <CartAddModal>"]:::modal
    RefreshMenu -->|품절/비활성| SoldOutToast["품절 또는 비활성 토스트"]:::error
    CartAdd -->|담기 확인| MenuTab

    MenuTab -->|장바구니 FAB 클릭| CartView["장바구니 모달 <CartModal>"]:::modal
    CartView -->|주문 완료하기| RequestOrder["POST /api/order<br/>주문 생성"]:::loading
    RequestOrder -->|성공| OrderCreatedToast["주문이 완료되었습니다 토스트"]:::success
    OrderCreatedToast --> AmountVerify
    RequestOrder -->|재고부족/미결제중복 등 실패| OrderFailToast["주문 실패 토스트"]:::error
    OrderFailToast --> CartView

    PayPanel -->|'토스 앱으로 간편 송금' 클릭| TossDeepLink["supertoss://send 딥링크"]:::state
    TossDeepLink --> BankWait[은행 이체망 처리 대기]:::state
    PayPanel -->|계좌번호 복사| CopyAccount["계좌번호 복사 완료 토스트"]:::success
    PayPanel -->|입금액 복사| CopyAmount["입금액 복사 완료 토스트"]:::success
    CopyAccount --> BankWait
    CopyAmount --> BankWait

    BankWait -->|자동/수동 입금 매칭| VenueOnlyPaid["bankTransaction.* 이벤트<br/>venue:default scope"]:::state
    VenueOnlyPaid -.->|고객 table scope WebSocket 미수신| PayPanel
    PayPanel -->|브라우저 focus/reload 등 재동기화| SyncPaid["GET /api/sync/table<br/>테이블 상태 재동기화"]:::loading
    AdminPaidHint["관리자 결제 완료 처리<br/>payment.paid table scope"]:::state --> SyncPaid
    SyncPaid -->|PENDING 주문 사라짐| MenuTab

    PayPanel -->|timeLeft <= 0| AutoCancel["DELETE /api/order<br/>자동 취소"]:::loading
    AutoCancel --> ExpiredToast["입금 기한 만료 토스트"]:::error
    ExpiredToast --> MenuTab

    OrderHistory -.->|menuOrder.ready hint 수신 후 sync/table| OrderHistory
```

---

## 2. 관리자용 화면 및 모달 전환 흐름도 (Admin-Side Transitions)

`/admin`은 독립 대시보드가 아니라 `/admin/pos`로 리다이렉트됩니다. POS에서 주방 화면(`/admin/cooker`)을 새 창으로 열 수 있고, 수동 입금 매칭은 별도 `ManualMatchModal`이 아니라 POS의 주문 현황 패널 내 “입금 확인 필요” 리스트에서 후보를 확정합니다. 재고 패널은 메뉴뿐 아니라 카테고리 관리와 한국어/영어 표시 메타데이터를 함께 관리합니다.

```mermaid
flowchart TD
    classDef page fill:#e0f2fe,stroke:#0369a1,stroke-width:1.5px;
    classDef modal fill:#fff2cc,stroke:#d97706,stroke-width:1.5px,stroke-dasharray:5 5;
    classDef loading fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px;
    classDef error fill:#fee2e2,stroke:#dc2626,stroke-width:2px;
    classDef success fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef panel fill:#f8fafc,stroke:#475569,stroke-width:1.5px;

    AdminEntry["/admin"]:::page -->|redirect| AdminPos["POS 운영 화면 /admin/pos<br/>⏱️#3"]:::page
    AdminPos -->|요리 섹션 버튼| AdminCooker["주방 모니터 /admin/cooker<br/>⏱️#4"]:::page
    AdminCooker -->|포스로 이동 버튼| AdminPos

    subgraph POS["POS 운영 화면"]
        OrdersPanel["주문 현황 패널 <Orders>"]:::panel
        TablesPanel["테이블 현황 패널 <Tables>"]:::panel
        InventoryPanel["재고 패널 <Inventories>"]:::panel
    end

    AdminPos --> OrdersPanel
    AdminPos --> TablesPanel
    AdminPos --> InventoryPanel

    TablesPanel -->|테이블 추가| TableCreate["테이블 생성 모달 <TableCreateModal>"]:::modal
    TableCreate --> CreateTableApi["POST /api/admin/table"]:::loading
    CreateTableApi --> CreateTableOk["테이블 생성 완료 토스트"]:::success
    CreateTableApi --> CreateTableFail["테이블 생성 실패 토스트"]:::error

    TablesPanel -->|테이블 카드 클릭| TableDetail["테이블 상세 모달 <TableDetailModal>"]:::modal
    TableDetail -->|활성화| OccupyApi["PUT /api/admin/table/occupy"]:::loading
    OccupyApi --> OccupyOk["테이블 점유 완료 토스트"]:::success
    OccupyApi --> OccupyFail["테이블 점유 실패 토스트"]:::error
    TableDetail -->|비활성화/퇴장 처리| VacateApi["PUT /api/admin/table/vacate"]:::loading
    VacateApi -->|미완료 주문/환불대기 존재| VacateFail["테이블 비우기 실패 토스트"]:::error
    VacateApi -->|성공| VacateOk["테이블 비우기 완료 토스트"]:::success
    TableDetail -->|정보 수정| UpdateTableApi["PUT /api/admin/table"]:::loading
    UpdateTableApi --> UpdateTableOk["테이블 수정 완료 토스트"]:::success
    UpdateTableApi --> UpdateTableFail["테이블 수정 실패 토스트"]:::error
    TableDetail -->|테이블 페이지| ClientTablePage["/client/table/:id 새 창"]:::page

    TablesPanel -->|테이블 제거| TableRemove["테이블 제거 모달 <RemoveTableModal>"]:::modal
    TableRemove --> RemoveTableApi["DELETE /api/admin/table"]:::loading
    RemoveTableApi --> RemoveTableOk["테이블 제거 완료 토스트"]:::success
    RemoveTableApi --> RemoveTableFail["점유 중이면 제거 실패"]:::error

    OrdersPanel -->|입금 확인 필요 후보 확정| ConfirmDepositApi["PUT /api/admin/deposit/confirm"]:::loading
    ConfirmDepositApi --> ConfirmDepositOk["입금 매칭 완료 토스트"]:::success
    ConfirmDepositApi --> ConfirmDepositFail["입금 매칭 실패 토스트"]:::error
    OrdersPanel -->|입금 내역 제외| IgnoreDepositApi["PUT /api/admin/deposit/ignore"]:::loading
    IgnoreDepositApi --> IgnoreDepositOk["입금 내역 제외 토스트"]:::success

    OrdersPanel -->|주문 카드 클릭| AdminOrderDetail["주문 상세 모달 <OrderDetailModal>"]:::modal
    AdminOrderDetail -->|관리자 결제 완료 처리| PayOrderApi["PUT /api/admin/order"]:::loading
    PayOrderApi --> PayOrderOk["관리자 결제 완료 토스트"]:::success
    PayOrderApi --> PayOrderFail["결제 처리 실패 토스트"]:::error
    AdminOrderDetail -->|주문 취소 / 취소 및 환불 대기 처리| CancelOrderApi["DELETE /api/admin/order"]:::loading
    CancelOrderApi --> CancelOrderOk["주문 취소 완료 토스트"]:::success
    CancelOrderApi --> CancelOrderFail["주문 취소 실패 토스트"]:::error
    AdminOrderDetail -->|READY 메뉴 수령 완료| PickUpApi["PUT /api/admin/order/pick-up"]:::loading
    PickUpApi --> PickUpOk["수령 완료 토스트"]:::success

    OrdersPanel -->|환불 필요 완료| RefundApi["PUT /api/admin/order/refund"]:::loading
    RefundApi --> RefundOk["환불 완료 토스트"]:::success
    RefundApi --> RefundFail["환불 실패 토스트"]:::error

    InventoryPanel -->|카테고리 관리| CategoryManage["카테고리 관리 모달 <CategoryManageModal><br/>ko/en 이름/설명"]:::modal
    CategoryManage --> CategoryManageApi["POST/PUT/DELETE /api/admin/menuCategory"]:::loading
    CategoryManageApi --> CategoryManageOk["카테고리 변경 완료 토스트"]:::success
    CategoryManageApi --> CategoryManageFail["카테고리 변경 실패 토스트"]:::error

    InventoryPanel -->|메뉴 추가| MenuCreate["메뉴 등록 모달 <MenuManageModal><br/>ko/en 이름/설명"]:::modal
    MenuCreate --> CreateMenuApi["POST /api/admin/menu"]:::loading
    CreateMenuApi --> CreateMenuOk["메뉴 생성 완료 토스트"]:::success
    CreateMenuApi --> CreateMenuFail["메뉴 생성 실패 토스트"]:::error
    InventoryPanel -->|메뉴 카드 클릭| MenuDetail["메뉴 수정 모달 <InventoryDetailModal><br/>ko/en 이름/설명"]:::modal
    MenuDetail --> UpdateMenuApi["PUT /api/admin/menu"]:::loading
    UpdateMenuApi --> UpdateMenuOk["메뉴 수정 완료 토스트"]:::success
    UpdateMenuApi --> UpdateMenuFail["메뉴 수정 실패 토스트"]:::error
    InventoryPanel -->|메뉴 제거| MenuRemove["메뉴 제거 모달 <InventoryRemoveModal>"]:::modal
    MenuRemove --> DeleteMenuApi["DELETE /api/admin/menu"]:::loading
    DeleteMenuApi --> DeleteMenuOk["메뉴 삭제 완료 토스트"]:::success
    DeleteMenuApi --> DeleteMenuFail["메뉴 삭제 실패 토스트"]:::error

    AdminCooker -->|메뉴 추가/제거| CookerMenuModal["모니터링 메뉴 선택 모달"]:::modal
    AdminCooker -->|조리 대기 카드 클릭| CookComplete["조리 완료 확인 모달 <MenuCompleteModal>"]:::modal
    CookComplete --> CompleteApi["PUT /api/admin/order/complete"]:::loading
    CompleteApi --> CompleteOk["준비 완료 토스트"]:::success
    CompleteApi --> CompleteFail["미결제/상태 경합 실패 토스트"]:::error
```

---

## 3. 데이터 무결성 상태 전이도 (State Transition Diagram)

백엔드 상태 머신은 테이블 컨텍스트, 주문, 결제, 메뉴 주문 상태가 분리되어 있습니다. 고객 QR 입장은 세션만 발급받으며, 현재 고객 페이지의 `table/session`은 활성 컨텍스트가 없으면 실패합니다. 운영 UI에서는 관리자가 먼저 테이블을 활성화해야 합니다.

메뉴/카테고리의 `nameEn`/`descriptionEn`은 주문 상태 전이가 아니라 렌더링 메타데이터입니다. 영어 값이 없으면 고객 화면은 기본 한국어 `name`/`description`을 fallback으로 사용합니다.

```mermaid
stateDiagram-v2
    [*] --> Vacant: 최초 매장 오픈 상태

    state "테이블 점유 수명 주기" as TableScope {
        Vacant --> Occupied: [관리자] PUT /api/admin/table/occupy
        Occupied --> TableSessionIssued: [고객] POST /api/table/session
        TableSessionIssued --> Occupied: 세션 만료 전 sync/order 접근
        Occupied --> Vacant: [관리자] PUT /api/admin/table/vacate\n제약: PENDING/READY menuOrder 0개, REFUND_PENDING payment 0개
    }

    state "주문 전체 (orders.status)" as Ord {
        [*] --> OrderActive: [고객] POST /api/order
        OrderActive --> OrderCancelled: [고객] 결제 전 DELETE /api/order
        OrderActive --> OrderCancelled: [관리자] DELETE /api/admin/order
        OrderActive --> OrderExpired: [시스템] expireStalePendingOrders\n5분 초과 PENDING/MANUAL_REVIEW
    }

    state "결제 정보 (payments.status)" as Pay {
        [*] --> PayPending: 결제 코드 임대 예약\n1~99원 감액
        PayPending --> PayPaid: 정확한 감액 입금 자동 매칭
        PayPending --> PayPaid: [관리자] 수동 결제 완료 / 입금 후보 확정
        PayPending --> PayNeedsReview: 동명이인/원금 입금/100원 미만 오차
        PayNeedsReview --> PayPaid: [관리자] 입금 후보 확정
        PayPending --> PayExpired: 5분 초과 만료
        PayNeedsReview --> PayExpired: 5분 초과 만료
        PayPending --> PayCancelled: 결제 전 주문 취소
        PayPaid --> PayRefundPending: [관리자] 결제 완료 주문 취소\n취소 사유 필수
        PayRefundPending --> PayRefunded: [관리자] 환불 완료 처리
    }

    state "메뉴 개별 조리 상태 (menuOrders.status)" as MenuOrderScope {
        [*] --> MenuPending: 주문 생성 시 재고 차감 완료
        MenuPending --> MenuReady: [주방] PUT /api/admin/order/complete\n제약: 주문 ACTIVE + 결제 PAID
        MenuReady --> MenuPickedUp: [관리자] PUT /api/admin/order/pick-up
        MenuPending --> MenuCancelled: 주문 취소/만료\n재고 복구
        MenuReady --> MenuCancelled: 결제 완료 주문 관리자 취소\n재고 복구 안 함
    }

    Occupied --> OrderActive: 테이블 점유 중 주문 발생
```

---

## 4. 실시간 동기화 아키텍처 및 5대 연동 맵 (Realtime Sync & Points)

서버는 mutation 성공 시 `scopeRevisions`와 `domainEvents`를 갱신하고, 설정된 `REALTIME_NOTIFY_URL`/`REALTIME_NOTIFY_SECRET`이 있을 때만 Realtime Worker에 hint를 보냅니다. 클라이언트는 WebSocket payload를 직접 reducer로 순차 적용하지 않고, hint를 받은 뒤 `sync/table` 또는 `sync/admin`을 호출합니다. snapshot이 있으면 store를 덮어쓰고, 점진 이벤트만 있으면 현재 구현은 관련 데이터를 재조회합니다.

### 1. 실시간 동기화 데이터 시퀀스

```mermaid
sequenceDiagram
    autonumber
    actor UI as 고객/관리자 UI
    participant Backend as Next.js API 서버
    participant DB as D1 DB
    participant Worker as Realtime Worker

    UI->>Backend: Mutation 요청
    Backend->>DB: 비즈니스 쿼리 수행
    Backend->>DB: scopeRevisions revision 증가
    Backend->>DB: domainEvents row 저장
    alt REALTIME_NOTIFY_URL/SECRET 있음
        Backend->>Worker: notifyRealtime(events)
        Worker-->>UI: WebSocket hint(scope, revision, eventId)
    else realtime 설정 없음
        Backend-->>Backend: realtime.notify.skip trace
    end
    UI->>Backend: GET /api/sync/table 또는 /api/sync/admin?afterRevision=X
    alt afterRevision=0 또는 gap
        Backend-->>UI: snapshot + revision + gap
        UI->>UI: store snapshot hard override
    else 점진 이벤트 존재
        Backend-->>UI: events + revision
        UI->>Backend: 현재 구현은 관련 데이터 재조회
    end
```

---

### 2. 매장 전체 동기화 포인트 맵

```mermaid
flowchart TD
    classDef syncPoint fill:#fef3c7,stroke:#d97706,stroke-width:1.5px;
    classDef loading fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px;
    classDef page fill:#e0f2fe,stroke:#0369a1,stroke-width:1.5px;
    classDef state fill:#f8fafc,stroke:#475569,stroke-width:1.5px;

    EventStore["scopeRevisions + domainEvents"]:::state --> Notify["notifyRealtime(events)"]:::loading
    Notify --> TableScope["WebSocket scope: table/:tableId"]:::syncPoint
    Notify --> VenueScope["WebSocket scope: venue:default"]:::syncPoint

    TableScope --> Point1["⏱️#1 고객 주문 내역 <OrderHistoryPanel><br/>menuOrder.ready/pickedUp 반영"]:::page
    TableScope --> Point2A["⏱️#2 고객 결제 대기 <OrderPaymentPanel><br/>table scope hint 또는 focus/reload 후 sync/table"]:::page
    VenueScope --> Point3["⏱️#3 POS 테이블/주문/입금 현황<br/>/admin/pos"]:::page
    VenueScope --> Point4["⏱️#4 주방 모니터 대기열<br/>/admin/cooker"]:::page
    VenueScope --> Point5A["⏱️#5 어드민 재고 패널<br/>menu.updated 반영"]:::page
    VenueScope --> Point2B["입금 자동/수동 매칭<br/>bankTransaction.* 는 venue scope만 emit"]:::syncPoint
    Point2B -.-> Point2A
    Point5A -.-> Point5B["고객 메뉴판은 venue scope 미구독<br/>진입/메뉴 클릭 시 GET /api/menu로 품절 차단"]:::state
```

---

## 5. 최단 E2E 통합 테스트 시나리오 시퀀스

아래 시퀀스는 실제 코드 흐름에 맞춘 검증 순서입니다. 색상 규칙은 flowchart 다이어그램에 적용했고, sequence 다이어그램은 행위 순서와 API 경계 검증에 집중합니다.

### 1. 고객용 최단 통합 시퀀스

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 관리자
    actor User as 고객(Client Web)
    participant Server as Next.js API 서버
    participant Bank as 입금 인제스트
    participant RT as Realtime hint

    Note over Admin, Server: 사전 조건: 관리자가 테이블을 활성화해야 고객 세션 발급 가능
    Admin->>Server: PUT /api/admin/table/occupy
    Server-->>Admin: table.occupied

    Note over User, Server: 1단계: QR 진입 및 초기 스냅샷
    User->>Server: POST /api/table/session
    Server-->>User: yoncom_table_session + yoncom_csrf
    User->>Server: GET /api/sync/table?afterRevision=0
    Server-->>User: snapshot.table
    User->>Server: GET /api/menu
    Server-->>User: 메뉴 목록

    Note over User, Server: 2단계: 주문 실패 후 성공
    User->>Server: POST /api/order (재고 초과)
    Server-->>User: 409 Menu Not Enough
    User->>Server: POST /api/order (정상 수량)
    Server-->>User: order.created + paymentCode + expectedTransferAmount
    User->>User: OrderModal에서 입금액 수동 확인
    User->>User: OrderPaymentPanel 진입

    Note over User, Server: 3단계: 결제 대기 조작 및 만료
    User->>User: 토스 딥링크 / 계좌 복사 / 입금액 복사
    User->>Server: timeLeft <= 0 후 DELETE /api/order
    Server-->>User: order.cancelled, 메뉴로 복귀

    Note over User, Bank: 4단계: 재주문 후 입금 완료
    User->>Server: POST /api/order
    Server-->>User: 결제 대기 주문
    User->>User: OrderModal 확인 후 PayPanel 유지
    Bank->>Server: POST /api/admin/deposit exact amount
    Server-->>Bank: AUTO_MATCHED
    RT-->>Admin: venue scope hint
    Note over User, RT: 현재 자동 입금 매칭은 table scope hint를 고객에게 직접 보내지 않음
    User->>Server: focus/reload 이후 GET /api/sync/table
    Server-->>User: PAID 반영된 최신 상태
    User->>User: PENDING 결제 주문 사라짐, 메뉴/주문내역 화면 표시

    Note over User, Server: 5단계: 조리 완료 동기화
    Admin->>Server: PUT /api/admin/order/complete
    RT-->>User: table scope hint
    User->>Server: GET /api/sync/table
    Server-->>User: menuOrder.ready 반영
    User->>User: 주문내역/상세 모달에서 준비 완료 확인
```

### 2. 관리자용 최단 통합 시퀀스

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 관리자(POS/주방)
    participant Server as Next.js API 서버
    participant Customer as 고객 단말
    participant RT as Realtime hint

    Note over Admin, Server: 1단계: 어드민 진입
    Admin->>Server: GET /admin
    Server-->>Admin: redirect /admin/pos
    Admin->>Server: GET /api/sync/admin?afterRevision=0
    Server-->>Admin: tables + menuCategories + bankTransactions snapshot

    Note over Admin, Server: 2단계: 테이블 관리
    Admin->>Server: POST /api/admin/table
    Server-->>Admin: table.created
    Admin->>Server: PUT /api/admin/table/occupy
    Server-->>Admin: table.occupied
    Admin->>Server: PUT /api/admin/table
    Server-->>Admin: table.updated

    Note over Admin, Server: 3단계: 입금 후보 확정과 환불 대기
    Admin->>Server: PUT /api/admin/deposit/confirm
    Server-->>Admin: bankTransaction.confirmed + payment paid
    RT-->>Admin: venue scope hint
    Note over Customer, RT: 고객은 이 이벤트를 table scope WebSocket으로 직접 받지 않음
    Admin->>Server: DELETE /api/admin/order (PAID, cancelReason 포함)
    Server-->>Admin: order.cancelled + REFUND_PENDING
    Admin->>Server: PUT /api/admin/table/vacate
    Server-->>Admin: 409 Refund Pending Orders Exist
    Admin->>Server: PUT /api/admin/order/refund
    Server-->>Admin: order.refunded
    Admin->>Server: PUT /api/admin/table/vacate
    Server-->>Admin: table.vacated

    Note over Admin, Server: 4단계: 재고 관리
    Admin->>Server: POST /api/admin/menu
    Server-->>Admin: menu.created
    Admin->>Server: PUT /api/admin/menu
    Server-->>Admin: menu.updated
    RT-->>Admin: venue scope hint
    Admin->>Server: GET /api/sync/admin
    Server-->>Admin: 메뉴/재고 최신 상태
    Customer->>Server: GET /api/menu 또는 메뉴 카드 클릭 시 재조회
    Server-->>Customer: 품절/비활성 메뉴 차단 가능

    Note over Admin, Server: 5단계: 주방 처리
    Admin->>Server: GET /admin/cooker
    Admin->>Server: PUT /api/admin/order/complete (미결제 또는 stale 상태)
    Server-->>Admin: 409 Order is not paid yet / status conflict
    Admin->>Server: PUT /api/admin/order/complete (PAID + PENDING)
    Server-->>Admin: menuOrder.ready
    Admin->>Server: PUT /api/admin/order/pick-up
    Server-->>Admin: menuOrder.pickedUp
```

### 실시간 마킹 설명

- `⏱️#1`: 고객 주문 내역 화면. `menuOrder.ready`/`menuOrder.pickedUp` table scope hint 후 `sync/table`.
- `⏱️#2`: 고객 결제 대기 패널. `PUT /api/admin/order`의 `payment.paid`는 table scope hint를 만들지만, 자동/수동 입금 매칭의 `bankTransaction.*`은 현재 `venue:default`만 emit한다. 고객은 focus/reload 등으로 `sync/table`을 다시 호출하면 더 이상 `PENDING` 결제 주문이 아니어서 메인 UI로 복귀한다.
- `⏱️#3`: POS 운영 화면. `venue:default` hint 후 `sync/admin` 또는 refresh.
- `⏱️#4`: 주방 모니터. 결제 완료 주문이 `isKitchenOrder`가 되어 대기열에 등장.
- `⏱️#5`: 어드민 재고 패널. `menu.updated`는 `venue:default`로 반영된다. 고객 메뉴판은 현재 `venue:default`를 구독하지 않으므로 진입 시 또는 메뉴 카드 클릭 시 `GET /api/menu` 재조회로 품절을 차단한다.
