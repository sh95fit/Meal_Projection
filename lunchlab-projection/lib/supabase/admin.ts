import { createClient } from "@supabase/supabase-js";

// 서비스 롤 키를 사용하는 서버 전용 Supabase 클라이언트
// RLS를 우회하여 서버에서 직접 DB 조작 시 사용
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
