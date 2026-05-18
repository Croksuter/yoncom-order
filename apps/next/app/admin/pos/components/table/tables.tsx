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

  return (
    <>
      <div className="full p-2">
        <Card className="full bg-[#F2F2F2] px-3 pb-3 fc rounded-3xl">
          <CardHeader className="px-2">
            <CardTitle className="text-2xl">테이블 현황 <b className="font-light text-lg">({tables.filter((table) => table.tableContexts[0]?.deletedAt === null).length}/{tables.length})</b></CardTitle>
          </CardHeader>
          <div className="fr justify-end *:mx-1 mb-3">
            <Button onClick={() => setCreateTableModalOpen(true)}>테이블 추가</Button>
            {/* <Button className="!bg-slate-600" onClick={() => setUpdateTableModalOpen(true)}>테이블 변경</Button> */}
            <Button variant="outline" onClick={() => setRemoveTableModalOpen(true)}>테이블 제거</Button>
          </div>
          {(isLoaded || tables.length > 0) ? (
            <CardContent className="flex-1 p-2 overflow-y-auto">
              <div className={"grid gap-4"} style={{
                gridTemplateColumns: `repeat(${min(ceil(sqrt(tables.filter((table) => table.deletedAt === null).length)), 4)}, minmax(0, 1fr))`,
              }}>
                {tables
                  .filter((table) => table.deletedAt === null)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(table =>
                    <TableInstance
                      key={table.id}
                      table={table}
                    />
                  )}
              </div>
            </CardContent>
          ) : (
            <CardContent className="grid grid-cols-2 gap-4 overflow-hidden">
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
            </CardContent>
          )}
        </Card>
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
  )
}