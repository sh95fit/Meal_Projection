"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Google OAuth 로그인을 시작합니다.
 * Supabase가 Google 로그인 URL을 생성하고, 해당 URL로 리다이렉트합니다.
 * 로그인 완료 후 /auth/callback으로 돌아옵니다.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  return redirect(data.url);
}

/**
 * 로그아웃합니다.
 * Supabase 세션을 종료하고 로그인 페이지로 리다이렉트합니다.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return redirect("/login");
}


