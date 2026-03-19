// lib/utils/format.ts
// ──────────────────────────────────────────────────────────────────
// 공통 포맷/유틸 함수
// 프로젝트 전역에서 사용되는 날짜 변환, 파싱, 통계 유틸리티
// ──────────────────────────────────────────────────────────────────

/** 요일 약어 → 한글 매핑 */
const DOW_KR: Record<string, string> = {
    sun: "일",
    mon: "월",
    tue: "화",
    wed: "수",
    thu: "목",
    fri: "금",
    sat: "토",
  };
  
  /**
   * 다양한 입력(Date, ISO 문자열, null 등)을 YYYY-MM-DD 문자열로 정규화합니다.
   *
   * @param val  변환 대상 — Date 객체, ISO 문자열, MySQL 날짜 등
   * @returns "YYYY-MM-DD" 형태 문자열, 변환 불가 시 null
   *
   * @example
   * toDateStr(new Date("2026-03-19"))       // "2026-03-19"
   * toDateStr("2026-03-19T00:00:00.000Z")   // "2026-03-19"
   * toDateStr("Tue Mar 19 2026")            // "2026-03-19"
   * toDateStr(null)                         // null
   */
  export function toDateStr(val: unknown): string | null {
    if (!val) return null;
  
    // Date 객체
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  
    const str = String(val);
  
    // 이미 YYYY-MM-DD 형태
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  
    // 그 외 — Date 파싱 시도
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  
    return null;
  }
  
  /**
   * MySQL accounts.order_day 필드를 파싱합니다.
   *
   * order_day 컬럼 형식:
   *   - JSON 배열 문자열: '["mon","tue","wed","thu","fri"]'
   *   - null 또는 빈 문자열
   *
   * @param raw       DB에서 가져온 값
   * @param toKorean  true면 한글 변환 (모달/UI용), false면 영문 약어 유지 (비교 로직용)
   * @returns string[]
   *
   * @example
   * parseOrderDay('["mon","tue"]', false)  // ["mon", "tue"]
   * parseOrderDay('["mon","tue"]', true)   // ["월", "화"]
   * parseOrderDay(null)                    // []
   */
  export function parseOrderDay(raw: unknown, toKorean = false): string[] {
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return parsed
          .map((d: string) => {
            const lower = d.toLowerCase().trim();
            return toKorean ? DOW_KR[lower] || lower : lower;
          })
          .filter(Boolean);
      }
    } catch {
      // 파싱 실패 시 빈 배열
    }
    return [];
  }
  
  /**
   * 숫자 배열의 중간값(median)을 반환합니다.
   * 소수점 첫째자리까지 반올림합니다.
   *
   * @param arr  숫자 배열
   * @returns 중간값 (빈 배열이면 0)
   *
   * @example
   * median([1, 3, 5])       // 3
   * median([1, 2, 3, 4])    // 2.5
   * median([])              // 0
   */
  export function median(arr: number[]): number {
    const n = arr.length;
    if (n === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return n % 2 === 0
      ? Math.round(((sorted[n / 2 - 1] + sorted[n / 2]) / 2) * 10) / 10
      : sorted[Math.floor(n / 2)];
  }
  
  /**
   * 두 날짜 사이의 일수를 계산합니다 (구독일 → 기준일).
   * 주로 고객사 이용일수 표시에 사용됩니다.
   *
   * @param fromDate   시작일 "YYYY-MM-DD" (null 가능)
   * @param toDate     종료일 "YYYY-MM-DD"
   * @returns 일수 (fromDate가 null이거나 음수면 null)
   */
  export function calcDaysBetween(
    fromDate: string | null,
    toDate: string
  ): number | null {
    if (!fromDate) return null;
    const from = fromDate.slice(0, 10);
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = toDate.split("-").map(Number);
    if (!fy || !fm || !fd || !ty || !tm || !td) return null;
    const fromObj = new Date(fy, fm - 1, fd);
    const toObj = new Date(ty, tm - 1, td);
    const diffMs = toObj.getTime() - fromObj.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : null;
  }
  