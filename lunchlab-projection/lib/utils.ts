import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "2026-03-12" → "2026-03-12.(목)"
 */
export function formatDateWithDay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = dayNames[date.getDay()];
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}.(${dayName})`;
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형태로 반환
 */
export function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * 날짜 문자열에 일수를 더해 반환
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
