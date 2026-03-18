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
    channel: 'web' | 'app' | 'both' | 'trial';
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
 * - yesterdayQty: 어제 같은 시점의 주문 수량 (비교용)
 * - forecastQty : Supabase order_forecasts.forecast_qty (예측값)
 * - progress    : todayQty / forecastQty * 100 (진행률 %)
 * - diff        : todayQty - yesterdayQty (전일 대비 증감)
 */
export interface RealtimeProduct {
productId: number;
productName: string;
todayQty: number;
yesterdayQty: number;
forecastQty: number;
progress: number;
diff: number;
}

/**
 * /api/dashboard/realtime 응답
 * - targetDate        : 조회 기준일 "YYYY-MM-DD"
 * - minutesUntilCutoff: 14:30 마감까지 남은 분 (음수면 이미 지남)
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
[key: string]: string | number;  // 상품명별 수량 + _total
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

// ─── [D] 드릴다운 섹션 ──────────────────────────────────────────

/**
 * 요일 기준 특이 고객사
 * - type          : 'lapsed' (이탈) | 'new' (신규) | 'unassigned' (미지정)
 * - accountId     : accounts.id
 * - accountName   : 고객사명
 * - orderDay      : 등록된 주문 요일 문자열 (예: 'mon,tue,wed')
 * - lastOrderDate : 해당 요일의 마지막 주문일 (이탈 시 표시)
 */
export interface WeekdayAnomaly {
type: 'lapsed' | 'new' | 'unassigned';
accountId: number;
accountName: string;
orderDay: string | null;
lastOrderDate: string | null;
}

/**
 * 수량 변동 특이 고객사
 * - accountId    : accounts.id
 * - accountName  : 고객사명
 * - todayQty     : 오늘 주문 수량
 * - avgQty       : 최근 4주 해당 요일 평균 수량
 * - diff         : todayQty - avgQty
 * - direction    : 'up' | 'down'
 * - productBreakdown : 상품별 비교 { productName, today, avg }
 */
export interface QuantityAnomaly {
accountId: number;
accountName: string;
todayQty: number;
avgQty: number;
diff: number;
direction: 'up' | 'down';
productBreakdown: {
    productName: string;
    today: number;
    avg: number;
}[];
}

/**
 * /api/dashboard/drilldown 응답
 */
export interface DrilldownResponse {
targetDate: string;
dow: string;
weekdayAnomalies: WeekdayAnomaly[];
quantityAnomalies: QuantityAnomaly[];
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
 */
export interface ClientChange {
type: 'churned' | 'new' | 'converted';
accountId: number;
accountName: string;
previousAvg: number;
currentAvg: number;
lastOrderDate: string | null;
mainProduct: string;
}

/**
 * 요일별 순유입 정보
 */
export interface DowFlow {
dow: string;          // 'mon' | 'tue' | ... | 'fri'
dowLabel: string;     // '월' | '화' | ... | '금'
churned: number;      // 이탈 고객 수
newCount: number;     // 신규 고객 수
net: number;          // newCount - churned
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
    netFlow: number;    // new - churned
};
dowFlows: DowFlow[];
}

// ─── [F] useDashboard 훅 상태 타입 ──────────────────────────────

/**
 * 기간 프리셋
 */
export type PeriodPreset = 'year' | '7d' | '30d' | '90d' | 'custom';