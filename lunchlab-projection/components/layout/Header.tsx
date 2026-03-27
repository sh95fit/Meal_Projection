// components/layout/Header.tsx
import type { User } from "@supabase/supabase-js";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  user: User;
}

export function Header({ user }: HeaderProps) {
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "사용자";
  const avatarUrl = user.user_metadata?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-3 lg:px-6">
      {/* 좌측 — 모바일에서 햄버거 버튼 공간 확보 */}
      <div className="w-10 lg:w-0" />

      {/* 우측: 유저 정보 + 로그아웃 */}
      <div className="flex items-center gap-2 lg:gap-3">
        <Avatar className="h-7 w-7 lg:h-8 lg:w-8">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-gray-700 hidden sm:inline">
          {displayName}
        </span>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit" className="text-xs lg:text-sm">
            로그아웃
          </Button>
        </form>
      </div>
    </header>
  );
}
