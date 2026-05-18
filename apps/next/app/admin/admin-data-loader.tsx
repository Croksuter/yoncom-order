"use client";

import { useEffect } from "react";
import useMenuStore from "~/stores/menu.store";
import useTableStore from "~/stores/table.store";

export function AdminDataLoader({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const refresh = async () => {
      await Promise.all([
        useMenuStore.getState().adminLoad({}),
        useTableStore.getState().load({}),
      ]);
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  return children;
}
