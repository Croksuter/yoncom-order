import { useState } from "react";
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
  }

  return (
    <Button onClick={handleConfirm} disabled={isSigningOut}>
      {isSigningOut ? "Signing Out..." : "Sign Out"}
    </Button>
  );
}
