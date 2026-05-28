"use client";

import { useEffect, useState } from "react";
import type { PublicSessionUser } from "shared/types/responses/client/admin";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import useTableStore from "~/stores/table.store";
import useMenuStore from "~/stores/menu.store";
import { api } from "~/lib/query";
import { useTheme } from "~/hooks/use-theme";
import {
  Package,
  LayoutDashboard,
  Receipt,
  Grid3X3,
  BarChart3,
  AlertCircle,
  ChefHat,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp
} from "lucide-react";

function getProfileInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "AD";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export default function DashboardLayout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: PublicSessionUser;
}) {
  const { theme, toggleTheme, isDark, mounted } = useTheme();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.post("auth/sign-out");
      router.push("/auth");
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  const { tables, bankTransactions } = useTableStore();
  const { menus } = useMenuStore();
  const tablesList = tables ?? [];
  const bankTransactionsList = bankTransactions ?? [];

  // 1. 누적 매출 (PAID 상태의 결제 금액 합산 - 정가 기준)
  const confirmedOrders = tablesList
    .filter((table) => table.tableContexts?.[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts?.[0]?.orders ?? [])
    .filter((order) => order.payment?.status === "PAID");

  const totalRevenue = confirmedOrders.reduce((acc, order) => {
    const originalOrderPrice = order.menuOrders.reduce((sum, menuOrder) => {
      const menu = menus.find((m) => m.id === menuOrder.menuId);
      return sum + (menu?.price ?? 0) * menuOrder.quantity;
    }, 0);
    return acc + originalOrderPrice;
  }, 0);

  // 2. 입금 대기 건수
  const reviewTransactions = bankTransactionsList.filter((transaction) => transaction.status !== "IGNORED");
  const pendingPaymentsCount = reviewTransactions.length;

  // 3. 환불 대기 건수 (환불 이슈)
  const refundPendingOrders = tablesList
    .filter((table) => table.tableContexts?.[0]?.deletedAt === null)
    .flatMap((table) => table.tableContexts?.[0]?.orders ?? [])
    .filter((order) => order.deletedAt === null && order.payment?.status === "REFUND_PENDING");
  const issuesCount = refundPendingOrders.length;

  // Dynamic header titles based on pathname
  const isCooker = pathname === "/admin/cooker";
  const isPos = pathname === "/admin/pos";
  const canCollapseHeader = isPos || isCooker;
  const headerCollapseStorageKey = isCooker ? "admin_cooker_header_collapsed" : "admin_pos_header_collapsed";
  const title = isCooker ? "Kitchen Monitor" : "Dashboard Overview";
  const subtitle = isCooker ? "메뉴별 실시간 대기열 모니터링" : "POS Dashboard & Live Status";
  const profileInitials = getProfileInitials(user.name);

  useEffect(() => {
    if (!canCollapseHeader) {
      setIsHeaderCollapsed(false);
      return;
    }

    setIsHeaderCollapsed(localStorage.getItem(headerCollapseStorageKey) === "true");
  }, [canCollapseHeader, headerCollapseStorageKey]);

  const toggleHeaderCollapsed = () => {
    const nextCollapsed = !isHeaderCollapsed;
    setIsHeaderCollapsed(nextCollapsed);
    localStorage.setItem(headerCollapseStorageKey, String(nextCollapsed));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300 relative">
      {/* Floating Collapsible Left Sidebar (Stitch Hover Overlay Design) */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => {
          setIsSidebarHovered(false);
          setIsProfileMenuOpen(false);
        }}
        className={`hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-lg h-full transition-all duration-300 ease-in-out absolute left-0 top-0 z-40 overflow-hidden ${
          isSidebarHovered
            ? "w-[216px] shadow-[12px_0_30px_rgba(0,0,0,0.08)] dark:shadow-[12px_0_30px_rgba(0,0,0,0.4)]"
            : "w-16 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.15)]"
        }`}
      >
        <div className="flex flex-col gap-6 h-full justify-between py-6 px-0 overflow-hidden w-full">
          <div className="flex flex-col gap-6 w-full">
            {/* Logo Section (Stationary Image, Sliding Text) */}
            <div className={`relative flex items-center h-12 ml-3 flex-shrink-0 transition-all duration-300 ${
              isSidebarHovered ? "w-[192px]" : "w-10"
            }`}>
              <div className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-800/80 active:scale-95 transition-all duration-300 flex-shrink-0 bg-[#0b1326] absolute left-0 top-1/2 -translate-y-1/2">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDsA9CPXvcB5VB3yhQlfDRcSBIFDGyk1NrW_ovdSMwPROFXURC7gotOCKORzvdvtG5RXejaeknLBwvCN3KUBCLY8TMos6bjvHooUR0DIuNS26KiQDTFfsTpiPJddu4Bd8EkJlkzb4DuhLg0b41iBc4WhlqdXgt8Hw1zXKoJ4755roRQCN7T8HtLVT-VPodEx9izW9ieD3q4O1p4CU_mVEFfyH0HMiAMWQjES7YYKmAr1esMtL-0W-bNdZxMdgZSNo8Uh__PNNI8Az4C"
                  alt="첨크크"
                  className="w-full h-full object-cover transform rotate-12 scale-125 mix-blend-screen"
                />
              </div>
              <h1 className={`font-extrabold text-xl text-slate-800 dark:text-white tracking-tight truncate select-none transition-all duration-300 absolute left-12 top-1/2 -translate-y-1/2 ${
                isSidebarHovered
                  ? "opacity-100 translate-x-0 pointer-events-auto"
                  : "opacity-0 -translate-x-3 overflow-hidden pointer-events-none"
              }`}>
                첨크크
              </h1>
            </div>

            {/* Sidebar Navigation */}
            <nav className="flex flex-col gap-2 w-full">
              {/* Dashboard Tab */}
              <Link
                href="/admin/pos"
                className={`relative flex items-center h-11 ml-3 rounded-2xl transition-all duration-200 border ${
                  isSidebarHovered ? "w-[192px]" : "w-10"
                } ${
                  !isCooker
                    ? "bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-white font-bold border-brand-100 dark:border-brand-900/30"
                    : "text-slate-500 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 border-transparent"
                }`}
              >
                <LayoutDashboard className="h-5 w-5 absolute left-[10px] top-1/2 -translate-y-1/2 flex-shrink-0" />
                <span className={`text-sm truncate select-none transition-all duration-300 absolute left-12 top-1/2 -translate-y-1/2 ${
                  isSidebarHovered
                    ? "opacity-100 translate-x-0 pointer-events-auto"
                    : "opacity-0 -translate-x-3 overflow-hidden pointer-events-none"
                }`}>
                  Dashboard
                </span>
              </Link>

              {/* Kitchen Tab */}
              <Link
                href="/admin/cooker"
                className={`relative flex items-center h-11 ml-3 rounded-2xl transition-all duration-200 border ${
                  isSidebarHovered ? "w-[192px]" : "w-10"
                } ${
                  isCooker
                    ? "bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-white font-bold border-brand-100 dark:border-brand-900/30"
                    : "text-slate-500 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 border-transparent"
                }`}
              >
                <ChefHat className="h-5 w-5 absolute left-[10px] top-1/2 -translate-y-1/2 flex-shrink-0" />
                <span className={`text-sm truncate select-none transition-all duration-300 absolute left-12 top-1/2 -translate-y-1/2 ${
                  isSidebarHovered
                    ? "opacity-100 translate-x-0 pointer-events-auto"
                    : "opacity-0 -translate-x-3 overflow-hidden pointer-events-none"
                }`}>
                  Kitchen
                </span>
              </Link>

              {[
                // { label: "Orders", icon: Receipt },
                // { label: "Table Management", icon: Grid3X3 },
                // { label: "Inventory", icon: Package },
                { label: "Sales Analytics", icon: BarChart3 }
              ].map((tab, idx) => {
                const Icon = tab.icon;
                return (
                  <a
                    key={idx}
                    href="#"
                    className={`relative flex items-center h-11 ml-3 rounded-2xl border border-transparent transition-all duration-200 ${
                      isSidebarHovered ? "w-[192px]" : "w-10"
                    } text-slate-500 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200`}
                  >
                    <Icon className="h-5 w-5 absolute left-[10px] top-1/2 -translate-y-1/2 flex-shrink-0" />
                    <span className={`text-sm truncate select-none transition-all duration-300 absolute left-12 top-1/2 -translate-y-1/2 ${
                      isSidebarHovered
                        ? "opacity-100 translate-x-0 pointer-events-auto"
                        : "opacity-0 -translate-x-3 overflow-hidden pointer-events-none"
                    }`}>
                      {tab.label}
                    </span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* User Profile Info */}
          <div
            onClick={() => {
              if (isSidebarHovered) {
                setIsProfileMenuOpen(!isProfileMenuOpen);
              }
            }}
            className={`relative pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col justify-end ml-3 flex-shrink-0 transition-all duration-300 select-none ${
              isSidebarHovered ? "w-[192px]" : "w-10"
            } ${
              isProfileMenuOpen && isSidebarHovered ? "h-32 cursor-pointer" : "h-16 cursor-pointer"
            }`}
          >
            {/* Smooth Floating Logout Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 mb-3 select-none active:scale-95 ${
                isProfileMenuOpen && isSidebarHovered
                  ? "opacity-100 scale-100 translate-y-0 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400"
                  : "opacity-0 scale-95 translate-y-2 pointer-events-none absolute"
              }`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>로그아웃</span>
            </button>

            {/* Profile Info Row */}
            <div className="relative flex items-center h-10 w-full">
              <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-950/40 text-brand-600 dark:text-brand-700 font-black flex items-center justify-center flex-shrink-0 text-[12px] shadow-inner absolute left-0 top-0">
                {profileInitials}
              </div>
              <div className={`transition-all duration-300 absolute left-12 top-0 ${
                isSidebarHovered
                  ? "opacity-100 translate-x-0 pointer-events-auto"
                  : "opacity-0 -translate-x-3 overflow-hidden pointer-events-none"
              }`}>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{user.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-300 font-semibold uppercase tracking-wider truncate">Manager</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace (Top Header + POS/Kitchen content) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden md:pl-16 pl-0 z-10 transition-all duration-300">
        {/* Top Header Section */}
        <header className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex-shrink-0 flex justify-between items-center px-6 z-10 transition-all duration-300 ${
          isHeaderCollapsed && canCollapseHeader ? "h-10" : "h-20"
        }`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex flex-col transition-all duration-200 ${
              isHeaderCollapsed && canCollapseHeader ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100"
            }`}>
              <h2 className="font-extrabold text-xl sm:text-2xl text-slate-800 dark:text-white tracking-tight">
                {title}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-300 font-medium">{subtitle}</p>
            </div>
            {isHeaderCollapsed && canCollapseHeader && (
              <span className="truncate text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-300">
                {title}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-4 sm:gap-6 transition-all duration-200 ${
            isHeaderCollapsed && canCollapseHeader ? "gap-2 sm:gap-2" : ""
          }`}>
            <div className={`contents ${
              isHeaderCollapsed && canCollapseHeader ? "[&>*]:hidden" : ""
            }`}>
            <div className="flex flex-col items-end">
              <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Total Sales</span>
              <span className="text-lg sm:text-xl font-black text-brand-600 dark:text-brand-700">
                ₩{totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

            <div className="flex flex-col items-end">
              <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Pending Payments</span>
              <span className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-200">
                {pendingPaymentsCount}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

            <div className="flex flex-col items-end">
              <span className="text-xs sm:text-sm font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Issues</span>
              <span className={`text-lg sm:text-xl font-black flex items-center gap-1.5 ${
                issuesCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-300"
              }`}>
                {issuesCount}
                {issuesCount > 0 && <AlertCircle className="h-4 w-4 text-rose-500 animate-pulse" />}
              </span>
            </div>

            {mounted && (
              <>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-200 transition-all duration-200 flex items-center justify-center active:scale-95 shadow-sm shrink-0"
                  title={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
                >
                  {isDark ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5 text-slate-500" />}
                </button>
              </>
            )}
            </div>
            {canCollapseHeader && (
              <button
                type="button"
                onClick={toggleHeaderCollapsed}
                className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-200 transition-all duration-200 flex items-center justify-center active:scale-95 shadow-sm shrink-0"
                title={isHeaderCollapsed ? "헤더 펼치기" : "헤더 접기"}
              >
                {isHeaderCollapsed ? <ChevronDown className="h-4.5 w-4.5" /> : <ChevronUp className="h-4.5 w-4.5" />}
              </button>
            )}
          </div>
        </header>

        {/* Child Content */}
        {children}
      </main>
    </div>
  );
}
