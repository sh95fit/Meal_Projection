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

// ──────────────────────────────────────────────────────────────────
// 공휴일 & 영업일
// ──────────────────────────────────────────────────────────────────

/**
 * 2026년 대한민국 공휴일 (MM-DD 형식)
 * ※ 매년 초에 업데이트 필요. 추후 공공데이터 API 연동 권장.
 */
const HOLIDAYS_BY_YEAR: Record<string, string[]> = {
  "2026": [
    "01-01", // 신정
    "02-16", // 설날 연휴
    "02-17", // 설날
    "02-18", // 설날 연휴
    "03-01", // 삼일절 (일요일)
    // "03-02", // 대체공휴일(삼일절)
    "05-05", // 어린이날
    "05-24", // 부처님오신날 (일요일)
    // "05-25", // 대체공휴일(부처님오신날)
    "06-06", // 현충일 (토요일)
    "07-17", // 제헌절 (금요일)
    "08-15", // 광복절 (토요일)
    // "08-17", // 대체공휴일(광복절)
    "09-24", // 추석 연휴
    "09-25", // 추석
    "09-26", // 추석 연휴 (토요일)
    "10-03", // 개천절 (토요일)
    // "10-05", // 대체공휴일(개천절)
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
 * 기준일로부터 N번째 다음 영업일을 찾습니다.
 * @param fromDate 기준일 "YYYY-MM-DD"
 * @param n 몇 번째 영업일 (1 = 바로 다음 영업일)
 */
export function getNthBusinessDay(fromDate: string, n: number): string {
  let candidate = fromDate;
  let count = 0;
  for (let i = 0; i < 30; i++) {
    candidate = addDays(candidate, 1);
    if (isBusinessDay(candidate)) {
      count++;
      if (count >= n) return candidate;
    }
  }
  return candidate;
}

/**
 * 대시보드 실시간 섹션의 기본 조회 날짜를 반환합니다.
 *
 * 규칙:
 *   - 현재 KST 14:30 이전 → 오늘 기준 +1 영업일 (내일 주문 마감 전)
 *   - 현재 KST 14:30 이후 → 오늘 기준 +2 영업일 (내일 주문 마감됨)
 *
 * 예시 (오늘 = 2026-03-18 수요일):
 *   13:00 → +1 영업일 = 03-19(목)
 *   15:00 → +2 영업일 = 03-20(금)
 *
 * 예시 (오늘 = 2026-03-20 금요일):
 *   13:00 → +1 영업일 = 03-21(토)
 *   15:00 → +2 영업일 = 03-23(월) ← 일요일 건너뜀
 */
export function getDefaultRealtimeDate(): string {
  const { dateStr, hour, minute } = getKSTNow();
  const currentMinutes = hour * 60 + minute;
  const cutoff = 14 * 60 + 30; // 14:30 = 870분

  const offset = currentMinutes < cutoff ? 1 : 2;
  return getNthBusinessDay(dateStr, offset);
}