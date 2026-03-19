// ──────────────────────────────────────────────────────────────────
// lib/constants/dashboard.ts
// 대시보드 전역 상수 — dashboardQueryRepository, clientRepository 공유
// ──────────────────────────────────────────────────────────────────

/** 앱 주문 이관 마감 시각 — 시(hour) */
export const CUTOFF_HOUR = 14;

/** 앱 주문 이관 마감 시각 — 분(minute) */
export const CUTOFF_MINUTE = 30;

/**
 * 수량 이상 감지 임계값.
 * 지난주 동일 요일 대비 |diff| >= 이 값이면 '특이'로 분류합니다.
 */
export const QTY_ANOMALY_THRESHOLD = 3;

/**
 * 데이터 시작일.
 * MySQL 주문 테이블에서 이 날짜 이전 데이터는 조회하지 않습니다.
 */
export const DATA_START_DATE = "2025-09-01";

/**
 * JS Date.getDay() → 영문 요일 약어
 * getDay(): 0=일, 1=월, ..., 6=토
 */
export const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** 한글 요일 레이블 (Date.getDay() 인덱스 순) */
export const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
