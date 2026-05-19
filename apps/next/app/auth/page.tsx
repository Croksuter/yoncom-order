"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { isSignedIn } from "~/lib/auth";
import SignIn from "./components/sign-in";
import SignOut from "./components/sign-out";
import SignUp from "./components/sign-up";

export default function AuthPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void isSignedIn(
      (res) => setSignedIn(Boolean(res.user)),
      () => setSignedIn(false),
    );
  }, []);

  return (
    <main className="screen fr items-center justify-center bg-white">
      <div className="fit-content max-h-md max-w-md">
        {signedIn === null ? (
          <div>Loading...</div>
        ) : signedIn ? (
          <SignOut />
        ) : (
          <Tabs defaultValue="sign-in" className="m-2 w-[calc(100%_-_1rem)] flex-1 overflow-scroll fc">
            <TabsList className="w-full justify-normal bg-blue-50 *:w-1/2">
              <TabsTrigger value="sign-in">로그인</TabsTrigger>
              <TabsTrigger value="sign-up">회원가입</TabsTrigger>
            </TabsList>
            <TabsContent value="sign-in" className="full">
              <SignIn />
            </TabsContent>
            <TabsContent value="sign-up">
              <SignUp />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
