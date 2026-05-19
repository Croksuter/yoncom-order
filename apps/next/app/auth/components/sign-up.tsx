import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { signUp } from "~/lib/auth";

export default function SignUp() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  
  const handleConfirm = () => {
    if (name === "" || password === "" || email === "") {
      setInvalid(true);
      return;
    }

    signUp(name, email, password);
  }

  return (
    <Card className="fit-content fc">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Sign Up</CardTitle>
      </CardHeader>
      <CardContent className="fc flex-1 full *:my-2 items-center">
        <Input className="w-[400px] h-12" type="text" placeholder="Name" onChange={(e) => setName(e.target.value)}/>
        <Input className="w-[400px] h-12" type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)}/>
        <Input className="w-[400px] h-12" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)}/>
        <CardDescription 
          className="dangerTXT !m-0 w-full text-end"
          style={{ opacity: invalid ? 1 : 0 }}
        >올바른 값을 입력하세요.</CardDescription>
        <Button className="w-[400px] h-14 text-xl font-extralight" onClick={handleConfirm}>Sign Up</Button>
      </CardContent>
    </Card>
  );
}
