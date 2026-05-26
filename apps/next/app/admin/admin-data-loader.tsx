"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSignedIn } from "~/lib/auth";
import { api } from "~/lib/query";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";
import { useRealtimeSync } from "~/hooks/use-realtime-sync";
import type * as AdminDepositResponse from "shared/types/responses/admin/deposit";
import type * as AdminMenuResponse from "shared/types/responses/admin/menu";
import type * as AdminPaymentSettingsResponse from "shared/types/responses/admin/payment-settings";
import type * as AdminTableResponse from "shared/types/responses/admin/table";

const adminScope = "venue:default";

type AdminSyncResponse = {
  result: {
    revision: number;
    events: unknown[];
    snapshot: {
      tables: AdminTableResponse.Get["result"];
      menuCategories: AdminMenuResponse.Get["result"];
      bankTransactions: AdminDepositResponse.Get["result"];
      paymentSettings: AdminPaymentSettingsResponse.Get["result"];
    } | null;
    gap: boolean;
  };
};

function normalizeTables(tables: AdminTableResponse.Get["result"]) {
  return tables.map((table) => ({
    ...table,
    tableContexts: table.tableContexts
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((tableContext) => ({
        ...tableContext,
        orders: tableContext.orders.sort((a, b) => b.createdAt - a.createdAt),
      })),
  }));
}

export function AdminDataLoader({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const revisionRef = useRef(0);

  const refresh = useCallback(async () => {
    await Promise.all([
      useMenuStore.getState().adminLoad({}),
      useTableStore.getState().load({}),
      useTableStore.getState().loadBankTransactions(),
      useTableStore.getState().loadPaymentSettings(),
    ]);
  }, []);

  const applySnapshot = useCallback((snapshot: NonNullable<AdminSyncResponse["result"]["snapshot"]>) => {
    useTableStore.setState({
      tables: normalizeTables(snapshot.tables),
      bankTransactions: snapshot.bankTransactions.transactions,
      paymentSettings: snapshot.paymentSettings,
      isLoaded: true,
      error: false,
    });
    useMenuStore.setState({
      menuCategories: snapshot.menuCategories.map((menuCategory) => ({ ...menuCategory, menus: undefined })),
      menus: snapshot.menuCategories.flatMap((menuCategory) => menuCategory.menus),
      isLoaded: true,
      error: false,
    });
  }, []);

  const syncAdmin = useCallback(async () => {
    const response = await api.get("sync/admin", {
      searchParams: { afterRevision: revisionRef.current },
    }).json<AdminSyncResponse>();
    revisionRef.current = response.result.revision;

    if (response.result.snapshot) {
      applySnapshot(response.result.snapshot);
      return;
    }

    if (response.result.events.length > 0 || response.result.gap) {
      await refresh();
    }
  }, [applySnapshot, refresh]);

  const refreshFromRealtime = useCallback(() => {
    void syncAdmin();
  }, [syncAdmin]);

  useRealtimeSync(authorized ? adminScope : null, refreshFromRealtime);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const session = await isSignedIn(() => {}, () => {
        window.location.href = "/auth";
      });

      if (!mounted) return;

      const sessionUser = session?.user as { role?: string } | null | undefined;
      if (!sessionUser || sessionUser.role !== "ADMIN") {
        window.location.href = "/auth";
        return;
      }

      setAuthorized(true);
      void syncAdmin();
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [refresh]);

  if (!authorized) {
    return <main className="flex min-h-screen items-center justify-center">권한 확인 중</main>;
  }

  return children;
}
