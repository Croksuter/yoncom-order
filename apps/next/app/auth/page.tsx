"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTheme } from "~/hooks/use-theme";
import { isSignedIn } from "~/lib/auth";
import SignIn from "./components/sign-in";
import SignOut from "./components/sign-out";
import SignUp from "./components/sign-up";

export default function AuthPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { toggleTheme, isDark, mounted } = useTheme();

  useEffect(() => {
    void isSignedIn(
      (res) => setSignedIn(Boolean(res.user)),
      () => setSignedIn(false),
    );
  }, []);

  return (
    <main className="min-h-screen w-full overflow-hidden bg-slate-50 text-slate-950 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50">
      <div className="absolute inset-x-0 top-0 h-32 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/70" />
      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b1326] text-sm font-black text-white shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/80">
              YC
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Yoncom Order</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">POS Admin</p>
            </div>
          </div>

          {mounted && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl border-slate-200 bg-white/85 text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:bg-slate-800"
              title={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </Button>
          )}
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[440px]">
            {signedIn === null ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                확인 중
              </div>
            ) : signedIn ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
                <SignOut />
              </div>
            ) : (
              <Tabs defaultValue="sign-in" className="w-full">
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <TabsTrigger value="sign-in" className="rounded-lg data-[state=active]:bg-slate-950 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950">로그인</TabsTrigger>
                  <TabsTrigger value="sign-up" className="rounded-lg data-[state=active]:bg-slate-950 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950">회원가입</TabsTrigger>
                </TabsList>
                <TabsContent value="sign-in" className="mt-4">
                  <SignIn />
                </TabsContent>
                <TabsContent value="sign-up" className="mt-4">
                  <SignUp />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
