import { Button } from "~/components/ui/button";
import TableInstance from "./table.instance";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

import useTableStore from "~/stores/table.store";
import CreateTableModal from "./table.create.modal";
import UpdateTableModal from "./table.update.modal";
import RemoveTableModal from "./table.remove.modal";
import { Skeleton } from "~/components/ui/skeleton";
const [min, sqrt, ceil] = [Math.min, Math.sqrt, Math.ceil];

export default function Tables() {
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);
  const [updateTableModalOpen, setUpdateTableModalOpen] = useState(false);
  const [removeTableModalOpen, setRemoveTableModalOpen] = useState(false);

  const { tables, isLoaded } = useTableStore();
  const activeTables = tables.filter((table) => table.deletedAt === null);
  const occupiedTableCount = activeTables.filter((table) => table.tableContexts[0]?.deletedAt === null).length;

  return (
    <>
      <div className="full p-2 h-full">
        <div className="full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-3xl flex flex-col overflow-hidden">
          {/* Header Section */}
          <div className="h-[76px] bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800/60 flex justify-between items-center px-4 shrink-0">
            <div className="flex flex-col gap-1">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                테이블 현황 <span className="text-slate-400 dark:text-slate-500 font-bold text-sm">({occupiedTableCount}/{activeTables.length})</span>
              </h3>
              {/* Status Indicators from Stitch */}
              <div className="flex gap-3 text-xs font-black text-slate-500 dark:text-slate-400 mt-1">
                <span className="flex items-center gap-1.5" title="사용 중 (Occupied)">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
                  <span>{occupiedTableCount}</span>
                </span>
                <span className="flex items-center gap-1.5" title="비어있음 (Available)">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-850 border border-slate-300 dark:border-slate-750"></span>
                  <span>{activeTables.length - occupiedTableCount}</span>
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm"
                className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs h-8 px-3 rounded-xl transition-all shadow-sm shadow-brand-500/10 shrink-0" 
                onClick={() => setCreateTableModalOpen(true)}
              >
                테이블 추가
              </Button>
              <Button 
                size="sm"
                variant="outline" 
                className="border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs h-8 px-3 rounded-xl transition-all shrink-0" 
                onClick={() => setRemoveTableModalOpen(true)}
              >
                테이블 제거
              </Button>
            </div>
          </div>

          {/* Grid Area */}
          {(isLoaded || tables.length > 0) ? (
            <div className="flex-1 p-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className={"grid gap-4"} style={{
                gridTemplateColumns: `repeat(${min(ceil(sqrt(activeTables.length)), 4)}, minmax(0, 1fr))`,
              }}>
                {activeTables
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(table =>
                    <TableInstance
                      key={table.id}
                      table={table}
                    />
                  )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 overflow-hidden flex-1">
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
            </div>
          )}
        </div>
      </div>
      <CreateTableModal
        openState={createTableModalOpen}
        setOpenState={setCreateTableModalOpen}
      />
      <RemoveTableModal
        openState={removeTableModalOpen}
        setOpenState={setRemoveTableModalOpen}
      />
      <UpdateTableModal
        openState={updateTableModalOpen}
        setOpenState={setUpdateTableModalOpen}
      />
    </>
  );
}

