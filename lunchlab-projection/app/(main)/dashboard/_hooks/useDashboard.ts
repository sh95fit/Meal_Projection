// app/(main)/dashboard/_hooks/useDashboard.ts (전체 교체)
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet } from "@/lib/api";
import { getToday, addDays, getDefaultRealtimeDate } from "@/lib/utils/date";
import type {
  RealtimeResponse,
  TrendResponse,
  DrilldownDetailResponse,
  ClientChangeResponse,
  PeriodPreset,
} from "@/types/dashboard";

const REFRESH_INTERVAL = 3 * 60 * 1000;

export function useDashboard() {
  // ─── 실시간 섹션 날짜 (기본: 다음 영업일) ───
  const [realtimeDate, setRealtimeDateState] = useState<string>(() => getDefaultRealtimeDate());

  // ─── 데이터 상태 ───
  const [realtime, setRealtime] = useState<RealtimeResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [clients, setClients] = useState<ClientChangeResponse | null>(null);

  // ─── 드릴다운 상세 상태 (차트 바 클릭) ───
  const [drilldownDetail, setDrilldownDetail] = useState<DrilldownDetailResponse | null>(null);
  const [drilldownDate, setDrilldownDate] = useState<string | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // ─── 로딩 상태 ───
  const [loading, setLoading] = useState(true);
  const [realtimeLoading, setRealtimeLoading] = useState(false);

  // ─── 기간 필터 상태 ───
  const [periodPreset, setPeriodPresetState] = useState<PeriodPreset>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── 날짜 범위 유틸 ───
  const getDateRangeQuery = useCallback((): string => {
    if (periodPreset === "custom" && customStart && customEnd) {
      return `start=${customStart}&end=${customEnd}`;
    }
    return `preset=${periodPreset}`;
  }, [periodPreset, customStart, customEnd]);

  // ─── 실시간 현황 조회 (날짜 파라미터 포함) ───
  const fetchRealtime = useCallback(async (date?: string) => {
    const targetDate = date || realtimeDate;
    try {
      setRealtimeLoading(true);
      const data = await apiGet<RealtimeResponse>(
        `/api/dashboard/realtime?date=${targetDate}`
      );
      setRealtime(data);
    } catch (err) {
      console.error("[Dashboard] realtime fetch error:", err);
    } finally {
      setRealtimeLoading(false);
    }
  }, [realtimeDate]);

  /** 실시간 섹션 날짜 변경 */
  const setRealtimeDate = useCallback((date: string) => {
    setRealtimeDateState(date);
  }, []);

  const fetchTrend = useCallback(async () => {
    try {
      const query = getDateRangeQuery();
      const data = await apiGet<TrendResponse>(`/api/dashboard/trend?${query}`);
      setTrend(data);
    } catch (err) {
      console.error("[Dashboard] trend fetch error:", err);
    }
  }, [getDateRangeQuery]);

  const fetchClients = useCallback(async () => {
    try {
      let url = "/api/dashboard/clients";
      if (periodPreset === "custom" && customStart && customEnd) {
        url += `?start=${customStart}&end=${customEnd}`;
      } else {
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

  // ─── 전체 새로고침 (순차 실행) ───
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetchRealtime();
    await Promise.all([fetchTrend(), fetchClients()]);
    setLoading(false);
  }, [fetchRealtime, fetchTrend, fetchClients]);

  const refreshRealtime = useCallback(async () => {
    await fetchRealtime();
  }, [fetchRealtime]);

  // ─── 드릴다운 상세 열기 ───
  const openDrilldown = useCallback(async (date: string) => {
    setDrilldownDate(date);
    setDrilldownOpen(true);
    setDrilldownLoading(true);
    try {
      const data = await apiGet<DrilldownDetailResponse>(
        `/api/dashboard/drilldown/detail?date=${date}`
      );
      setDrilldownDetail(data);
    } catch (err) {
      console.error("[Dashboard] drilldown detail fetch error:", err);
      setDrilldownDetail(null);
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  const closeDrilldown = useCallback(() => {
    setDrilldownOpen(false);
    setDrilldownDate(null);
    setDrilldownDetail(null);
  }, []);

  // ─── 필터 핸들러 ───
  const setPeriodPreset = useCallback((preset: PeriodPreset) => {
    setPeriodPresetState(preset);
  }, []);

  const setCustomRange = useCallback((start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPeriodPresetState("custom");
  }, []);

  // ─── 초기 로드 ───
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 실시간 날짜 변경 시 재조회 ───
  useEffect(() => {
    if (realtime) {
      fetchRealtime(realtimeDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeDate]);

  // ─── 기간 변경 시 trend + clients 재조회 ───
  useEffect(() => {
    if (realtime) {
      fetchTrend();
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodPreset, customStart, customEnd]);

  // ─── 자동 새로고침 ───
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(refreshRealtime, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshRealtime]);

  return {
    realtime,
    trend,
    clients,

    // 실시간 날짜
    realtimeDate,
    setRealtimeDate,

    // 드릴다운 상세
    drilldownDetail,
    drilldownDate,
    drilldownOpen,
    drilldownLoading,
    openDrilldown,
    closeDrilldown,

    loading,
    realtimeLoading,

    periodPreset,
    customStart,
    customEnd,

    setPeriodPreset,
    setCustomRange,
    refreshRealtime,
    refreshAll,
  };
}
