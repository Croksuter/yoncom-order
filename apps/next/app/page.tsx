import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-700">codex/nextjs-migration</p>
            <h1 className="text-3xl font-extrabold tracking-normal">Yoncom Order</h1>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Primary">
            <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/auth">
              Auth
            </Link>
            <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/admin/pos">
              POS
            </Link>
            <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/admin/cooker">
              Cooker
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 place-items-center rounded-lg border bg-white p-6 shadow-sm">
          <div className="w-full max-w-2xl">
            <h2 className="mb-4 text-2xl font-bold">Next.js migration is now serving real screens.</h2>
            <p className="mb-6 text-slate-600">
              기존 Remix 화면의 UI, Zustand store, hooks, shadcn-style 컴포넌트를 Next App Router로 옮기기
              시작했습니다. API 핸들러는 아직 단계적으로 이식 중이라 일부 데이터 요청은 migration placeholder
              응답을 받을 수 있습니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link className="rounded-lg bg-blue-600 px-4 py-4 font-semibold text-white" href="/client/table/demo-table">
                고객 테이블 화면
              </Link>
              <Link className="rounded-lg bg-slate-900 px-4 py-4 font-semibold text-white" href="/admin/pos">
                관리자 POS 화면
              </Link>
              <Link className="rounded-lg border bg-white px-4 py-4 font-semibold" href="/admin/cooker">
                조리 모니터 화면
              </Link>
              <Link className="rounded-lg border bg-white px-4 py-4 font-semibold" href="/auth">
                로그인 화면
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-6 text-sm text-slate-500">
          다음 단계는 이 화면들이 호출하는 `/api/*` 핸들러를 Cloudflare Worker/Hono 구현에서 Next Route
          Handler로 옮기는 작업입니다.
        </p>
      </div>
    </main>
  );
}
