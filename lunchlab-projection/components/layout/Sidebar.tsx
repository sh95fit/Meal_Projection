// components/layout/Sidebar.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

function isMenuActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;

  // /forecasts 는 정확히 일치할 때만 active (하위 경로 제외)
  if (href === "/forecasts") return pathname === "/forecasts";

  return pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const prevPathRef = useRef(pathname);

  // 라우트 변경 감지 → 모바일 메뉴 닫기 (lint-safe)
  if (prevPathRef.current !== pathname) {
    prevPathRef.current = pathname;
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  // 모바일 메뉴 열릴 때 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const navContent = (
    <>
      <h2 className="text-lg font-bold mb-4">식수 예측</h2>
      <Separator className="mb-4" />
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const isActive = isMenuActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
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
      {/* 모바일 햄버거 버튼 */}
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-white border shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* 데스크탑: 기존 사이드바 */}
      <aside className="hidden lg:flex w-60 border-r bg-white p-4 flex-col shrink-0">
        {navContent}
      </aside>

      {/* 모바일: 오버레이 + 슬라이드 사이드바 */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={closeMobile} />
          <aside className="relative z-50 w-64 bg-white p-4 flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              className="absolute top-3 right-3 p-1 rounded-md hover:bg-gray-100"
              onClick={closeMobile}
              aria-label="메뉴 닫기"
            >
              <X className="h-5 w-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
