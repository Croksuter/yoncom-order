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

type TableState = {
  clientTable: ClientTableResponse.Get["result"] | null;
  tables: AdminTableResponse.Get["result"];
  bankTransactions: AdminDepositResponse.Get["result"]["transactions"];
  isLoaded: boolean;
  error: boolean;

  load: (query: AdminTableRequest.Get) => Promise<AdminTableResponse.Get | null>;

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
  loadBankTransactions: () => Promise<AdminDepositResponse.Get | null>;
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
    }}),
  }),

  clientCancelOrder: async (query: ClientOrderRequest.Remove) => await queryStore<ClientOrderRequest.Remove, ClientOrderResponse.Remove>({
    route: "order",
    method: "delete",
    query,
    setter: set,
    onSuccess: (res) => {
      toast({
        title: "주문 취소 완료",
        description: "주문이 성공적으로 취소되었습니다.",
        duration: 3000,
      });
      get().clientGetTable({ tableId: get().clientTable?.id ?? "" });
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
      description: "주문이 성공적으로 취소되었습니다.",
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
      toast({
        title: "준비 완료",
        description: "주문이 준비 완료 상태로 변경되었습니다.",
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
        description: "주문이 수령 완료 상태로 변경되었습니다.",
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
        ? "입금 내역이 주문과 자동 매칭되었습니다."
        : res.result.status === "NEEDS_REVIEW"
          ? "입금 확인 필요 목록에서 매칭할 주문을 선택해주세요."
          : "일치하는 주문 후보가 없어 미확인 입금으로 보관했습니다.";
      toast({
        title: "입금 내역 등록",
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
        title: "결제 확인",
        description: "주문이 수동 결제 완료 처리되었습니다.",
        duration: 3000,
      });
      get().load({});
      get().loadBankTransactions();
    },
  }),

  loadBankTransactions: async () => await queryStore<{}, AdminDepositResponse.Get>({
    route: "admin/deposit",
    method: "get",
    query: {},
    onSuccess: (res) => set({ bankTransactions: res.result.transactions }),
  }),

  adminConfirmBankTransaction: async (query: AdminDepositRequest.Confirm) => await queryStore<AdminDepositRequest.Confirm, AdminDepositResponse.Confirm>({
    route: "admin/deposit/confirm",
    method: "put",
    query,
    setter: set,
    onSuccess: () => {
      toast({
        title: "입금 매칭 완료",
        description: "선택한 주문이 결제 완료 처리되었습니다.",
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
        title: "입금 내역 무시",
        description: "해당 입금 내역을 후보 목록에서 제외했습니다.",
        duration: 3000,
      });
      get().loadBankTransactions();
    },
  }),

  _setTables: (tables: AdminTableResponse.Get["result"]) => set({ tables }),
}));

export default useTableStore;
