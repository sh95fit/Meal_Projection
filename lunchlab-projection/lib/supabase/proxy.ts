import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // 1. 기본 응답 객체 생성
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 2. Supabase 서버 클라이언트 생성 (쿠키 기반)
  //    ⚠️ 매 요청마다 새로 생성해야 합니다. 전역 변수에 저장하지 마세요.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 요청 쿠키에 새 값 설정 (서버 컴포넌트로 전달)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // 응답 객체 재생성 (업데이트된 요청 포함)
          supabaseResponse = NextResponse.next({
            request,
          });
          // 응답 쿠키에 새 값 설정 (브라우저로 전달)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Auth 토큰 갱신
  //    ⚠️ createServerClient()와 getClaims() 사이에 다른 코드를 넣지 마세요.
  //    ⚠️ getClaims()를 제거하면 사용자가 무작위로 로그아웃될 수 있습니다.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // 4. 미인증 사용자 리다이렉트
  //    /login과 /auth 경로는 인증 없이 접근 가능
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 5. 응답 반환
  //    ⚠️ 반드시 이 supabaseResponse를 그대로 반환해야 합니다.
  //    새 NextResponse를 만들면 브라우저-서버 쿠키가 동기화되지 않아
  //    세션이 끊길 수 있습니다.
  return supabaseResponse;
}
