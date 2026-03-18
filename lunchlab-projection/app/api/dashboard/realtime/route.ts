// ──────────────────────────────────────────────────────────────────
// app/api/dashboard/realtime/route.ts
// 실시간 현황 API
// ──────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getRealtimeData } from "@/lib/repositories/dashboardQueryRepository";

/**
 * GET /api/dashboard/realtime
 *
 * 쿼리 파라미터:
 *   - date (optional) : 조회 기준일 "YYYY-MM-DD". 기본값: 오늘.
 *
 * 응답 (200):
 *   RealtimeResponse {
 *     targetDate: string,
 *     minutesUntilCutoff: number,
 *     appOrdersMerged: boolean,
 *     products: RealtimeProduct[]
 *   }
 *
 * 에러:
 *   - 401: 인증 실패 (Supabase 세션 없음)
 *   - 500: 서버 에러 (DB 조회 실패 등)
 */
export async function GET(request: NextRequest) {
  try {
    // ── 인증 확인 ──
    // requireAuth()는 Supabase Auth로 현재 유저를 확인합니다.
    // 유효한 세션이 없으면 Error("Unauthorized")를 throw하여
    // 아래 catch 블록에서 401을 반환합니다.
    await requireAuth();

    // ── 파라미터 파싱 ──
    // date가 없으면 getRealtimeData 내부에서 getToday()를 사용합니다.
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;

    // ── 데이터 조회 ──
    // getRealtimeData 내부에서:
    //   1) getOrdersByDate(today) → needsAppMenuMerge() 분기 로직 실행
    //   2) getOrdersByDate(yesterday) → 전일 비교
    //   3) Supabase order_forecasts에서 예측값 조회
    //   4) 상품별 집계 → RealtimeProduct[] 생성
    const result = await getRealtimeData(date);

    return NextResponse.json(result);
  } catch (err: unknown) {
    // ── 에러 처리 ──
    // requireAuth() 실패 시 "Unauthorized" 메시지로 401 반환
    // 그 외 모든 에러는 500으로 처리
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}