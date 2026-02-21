"use client";

import { useTransition } from "react";
import { signInWithGoogle } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default function GoogleLoginButton() {
  // useTransition으로 로딩 상태 관리
  const [isPending, startTransition] = useTransition();

  const handleLogin = () => {
    startTransition(async () => {
      await signInWithGoogle();
    });
  };

  return (
    <Button
      onClick={handleLogin}
      disabled={isPending}
      className="w-full"
      size="lg"
    >
      {isPending ? "로그인 중..." : "Google로 로그인"}
    </Button>
  );
}
