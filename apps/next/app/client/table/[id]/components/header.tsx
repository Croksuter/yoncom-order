"use client";

import useTableStore from "~/stores/table.store";
import { useTheme } from "~/hooks/use-theme";
import { Sun, Moon } from "lucide-react";

interface HeaderProps {
  scrollY: number;
}

export default function Header({ scrollY }: HeaderProps) {
  const { clientTable } = useTableStore();
  const { theme, toggleTheme, isDark, mounted } = useTheme();

  // Interpolation ratio (0 to 1) based on scroll position (0 to 136 pixels)
  const t = Math.min(scrollY / 136, 1);

  return (
    <header
      className="fixed top-0 left-[50%] translate-x-[-50%] w-full max-w-[600px] z-50 bg-[#0b1326] text-white overflow-hidden transition-all duration-75 ease-out"
      style={{
        height: `${196 - t * (196 - 60)}px`,
        borderRadius: `0px 0px ${24 * (1 - t)}px ${24 * (1 - t)}px`,
        borderBottom: `1px solid rgba(32, 46, 70, ${1 - t})`,
        boxShadow: t > 0.5 ? "0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)" : "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      {/* Background Logo Graphic */}
      <div
        className="absolute right-[-20%] top-[-10%] pointer-events-none w-2/3 h-full z-0 flex justify-end items-start transition-opacity duration-300"
        style={{ opacity: 0.1 * (1 - t) }}
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
          className="flex items-baseline space-x-2 transition-all duration-300 ease-out"
          style={{
            opacity: t,
            transform: `translateY(${(1 - t) * 10}px)`,
            pointerEvents: t > 0.5 ? "auto" : "none",
          }}
        >
          <h1 className="text-lg font-bold text-white font-sans">첨크크</h1>
          <p className="text-[10px] text-[#E6EEF8] opacity-80 font-medium font-sans">
            연세대학교 컴퓨터과학과
          </p>
        </div>

        {/* Right Actions Flex Container */}
        <div className="flex items-center gap-2">
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center border border-white/15 cursor-pointer shrink-0"
              title={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-300" />}
            </button>
          )}

          {/* Right Side: Table Badge (smoothly transitions style) */}
          <div
            className="rounded-full font-sans transition-all duration-300 ease-in-out border border-transparent shadow-inner shrink-0"
            style={{
              backgroundColor: `rgba(26, 73, 156, ${0.8 * (1 - t)})`,
              borderColor: t > 0.5 ? "rgba(230, 238, 248, 0.3)" : "rgba(26, 73, 156, 0.2)",
              color: "#ffffff",
              fontSize: t > 0.5 ? "12px" : "14px",
              padding: t > 0.5 ? "4px 12px" : "6px 16px",
              fontWeight: t > 0.5 ? 500 : 700,
            }}
          >
            {clientTable ? clientTable.name : "Table 07"}
          </div>
        </div>
      </nav>

      {/* Brand Identity Section (fades and slides up as collapsed) */}
      <div
        className="relative z-10 px-6 pt-2 pb-2 transition-all duration-300 ease-out"
        style={{
          opacity: 1 - t,
          transform: `translateY(${-t * 15}px)`,
          pointerEvents: t < 0.5 ? "auto" : "none",
        }}
      >
        <p className="text-blue-300 text-xs font-semibold tracking-wider mb-1 opacity-90 uppercase font-sans">
          연세대학교 컴퓨터과학과 부스
        </p>
        <h1 className="text-4xl font-black tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 font-sans">
          첨크크
        </h1>
        <p className="text-xs font-medium text-blue-100 opacity-80 max-w-xs leading-relaxed font-sans">
          Absolute Vital for Debugging Late into the Night.
        </p>
      </div>
    </header>
  );
}