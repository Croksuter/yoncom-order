import { useEffect } from "react";
import useLanguageStore, { type Language } from "~/stores/language.store";
import { translations } from "~/lib/i18n/translations";

export type TranslationKey = keyof typeof translations.ko;
type TranslationReplacements = Record<string, string | number>;

function applyReplacements(text: string, replacements?: TranslationReplacements) {
  if (!replacements) return text;

  let nextText = text;
  Object.entries(replacements).forEach(([key, value]) => {
    nextText = nextText.replace(`{${key}}`, String(value));
  });
  return nextText;
}

export function translate(
  key: TranslationKey,
  replacements?: TranslationReplacements,
  languageOverride?: Language,
) {
  const state = useLanguageStore.getState();
  const currentLang = languageOverride ?? (state.mounted ? state.language : "ko");
  const group = translations[currentLang];
  const text = group[key] || translations.ko[key] || String(key);
  return applyReplacements(text, replacements);
}

export function useTranslation() {
  const { language, setLanguage, mounted, setMounted } = useLanguageStore();

  useEffect(() => {
    if (!mounted) {
      try {
        const saved = localStorage.getItem("language") as Language | null;
        if (saved === "ko" || saved === "en") {
          setLanguage(saved);
        } else {
          // Fallback to browser language
          const browserLang = navigator.language.startsWith("ko") ? "ko" : "en";
          setLanguage(browserLang);
        }
      } catch (e) {}
      setMounted(true);
    }
  }, [mounted, setLanguage, setMounted]);

  const t = (key: TranslationKey, replacements?: TranslationReplacements) => (
    translate(key, replacements, mounted ? language : "ko")
  );

  return {
    t,
    language,
    setLanguage,
    mounted,
  };
}
