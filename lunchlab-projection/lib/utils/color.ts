// ──────────────────────────────────────────────────────────────────
// lib/utils/color.ts
// 상품 색상 관련 유틸리티
// ──────────────────────────────────────────────────────────────────

/** 신규 상품 등록 시 랜덤 배정에 사용하는 프리셋 팔레트 */
export const PRESET_COLORS = [
    "#818cf8", "#34d399", "#fbbf24", "#f87171",
    "#fb923c", "#a78bfa", "#38bdf8", "#f472b6",
    "#4ade80", "#facc15", "#f97316", "#e879f9",
    "#2dd4bf", "#c084fc", "#f43f5e", "#0ea5e9",
    "#84cc16", "#ec4899", "#14b8a6", "#eab308",
  ] as const;
  
  /**
   * 기존에 사용 중인 색상을 피해 랜덤 색상을 반환합니다.
   * 프리셋이 모두 사용 중이면 완전 랜덤 hex를 생성합니다.
   */
  export function getRandomProductColor(usedColors: string[] = []): string {
    const usedSet = new Set(usedColors.map((c) => c.toLowerCase()));
  
    // 프리셋에서 미사용 색상 우선
    const available = PRESET_COLORS.filter(
      (c) => !usedSet.has(c.toLowerCase())
    );
  
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
  
    // 프리셋 소진 시 완전 랜덤 hex 생성
    const hex = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0");
    return `#${hex}`;
  }
  
  /**
   * 유효한 hex 색상 코드인지 검증합니다.
   * 3자리(#abc) 또는 6자리(#aabbcc) 허용
   */
  export function isValidHexColor(color: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
  }
  