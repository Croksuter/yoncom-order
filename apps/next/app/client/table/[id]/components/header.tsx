"use client";

import useTableStore from "~/stores/table.store";

export default function Header() {
  const { clientTable } = useTableStore();

  return (
    <header className="fixed top-0 left-[50%] translate-x-[-50%] w-full max-w-[600px] z-50 bg-background/80 backdrop-blur-md border-b border-border/80 transition-all duration-300 ease-in-out">
      <div className="flex justify-between items-center px-4 py-3 w-full">
        <h1 className="font-extrabold text-lg tracking-tight text-primary font-sans">
          연컴 홈런포차
        </h1>
        <div className="transition-all duration-300 ease-in-out active:scale-95 px-4 py-1.5 rounded-full bg-secondary text-primary font-bold text-sm shadow-sm border border-border">
          {clientTable ? clientTable.name : "Table"}
        </div>
      </div>
    </header>
  );
}