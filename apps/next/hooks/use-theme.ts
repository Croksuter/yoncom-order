import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("theme") as Theme | null;
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        if (saved === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } else {
        // System preference default
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const defaultTheme = systemPrefersDark ? "dark" : "light";
        setTheme(defaultTheme);
        if (defaultTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    } catch (e) {
      // Fallback
    }
  }, []);

  // Listen to system preference changes if no manual override is set
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem("theme");
      if (!saved) {
        const nextTheme = e.matches ? "dark" : "light";
        setTheme(nextTheme);
        if (nextTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("theme", nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (e) {
      // ignore
    }
  };

  return {
    theme,
    toggleTheme,
    isDark: theme === "dark",
    isLight: theme === "light",
    mounted,
  };
}
