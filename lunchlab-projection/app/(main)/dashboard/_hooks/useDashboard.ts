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
  // ─── ★ 캐시 (useRef → 렌더 간 유지, refreshAll 시 초기화) ───
  const trendCacheRef = useRef<Map<string, TrendResponse>>(new Map());
  const clientsCacheRef = useRef<Map<string, ClientChangeResponse>>(new Map());

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

  // ★ 실시간 fetch의 요청 ID — 마지막 요청만 반영
  const realtimeRequestIdRef = useRef(0);

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

  // ★ 마지막으로 fetch한 쿼리 문자열을 기억 → 동일 쿼리 중복 방지
  const lastTrendQueryRef = useRef<string>("");
  const lastClientQueryRef = useRef<string>("");

  // ★ 실시간 날짜 변경 debounce 타이머
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch 함수들 (모두 deps=[] → 참조 안정) ───

  const fetchRealtime = useCallback(async (date?: string) => {
    const targetDate = date || realtimeDateRef.current;
    const requestId = ++realtimeRequestIdRef.current;

    try {
      setRealtimeLoading(true);
      const data = await apiGet<RealtimeResponse>(`/api/dashboard/realtime?date=${targetDate}`);

      // ★ 응답 도착 시점에 최신 요청인지 확인 — 아니면 무시
      if (requestId !== realtimeRequestIdRef.current) return;

      setRealtime(data);
    } catch (err) {
      if (requestId !== realtimeRequestIdRef.current) return;
      console.error("[Dashboard] realtime fetch error:", err);
    } finally {
      if (requestId === realtimeRequestIdRef.current) {
        setRealtimeLoading(false);
      }
    }
  }, []);

  const fetchTrend = useCallback(async (force?: boolean) => {
    const { preset, customStart, customEnd } = trendStateRef.current;

    // ★ custom 모드인데 날짜가 불완전하면 fetch하지 않음
    if (preset === "custom" && (!customStart || !customEnd)) return;

    let query: string;
    if (preset === "custom" && customStart && customEnd) {
      query = `start=${customStart}&end=${customEnd}`;
    } else {
      query = `preset=${preset}`;
    }

    // ★ 동일 쿼리면 skip (force=true일 때는 무시)
    if (!force && query === lastTrendQueryRef.current) return;
    lastTrendQueryRef.current = query;

    // ★ 캐시 적중 확인 (force가 아닌 경우)
    if (!force) {
      const cached = trendCacheRef.current.get(query);
      if (cached) {
        setTrend(cached);
        return;
      }
    }

    try {
      setTrendLoading(true);
      const data = await apiGet<TrendResponse>(`/api/dashboard/trend?${query}`);
      setTrend(data);
      // ★ 캐시에 저장
      trendCacheRef.current.set(query, data);
    } catch (err) {
      console.error("[Dashboard] trend fetch error:", err);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async (force?: boolean) => {
    const { preset, customStart, customEnd } = clientStateRef.current;

    // ★ custom 모드인데 날짜가 불완전하면 fetch하지 않음
    if (preset === "custom" && (!customStart || !customEnd)) return;

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
      url = `/api/dashboard/clients?start=${start}&end=${today}&preset=${preset}`;
    }

    // ★ 동일 쿼리면 skip (force=true일 때는 무시)
    if (!force && url === lastClientQueryRef.current) return;
    lastClientQueryRef.current = url;

    // ★ 캐시 적중 확인 (force가 아닌 경우)
    if (!force) {
      const cached = clientsCacheRef.current.get(url);
      if (cached) {
        setClients(cached);
        return;
      }
    }

    try {
      setClientsLoading(true);
      const data = await apiGet<ClientChangeResponse>(url);
      setClients(data);
      // ★ 캐시에 저장
      clientsCacheRef.current.set(url, data);
    } catch (err) {
      console.error("[Dashboard] clients fetch error:", err);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  // ─── 전체 새로고침 ───
  const refreshAll = useCallback(async () => {
    setLoading(true);
    // ★ force refresh이므로 캐시 초기화
    trendCacheRef.current.clear();
    clientsCacheRef.current.clear();
    lastTrendQueryRef.current = "";
    lastClientQueryRef.current = "";

    await fetchRealtime();
    // ★ force=true로 중복 방지 우회
    await Promise.all([fetchTrend(true), fetchClients(true)]);
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
  const openClientModal = useCallback(async (accountId: number, type?: string) => {
    setClientModalOpen(true);
    setClientModalLoading(true);
    setClientModalData(null);
    try {
      const t = type || "churned";
      const data = await apiGet<ClientModalData>(
        `/api/dashboard/clients/modal?accountId=${accountId}&type=${t}`
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

  // ─── ★ 실시간 날짜 변경 시 debounce + 이전 응답 무시 ───
  useEffect(() => {
    if (!initializedRef.current) return;

    // 이전 debounce 타이머 취소
    if (realtimeDebounceRef.current) {
      clearTimeout(realtimeDebounceRef.current);
    }

    // ★ 즉시 로딩 표시 (날짜 변경 시 바로 로딩 UI로 전환)
    setRealtimeLoading(true);

    // ★ 300ms debounce — 빠르게 여러 번 변경해도 마지막 것만 fetch
    realtimeDebounceRef.current = setTimeout(() => {
      fetchRealtime(realtimeDate);
    }, 300);

    return () => {
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeDate]);

  // ─── ★ 추이 차트: 필터 변경 시에만 fetch (16ms 배칭 + 동일 쿼리 skip + 캐시) ───
  useEffect(() => {
    if (!initializedRef.current) return;
    const timer = setTimeout(() => {
      fetchTrend();
    }, 16);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPreset, trendCustomStart, trendCustomEnd]);

  // ─── ★ 고객 변동: 동일한 패턴 ───
  useEffect(() => {
    if (!initializedRef.current) return;
    const timer = setTimeout(() => {
      fetchClients();
    }, 16);
    return () => clearTimeout(timer);
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
