import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 서버에서 현재 유저 정보 조회
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 유저 없으면 로그인 페이지로 리다이렉트
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen">
      {/* 좌측 사이드바 */}
      <Sidebar />

      {/* 우측 메인 영역 */}
      <div className="flex flex-1 flex-col">
        {/* 상단 헤더 (유저 정보 표시) */}
        <Header user={user} />

        {/* 컨텐츠 영역 */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
