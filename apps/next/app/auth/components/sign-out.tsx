import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "~/components/ui/button";
import { signOut } from "~/lib/auth";

export default function SignOut() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleConfirm = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      await signOut();
      document.location.href = "/auth";
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-slate-50">로그인됨</h2>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">세션을 종료할 수 있습니다.</p>
      </div>
      <Button
        className="h-11 rounded-xl bg-brand-500 font-black text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-600"
        onClick={handleConfirm}
        disabled={isSigningOut}
      >
        <LogOut className="h-4 w-4" />
        {isSigningOut ? "로그아웃 중" : "로그아웃"}
      </Button>
    </div>
  );
}
