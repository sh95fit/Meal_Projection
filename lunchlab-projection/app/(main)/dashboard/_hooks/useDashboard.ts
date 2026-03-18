// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_hooks/useDashboard.ts
// 대시보드 페이지의 전체 상태 관리 및 데이터 페칭을 담당하는 커스텀 훅
// ──────────────────────────────────────────────────────────────────
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet } from "@/lib/api";
import { getToday, addDays } from "@/lib/utils/date";
import type {
  RealtimeResponse,
  TrendResponse,
  DrilldownResponse,
  ClientChangeResponse,
  PeriodPreset,
} from "@/types/dashboard";

/** 자동 새로고침 간격: 3분 (밀리초) */
const REFRESH_INTERVAL = 3 * 60 * 1000;

/**
 * useDashboard
 *
 * 대시보드 페이지의 네 섹션(실시간, 추이, 드릴다운, 고객변동) 데이터를
 * 한곳에서 관리합니다.
 *
 * 반환값:
 *   - 데이터: realtime, trend, drilldown, clients
 *   - 로딩: loading (any section), realtimeLoading
 *   - 필터: periodPreset, customStart, customEnd
 *   - 액션: setPeriodPreset, setCustomRange, refreshRealtime, refreshAll
 */
export function useDashboard() {
  // ─── 데이터 상태 ───
  const [realtime, setRealtime] = useState<RealtimeResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownResponse | null>(null);
  const [clients, setClients] = useState<ClientChangeResponse | null>(null);

  // ─── 로딩 상태 ───
  const [loading, setLoading] = useState(true);
  const [realtimeLoading, setRealtimeLoading] = useState(false);

  // ─── 기간 필터 상태 ───
  const [periodPreset, setPeriodPresetState] = useState<PeriodPreset>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // ─── 타이머 ref (자동 새로고침) ───
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ────────────────────────────────────────────────────
  // 날짜 범위 계산 유틸
  // ────────────────────────────────────────────────────

  /**
   * 현재 periodPreset과 custom 날짜를 기반으로
   * trend/clients API에 전달할 쿼리 문자열을 계산합니다.
   */
  const getDateRangeQuery = useCallback((): string => {
    if (periodPreset === "custom" && customStart && customEnd) {
      return `start=${customStart}&end=${customEnd}`;
    }
    // preset 모드 → API에 preset 파라미터 전달
    return `preset=${periodPreset}`;
  }, [periodPreset, customStart, customEnd]);

  // ────────────────────────────────────────────────────
  // 개별 fetch 함수
  // ────────────────────────────────────────────────────

  /** 실시간 현황 조회 */
  const fetchRealtime = useCallback(async () => {
    try {
      setRealtimeLoading(true);
      const data = await apiGet<RealtimeResponse>("/api/dashboard/realtime");
      setRealtime(data);
    } catch (err) {
      console.error("[Dashboard] realtime fetch error:", err);
    } finally {
      setRealtimeLoading(false);
    }
  }, []);

  /** 추이 차트 조회 */
  const fetchTrend = useCallback(async () => {
    try {
      const query = getDateRangeQuery();
      const data = await apiGet<TrendResponse>(`/api/dashboard/trend?${query}`);
      setTrend(data);
    } catch (err) {
      console.error("[Dashboard] trend fetch error:", err);
    }
  }, [getDateRangeQuery]);

  /** 드릴다운 조회 */
  const fetchDrilldown = useCallback(async () => {
    try {
      const data = await apiGet<DrilldownResponse>("/api/dashboard/drilldown");
      setDrilldown(data);
    } catch (err) {
      console.error("[Dashboard] drilldown fetch error:", err);
    }
  }, []);

  /** 고객 변동 조회 */
  const fetchClients = useCallback(async () => {
    try {
      // clients API에는 start/end를 직접 전달
      let url = "/api/dashboard/clients";
      if (periodPreset === "custom" && customStart && customEnd) {
        url += `?start=${customStart}&end=${customEnd}`;
      } else {
        // preset에 따라 start/end 계산
        const today = getToday();
        let start: string;
        switch (periodPreset) {
          case "year":
            start = `${today.split("-")[0]}-01-01`;
            break;
          case "7d":
            start = addDays(today, -6);
            break;
          case "30d":
            start = addDays(today, -29);
            break;
          case "90d":
          default:
            start = addDays(today, -89);
        }
        url += `?start=${start}&end=${today}`;
      }
      const data = await apiGet<ClientChangeResponse>(url);
      setClients(data);
    } catch (err) {
      console.error("[Dashboard] clients fetch error:", err);
    }
  }, [periodPreset, customStart, customEnd]);

  // ────────────────────────────────────────────────────
  // 전체 새로고침
  // ────────────────────────────────────────────────────

  /** 모든 섹션 데이터를 다시 조회 */
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRealtime(), fetchTrend(), fetchDrilldown(), fetchClients()]);
    setLoading(false);
  }, [fetchRealtime, fetchTrend, fetchDrilldown, fetchClients]);

  /** 실시간 + 드릴다운만 새로고침 (자동 새로고침용) */
  const refreshRealtime = useCallback(async () => {
    await Promise.all([fetchRealtime(), fetchDrilldown()]);
  }, [fetchRealtime, fetchDrilldown]);

  // ────────────────────────────────────────────────────
  // 필터 변경 핸들러
  // ────────────────────────────────────────────────────

  /** 프리셋 변경 → trend/clients 재조회 */
  const setPeriodPreset = useCallback(
    (preset: PeriodPreset) => {
      setPeriodPresetState(preset);
    },
    []
  );

  /** 커스텀 범위 변경 → 자동으로 프리셋을 'custom'으로 전환 */
  const setCustomRange = useCallback((start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPeriodPresetState("custom");
  }, []);

  // ────────────────────────────────────────────────────
  // 초기 로드 (마운트 시)
  // ────────────────────────────────────────────────────

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────────────────────────────────────────────
  // 기간 변경 시 trend + clients 재조회
  // ────────────────────────────────────────────────────

  useEffect(() => {
    // 초기 로드와 중복 방지: realtime이 한번이라도 로드된 후에만
    if (realtime) {
      fetchTrend();
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodPreset, customStart, customEnd]);

  // ────────────────────────────────────────────────────
  // 자동 새로고침 (3분마다 실시간 + 드릴다운)
  // ────────────────────────────────────────────────────

  useEffect(() => {
    // 기존 타이머 제거 후 새로 설정
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(refreshRealtime, REFRESH_INTERVAL);

    // 클린업: 언마운트 시 타이머 해제
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshRealtime]);

  // ────────────────────────────────────────────────────
  // 반환
  // ────────────────────────────────────────────────────

  return {
    // 데이터
    realtime,
    trend,
    drilldown,
    clients,

    // 로딩
    loading,
    realtimeLoading,

    // 필터 상태
    periodPreset,
    customStart,
    customEnd,

    // 액션
    setPeriodPreset,
    setCustomRange,
    refreshRealtime,
    refreshAll,
  };
}