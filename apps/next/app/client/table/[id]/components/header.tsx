"use client";

import useTableStore from "~/stores/table.store";
import { useTheme } from "~/hooks/use-theme";
import { useTranslation } from "~/hooks/use-translation";
import { Sun, Moon } from "lucide-react";

interface HeaderProps {
  scrollY: number;
}

const noticeMarqueeCopies = [0, 1];

export default function Header({ scrollY }: HeaderProps) {
  const { clientTable, clientNoticeSettings } = useTableStore();
  const { theme, toggleTheme, isDark, mounted } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const noticeDescription = clientNoticeSettings?.description.trim() ?? "";
  const noticeHeight = noticeDescription ? 32 : 0;

  // Interpolation ratio (0 to 1) based on scroll position (0 to 136 pixels)
  const tRatio = Math.min(scrollY / 136, 1);

  return (
    <header
      className="fixed top-0 left-[50%] translate-x-[-50%] w-full max-w-[600px] z-50 bg-[#0b1326] text-white overflow-hidden transition-all duration-75 ease-out"
      style={{
        height: `${196 + noticeHeight - tRatio * (196 - 60)}px`,
        borderRadius: `0px 0px ${24 * (1 - tRatio)}px ${24 * (1 - tRatio)}px`,
        borderBottom: `1px solid rgba(32, 46, 70, ${1 - tRatio})`,
        boxShadow: tRatio > 0.5 ? "0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)" : "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      {/* Background Logo Graphic */}
      <div
        className="absolute right-[-20%] top-[-10%] pointer-events-none w-2/3 h-full z-0 flex justify-end items-start transition-opacity duration-300"
        style={{ opacity: 0.1 * (1 - tRatio) }}
      >
        <img
          alt=""
          className="w-full h-auto object-cover transform rotate-12 scale-150 mix-blend-screen"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDsA9CPXvcB5VB3yhQlfDRcSBIFDGyk1NrW_ovdSMwPROFXURC7gotOCKORzvdvtG5RXejaeknLBwvCN3KUBCLY8TMos6bjvHooUR0DIuNS26KiQDTFfsTpiPJddu4Bd8EkJlkzb4DuhLg0b41iBc4WhlqdXgt8Hw1zXKoJ4755roRQCN7T8HtLVT-VPodEx9izW9ieD3q4O1p4CU_mVEFfyH0HMiAMWQjES7YYKmAr1esMtL-0W-bNdZxMdgZSNo8Uh__PNNI8Az4C"
        />
      </div>

      {/* Top Navigation Bar */}
      <nav className="relative z-10 flex items-center justify-between px-6 h-[60px] w-full">
        {/* Left Side: Compact Title Info (fades in as collapsed) */}
        <div
          className="flex items-baseline space-x-2 transition-all duration-300 ease-out min-w-0 flex-1 mr-4"
          style={{
            opacity: tRatio,
            transform: `translateY(${(1 - tRatio) * 10}px)`,
            pointerEvents: tRatio > 0.5 ? "auto" : "none",
          }}
        >
          <h1 className="text-lg font-bold text-white font-sans shrink-0">{t("brand_title")}</h1>
          <p className="text-[10px] text-[#E6EEF8] opacity-80 font-medium font-sans truncate">
            {t("brand_sub")}
          </p>
        </div>

        {/* Right Actions Flex Container */}
        <div className="flex items-center gap-2 shrink-0">
          {mounted && (
            <>
              <button
                type="button"
                onClick={() => setLanguage(language === "ko" ? "en" : "ko")}
                className="px-2.5 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center border border-white/15 cursor-pointer shrink-0 font-sans text-xs font-bold text-white"
                title={t("change_language")}
              >
                {language === "ko" ? "EN" : "KO"}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center border border-white/15 cursor-pointer shrink-0"
                title={isDark ? t("change_to_light") : t("change_to_dark")}
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-300" />}
              </button>
            </>
          )}

          {/* Right Side: Table Badge (smoothly transitions style) */}
          <div
            className="rounded-full font-sans transition-all duration-300 ease-in-out border border-transparent shadow-inner shrink-0"
            style={{
              backgroundColor: `rgba(26, 73, 156, ${0.8 * (1 - tRatio)})`,
              borderColor: tRatio > 0.5 ? "rgba(230, 238, 248, 0.3)" : "rgba(26, 73, 156, 0.2)",
              color: "#ffffff",
              fontSize: tRatio > 0.5 ? "12px" : "14px",
              padding: tRatio > 0.5 ? "4px 12px" : "6px 16px",
              fontWeight: tRatio > 0.5 ? 500 : 700,
            }}
          >
            {clientTable ? clientTable.name : t("default_table_name")}
          </div>
        </div>
      </nav>

      {/* Brand Identity Section (fades and slides up as collapsed) */}
      <div
        className="relative z-10 px-6 pt-2 pb-2 transition-all duration-300 ease-out"
        style={{
          opacity: 1 - tRatio,
          transform: `translateY(${-tRatio * 15}px)`,
          pointerEvents: tRatio < 0.5 ? "auto" : "none",
        }}
      >
        <p className="text-blue-300 text-xs font-semibold tracking-wider mb-1 opacity-90 uppercase font-sans">
          {t("brand_booth")}
        </p>
        <h1 className="text-4xl font-black tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 font-sans">
          {t("brand_title")}
        </h1>
        <p className="text-xs font-medium text-blue-100 opacity-80 max-w-xs leading-relaxed font-sans">
          {t("brand_slogan")}
        </p>
      </div>

      {noticeDescription && (
        <div className="absolute bottom-0 left-0 right-0 z-20 h-8 overflow-hidden text-rose-100">
          <div className="client-notice-marquee absolute inset-y-0 left-0 flex w-max items-center whitespace-nowrap text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.58)]">
            {noticeMarqueeCopies.map((copy) => (
              <span key={copy} className="px-6">{noticeDescription}</span>
            ))}
          </div>
          <style jsx>{`
            @keyframes client-notice-marquee {
              0% { transform: translateX(calc(100vw)); }
              100% { transform: translateX(calc(-100%)); }
            }

            .client-notice-marquee {
              animation: client-notice-marquee 33s linear infinite;
            }
          `}</style>
        </div>
      )}
    </header>
  );
}
