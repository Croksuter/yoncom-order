"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLoadingStore } from "~/stores/loading.store";
import { useTranslation } from "~/hooks/use-translation";

export default function GlobalLoading() {
  const activeQueries = useLoadingStore((state) => state.activeQueries);
  const activeMutations = useLoadingStore((state) => state.activeMutations);
  const activeBlockingLoads = useLoadingStore((state) => state.activeBlockingLoads);

  // CSR(Client Side Rendering) 수화(Hydration) 에러 방지
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { t } = useTranslation();

  if (!mounted) return null;

  const showQueryBar = activeQueries > 0;
  const showBlockingOverlay = activeMutations > 0 || activeBlockingLoads > 0;
  const overlayLabel = activeMutations > 0 ? t("processing_status") : t("loading_status");

  return (
    <>
      {/* 1. Top Progress Bar (GET/HEAD Queries) */}
      <div
        className={`fixed top-0 left-0 right-0 h-0.5 z-[10000] top-progress-bar transition-opacity duration-300 ${
          showQueryBar ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* 2. Glassmorphic Dimmed Overlay (mutations and user-triggered blocking loads) */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/20 dark:bg-black/40 backdrop-blur-sm transition-all duration-300 ${
          showBlockingOverlay
            ? "opacity-100 pointer-events-auto scale-100"
            : "opacity-0 pointer-events-none scale-105"
        }`}
      >
        <div className="flex flex-col items-center p-8 rounded-2xl brand-glass shadow-2xl space-y-4 max-w-xs text-center transform transition-transform duration-300">
          <div className="relative flex items-center justify-center">
            {/* Pulsing glow behind the spinner */}
            <div className="absolute inset-0 w-12 h-12 rounded-full bg-brand-500/20 blur-xl animate-pulse" />
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin relative z-10" />
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground text-base">{overlayLabel}</p>
          </div>
        </div>
      </div>
    </>
  );
}
