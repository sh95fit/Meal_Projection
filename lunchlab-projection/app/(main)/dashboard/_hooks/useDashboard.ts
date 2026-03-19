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
  ClientModalData,
  PeriodPreset,
  ViewScope,
} from "@/types/dashboard";

const REFRESH_INTERVAL = 3 * 60 * 1000;

export function useDashboard() {
  // ─── 실시간 섹션 ───
  const [realtimeDate, setRealtimeDateState] = useState<string>(() => getDefaultRealtimeDate());
  const [realtime, setRealtime] = useState<RealtimeResponse | null>(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);

  // ─── 추이 차트 섹션 ───
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [trendPreset, _setTrendPreset] = useState<PeriodPreset>("30d");
  const [trendCustomStart, _setTrendCustomStart] = useState("");
  const [trendCustomEnd, _setTrendCustomEnd] = useState("");
  const [trendExcludedProducts, setTrendExcludedProducts] = useState<Set<string>>(new Set());

  // ─── 고객 변동 섹션 ───
  const [clients, setClients] = useState<ClientChangeResponse | null>(null);
  const [clientPreset, _setClientPreset] = useState<PeriodPreset>("7d");
  const [clientCustomStart, _setClientCustomStart] = useState("");
  const [clientCustomEnd, _setClientCustomEnd] = useState("");
  const [dowScope, setDowScope] = useState<ViewScope>("total");

  // ─── 드릴다운 상세 ───
  const [drilldownDetail, setDrilldownDetail] = useState<DrilldownDetailResponse | null>(null);
  const [drilldownDate, setDrilldownDate] = useState<string | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // ─── 고객사 상세 모달 ───
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientModalData, setClientModalData] = useState<ClientModalData | null>(null);
  const [clientModalLoading, setClientModalLoading] = useState(false);

  // ─── 로딩 ───
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ★ ref로 최신 필터 상태를 항상 추적
  const realtimeDateRef = useRef(realtimeDate);
  realtimeDateRef.current = realtimeDate;

  const trendStateRef = useRef({
    preset: trendPreset,
    customStart: trendCustomStart,
    customEnd: trendCustomEnd,
  });
  trendStateRef.current = {
    preset: trendPreset,
    customStart: trendCustomStart,
    customEnd: trendCustomEnd,
  };

  const clientStateRef = useRef({
    preset: clientPreset,
    customStart: clientCustomStart,
    customEnd: clientCustomEnd,
  });
  clientStateRef.current = {
    preset: clientPreset,
    customStart: clientCustomStart,
    customEnd: clientCustomEnd,
  };

  // ★ 초기 로드 완료 여부 (useEffect 가드용)
  const initializedRef = useRef(false);

  // ★ debounce 타이머 ref (다중 state 변경이 한 번의 fetch로 합쳐짐)
  const trendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch 함수들 (모두 deps=[] → 참조 안정) ───

  const fetchRealtime = useCallback(async (date?: string) => {
    const targetDate = date || realtimeDateRef.current;
    try {
      setRealtimeLoading(true);
      const data = await apiGet<RealtimeResponse>(`/api/dashboard/realtime?date=${targetDate}`);
      setRealtime(data);
    } catch (err) {
      console.error("[Dashboard] realtime fetch error:", err);
    } finally {
      setRealtimeLoading(false);
    }
  }, []);

  const fetchTrend = useCallback(async () => {
    try {
      setTrendLoading(true);
      const { preset, customStart, customEnd } = trendStateRef.current;
      let query: string;
      if (preset === "custom" && customStart && customEnd) {
        query = `start=${customStart}&end=${customEnd}`;
      } else {
        query = `preset=${preset}`;
      }
      const data = await apiGet<TrendResponse>(`/api/dashboard/trend?${query}`);
      setTrend(data);
    } catch (err) {
      console.error("[Dashboard] trend fetch error:", err);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      setClientsLoading(true);
      const { preset, customStart, customEnd } = clientStateRef.current;
      const today = getToday();
      let url: string;
      if (preset === "custom" && customStart && customEnd) {
        url = `/api/dashboard/clients?start=${customStart}&end=${customEnd}`;
      } else {
        let start: string;
        switch (preset) {
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
        url = `/api/dashboard/clients?start=${start}&end=${today}`;
      }
      const data = await apiGet<ClientChangeResponse>(url);
      setClients(data);
    } catch (err) {
      console.error("[Dashboard] clients fetch error:", err);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  // ─── 전체 새로고침 ───
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetchRealtime();
    await Promise.all([fetchTrend(), fetchClients()]);
    initializedRef.current = true;
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

  // ─── 고객사 상세 모달 ───
  const openClientModal = useCallback(async (accountId: number) => {
    setClientModalOpen(true);
    setClientModalLoading(true);
    setClientModalData(null);
    try {
      const data = await apiGet<ClientModalData>(
        `/api/dashboard/clients/modal?accountId=${accountId}`
      );
      setClientModalData(data);
    } catch (err) {
      console.error("[Dashboard] client modal fetch error:", err);
      setClientModalData(null);
    } finally {
      setClientModalLoading(false);
    }
  }, []);

  const closeClientModal = useCallback(() => {
    setClientModalOpen(false);
    setClientModalData(null);
  }, []);

  // ─── 추이 차트 필터 핸들러 ───
  const setTrendPreset = useCallback((p: PeriodPreset) => {
    _setTrendPreset(p);
    if (p !== "custom") {
      _setTrendCustomStart("");
      _setTrendCustomEnd("");
    }
  }, []);

  const setTrendCustomRange = useCallback((start: string, end: string) => {
    _setTrendPreset("custom");
    _setTrendCustomStart(start);
    _setTrendCustomEnd(end);
  }, []);

  const toggleTrendProduct = useCallback((productName: string) => {
    setTrendExcludedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  }, []);

  // ─── 고객 변동 필터 핸들러 ───
  const setClientPreset = useCallback((p: PeriodPreset) => {
    _setClientPreset(p);
    if (p !== "custom") {
      _setClientCustomStart("");
      _setClientCustomEnd("");
    }
  }, []);

  const setClientCustomRange = useCallback((start: string, end: string) => {
    _setClientPreset("custom");
    _setClientCustomStart(start);
    _setClientCustomEnd(end);
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
    if (initializedRef.current) {
      fetchRealtime(realtimeDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeDate]);

  // ─── ★ 추이 차트: debounce로 다중 state 변경을 1회 fetch로 합침 ───
  useEffect(() => {
    if (!initializedRef.current) return;

    if (trendDebounceRef.current) clearTimeout(trendDebounceRef.current);
    trendDebounceRef.current = setTimeout(() => {
      fetchTrend();
    }, 0);

    return () => {
      if (trendDebounceRef.current) clearTimeout(trendDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPreset, trendCustomStart, trendCustomEnd]);

  // ─── ★ 고객 변동: 동일한 debounce 패턴 ───
  useEffect(() => {
    if (!initializedRef.current) return;

    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    clientDebounceRef.current = setTimeout(() => {
      fetchClients();
    }, 0);

    return () => {
      if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    };
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
    realtime,
    trend,
    clients,

    realtimeDate,
    setRealtimeDate,
    realtimeLoading,

    trendPreset,
    trendCustomStart,
    trendCustomEnd,
    trendExcludedProducts,
    setTrendPreset,
    setTrendCustomRange,
    toggleTrendProduct,

    clientPreset,
    clientCustomStart,
    clientCustomEnd,
    dowScope,
    setClientPreset,
    setClientCustomRange,
    setDowScope,

    drilldownDetail,
    drilldownDate,
    drilldownOpen,
    drilldownLoading,
    openDrilldown,
    closeDrilldown,

    clientModalOpen,
    clientModalData,
    clientModalLoading,
    openClientModal,
    closeClientModal,

    loading,
    trendLoading,
    clientsLoading,
    refreshAll,
    refreshRealtime,
  };
}
