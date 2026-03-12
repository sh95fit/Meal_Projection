import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 날짜 문자열에 요일을 붙여 반환
 * "2026-03-12" → "2026-03-12(목)"
 */
export function formatDateWithDay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = dayNames[date.getDay()];
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}.(${dayName})`;
}