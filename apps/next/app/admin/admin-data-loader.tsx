"use client";

import { useEffect, useState } from "react";
import { isSignedIn } from "~/lib/auth";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";

export function AdminDataLoader({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let interval: number | null = null;
    let mounted = true;

    const refresh = async () => {
      await Promise.all([
        useMenuStore.getState().adminLoad({}),
        useTableStore.getState().load({}),
        useTableStore.getState().loadBankTransactions(),
      ]);
    };

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
      void refresh();
      interval = window.setInterval(() => {
        void refresh();
      }, 4000);
    };

    void bootstrap();

    return () => {
      mounted = false;
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, []);

  if (!authorized) {
    return <main className="flex min-h-screen items-center justify-center">권한 확인 중</main>;
  }

  return children;
}
