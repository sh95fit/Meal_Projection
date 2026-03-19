// ──────────────────────────────────────────────────────────────────
// types/dashboard.ts
// LunchLab 대시보드 전용 타입 정의
// ──────────────────────────────────────────────────────────────────

// ─── [A] 주문 소스 분기 관련 ─────────────────────────────────────

/**
 * MySQL에서 조회한 개별 주문 행 (웹/앱 합산 후)
 * - accountId   : accounts.id (정수)
 * - accountName : accounts.name
 * - productId   : Supabase products.id (내부 ID, 매핑 완료 후)
 * - productName : Supabase products.product_name
 * - quantity    : 해당 상품의 주문 수량
 * - totalQty    : 해당 고객사의 전체 주문 수량 합계
 * - channel     : 'web' | 'app' | 'both' | 'trial'
 */
export interface MergedOrder {
  accountId: number;
  accountName: string;
  productId: number;
  productName: string;
  quantity: number;
  totalQty: number;
  channel: "web" | "app" | "both" | "trial";
}

/**
 * getOrdersByDate 반환값
 * - orders          : 합산된 주문 배열
 * - appOrdersMerged : 앱 주문이 별도 합산되었는지 여부
 *                     true  = 이관 전이므로 selected_menus에서 별도 조회하여 합산함
 *                     false = 이관 완료, orders 테이블만 사용
 */
export interface OrdersByDateResult {
  orders: MergedOrder[];
  appOrdersMerged: boolean;
}

// ─── [B] 실시간 현황 섹션 ────────────────────────────────────────

/**
 * 실시간 현황의 상품별 진행 상태
 * - productId   : Supabase products.id
 * - productName : 상품명
 * - todayQty    : 오늘 기준 주문 수량 (웹+앱 합산)
 * - lastWeekQty : 지난주 동일 요일의 주문 수량 (비교용)
 * - forecastQty : Supabase order_forecasts.forecast_qty (예측값)
 *                 예측 레코드 없을 시 최근 4주 동일 요일 평균으로 fallback
 * - progress    : todayQty / forecastQty * 100 (진행률 %)
 * - diff        : todayQty - lastWeekQty (지난주 대비 증감)
 */
export interface RealtimeProduct {
  productId: number;
  productName: string;
  todayQty: number;
  lastWeekQty: number;
  forecastQty: number;
  progress: number;
  diff: number;
}

/**
 * /api/dashboard/realtime 응답
 * - targetDate        : 조회 기준일 "YYYY-MM-DD"
 * - minutesUntilCutoff: 배송일 전날 14:30 마감까지 남은 분 (음수면 이미 지남)
 * - appOrdersMerged   : 앱 주문 별도 합산 여부
 * - products          : 상품별 진행 상태 배열
 */
export interface RealtimeResponse {
  targetDate: string;
  minutesUntilCutoff: number;
  appOrdersMerged: boolean;
  products: RealtimeProduct[];
}

// ─── [C] 추이 차트 섹션 ──────────────────────────────────────────

/**
 * 추이 차트의 상품 정보 (범례 & 색상)
 */
export interface TrendProduct {
  productId: number;
  productName: string;
  color: string;
}

/**
 * 추이 차트의 일자별 행
 * - date       : "YYYY-MM-DD"
 * - dayLabel   : "03/18(수)" 형태의 축 레이블
 * - [key]      : 상품명 → 해당일 수량 (동적 키)
 * - _total     : 해당일 전체 수량 합계
 */
export interface TrendRow {
  date: string;
  dayLabel: string;
  [key: string]: string | number;
}

/**
 * /api/dashboard/trend 응답
 * - productList : 상품 목록 (범례/색상)
 * - rows        : 일자별 데이터 (Recharts 데이터)
 */
export interface TrendResponse {
  productList: TrendProduct[];
  rows: TrendRow[];
}

// ─── [D] 드릴다운 상세 분석 ─────────────────────────────────────

/**
 * 요일 비교 케이스
 * - lapsed    : 전주 주문 O → 금주 X (이탈)
 * - new       : 전주 주문 X → 금주 O (신규)
 * - unassigned: order_days에 해당 요일 미포함인데 주문 존재
 */
export type WeekdayCase = "lapsed" | "new" | "unassigned";


/** 계정 이용상태 */
export type AccountStatus = "available" | "disabled" | "considering" | "pending" | "suspended" | "scheduled" | string;


/**
 * 요일 기준 특이 고객사
 * - case           : 케이스 유형
 * - accountId      : accounts.id
 * - accountName    : 고객사명
 * - accountStatus  : 이용 상태
 * - subscriptionAt : 구독 전환일
 * - dowOrderCount: : 해당 요일 총 주문횟수
 * - lastWeekQty    : 전주 총 주문 수량
 * - thisWeekQty    : 금주 총 주문 수량
 * - diff           : thisWeekQty - lastWeekQty
 * - changeRate     : 변화율 (%) — 전주 0이면 'NEW'
 * - products       : 주문 상품 상세 { productName, qty }[]
 */
export interface WeekdayCaseClient {
  case: WeekdayCase;
  accountId: number;
  accountName: string;
  accountStatus: AccountStatus; 
  subscriptionAt: string | null; 
  dowOrderCount: number; 
  lastWeekQty: number;
  thisWeekQty: number;
  diff: number;
  changeRate: number | null; // null이면 'NEW' 표시
  products: { productName: string; qty: number }[];
}

/**
 * 수량 기준 특이 고객사 (전주 대비 ±3 이상 변동)
 * - accountId        : accounts.id
 * - accountName      : 고객사명
 * - accountStatus    : 이용 상태
 * - subscriptionAt   : 구독 전환일
 * - dowOrderCount:   : 해당 요일 총 주문횟수
 * - lastWeekQty      : 전주 총 주문 수량
 * - thisWeekQty      : 금주 총 주문 수량
 * - diff             : thisWeekQty - lastWeekQty
 * - changeRate       : 변화율 (%)
 * - direction        : 'up' (증가) | 'down' (감소)
 * - products         : 주문 상품 상세 { productName, thisWeek, lastWeek, diff }[]
 */
export interface QuantityAnomalyClient {
  accountId: number;
  accountName: string;
  accountStatus: AccountStatus;
  subscriptionAt: string | null; 
  dowOrderCount: number; 
  lastWeekQty: number;
  thisWeekQty: number;
  diff: number;
  changeRate: number;
  direction: "up" | "down";
  products: { productName: string; thisWeek: number; lastWeek: number; diff: number }[];
}

/**
 * 요일 케이스 요약 수치
 */
export interface WeekdayCaseSummary {
  lapsed: number;
  new: number;
  unassigned: number;
  total: number;
}

/**
 * 상품별 수량 배지 데이터
 */
export interface ProductChip {
  productId: number;
  productName: string;
  qty: number;
  color: string;
}

/**
 * /api/dashboard/drilldown/detail 응답
 *
 * 추이 차트에서 바 클릭 시 해당 날짜의 상세 분석 데이터를 제공한다.
 * 차트 데이터는 포함하지 않으며, 해당 일자 주문만으로 분석한다.
 *
 * - targetDate       : 분석 기준일
 * - dow              : 요일 한글 ("월", "화", ...)
 * - orderedCount     : 주문 고객사 수
 * - unorderedCount   : 미주문 고객사 수
 * - totalQty         : 총 주문 수량
 * - newCount         : 신규 주문 고객사 수 (전주X → 금주O)
 * - lapsedCount      : 이탈 고객사 수 (전주O → 금주X)
 * - productChips     : 상품별 수량 배지
 * - weekdayClients   : 요일 기준 특이 고객사 목록
 * - weekdaySummary   : 요일 케이스별 수치 요약
 * - quantityClients  : 수량 기준 특이 고객사 목록 (±3 이상 변동)
 */
export interface DrilldownDetailResponse {
  targetDate: string;
  dow: string;
  orderedCount: number;
  unorderedCount: number;
  totalQty: number;
  newCount: number;
  lapsedCount: number;
  productChips: ProductChip[];
  weekdayClients: WeekdayCaseClient[];
  weekdaySummary: WeekdayCaseSummary;
  quantityClients: QuantityAnomalyClient[];
}

/**
 * 수량 기준 특이 고객사 — QuantityTable 컴포넌트용
 * (DrilldownDetailSection 내부의 QuantityAnomalyClient와 별도)
 * - accountId    : accounts.id
 * - accountName  : 고객사명
 * - accountStatus    : 이용 상태
 * - subscriptionAt   : 구독 전환일
 * - dowOrderCount:   : 해당 요일 총 주문횟수
 * - totalLast    : 전주 총 수량
 * - totalThis    : 금주 총 수량
 * - totalDiff    : totalThis - totalLast
 * - products     : 상품별 상세 변동
 */
export interface QuantityClient {
  accountId: number;
  accountName: string;
  accountStatus: AccountStatus; 
  subscriptionAt: string | null;
  dowOrderCount: number;
  totalLast: number;
  totalThis: number;
  totalDiff: number;
  products: {
    productName: string;
    lastWeekQty: number;
    thisWeekQty: number;
    diff: number;
  }[];
}

// ─── [E] 고객 변동 섹션 ──────────────────────────────────────────

/**
 * 개별 고객 변동 정보
 * - type         : 'churned' | 'new' | 'converted'
 * - accountId    : accounts.id
 * - accountName  : 고객사명
 * - previousAvg  : 이전 기간 일평균 주문량
 * - currentAvg   : 현재 기간 일평균 주문량
 * - lastOrderDate: 마지막 주문일
 * - mainProduct  : 주로 주문한 상품명
 * - productAvgs  : 상품별 일평균 수량
 */
export interface ClientChange {
  type: "churned" | "new" | "converted";
  accountId: number;
  accountName: string;
  previousAvg: number;
  currentAvg: number;
  lastOrderDate: string | null;
  mainProduct: string;
  /** 상품별 일평균 수량 */
  productAvgs: { productName: string; avg: number }[];
  /** 이탈 고객: 이용 종료일 (terminate_at) */
  terminateAt: string | null;
  /** 신규 고객: 구독 전환일 (subscription_at) */
  subscriptionAt: string | null;
  /** 전환예정 고객: 전환 예정일 (subscription_scheduled_at) */
  subscriptionScheduledAt: string | null;
}

/**
 * 요일별 순유입 — 상품별 상세
 */
export interface DowFlowProductDetail {
  productName: string;
  churnedAvgSum: number;
  churnedMedianSum: number;
  newAvgSum: number;
  newMedianSum: number;
}

/**
 * 요일별 순유입 정보
 * - dow              : 'mon' | 'tue' | ... | 'sat'
 * - dowLabel         : '월' | '화' | ... | '토'
 * - churnedAvgSum    : 이탈 고객사 평균 식수 합계
 * - churnedMedianSum : 이탈 고객사 중간 식수 합계
 * - newAvgSum        : 신규 고객사 평균 식수 합계
 * - newMedianSum     : 신규 고객사 중간 식수 합계
 * - netAvg           : 순 변화 (평균 기준)
 * - netMedian        : 순 변화 (중간 기준)
 * - products         : 상품별 상세
 */
export interface DowFlow {
  dow: string;
  dowLabel: string;
  churnedAvgSum: number;
  churnedMedianSum: number;
  newAvgSum: number;
  newMedianSum: number;
  netAvg: number;
  netMedian: number;
  products: DowFlowProductDetail[];
}

/**
 * /api/dashboard/clients 응답
 */
export interface ClientChangeResponse {
  startDate: string;
  endDate: string;
  changes: ClientChange[];
  summary: {
    churned: number;
    new: number;
    converted: number;
    netFlow: number;
    // 전기 대비 증감 (추가)
    churnedDelta: number;
    newDelta: number;
    convertedDelta: number;
    prevChurned: number;
    prevNew: number;
    prevConverted: number;
  };
  dowFlows: DowFlow[];
}

// ─── [F] useDashboard 훅 상태 타입 ──────────────────────────────

/**
 * 기간 프리셋
 * - year   : 올해 전체
 * - 7d     : 최근 7일
 * - 30d    : 최근 30일
 * - 60d    : 최근 60일
 * - 90d    : 최근 90일
 * - custom : 사용자 지정 기간
 */
export type PeriodPreset = "year" | "7d" | "30d" | "60d" | "90d" | "custom";

/** 요일별 증감 테이블 보기 범위 */
export type ViewScope = "total" | "product";

// ─── [G] 고객 변동 확장 (상세 분석용) ────────────────────────────

/**
 * 고객 그룹 요약 — 이탈/신규/전환 그룹별 통계
 * - count        : 해당 그룹 고객 수
 * - avgQty       : 일평균 주문량
 * - medianQty    : 일중간값 주문량
 * - productStats : 상품별 평균/중간값
 */
export interface ClientGroupSummary {
  count: number;
  avgQty: number;
  medianQty: number;
  productStats: {
    productName: string;
    avg: number;
    median: number;
  }[];
}

/**
 * 고객 변동 리스트 항목 — 개별 고객사 상세
 * - accountId   : accounts.id
 * - accountName : 고객사명
 * - orderCount  : 주문 횟수
 * - avgQty      : 일평균 주문량
 * - medianQty   : 일중간값 주문량
 * - productQty  : 상품명 → 수량 맵
 */
export interface ClientListItem {
  accountId: number;
  accountName: string;
  orderCount: number;
  avgQty: number;
  medianQty: number;
  productQty: Record<string, number>;
}

/**
 * 요일별 증감 — 상품별 분리 포함
 * - dow         : 'mon' | 'tue' | ... | 'fri'
 * - dowLabel    : '월' | '화' | ... | '금'
 * - churn       : 이탈 수
 * - newCount    : 신규 수
 * - net         : newCount - churn
 * - productChurn: 상품명 → 이탈 수
 * - productNew  : 상품명 → 신규 수
 */
export interface DowChange {
  dow: string;
  dowLabel: string;
  churn: number;
  newCount: number;
  net: number;
  productChurn: Record<string, number>;
  productNew: Record<string, number>;
}

/**
 * 고객 변동 응답 확장 — 상세 분석 페이지용
 * ClientChangeResponse를 확장하여 그룹별 요약, 리스트, 요일별 증감 포함
 */
export interface ClientChangeDetailResponse extends ClientChangeResponse {
  churnSummary: ClientGroupSummary;
  newSummary: ClientGroupSummary;
  convertedSummary: ClientGroupSummary;
  churnList: ClientListItem[];
  newList: ClientListItem[];
  convertedList: ClientListItem[];
  dowChanges: DowChange[];
  netQty: number;
  netCount: number;
}

// ─── [H] 모달용 ─────────────────────────────────────────────────

/**
 * 고객사 상세 모달 데이터
 * - accountId    : accounts.id
 * - accountName  : 고객사명
 * - totalOrders  : 총 주문 건수
 * - avgQty       : 일평균 주문량
 * - medianQty    : 일중간값 주문량
 * - productStats : 상품별 평균/중간값
 * - recentTrend  : 최근 일자별 주문 추이
 */
export interface ClientModalData {
  accountId: number;
  accountName: string;
  totalOrders: number;
  avgQty: number;
  medianQty: number;
  productStats: {
    productName: string;
    avg: number;
    median: number;
  }[];
  recentTrend: {
    date: string;
    qty: number;
  }[];
}
