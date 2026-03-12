// ====== MySQL 쿼리 결과 (외부 주문 DB) ======

export interface OrderSummaryRow {
  account_id: number;
  고객사명: string;
  주문채널: string;
  조건충족여부: string;
  상품수량: number;
  총주문수량: number;
  // 조건불충족 고객사 기준 데이터 (조건충족 고객사는 모두 0)
  ref_전체_평균: number;
  ref_전체_중간값: number;
  ref_상품_전체_평균: number;
  ref_상품_전체_중간값: number;
  ref_요일별_평균: number;
  ref_요일별_중간값: number;
  ref_상품_요일별_평균: number;
  ref_상품_요일별_중간값: number;
}

export interface UnorderedAccountRow {
  account_id: number;
  고객사명: string;
  주문요일: string;
  주문요일_해당여부: string;
  전체_평균: number;
  전체_중간값: number;
  상품_전체_평균: number;
  상품_전체_중간값: number;
  요일별_평균: number;
  요일별_중간값: number;
  상품_요일별_평균: number;
  상품_요일별_중간값: number;
  해당요일_최근주문일자: string | null;
  해당요일_주문횟수: number;
}
