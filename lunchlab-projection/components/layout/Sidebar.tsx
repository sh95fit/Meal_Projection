"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";

// 메뉴 아이템 배열 — 나중에 여기에 추가하면 사이드바에 자동 반영
const menuItems = [
  { label: "대시보드", href: "/dashboard" },
  // { label: "발주 예측", href: "/forecast" },
  // { label: "고객 관리", href: "/clients" },
  // { label: "상품 관리", href: "/products" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-white p-4 flex flex-col">
      {/* 앱 로고/제목 */}
      <h2 className="text-lg font-bold mb-4">식수 예측</h2>
      <Separator className="mb-4" />

      {/* 네비게이션 메뉴 */}
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-gray-100 font-medium text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 여백 (나중에 설정/도움말 링크 추가 가능) */}
      <div className="mt-auto" />
    </aside>
  );
}

