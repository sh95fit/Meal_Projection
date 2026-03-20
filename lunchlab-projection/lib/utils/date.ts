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
 */
export const HOLIDAYS_BY_YEAR: Record<string, string[]> = {
  "2025": [
    "01-01", // 신정 (수)
    "01-27", // 임시공휴일 - 설 연휴 확대 (월)
    "01-28", // 설날 연휴 (화)
    "01-29", // 설날 (수)
    "01-30", // 설날 연휴 (목)
    "03-01", // 삼일절 (토)
    "03-03", // 대체공휴일 - 삼일절 (월)
    "05-05", // 어린이날 + 부처님오신날 (월)
    "05-06", // 대체공휴일 - 부처님오신날 (화)
    "06-03", // 제21대 대통령선거일 (화)
    "06-06", // 현충일 (금)
    "08-15", // 광복절 (금)
    "10-03", // 개천절 (금)
    "10-05", // 추석 연휴 (일)
    "10-06", // 추석 (월)
    "10-07", // 추석 연휴 (화)
    "10-08", // 대체공휴일 - 추석 (수)
    "10-09", // 한글날 (목)
    "12-25", // 크리스마스 (목)
  ],
  "2026": [
    "01-01", // 신정 (목)
    "02-16", // 설날 연휴 (월)
    "02-17", // 설날 (화)
    "02-18", // 설날 연휴 (수)
    "03-01", // 삼일절 (일)
    // "03-02", // 대체공휴일 - 삼일절 (월)
    "05-05", // 어린이날 (화)
    "05-24", // 부처님오신날 (일)
    // "05-25", // 대체공휴일 - 부처님오신날 (월)
    "06-03", // 제9회 전국동시지방선거일 (수)
    "06-06", // 현충일 (토)
    "07-17", // 제헌절 (금)
    "08-15", // 광복절 (토)
    // "08-17", // 대체공휴일 - 광복절 (월)
    "09-24", // 추석 연휴 (목)
    "09-25", // 추석 (금)
    "09-26", // 추석 연휴 (토)
    "10-03", // 개천절 (토)
    // "10-05", // 대체공휴일 - 개천절 (월)
    "10-09", // 한글날 (금)
    "12-25", // 크리스마스 (금)
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
  if (date.getDay() === 0) return false;
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
  for (let i = 0; i < 60; i++) {
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
 * ── 비즈니스 규칙 ──
 * - 토요일 미포함: 영업일 = 월~금 (토·일·공휴일 건너뜀)
 * - 토요일 포함:   영업일 = 월~금 + 토요일
 *   단, 토요일은 월요일과 묶음으로 1회 카운트됩니다.
 *   토요일이 카운트되면 월요일은 건너뜁니다.
 *   출고일이 토,월 묶음에 해당하면 대표일(토요일)을 반환합니다.
 *
 * ── 예시: D+3 토요일 포함 ──
 * 월 → 화(1) 수(2) 목(3) = 목
 * 화 → 수(1) 목(2) 금(3) = 금
 * 수 → 목(1) 금(2) 토+월(3) = 토  ← 관리자가 월요일 건 별도 추가
 * 목 → 금(1) 토+월(2) 화(3) = 화
 * 금 → 토+월(1) 화(2) 수(3) = 수
 *
 * ── 예시: D+3 토요일 미포함 ──
 * 월 → 화(1) 수(2) 목(3) = 목
 * 화 → 수(1) 목(2) 금(3) = 금
 * 수 → 목(1) 금(2) 월(3) = 월
 * 목 → 금(1) 월(2) 화(3) = 화
 * 금 → 월(1) 화(2) 수(3) = 수
 *
 * @param fromDate           기준일(산출일) "YYYY-MM-DD"
 * @param offsetDays         상품의 D+N 값
 * @param saturdayAvailable  토요일 판매 여부
 * @returns 출고일 "YYYY-MM-DD"
 */
export function getProductDeliveryDate(
  fromDate: string,
  offsetDays: number,
  saturdayAvailable: boolean
): string {
  // 토요일 미포함: 월~금만 영업일
  if (!saturdayAvailable) {
    let candidate = fromDate;
    let count = 0;
    for (let i = 0; i < 60; i++) {
      candidate = addDays(candidate, 1);
      const [cy, cm, cd] = candidate.split("-").map(Number);
      const day = new Date(cy, cm - 1, cd).getDay();
      if (day === 0 || day === 6) continue;
      if (isHoliday(candidate)) continue;
      count++;
      if (count >= offsetDays) return candidate;
    }
    return candidate;
  }

  // 토요일 포함: 토+월 묶음으로 1회 카운트
  let candidate = fromDate;
  let count = 0;
  for (let i = 0; i < 60; i++) {
    candidate = addDays(candidate, 1);
    const [cy, cm, cd] = candidate.split("-").map(Number);
    const day = new Date(cy, cm - 1, cd).getDay();

    // 일요일 건너뜀
    if (day === 0) continue;
    // 공휴일 건너뜀
    if (isHoliday(candidate)) continue;

    if (day === 6) {
      // 토요일 = 토+월 묶음 → 1회 카운트, 대표일은 토요일
      count++;
      if (count >= offsetDays) return candidate;
      // 월요일도 소진됐으므로 건너뜀 → candidate를 월요일로 이동
      // 다음 루프에서 +1 하면 화요일부터 시작
      candidate = addDays(candidate, 2); // 토 +2 = 월
      continue;
    }

    // 월~금 일반 영업일
    count++;
    if (count >= offsetDays) return candidate;
  }
  return candidate;
}

/**
 * 대시보드 실시간 섹션의 기본 조회 날짜를 반환합니다.
 *
 * 규칙:
 *   - KST 14:30 이전 → 다음 영업일 1개
 *   - KST 14:30 이후 → 다음+2 영업일
 *     단, 토요일 포함 상품이 있으므로 토+월 묶음이면 둘 다 반환
 *
 * ★ 복수 날짜를 반환합니다 (토+월 묶음 대응)
 */
export function getDefaultRealtimeDates(): string[] {
  const { dateStr, hour, minute } = getKSTNow();
  const currentMinutes = hour * 60 + minute;
  const cutoff = 14 * 60 + 30;

  if (currentMinutes < cutoff) {
    // 마감 전: 다음 영업일 1개
    return [getNthBusinessDay(dateStr, 1)];
  }

  // 마감 후: 다음 영업일부터 탐색
  const first = getNthBusinessDay(dateStr, 1);
  const [fy, fm, fd] = first.split("-").map(Number);
  const firstDay = new Date(fy, fm - 1, fd).getDay();

  if (firstDay === 6) {
    // 다음 영업일이 토요일 → 토+월 묶음
    // 월요일 찾기 (토요일 다음 영업일)
    const monday = getNthBusinessDay(first, 1);
    return [first, monday];
  }

  // 일반적인 경우: 2번째 영업일
  const second = getNthBusinessDay(dateStr, 2);
  const [sy, sm, sd] = second.split("-").map(Number);
  const secondDay = new Date(sy, sm - 1, sd).getDay();

  if (secondDay === 6) {
    // 2번째 영업일이 토요일 → 토+월 묶음이므로 토, 월 둘 다
    const monday = getNthBusinessDay(second, 1);
    return [second, monday];
  }

  return [second];
}

// 기존 함수도 호환성을 위해 유지 (첫 번째 날짜 반환)
export function getDefaultRealtimeDate(): string {
  return getDefaultRealtimeDates()[0];
}