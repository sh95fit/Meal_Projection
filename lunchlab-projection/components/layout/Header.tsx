"use client";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps { userEmail: string; userName: string; userAvatar?: string; }

export function Header({ userEmail, userName, userAvatar }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback className="text-xs">{userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{userName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled className="text-xs text-gray-400">{userEmail}</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <form action={signOut} className="w-full">
              <button type="submit" className="w-full text-left text-sm">로그아웃</button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
