type MenuOrderProgressLike = {
  quantity?: number | null;
  status?: string | null;
  readyQuantity?: number | null;
  pickedUpQuantity?: number | null;
};

function normalizeCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clampCount(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getMenuOrderProgress(menuOrder: MenuOrderProgressLike | null | undefined) {
  const status = menuOrder?.status ?? null;
  const totalQuantity = normalizeCount(menuOrder?.quantity);

  if (status === "CANCELLED") {
    return {
      totalQuantity,
      pendingQuantity: 0,
      readyQuantity: 0,
      pickedUpQuantity: 0,
    };
  }

  const legacyReadyQuantity = status === "READY" ? totalQuantity : 0;
  const legacyPickedUpQuantity = status === "PICKED_UP" || status === "SERVED" ? totalQuantity : 0;
  const pickedUpQuantity = clampCount(
    normalizeCount(menuOrder?.pickedUpQuantity ?? legacyPickedUpQuantity),
    0,
    totalQuantity,
  );
  const readyQuantity = clampCount(
    normalizeCount(menuOrder?.readyQuantity ?? legacyReadyQuantity),
    0,
    Math.max(0, totalQuantity - pickedUpQuantity),
  );
  const pendingQuantity = Math.max(0, totalQuantity - readyQuantity - pickedUpQuantity);

  return {
    totalQuantity,
    pendingQuantity,
    readyQuantity,
    pickedUpQuantity,
  };
}

export function getMenuOrderDerivedStatus(menuOrder: MenuOrderProgressLike | null | undefined) {
  if (menuOrder?.status === "CANCELLED") return "CANCELLED";
  const progress = getMenuOrderProgress(menuOrder);

  if (progress.totalQuantity > 0 && progress.pickedUpQuantity >= progress.totalQuantity) return "PICKED_UP";
  if (progress.pendingQuantity > 0) return "PENDING";
  if (progress.readyQuantity > 0) return "READY";
  return menuOrder?.status ?? "-";
}
