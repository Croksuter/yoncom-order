import { create } from "zustand";

export type Language = "ko" | "en";

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
  mounted: boolean;
  setMounted: (mounted: boolean) => void;
}

const useLanguageStore = create<LanguageState>((set) => ({
  language: "ko",
  mounted: false,
  setLanguage: (language) => {
    set({ language });
    try {
      localStorage.setItem("language", language);
    } catch (e) {}
  },
  setMounted: (mounted) => set({ mounted }),
}));

export default useLanguageStore;
