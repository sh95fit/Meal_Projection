// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 날짜 유틸은 별도 파일에서 re-export
export {
  getToday,
  addDays,
  formatDateWithDay,
  parseDateParts,
  getProductDeliveryDate,
  isBusinessDay,
  isHoliday,
  getNthBusinessDay,
} from "./utils/date";
