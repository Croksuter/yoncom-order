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

  adminCompleteOrder: (query: AdminOrderRequest.CompleteOrder) => Promise<AdminOrderResponse.Complete | null>;

  // 다른 store에서 사용하기 위해 노출. component에서 사용하지 않음.
  _setTables: (tables: AdminTableResponse.Get["result"]) => void;
}

const useTableStore = create<TableState>((set, get) => ({
  clientTable: null,
  tables: [],
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
    onSuccess: (res) => toast({
      title: "테이블 생성 완료",
      description: "테이블이 성공적으로 생성되었습니다.",
      duration: 3000,
    }),
  }),

  removeTable: async (query: AdminTableRequest.Remove) => await queryStore<AdminTableRequest.Remove, AdminTableResponse.Remove>({
    route: "admin/table",
    method: "delete",
    query,
    setter: set,
    onSuccess: (res) => toast({
      title: "테이블 제거 완료",
      description: "테이블이 성공적으로 제거되었습니다.",
      duration: 3000,
    }),
  }),

  updateTable: async (query: AdminTableRequest.Update) => await queryStore<AdminTableRequest.Update, AdminTableResponse.Update>({
    route: "admin/table",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => toast({
      title: "테이블 수정 완료",
      description: "테이블이 성공적으로 수정되었습니다.",
      duration: 3000,
    }),
  }),

  occupyTable: async (query: AdminTableRequest.Occupy) => await queryStore<AdminTableRequest.Occupy, AdminTableResponse.Occupy>({
    route: "admin/table/occupy",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => toast({
      title: "테이블 점유 완료",
      description: "테이블이 성공적으로 점유되었습니다.",
      duration: 3000,
    }),
  }),

  vacateTable: async (query: AdminTableRequest.Vacate) => await queryStore<AdminTableRequest.Vacate, AdminTableResponse.Vacate>({
    route: "admin/table/vacate",
    method: "put",
    query,
    setter: set,
    onSuccess: (res) => toast({
      title: "테이블 비우기 완료",
      description: "테이블이 성공적으로 비워졌습니다.",
      duration: 3000,
    }),
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
        title: "주문 완료 완료",
        description: "주문이 성공적으로 완료되었습니다.",
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
      toast({
        title: "결제 처리 완료",
        description: "결제가 성공적으로 처리되었습니다.",
        duration: 3000,
      });
      get().load({});
    },
  }),

  _setTables: (tables: AdminTableResponse.Get["result"]) => set({ tables }),
}));

export default useTableStore;