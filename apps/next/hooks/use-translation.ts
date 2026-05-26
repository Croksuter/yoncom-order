import { useEffect } from "react";
import useLanguageStore, { type Language } from "~/stores/language.store";
import { translations } from "~/lib/i18n/translations";

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

  const t = (key: keyof typeof translations.ko, replacements?: Record<string, string | number>) => {
    const currentLang = mounted ? language : "ko";
    const group = translations[currentLang];
    let text = group[key] || translations.ko[key] || String(key);

    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }

    return text;
  };

  return {
    t,
    language,
    setLanguage,
    mounted,
  };
}
