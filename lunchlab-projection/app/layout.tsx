import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "식수 예측 시스템",
  description: "LunchLab - 식수 예측 및 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        {/* 토스트 알림 (sonner) */}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

