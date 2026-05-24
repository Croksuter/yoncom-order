import { useLoadingStore } from "~/stores/loading.store";

export function waitForNextFrame() {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export async function runWithBlockingLoading<T>(callback: () => Promise<T>) {
  const { startBlockingLoad, endBlockingLoad } = useLoadingStore.getState();

  startBlockingLoad();
  try {
    return await callback();
  } finally {
    await waitForNextFrame();
    endBlockingLoad();
  }
}
