import type { User } from "@supabase/supabase-js";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  user: User;
}

export function Header({ user }: HeaderProps) {
  // Google 로그인 시 user_metadata에 이름과 아바타 URL이 포함됩니다
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "사용자";
  const avatarUrl = user.user_metadata?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      {/* 좌측 (나중에 브레드크럼이나 페이지 제목 추가 가능) */}
      <div />

      {/* 우측: 유저 정보 + 로그아웃 */}
      <div className="flex items-center gap-3">
        {/* 프로필 아바타 */}
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        {/* 유저 이름 */}
        <span className="text-sm font-medium text-gray-700">
          {displayName}
        </span>

        {/* 로그아웃 버튼 */}
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            로그아웃
          </Button>
        </form>
      </div>
    </header>
  );
}
