import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 세션 교환 성공 → 대시보드로 이동
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 실패 시 로그인 페이지로 이동 (에러 메시지 포함)
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}



