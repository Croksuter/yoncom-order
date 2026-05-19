import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { signIn } from "~/lib/auth";


export default function SignIn() {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  
  const handleConfirm = () => {
    console.log(password, email);
    if (password === "" || email === "") {
      setInvalid(true);
      return;
    }

    signIn(email, password);
  }

  return (
    <Card className="fit-content fc">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Sign In</CardTitle>
      </CardHeader>
      <CardContent className="fc flex-1 full *:my-2 items-center">
        <Input className="w-[400px] h-12" type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)}/>
        <Input className="w-[400px] h-12" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)}/>
        <CardDescription 
          className="dangerTXT !m-0 w-full text-end"
          style={{ opacity: invalid ? 1 : 0 }}
        >올바른 값을 입력하세요.</CardDescription>
        <Button className="w-[400px] h-14 text-xl font-extralight" onClick={handleConfirm}>Sign In</Button>
      </CardContent>
    </Card>
  );
}
