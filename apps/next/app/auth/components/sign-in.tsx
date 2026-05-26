import { type FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { signIn } from "~/lib/auth";

export default function SignIn() {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);

  const handleConfirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password === "" || email === "") {
      setInvalid(true);
      return;
    }

    signIn(email, password);
  };

  return (
    <Card className="w-full rounded-2xl border-slate-200 bg-white/95 text-slate-950 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-50 dark:shadow-black/20">
      <CardHeader className="space-y-2 p-6 pb-3">
        <CardTitle className="text-2xl font-black tracking-tight">관리자 로그인</CardTitle>
        <CardDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">
          POS와 주방 화면에 접근합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        <form className="flex flex-col gap-3" onSubmit={handleConfirm}>
          <Input
            className="h-12 rounded-xl border-slate-200 bg-slate-50 text-base text-slate-950 placeholder:text-slate-400 focus-visible:ring-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus-visible:ring-slate-600"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            className="h-12 rounded-xl border-slate-200 bg-slate-50 text-base text-slate-950 placeholder:text-slate-400 focus-visible:ring-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus-visible:ring-slate-600"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <CardDescription
            className="min-h-5 text-right text-sm font-semibold text-rose-600 dark:text-rose-400"
            style={{ opacity: invalid ? 1 : 0 }}
          >
            올바른 값을 입력하세요.
          </CardDescription>
          <Button className="h-12 w-full rounded-xl bg-slate-950 text-base font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            <LogIn className="h-4 w-4" />
            로그인
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
