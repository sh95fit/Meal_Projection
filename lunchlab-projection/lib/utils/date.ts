// lib/utils/date.ts
// ──────────────────────────────────────────────────────────────────
// KST 기준 날짜 유틸리티 + 공휴일 + 영업일
// ──────────────────────────────────────────────────────────────────

/** KST 기준 현재 시각 정보 반환 */
function getKSTNow() {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  return {
    dateStr: `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`,
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
  };
}

/** 오늘 날짜를 YYYY-MM-DD 형태로 반환 (KST 기준) */
export function getToday(): string {
  return getKSTNow().dateStr;
}

/** 날짜 문자열에 일수를 더해 반환 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "2026-03-12" → "2026-03-12.(목)" */
export function formatDateWithDay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}.(${dayNames[date.getDay()]})`;
}

/** "2026-03-12" → { month: 3, day: 12, dayName: "목" } */
export function parseDateParts(dateStr: string): {
  month: number;
  day: number;
  dayName: string;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  return {
    month: dateObj.getMonth() + 1,
    day: dateObj.getDate(),
    dayName: dayNames[dateObj.getDay()],
  };
}

/** 날짜 문자열에서 요일 인덱스(getDay) 반환 */
export function getDayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

// ──────────────────────────────────────────────────────────────────
// 공휴일 & 영업일
// ──────────────────────────────────────────────────────────────────

/**
 * 대한민국 공휴일 (MM-DD 형식, 연도별)
 * ※ 매년 초에 해당 연도를 추가합니다. 추후 공공데이터 API 연동 권장.
 *
 * 다른 모듈(forecast, dashboard 등)에서도 참조할 수 있도록 export합니다.
 */
export const HOLIDAYS_BY_YEAR: Record<string, string[]> = {
  "2026": [
    "01-01", // 신정
    "02-16", // 설날 연휴
    "02-17", // 설날
    "02-18", // 설날 연휴
    "03-01", // 삼일절 (일요일)
    "05-05", // 어린이날
    "05-24", // 부처님오신날 (일요일)
    "06-06", // 현충일 (토요일)
    "07-17", // 제헌절 (금요일)
    "08-15", // 광복절 (토요일)
    "09-24", // 추석 연휴
    "09-25", // 추석
    "09-26", // 추석 연휴 (토요일)
    "10-03", // 개천절 (토요일)
    "10-09", // 한글날
    "12-25", // 크리스마스
  ],
};

/** 지정된 날짜가 공휴일인지 확인 */
export function isHoliday(dateStr: string): boolean {
  const year = dateStr.substring(0, 4);
  const mmdd = dateStr.substring(5);
  const holidays = HOLIDAYS_BY_YEAR[year];
  if (!holidays) return false;
  return holidays.includes(mmdd);
}

/**
 * 영업일 판단: 월~토(getDay 1~6) AND 공휴일 아닌 날
 * 일요일(getDay 0) = 비영업일
 */
export function isBusinessDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getDay() === 0) return false; // 일요일
  if (isHoliday(dateStr)) return false;
  return true;
}

/**
 * 상품별 영업일 판단.
 * saturday_available = false인 상품은 토요일도 비영업일로 처리합니다.
 *
 * @param dateStr           날짜 "YYYY-MM-DD"
 * @param saturdayAvailable 해당 상품이 토요일 판매를 하는지
 */
export function isProductBusinessDay(
  dateStr: string,
  saturdayAvailable: boolean
): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();

  // 일요일은 항상 비영업일
  if (day === 0) return false;
  // 토요일 판매 안하는 상품이면 토요일도 비영업일
  if (day === 6 && !saturdayAvailable) return false;
  // 공휴일
  if (isHoliday(dateStr)) return false;

  return true;
}

/**
 * 기준일로부터 N번째 다음 영업일을 찾습니다.
 * @param fromDate 기준일 "YYYY-MM-DD"
 * @param n 몇 번째 영업일 (1 = 바로 다음 영업일)
 */
export function getNthBusinessDay(fromDate: string, n: number): string {
  let candidate = fromDate;
  let count = 0;
  for (let i = 0; i < 60; i++) { // 안전 상한 30→60으로 증가 (연휴 대응)
    candidate = addDays(candidate, 1);
    if (isBusinessDay(candidate)) {
      count++;
      if (count >= n) return candidate;
    }
  }
  return candidate;
}

/**
 * 상품별 출고일(배송일)을 영업일 기준으로 계산합니다.
 *
 * 오늘(산출일) 기준으로 N번째 "해당 상품의 영업일"을 반환합니다.
 * 토요일 판매 여부에 따라 토요일을 영업일로 카운트할지 결정합니다.
 *
 * @param fromDate           기준일(산출일) "YYYY-MM-DD"
 * @param offsetDays         상품의 D+N 값
 * @param saturdayAvailable  토요일 판매 여부
 * @returns 출고일 "YYYY-MM-DD"
 *
 * @example
 * // 토요일 비판매, D+4, 기준일이 월요일
 * getProductDeliveryDate("2026-03-16", 4, false)
 * // 월→화(1) →수(2) →목(3) →금(4) = "2026-03-20" (금요일)
 *
 * // 토요일 판매, D+3, 기준일이 수요일
 * getProductDeliveryDate("2026-03-18", 3, true)
 * // 수→목(1) →금(2) →토(3) = "2026-03-21" (토요일)
 */
export function getProductDeliveryDate(
  fromDate: string,
  offsetDays: number,
  saturdayAvailable: boolean
): string {
  let candidate = fromDate;
  let count = 0;
  for (let i = 0; i < 60; i++) {
    candidate = addDays(candidate, 1);
    if (isProductBusinessDay(candidate, saturdayAvailable)) {
      count++;
      if (count >= offsetDays) return candidate;
    }
  }
  return candidate;
}

/**
 * 대시보드 실시간 섹션의 기본 조회 날짜를 반환합니다.
 *
 * 규칙:
 *   - 현재 KST 14:30 이전 → 오늘 기준 +1 영업일
 *   - 현재 KST 14:30 이후 → 오늘 기준 +2 영업일
 */
export function getDefaultRealtimeDate(): string {
  const { dateStr, hour, minute } = getKSTNow();
  const currentMinutes = hour * 60 + minute;
  const cutoff = 14 * 60 + 30; // 14:30 = 870분

  const offset = currentMinutes < cutoff ? 1 : 2;
  return getNthBusinessDay(dateStr, offset);
}