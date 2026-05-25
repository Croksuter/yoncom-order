"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import * as ClientMenuResponse from "shared/types/responses/client/menu";
import MenuInstance from "./menu.instance";
import useMenuStore from "~/stores/menu.store";
import { useCallback, useEffect, useRef, useState, type UIEventHandler } from "react";

export default function Menus({
  menuCategories,
  isHeaderCollapsed,
  onContentScroll,
}: {
  menuCategories: ClientMenuResponse.Get["result"];
  isHeaderCollapsed: boolean;
  onContentScroll?: UIEventHandler<HTMLDivElement>;
}) {
  const firstCategoryId = menuCategories[0]?.id ?? "";
  const [activeCategoryId, setActiveCategoryId] = useState(firstCategoryId);
  const [categoryTabsHeight, setCategoryTabsHeight] = useState(0);
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);
  const scrollContainersRef = useRef(new Map<string, HTMLDivElement>());
  const suppressNextScrollSyncRef = useRef(false);
  const selectedCategoryId = activeCategoryId || firstCategoryId;
  const menuContentMinHeight =
    categoryTabsHeight > 0
      ? `max(0px, calc(100dvh - var(--client-header-height) - ${categoryTabsHeight}px - var(--client-footer-height)))`
      : `max(0px, calc(100dvh - var(--client-header-height) - var(--client-footer-height)))`;
  const categoryResetScrollTop = isHeaderCollapsed ? 1 : 0;

  useEffect(() => {
    if (!firstCategoryId) return;
    if (menuCategories.some((category) => category.id === activeCategoryId)) return;
    setActiveCategoryId(firstCategoryId);
  }, [activeCategoryId, firstCategoryId, menuCategories]);

  useEffect(() => {
    const categoryTabs = categoryTabsRef.current;
    if (!categoryTabs) return;

    const updateCategoryTabsHeight = () => {
      setCategoryTabsHeight(Math.ceil(categoryTabs.getBoundingClientRect().height));
    };

    updateCategoryTabsHeight();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateCategoryTabsHeight);
      return () => window.removeEventListener("resize", updateCategoryTabsHeight);
    }

    const observer = new ResizeObserver(updateCategoryTabsHeight);
    observer.observe(categoryTabs);
    return () => observer.disconnect();
  }, [menuCategories.length]);

  const resetCategoryScroll = useCallback((categoryId: string) => {
    suppressNextScrollSyncRef.current = true;
    const currentContainer = scrollContainersRef.current.get(categoryId);
    if (currentContainer) {
      currentContainer.scrollTop = categoryResetScrollTop;
    }
    window.requestAnimationFrame(() => {
      const nextContainer = scrollContainersRef.current.get(categoryId);
      if (nextContainer) {
        nextContainer.scrollTop = categoryResetScrollTop;
      }
      window.requestAnimationFrame(() => {
        suppressNextScrollSyncRef.current = false;
      });
    });
  }, [categoryResetScrollTop]);

  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategoryId(categoryId);
    resetCategoryScroll(categoryId);
    void useMenuStore.getState().clientLoad({});
  }, [resetCategoryScroll]);

  const handleMenuContentScroll: UIEventHandler<HTMLDivElement> = useCallback((event) => {
    if (suppressNextScrollSyncRef.current) return;
    onContentScroll?.(event);
  }, [onContentScroll]);

  return (
    <Tabs
      className="w-full flex-1 min-h-0 fc overflow-hidden pb-2"
      value={selectedCategoryId}
      onValueChange={handleCategoryChange}
    >
      <TabsList
        ref={categoryTabsRef}
        className="w-full h-auto justify-start bg-transparent overflow-x-auto no-scrollbar flex gap-2 pb-3 pt-2 px-1 border-b border-border/50 shrink-0"
      >
        {menuCategories.map((menuCategory) => (
          <TabsTrigger
            key={menuCategory.id}
            value={menuCategory.id}
            className="flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 bg-secondary/80 text-slate-600 hover:bg-secondary hover:text-slate-800 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md cursor-pointer border-0 shadow-none ring-0 outline-none"
          >
            {menuCategory.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {menuCategories.map((menuCategory) => {
        const visibleMenus = menuCategory.menus.filter((menu) => !menu.deletedAt);

        return (
          <TabsContent
            className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-4 pb-20 space-y-3"
            key={menuCategory.id}
            value={menuCategory.id}
            onScroll={handleMenuContentScroll}
            ref={(container) => {
              if (container) {
                scrollContainersRef.current.set(menuCategory.id, container);
              } else {
                scrollContainersRef.current.delete(menuCategory.id);
              }
            }}
          >
            <div
              className="grid grid-cols-1 content-start gap-3"
              style={{ minHeight: menuContentMinHeight }}
            >
              {visibleMenus.map((menu) => (
                <MenuInstance key={menu.id} menu={menu} />
              ))}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
