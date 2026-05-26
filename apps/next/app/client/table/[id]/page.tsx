"use client";

import { HTTPError } from "ky";
import { use, useCallback, useEffect, useRef, useState, type CSSProperties, type UIEventHandler } from "react";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import Footer from "./components/footer";
import Header from "./components/header";
import Menus from "./components/menu/menus";
import ShopIntro from "./components/shop.intro";
import OrderHistoryPanel from "./components/order/order.history.panel";
import OrderModal from "./components/order/order.modal";
import OrderPaymentPanel from "./components/order/order.payment.panel";
import { Skeleton } from "~/components/ui/skeleton";
import { isPaymentInstructionOrder } from "~/lib/order-status";
import { useRealtimeSync } from "~/hooks/use-realtime-sync";
import { useTranslation } from "~/hooks/use-translation";
import { api } from "~/lib/query";
import type * as ClientTableResponse from "shared/types/responses/client/table";
import type * as AdminClientNoticeSettingsResponse from "shared/types/responses/admin/client-notice-settings";
import type * as AdminPaymentSettingsResponse from "shared/types/responses/admin/payment-settings";
import { traceEvent } from "~/lib/verification-trace";
import kyErrorHandler from "~/lib/ky-error-handler";

type ClientTablePageProps = {
  params: Promise<{ id: string }>;
};

type TableSyncResponse = {
  result: {
    revision: number;
    events: unknown[];
    snapshot: {
      table: ClientTableResponse.Get["result"];
      paymentSettings: AdminPaymentSettingsResponse.Get["result"];
      clientNoticeSettings: AdminClientNoticeSettingsResponse.Get["result"];
    } | null;
    gap: boolean;
  };
};

type TableSessionResponse = {
  result: {
    state: "INACTIVE" | "RESUMED";
    table: Omit<ClientTableResponse.Get["result"], "tableContexts">;
    tableId: string;
    tableContextId: string | null;
    expiresAt: number | null;
    paymentSettings: AdminPaymentSettingsResponse.Get["result"];
    clientNoticeSettings: AdminClientNoticeSettingsResponse.Get["result"];
  };
};

const TABLE_UNAVAILABLE_MESSAGE = "table_unavailable";
const TABLE_UNAVAILABLE_DESCRIPTION = "table_unavailable_desc";
const TABLE_IN_USE_MESSAGE = "table_in_use";
const TABLE_IN_USE_DESCRIPTION = "table_in_use_desc";
const tableAccessFailureStatuses = new Set([401, 403, 404, 409]);
const baseExpandedHeaderHeight = 196;
const baseCollapsedHeaderHeight = 60;
const noticeHeaderHeight = 32;
const clientFooterReservedHeight = 88;
const paymentSyncIntervalMs = 1000;
type TableAccessState = "UNKNOWN" | "INACTIVE" | "RESUMED" | "BLOCKED";

function normalizeClientTable(table: ClientTableResponse.Get["result"]) {
  return {
    ...table,
    tableContexts: table.tableContexts
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((tableContext) => ({
        ...tableContext,
        orders: tableContext.orders.sort((a, b) => b.createdAt - a.createdAt),
      })),
  };
}

function isTableAccessFailure(error: unknown) {
  return error instanceof HTTPError && tableAccessFailureStatuses.has(error.response.status);
}

async function getTableAccessFailureCopy(error: unknown) {
  if (!(error instanceof HTTPError)) {
    return {
      message: TABLE_UNAVAILABLE_MESSAGE,
      description: TABLE_UNAVAILABLE_DESCRIPTION,
    };
  }

  const body = (await error.response.clone().json().catch(() => null)) as { error?: string } | null;
  if (body?.error === "Table already in use") {
    return {
      message: TABLE_IN_USE_MESSAGE,
      description: TABLE_IN_USE_DESCRIPTION,
    };
  }
  if (body?.error === "Table Not Found") {
    return {
      message: "table_not_found",
      description: "table_not_found_desc",
    };
  }

  return {
    message: TABLE_UNAVAILABLE_MESSAGE,
    description: TABLE_UNAVAILABLE_DESCRIPTION,
  };
}

export default function ClientTablePage({ params }: ClientTablePageProps) {
  const { id } = use(params);
  const { clientTable, clientNoticeSettings } = useTableStore();
  const { clientMenuCategories } = useMenuStore();
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [tableAccessMessage, setTableAccessMessage] = useState<string | null>(null);
  const [tableAccessDescription, setTableAccessDescription] = useState<string | null>(null);
  const [tableAccessState, setTableAccessState] = useState<TableAccessState>("UNKNOWN");
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu");
  const [scrollY, setScrollY] = useState(0);
  const isValidTableId = id.length === 15;
  const activeUnpaidOrder = clientTable?.tableContexts[0]?.orders.find(isPaymentInstructionOrder);
  const activeNoticeDescription = (language === "en"
    ? clientNoticeSettings?.descriptionEn
    : clientNoticeSettings?.description
  )?.trim() ?? "";
  const hasClientNotice = Boolean(activeNoticeDescription);
  const expandedHeaderHeight = baseExpandedHeaderHeight + (hasClientNotice ? noticeHeaderHeight : 0);
  const collapsedHeaderHeight = baseCollapsedHeaderHeight + (hasClientNotice ? noticeHeaderHeight : 0);
  const headerCollapseDistance = expandedHeaderHeight - collapsedHeaderHeight;
  const collapsedHeaderOffset = headerCollapseDistance;
  const [isVerified, setIsVerified] = useState(false);
  const tableScope =
    isValidTableId && clientTable?.id === id && tableAccessState === "RESUMED" && !tableAccessMessage
      ? `table:${id}`
      : null;
  const revisionRef = useRef(0);
  const paymentSyncInFlightRef = useRef(false);
  const setTracedActiveTab = useCallback((tab: "menu" | "orders") => {
    traceEvent("client", "ui.panel.state", {
      panel: "client.table.activeTab",
      from: activeTab,
      to: tab,
    });
    setActiveTab(tab);
  }, [activeTab]);

  useEffect(() => {
    setScrollY(activeTab === "orders" ? collapsedHeaderOffset : 0);
  }, [activeTab, collapsedHeaderOffset]);

  const handleContentScroll: UIEventHandler<HTMLDivElement> = useCallback((event) => {
    const nextScrollY = event.currentTarget.scrollTop > 0 ? collapsedHeaderOffset : 0;
    setScrollY((prev) => (prev === nextScrollY ? prev : nextScrollY));
  }, [collapsedHeaderOffset]);

  const clientLayoutStyle = {
    paddingTop: `${scrollY > 0 ? collapsedHeaderHeight : expandedHeaderHeight}px`,
    "--client-header-height": `${scrollY > 0 ? collapsedHeaderHeight : expandedHeaderHeight}px`,
    "--client-footer-height": `${clientFooterReservedHeight}px`,
  } as CSSProperties;

  const refreshClientTable = useCallback(async () => {
    if (isValidTableId) {
      await useTableStore.getState().clientGetTable({ tableId: id });
    }
  }, [id, isValidTableId]);

  const markTableUnavailable = useCallback((copy?: { message: string; description: string }) => {
    revisionRef.current = 0;
    setTableAccessState("BLOCKED");
    setTableAccessMessage(copy?.message ?? TABLE_UNAVAILABLE_MESSAGE);
    setTableAccessDescription(copy?.description ?? TABLE_UNAVAILABLE_DESCRIPTION);
    useTableStore.setState({ clientTable: null, isLoaded: false, error: true });
  }, []);

  const syncClientTable = useCallback(async (afterRevision = revisionRef.current) => {
    if (!isValidTableId) return;

    try {
      const response = await api.get("sync/table", {
        searchParams: { tableId: id, afterRevision },
      }).json<TableSyncResponse>();
      revisionRef.current = response.result.revision;

      if (response.result.snapshot?.table) {
        setTableAccessState("RESUMED");
        setTableAccessMessage(null);
        useTableStore.setState({
          clientTable: normalizeClientTable(response.result.snapshot.table),
          paymentSettings: response.result.snapshot.paymentSettings,
          clientNoticeSettings: response.result.snapshot.clientNoticeSettings,
          isLoaded: true,
          error: false,
        });
        return;
      }

      if (response.result.events.length > 0 || response.result.gap) {
        await refreshClientTable();
      }
    } catch (error) {
      if (isTableAccessFailure(error)) {
        markTableUnavailable(await getTableAccessFailureCopy(error));
      }
      void kyErrorHandler(error);
    }
  }, [id, isValidTableId, markTableUnavailable, refreshClientTable]);

  const syncClientTableFromRealtime = useCallback(() => {
    if (tableAccessState !== "RESUMED") {
      return;
    }
    void syncClientTable();
  }, [syncClientTable, tableAccessState]);

  useRealtimeSync(tableScope, syncClientTableFromRealtime);

  useEffect(() => {
    if (!activeUnpaidOrder || tableAccessState !== "RESUMED") {
      return;
    }

    const syncPaymentState = async () => {
      if (paymentSyncInFlightRef.current) {
        return;
      }
      paymentSyncInFlightRef.current = true;
      traceEvent("client", "payment.pending.resync", {
        orderId: activeUnpaidOrder.id,
        tableId: id,
        mode: "forceSnapshot",
      });
      try {
        await syncClientTable(0);
      } finally {
        paymentSyncInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void syncPaymentState();
    }, paymentSyncIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeUnpaidOrder?.id, id, syncClientTable, tableAccessState]);

  useEffect(() => {
    if (activeUnpaidOrder) {
      const verified = localStorage.getItem(`verified_order_${activeUnpaidOrder.id}`) === "true";
      setIsVerified(verified);
    } else {
      setIsVerified(false);
    }
  }, [activeUnpaidOrder]);

  useEffect(() => {
    if (clientTable?.name) {
      document.title = `${clientTable.name} | ${t("brand_title")}`;
    } else {
      document.title = `${t("brand_title")}`;
    }
  }, [clientTable, t]);

  useEffect(() => {
    if (tableAccessState === "INACTIVE" && clientTable?.tableContexts.some((context) => context.deletedAt === null)) {
      setTableAccessState("RESUMED");
    }
  }, [clientTable, tableAccessState]);

  useEffect(() => {
    const fetchTableData = async () => {
      setLoading(true);
      setTableAccessState("UNKNOWN");
      setTableAccessMessage(null);
      setTableAccessDescription(null);
      useTableStore.setState({ clientTable: null });

      if (!isValidTableId) {
        setLoading(false);
        return;
      }

      try {
        const session = await api.post("table/session", {
          json: { tableId: id },
        }).json<TableSessionResponse>();

        if (session.result.state === "INACTIVE") {
          revisionRef.current = 0;
          setTableAccessState("INACTIVE");
          setTableAccessMessage(null);
          setTableAccessDescription(null);
          useTableStore.setState({
            clientTable: {
              ...session.result.table,
              tableContexts: [],
            },
            paymentSettings: session.result.paymentSettings,
            clientNoticeSettings: session.result.clientNoticeSettings,
            isLoaded: true,
            error: false,
          });
          return;
        }

        setTableAccessState("RESUMED");
        useTableStore.setState({
          paymentSettings: session.result.paymentSettings,
          clientNoticeSettings: session.result.clientNoticeSettings,
        });
        revisionRef.current = 0;
        await syncClientTable(0);
      } catch (error) {
        if (isTableAccessFailure(error)) {
          markTableUnavailable(await getTableAccessFailureCopy(error));
        }
        void kyErrorHandler(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchTableData();
  }, [id, isValidTableId, markTableUnavailable, syncClientTable]);

  useEffect(() => {
    if (!clientTable) {
      return;
    }

    void useMenuStore.getState().clientLoad({});
  }, [clientTable]);

  useEffect(() => {
    if (typeof window === "undefined" || !clientMenuCategories) return;
    clientMenuCategories
      .flatMap((cat) => cat.menus)
      .forEach((menu) => {
        if (menu.image) {
          const img = new window.Image();
          img.src = menu.image;
        }
      });
  }, [clientMenuCategories]);

  if (loading) {
    return (
      <main className="h-screen w-screen items-center justify-center overflow-hidden fc p-4">
        <div className="w-full max-w-[600px] flex-1 overflow-hidden px-2 fc gap-4">
          {/* Header Skeleton */}
          <div className="fr justify-between items-center py-4 border-b border-gray-100">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          {/* ShopIntro Skeleton */}
          <div className="space-y-2 py-4">
            <Skeleton className="h-6 w-32 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          {/* Tabs/Categories Skeleton */}
          <div className="fr gap-2 pb-2">
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
          </div>
          {/* Menu Items Skeleton */}
          <div className="flex-1 space-y-4 overflow-hidden pt-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="fr gap-4 p-3 border border-gray-100 rounded-xl items-center bg-card">
                <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3 rounded" />
                  <Skeleton className="h-4 w-2/3 rounded" />
                  <Skeleton className="h-5 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
          {/* Footer Skeleton */}
          <div className="fr justify-between items-center py-4 border-t border-gray-100 gap-2">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] w-screen items-center justify-center overflow-hidden fc">
      {clientTable && clientMenuCategories ? (
        activeUnpaidOrder && isVerified ? (
          <OrderPaymentPanel order={activeUnpaidOrder} />
        ) : (
          <>
            <Header scrollY={scrollY} />
            <div
              className="w-full max-w-[600px] flex-1 min-h-0 overflow-hidden px-4 fc relative transition-all duration-75 ease-out"
              style={clientLayoutStyle}
            >
              {activeTab === "menu" || tableAccessState === "INACTIVE" ? (
                <div className="flex-1 min-h-0 fc overflow-hidden w-full">
                  {/* <ShopIntro tableName={clientTable.name} tableSeats={clientTable.seats} /> */}
                  <Menus
                    menuCategories={clientMenuCategories}
                    isHeaderCollapsed={scrollY > 0}
                    onContentScroll={handleContentScroll}
                  />
                </div>
              ) : (
                <OrderHistoryPanel onContentScroll={handleContentScroll} />
              )}
              <Footer
                activeTab={activeTab}
                setActiveTab={setTracedActiveTab}
                canViewOrders={tableAccessState !== "INACTIVE"}
              />
            </div>

            {/* Locked Verification Modal */}
            {activeUnpaidOrder && !isVerified && (
              <OrderModal
                openState={true}
                setOpenState={() => {}}
                onVerify={() => setIsVerified(true)}
              />
            )}
          </>
        )
      ) : (
        <div className="p-6 text-center">
          <h1 className="text-xl font-bold">
            {isValidTableId ? (tableAccessMessage ? t(tableAccessMessage as any) : t("table_not_found")) : t("invalid_table_url")}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isValidTableId && tableAccessMessage ? t(tableAccessDescription as any) : `tableId: ${id}`}
          </p>
        </div>
      )}
    </main>
  );
}
