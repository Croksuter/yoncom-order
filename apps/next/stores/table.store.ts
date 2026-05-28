import { create } from 'zustand';
import * as ClientTableRequest from "types/requests/client/table";
import * as ClientTableResponse from "types/responses/client/table";
import * as AdminTableRequest from "types/requests/admin/table";
import * as AdminTableResponse from "types/responses/admin/table";
import queryStore from '~/lib/query';
import { toast } from '~/hooks/use-toast';
import * as ClientOrderRequest from "shared/types/requests/client/order";
import * as ClientOrderResponse from "shared/types/responses/client/order";
import * as AdminOrderRequest from "shared/types/requests/admin/order";
import * as AdminOrderResponse from "shared/types/responses/admin/order";
import * as AdminDepositRequest from "shared/types/requests/admin/deposit";
import * as AdminDepositResponse from "shared/types/responses/admin/deposit";
import * as AdminPaymentSettingsRequest from "shared/types/requests/admin/payment-settings";
import * as AdminPaymentSettingsResponse from "shared/types/responses/admin/payment-settings";
import * as AdminClientNoticeSettingsRequest from "shared/types/requests/admin/client-notice-settings";
import * as AdminClientNoticeSettingsResponse from "shared/types/responses/admin/client-notice-settings";
import * as AdminOrderWorkflowSettingsRequest from "shared/types/requests/admin/order-workflow-settings";
import * as AdminOrderWorkflowSettingsResponse from "shared/types/responses/admin/order-workflow-settings";

type TableState = {
  clientTable: ClientTableResponse.Get["result"] | null;
  tables: AdminTableResponse.Get["result"];
  bankTransactions: AdminDepositResponse.Get["result"]["transactions"];
  paymentSettings: AdminPaymentSettingsResponse.Get["result"] | null;
  clientNoticeSettings: AdminClientNoticeSettingsResponse.Get["result"] | null;
  orderWorkflowSettings: AdminOrderWorkflowSettingsResponse.Get["result"] | null;
  isLoaded: boolean;
  error: boolean;

  load: (query: AdminTableRequest.Get) => Promise<AdminTableResponse.Get | null>;
  clientStartTableSession: (
    query: ClientTableRequest.Get,
  ) => Promise<{
    result: {
      state: "INACTIVE" | "RESUMED";
      table: Omit<ClientTableResponse.Get["result"], "tableContexts">;
      tableId: string;
      tableContextId: string | null;
      expiresAt: number | null;
      paymentSettings: AdminPaymentSettingsResponse.Get["result"];
      clientNoticeSettings: AdminClientNoticeSettingsResponse.Get["result"];
    };
  } | null>;

  createTable: (query: AdminTableRequest.Create) => Promise<AdminTableResponse.Create | null>;
  removeTable: (query: AdminTableRequest.Remove) => Promise<AdminTableResponse.Remove | null>;
  updateTable: (query: AdminTableRequest.Update) => Promise<AdminTableResponse.Update | null>;

  occupyTable: (query: AdminTableRequest.Occupy) => Promise<AdminTableResponse.Occupy | null>;
  vacateTable: (query: AdminTableRequest.Vacate) => Promise<AdminTableResponse.Vacate | null>;

  clientGetTable: (query: ClientTableRequest.Get) => Promise<ClientTableResponse.Get | null>;

  clientCancelOrder: (query: ClientOrderRequest.Remove) => Promise<ClientOrderResponse.Remove | null>;
  adminCancelOrder: (query: AdminOrderRequest.RemoveOrderQuery) => Promise<AdminOrderResponse.Remove | null>;
  
  adminDeposit: (query: AdminDepositRequest.Create) => Promise<AdminDepositResponse.Create | null>;
  adminPayOrder: (query: AdminOrderRequest.PaidOrder) => Promise<AdminOrderResponse.Paid | null>;
  adminRefundOrder: (query: AdminOrderRequest.RefundOrder) => Promise<AdminOrderResponse.Refund | null>;
  loadBankTransactions: () => Promise<AdminDepositResponse.Get | null>;
  loadPaymentSettings: () => Promise<AdminPaymentSettingsResponse.Get | null>;
  updatePaymentSettings: (query: AdminPaymentSettingsRequest.Update) => Promise<AdminPaymentSettingsResponse.Update | null>;
  loadClientNoticeSettings: () => Promise<AdminClientNoticeSettingsResponse.Get | null>;
  updateClientNoticeSettings: (query: AdminClientNoticeSettingsRequest.Update) => Promise<AdminClientNoticeSettingsResponse.Update | null>;
  loadOrderWorkflowSettings: () => Promise<AdminOrderWorkflowSettingsResponse.Get | null>;
  updateOrderWorkflowSettings: (query: AdminOrderWorkflowSettingsRequest.Update) => Promise<AdminOrderWorkflowSettingsResponse.Update | null>;
  adminConfirmBankTransaction: (query: AdminDepositRequest.Confirm) => Promise<AdminDepositResponse.Confirm | null>;
  adminIgnoreBankTransaction: (query: AdminDepositRequest.Ignore) => Promise<AdminDepositResponse.Ignore | null>;

  adminCompleteOrder: (query: AdminOrderRequest.CompleteOrder) => Promise<AdminOrderResponse.Complete | null>;
  adminPickUpOrder: (query: AdminOrderRequest.PickUpOrder) => Promise<AdminOrderResponse.PickUp | null>;

  // 다른 store에서 사용하기 위해 노출. component에서 사용하지 않음.
  _setTables: (tables: AdminTableResponse.Get["result"]) => void;
}

const useTableStore = create<TableState>((set, get) => ({
  clientTable: null,
  tables: [],
  bankTransactions: [],
  paymentSettings: null,
  clientNoticeSettings: null,
  orderWorkflowSettings: null,
  isLoaded: false,
  error: false,

  load: async (query: AdminTableRequest.Get) => await queryStore<AdminTableRequest.Get, AdminTableResponse.Get>({
    route: "admin/table",
    method: "get",
    query,
    setter: set,
    onSuccess: (res) => set({ tables: res.result.map((table) => ({
      ...table,
      tableContexts: table.tableContexts.sort((a, b) => b.createdAt - a.createdAt)
        .map((tableContext) => ({
          ...tableContext,
          orders: tableContext.orders.sort((a, b) => b.createdAt - a.createdAt),
        })),
    })) }),
  }),

  clientStartTableSession: async (query: ClientTableRequest.Get) => await queryStore<
    ClientTableRequest.Get,
    {
      result: {
        state: "INACTIVE" | "RESUMED";
        table: Omit<ClientTableResponse.Get["result"], "tableContexts">;
        tableId: string;
        tableContextId: string | null;
        expiresAt: number | null;
        paymentSettings: AdminPaymentSettingsResponse.Get["result"];
        clientNoticeSettings: AdminClientNoticeSettingsResponse.Get["result"];
      };
    }
  >({
    route: "table/session",
    method: "post",
    query,
    setter: set,
  }),

  createTable: async (query: AdminTableRequest.Create) => await queryStore<AdminTableRequest.Create, AdminTableResponse.Create>({
    route: "admin/table",
    method: "post",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "테이블 생성 완료",
        description: "테이블이 성공적으로 생성되었습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  removeTable: async (query: AdminTableRequest.Remove) => await queryStore<AdminTableRequest.Remove, AdminTableResponse.Remove>({
    route: "admin/table",
    method: "delete",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "테이블 제거 완료",
        description: "테이블이 성공적으로 제거되었습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  updateTable: async (query: AdminTableRequest.Update) => await queryStore<AdminTableRequest.Update, AdminTableResponse.Update>({
    route: "admin/table",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "테이블 수정 완료",
        description: "테이블이 성공적으로 수정되었습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  occupyTable: async (query: AdminTableRequest.Occupy) => await queryStore<AdminTableRequest.Occupy, AdminTableResponse.Occupy>({
    route: "admin/table/occupy",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "테이블 점유 완료",
        description: "테이블이 성공적으로 점유되었습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  vacateTable: async (query: AdminTableRequest.Vacate) => await queryStore<AdminTableRequest.Vacate, AdminTableResponse.Vacate>({
    route: "admin/table/vacate",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "테이블 비우기 완료",
        description: "테이블이 성공적으로 비워졌습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  clientGetTable: async (query: ClientTableRequest.Get) => await queryStore<ClientTableRequest.Get, ClientTableResponse.Get>({
    route: "table",
    method: "get",
    query,
    setter: set,
    onSuccess: (res) => set({ clientTable: {
      ...res.result,
      tableContexts: res.result.tableContexts.sort((a, b) => b.createdAt - a.createdAt)
        .map((tableContext) => ({
          ...tableContext,
          orders: tableContext.orders.sort((a, b) => b.createdAt - a.createdAt),
        })),
    },
    paymentSettings: res.result.paymentSettings ?? get().paymentSettings,
    clientNoticeSettings: res.result.clientNoticeSettings ?? get().clientNoticeSettings,
  }),
  }),

  clientCancelOrder: async (query: ClientOrderRequest.Remove) => await queryStore<ClientOrderRequest.Remove, ClientOrderResponse.Remove>({
    route: "order",
    method: "delete",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
        title: "주문 취소 완료",
        description: "입금 전 주문을 취소하고 재고와 결제코드를 복구했습니다.",
        duration: 3000,
      });
    },
  }),

  adminCancelOrder: async (query: AdminOrderRequest.RemoveOrderQuery) => await queryStore<AdminOrderRequest.RemoveOrderQuery, AdminOrderResponse.Remove>({
    route: "admin/order",
    method: "delete",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
        title: "주문 취소 완료",
        description: "주문 상태를 취소로 변경했습니다. 결제 완료 건은 환불 대기 목록을 확인해주세요.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  adminCompleteOrder: async (query: AdminOrderRequest.CompleteOrder) => await queryStore<AdminOrderRequest.CompleteOrder, AdminOrderResponse.Complete>({
    route: "admin/order/complete",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => {
      const bypass = get().orderWorkflowSettings?.autoPickUpOnCookComplete;
      toast({
        title: bypass ? "수령 완료" : "조리 완료",
        description: bypass
          ? "해당 메뉴를 조리완료와 동시에 수령 완료로 변경했습니다."
          : "해당 메뉴를 수령 대기 상태로 변경했습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  adminPickUpOrder: async (query: AdminOrderRequest.PickUpOrder) => await queryStore<AdminOrderRequest.PickUpOrder, AdminOrderResponse.PickUp>({
    route: "admin/order/pick-up",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "수령 완료",
        description: "해당 메뉴를 고객 수령 완료로 변경했습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  adminDeposit: async (query: AdminDepositRequest.Create) => await queryStore<AdminDepositRequest.Create, AdminDepositResponse.Create>({
    route: "admin/deposit",
    method: "post",
    query,
    setter: set,
    onSuccess: (res) => {
      const message = res.result.status === "AUTO_MATCHED"
        ? "입금금액이 정확히 일치해 주문과 자동 매칭되었습니다."
        : res.result.status === "NEEDS_REVIEW"
          ? "금액이 애매합니다. 입금 확인 필요 목록에서 주문을 직접 확정해주세요."
          : "일치하는 주문 후보가 없습니다. 은행 내역 확인 후 처리해주세요.";
      toast({
        title: "입금 내역 확인",
        description: message,
        duration: 3000,
      });
      get().load({});
      get().loadBankTransactions();
    },
  }),

  adminPayOrder: async (query: AdminOrderRequest.PaidOrder) => await queryStore<AdminOrderRequest.PaidOrder, AdminOrderResponse.Paid>({
    route: "admin/order",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "관리자 결제 완료",
        description: "선택한 주문을 결제 완료로 처리했습니다.",
        duration: 3000,
      });
      get().load({});
      get().loadBankTransactions();
    },
  }),

  adminRefundOrder: async (query: AdminOrderRequest.RefundOrder) => await queryStore<AdminOrderRequest.RefundOrder, AdminOrderResponse.Refund>({
    route: "admin/order/refund",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "환불 완료",
        description: "선택한 주문을 환불 완료로 처리했습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  loadBankTransactions: async () => await queryStore<{}, AdminDepositResponse.Get>({
    route: "admin/deposit",
    method: "get",
    query: {},
    onSuccess: (res) => set({ bankTransactions: res.result.transactions }),
  }),

  loadPaymentSettings: async () => await queryStore<{}, AdminPaymentSettingsResponse.Get>({
    route: "admin/payment-settings",
    method: "get",
    query: {},
    onSuccess: (res) => set({ paymentSettings: res.result }),
  }),

  updatePaymentSettings: async (query: AdminPaymentSettingsRequest.Update) => await queryStore<
    AdminPaymentSettingsRequest.Update,
    AdminPaymentSettingsResponse.Update
  >({
    route: "admin/payment-settings",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => {
      set({ paymentSettings: res.result });
      toast({
        title: "입금 안내 수정 완료",
        description: "계좌 정보와 송금 안내가 실시간으로 반영됩니다.",
        duration: 3000,
      });
    },
  }),

  loadClientNoticeSettings: async () => await queryStore<{}, AdminClientNoticeSettingsResponse.Get>({
    route: "admin/client-notice-settings",
    method: "get",
    query: {},
    onSuccess: (res) => set({ clientNoticeSettings: res.result }),
  }),

  updateClientNoticeSettings: async (query: AdminClientNoticeSettingsRequest.Update) => await queryStore<
    AdminClientNoticeSettingsRequest.Update,
    AdminClientNoticeSettingsResponse.Update
  >({
    route: "admin/client-notice-settings",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => {
      set({ clientNoticeSettings: res.result });
      toast({
        title: "고객 공지 저장 완료",
        description: "고객 주문 화면 헤더 공지가 실시간으로 반영됩니다.",
        duration: 3000,
      });
    },
  }),

  loadOrderWorkflowSettings: async () => await queryStore<{}, AdminOrderWorkflowSettingsResponse.Get>({
    route: "admin/order-workflow-settings",
    method: "get",
    query: {},
    onSuccess: (res) => set({ orderWorkflowSettings: res.result }),
  }),

  updateOrderWorkflowSettings: async (query: AdminOrderWorkflowSettingsRequest.Update) => await queryStore<
    AdminOrderWorkflowSettingsRequest.Update,
    AdminOrderWorkflowSettingsResponse.Update
  >({
    route: "admin/order-workflow-settings",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => {
      set({ orderWorkflowSettings: res.result });
      toast({
        title: "처리 설정 수정 완료",
        description: "조리완료 후 수령완료 처리 방식이 변경되었습니다.",
        duration: 3000,
      });
    },
  }),

  adminConfirmBankTransaction: async (query: AdminDepositRequest.Confirm) => await queryStore<AdminDepositRequest.Confirm, AdminDepositResponse.Confirm>({
    route: "admin/deposit/confirm",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "입금 매칭 완료",
        description: "입금 내역을 선택한 주문에 연결하고 결제 완료 처리했습니다.",
        duration: 3000,
      });
      get().load({});
      get().loadBankTransactions();
    },
  }),

  adminIgnoreBankTransaction: async (query: AdminDepositRequest.Ignore) => await queryStore<AdminDepositRequest.Ignore, AdminDepositResponse.Ignore>({
    route: "admin/deposit/ignore",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "입금 내역 제외",
        description: "해당 입금 내역을 확인 필요 목록에서 제외했습니다.",
        duration: 3000,
      });
      get().loadBankTransactions();
    },
  }),

  _setTables: (tables: AdminTableResponse.Get["result"]) => set({ tables }),
}));

export default useTableStore;
