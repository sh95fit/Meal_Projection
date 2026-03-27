// components/layout/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Menu, X } from "lucide-react";

const menuItems = [
  { label: "대시보드", href: "/dashboard" },
  { label: "발주 예상 산출", href: "/forecasts/new" },
  { label: "발주 예상 목록", href: "/forecasts" },
  { label: "상품 관리", href: "/products" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 라우트 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // 모바일 메뉴 열릴 때 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const navContent = (
    <>
      <h2 className="text-lg font-bold mb-4">식수 예측</h2>
      <Separator className="mb-4" />
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
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
      <div className="mt-auto" />
    </>
  );

  return (
    <>
      {/* ── 모바일 햄버거 버튼 (Header에서 사용하기 위해 포탈 대신 고정 위치) ── */}
      <button
        type="button"
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-md bg-white border shadow-sm"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="메뉴 열기"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden lg:flex w-60 border-r bg-white p-4 flex-col shrink-0">
        {navContent}
      </aside>

      {/* ── 모바일 오버레이 사이드바 ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* 배경 딤 */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          {/* 슬라이드 패널 */}
          <aside className="absolute left-0 top-0 h-full w-64 bg-white p-4 flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
