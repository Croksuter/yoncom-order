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

const BRAND_LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDsA9CPXvcB5VB3yhQlfDRcSBIFDGyk1NrW_ovdSMwPROFXURC7gotOCKORzvdvtG5RXejaeknLBwvCN3KUBCLY8TMos6bjvHooUR0DIuNS26KiQDTFfsTpiPJddu4Bd8EkJlkzb4DuhLg0b41iBc4WhlqdXgt8Hw1zXKoJ4755roRQCN7T8HtLVT-VPodEx9izW9ieD3q4O1p4CU_mVEFfyH0HMiAMWQjES7YYKmAr1esMtL-0W-bNdZxMdgZSNo8Uh__PNNI8Az4C";

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
      <div className="absolute left-1/2 top-12 h-32 w-[28rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-500/15" />
      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#0b1326] shadow-lg ring-1 ring-slate-200/70 dark:border-slate-800 dark:ring-slate-700/80">
              <img
                src={BRAND_LOGO_URL}
                alt="첨크크"
                className="h-full w-full scale-125 rotate-12 object-cover mix-blend-screen"
              />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">첨크크</h1>
              <p className="text-xs font-semibold text-brand-600 dark:text-brand-700">POS Admin</p>
            </div>
          </div>

          {mounted && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl border-slate-200 bg-white/85 text-slate-700 shadow-sm hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:border-brand-900/40 dark:hover:bg-brand-950/20 dark:hover:text-brand-400"
              title={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-brand-600" />}
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
              <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-xl shadow-brand-500/10 dark:border-brand-900/30 dark:bg-slate-900 dark:shadow-black/20">
                <SignOut />
              </div>
            ) : (
              <Tabs defaultValue="sign-in" className="w-full">
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <TabsTrigger
                    value="sign-in"
                    className="rounded-lg data-[state=active]:bg-brand-500 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-brand-500 dark:data-[state=active]:text-white"
                  >
                    로그인
                  </TabsTrigger>
                  <TabsTrigger
                    value="sign-up"
                    className="rounded-lg data-[state=active]:bg-brand-500 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-brand-500 dark:data-[state=active]:text-white"
                  >
                    회원가입
                  </TabsTrigger>
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
