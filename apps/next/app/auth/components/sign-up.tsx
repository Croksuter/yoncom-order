import { type FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { signUp } from "~/lib/auth";

export default function SignUp() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);

  const handleConfirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name === "" || password === "" || email === "") {
      setInvalid(true);
      return;
    }

    signUp(name, email, password);
  };

  return (
    <Card className="w-full rounded-2xl border-brand-100 bg-white/95 text-slate-950 shadow-xl shadow-brand-500/10 dark:border-brand-900/30 dark:bg-slate-900/95 dark:text-slate-50 dark:shadow-black/20">
      <CardHeader className="space-y-2 p-6 pb-3">
        <CardTitle className="text-2xl font-black tracking-tight">계정 생성</CardTitle>
        <CardDescription className="text-sm font-medium text-slate-500 dark:text-slate-300">
          운영자 이름과 로그인 정보를 등록합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        <form className="flex flex-col gap-3" onSubmit={handleConfirm}>
          <Input
            className="h-12 rounded-xl border-slate-200 bg-slate-50 text-base text-slate-950 placeholder:text-slate-400 focus-visible:border-brand-500 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus-visible:border-brand-500 dark:focus-visible:ring-brand-500"
            type="text"
            placeholder="Name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="h-12 rounded-xl border-slate-200 bg-slate-50 text-base text-slate-950 placeholder:text-slate-400 focus-visible:border-brand-500 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus-visible:border-brand-500 dark:focus-visible:ring-brand-500"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            className="h-12 rounded-xl border-slate-200 bg-slate-50 text-base text-slate-950 placeholder:text-slate-400 focus-visible:border-brand-500 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus-visible:border-brand-500 dark:focus-visible:ring-brand-500"
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <CardDescription
            className="min-h-5 text-right text-sm font-semibold text-rose-600 dark:text-rose-400"
            style={{ opacity: invalid ? 1 : 0 }}
          >
            올바른 값을 입력하세요.
          </CardDescription>
          <Button className="h-12 w-full rounded-xl bg-brand-500 text-base font-black text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-600">
            <UserPlus className="h-4 w-4" />
            계정 생성
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
