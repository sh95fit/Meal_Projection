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
  ViewScope,
} from "@/types/dashboard";

const REFRESH_INTERVAL = 3 * 60 * 1000;

export function useDashboard() {
  // ─── 실시간 섹션 ───
  const [realtimeDate, setRealtimeDateState] = useState<string>(() => getDefaultRealtimeDate());
  const [realtime, setRealtime] = useState<RealtimeResponse | null>(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);

  // ─── 추이 차트 섹션 (독립 필터) ───
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [trendPreset, setTrendPresetState] = useState<PeriodPreset>("60d");
  const [trendCustomStart, setTrendCustomStart] = useState("");
  const [trendCustomEnd, setTrendCustomEnd] = useState("");
  const [trendExcludedProducts, setTrendExcludedProducts] = useState<Set<string>>(new Set());

  // ─── 고객 변동 섹션 (독립 필터) ───
  const [clients, setClients] = useState<ClientChangeResponse | null>(null);
  const [clientPreset, setClientPresetState] = useState<PeriodPreset>("7d");
  const [clientCustomStart, setClientCustomStart] = useState("");
  const [clientCustomEnd, setClientCustomEnd] = useState("");
  const [dowScope, setDowScope] = useState<ViewScope>("total");

  // ─── 드릴다운 상세 ───
  const [drilldownDetail, setDrilldownDetail] = useState<DrilldownDetailResponse | null>(null);
  const [drilldownDate, setDrilldownDate] = useState<string | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // ─── 로딩 ───
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── 추이 차트: 날짜 범위 쿼리 ───
  const getTrendQuery = useCallback((): string => {
    if (trendPreset === "custom" && trendCustomStart && trendCustomEnd) {
      return `start=${trendCustomStart}&end=${trendCustomEnd}`;
    }
    return `preset=${trendPreset}`;
  }, [trendPreset, trendCustomStart, trendCustomEnd]);

  // ─── 고객 변동: 날짜 범위 URL ───
  const getClientUrl = useCallback((): string => {
    const today = getToday();
    if (clientPreset === "custom" && clientCustomStart && clientCustomEnd) {
      return `/api/dashboard/clients?start=${clientCustomStart}&end=${clientCustomEnd}`;
    }
    let start: string;
    switch (clientPreset) {
      case "year":
        start = `${today.split("-")[0]}-01-01`;
        break;
      case "7d":
        start = addDays(today, -6);
        break;
      case "30d":
        start = addDays(today, -29);
        break;
      case "60d":
        start = addDays(today, -59);
        break;
      case "90d":
      default:
        start = addDays(today, -89);
        break;
    }
    return `/api/dashboard/clients?start=${start}&end=${today}`;
  }, [clientPreset, clientCustomStart, clientCustomEnd]);

  // ─── Fetch 함수들 ───
  const fetchRealtime = useCallback(async (date?: string) => {
    const targetDate = date || realtimeDate;
    try {
      setRealtimeLoading(true);
      const data = await apiGet<RealtimeResponse>(`/api/dashboard/realtime?date=${targetDate}`);
      setRealtime(data);
    } catch (err) {
      console.error("[Dashboard] realtime fetch error:", err);
    } finally {
      setRealtimeLoading(false);
    }
  }, [realtimeDate]);

  const fetchTrend = useCallback(async () => {
    try {
      const query = getTrendQuery();
      const data = await apiGet<TrendResponse>(`/api/dashboard/trend?${query}`);
      setTrend(data);
    } catch (err) {
      console.error("[Dashboard] trend fetch error:", err);
    }
  }, [getTrendQuery]);

  const fetchClients = useCallback(async () => {
    try {
      const url = getClientUrl();
      const data = await apiGet<ClientChangeResponse>(url);
      setClients(data);
    } catch (err) {
      console.error("[Dashboard] clients fetch error:", err);
    }
  }, [getClientUrl]);

  // ─── 전체 새로고침 ───
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetchRealtime();
    await Promise.all([fetchTrend(), fetchClients()]);
    setLoading(false);
  }, [fetchRealtime, fetchTrend, fetchClients]);

  const refreshRealtime = useCallback(async () => {
    await fetchRealtime();
  }, [fetchRealtime]);

  // ─── 드릴다운 ───
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

  // ─── 추이 차트 필터 핸들러 ───
  const setTrendPreset = useCallback((preset: PeriodPreset) => {
    setTrendPresetState(preset);
  }, []);

  const setTrendCustomRange = useCallback((start: string, end: string) => {
    setTrendCustomStart(start);
    setTrendCustomEnd(end);
    setTrendPresetState("custom");
  }, []);

  const toggleTrendProduct = useCallback((productName: string) => {
    setTrendExcludedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  }, []);

  // ─── 고객 변동 필터 핸들러 ───
  const setClientPreset = useCallback((preset: PeriodPreset) => {
    setClientPresetState(preset);
  }, []);

  const setClientCustomRange = useCallback((start: string, end: string) => {
    setClientCustomStart(start);
    setClientCustomEnd(end);
    setClientPresetState("custom");
  }, []);

  // ─── 실시간 날짜 변경 ───
  const setRealtimeDate = useCallback((date: string) => {
    setRealtimeDateState(date);
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

  // ─── 추이 차트 필터 변경 시 재조회 (독립) ───
  useEffect(() => {
    if (realtime) {
      fetchTrend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPreset, trendCustomStart, trendCustomEnd]);

  // ─── 고객 변동 필터 변경 시 재조회 (독립) ───
  useEffect(() => {
    if (realtime) {
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPreset, clientCustomStart, clientCustomEnd]);

  // ─── 자동 새로고침 (실시간만) ───
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(refreshRealtime, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshRealtime]);

  return {
    // 데이터
    realtime,
    trend,
    clients,

    // 실시간
    realtimeDate,
    setRealtimeDate,
    realtimeLoading,

    // 추이 차트 필터
    trendPreset,
    trendCustomStart,
    trendCustomEnd,
    trendExcludedProducts,
    setTrendPreset,
    setTrendCustomRange,
    toggleTrendProduct,

    // 고객 변동 필터
    clientPreset,
    clientCustomStart,
    clientCustomEnd,
    dowScope,
    setClientPreset,
    setClientCustomRange,
    setDowScope,

    // 드릴다운
    drilldownDetail,
    drilldownDate,
    drilldownOpen,
    drilldownLoading,
    openDrilldown,
    closeDrilldown,

    // 전체
    loading,
    refreshAll,
    refreshRealtime,
  };
}