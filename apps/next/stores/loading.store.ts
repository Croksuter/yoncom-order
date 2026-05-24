import { create } from "zustand";

interface LoadingState {
  activeQueries: number;
  activeMutations: number;
  activeBlockingLoads: number;
  startQuery: () => void;
  endQuery: () => void;
  startMutation: () => void;
  endMutation: () => void;
  startBlockingLoad: () => void;
  endBlockingLoad: () => void;
  reset: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  activeQueries: 0,
  activeMutations: 0,
  activeBlockingLoads: 0,
  startQuery: () => set((state) => ({ activeQueries: state.activeQueries + 1 })),
  endQuery: () =>
    set((state) => ({ activeQueries: Math.max(0, state.activeQueries - 1) })),
  startMutation: () => set((state) => ({ activeMutations: state.activeMutations + 1 })),
  endMutation: () =>
    set((state) => ({ activeMutations: Math.max(0, state.activeMutations - 1) })),
  startBlockingLoad: () => set((state) => ({ activeBlockingLoads: state.activeBlockingLoads + 1 })),
  endBlockingLoad: () =>
    set((state) => ({ activeBlockingLoads: Math.max(0, state.activeBlockingLoads - 1) })),
  reset: () => set({ activeQueries: 0, activeMutations: 0, activeBlockingLoads: 0 }),
}));
