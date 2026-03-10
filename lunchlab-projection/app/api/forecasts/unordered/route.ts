import { NextRequest, NextResponse } from "next/server";
import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const productId = searchParams.get("productId");

  if (!date || !productId) {
    return NextResponse.json(
      { error: "date and productId are required" },
      { status: 400 }
    );
  }

  const { data: mappings } = await supabase
    .from("product_id_mappings")
    .select("*")
    .eq("product_id", parseInt(productId));

  const webIds = (mappings || [])
    .filter((m) => m.channel === "web")
    .map((m) => m.external_id);

  const productCaseExpr =
    webIds.length > 0
      ? `CAST(SUM(CASE WHEN od.product_id IN (${webIds.join(",")}) THEN od.quantity ELSE 0 END) AS SIGNED)`
      : "0";

  const sql = `
    WITH
    ordered_accounts AS (
        SELECT DISTINCT o.account_id
        FROM orders o
        WHERE o.delivery_date = ?
          AND o.deleted_at IS NULL
        UNION
        SELECT DISTINCT a.id
        FROM selected_menus sm
        JOIN scheduled_menus sm2 ON sm.scheduled_menu_id = sm2.id
        JOIN schedules s ON s.id = sm.schedule_id
        JOIN order_profiles op ON op.id = sm.order_profile_id
        JOIN accounts a ON a.record_id = op.company_id
        WHERE sm.is_skipped = 0
          AND s.delivery_on = ?
    ),
    unordered_accounts AS (
        SELECT a.id AS account_id, a.name, a.order_day
        FROM accounts a
        WHERE a.status = 'available'
          AND a.id NOT IN (SELECT account_id FROM ordered_accounts)
    ),
    daily_orders AS (
        SELECT
            o.account_id,
            o.delivery_date,
            DAYOFWEEK(o.delivery_date) AS dow,
            CAST(SUM(od.quantity) AS SIGNED) AS daily_qty,
            ${productCaseExpr} AS product_qty
        FROM orders o
        JOIN \`order-details\` od ON od.order_id = o.id
        WHERE o.deleted_at IS NULL
          AND od.deleted_at IS NULL
          AND o.delivery_date >= '2025-09-01'
          AND o.delivery_date < ?
          AND o.account_id IN (SELECT account_id FROM unordered_accounts)
        GROUP BY o.account_id, o.delivery_date
    ),
    overall_stats AS (
        SELECT
            account_id,
            ROUND(AVG(daily_qty),1) AS 전체_평균,
            ROUND(AVG(product_qty),1) AS 상품_전체_평균
        FROM daily_orders
        GROUP BY account_id
    ),
    overall_ranked AS (
        SELECT account_id, daily_qty, product_qty,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY daily_qty) AS rn_total,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY product_qty) AS rn_product,
               COUNT(*) OVER (PARTITION BY account_id) AS cnt
        FROM daily_orders
    ),
    overall_median AS (
        SELECT account_id, ROUND(AVG(daily_qty),1) AS 전체_중간값
        FROM overall_ranked
        WHERE rn_total IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    ),
    overall_median_product AS (
        SELECT account_id, ROUND(AVG(product_qty),1) AS 상품_전체_중간값
        FROM overall_ranked
        WHERE rn_product IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    ),
    dow_stats AS (
        SELECT
            account_id,
            ROUND(AVG(daily_qty),1) AS 요일별_평균,
            ROUND(AVG(product_qty),1) AS 상품_요일별_평균
        FROM daily_orders
        WHERE dow = DAYOFWEEK(?)
        GROUP BY account_id
    ),
    dow_summary AS (
        SELECT account_id,
               MAX(delivery_date) AS 해당요일_최근주문일자,
               COUNT(*) AS 해당요일_주문횟수
        FROM daily_orders
        WHERE dow = DAYOFWEEK(?)
        GROUP BY account_id
    ),
    dow_ranked AS (
        SELECT account_id, daily_qty, product_qty,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY daily_qty) AS rn_total,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY product_qty) AS rn_product,
               COUNT(*) OVER (PARTITION BY account_id) AS cnt
        FROM daily_orders
        WHERE dow = DAYOFWEEK(?)
    ),
    dow_median AS (
        SELECT account_id, ROUND(AVG(daily_qty),1) AS 요일별_중간값
        FROM dow_ranked
        WHERE rn_total IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    ),
    dow_median_product AS (
        SELECT account_id, ROUND(AVG(product_qty),1) AS 상품_요일별_중간값
        FROM dow_ranked
        WHERE rn_product IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    )
    SELECT
        ua.account_id,
        ua.name AS 고객사명,
        ua.order_day AS 주문요일,
        CASE WHEN ua.order_day LIKE CONCAT('%', ELT(DAYOFWEEK(?), 'sun','mon','tue','wed','thu','fri','sat'), '%')
             THEN '포함' ELSE '미포함' END AS 주문요일_해당여부,
        COALESCE(os.전체_평균,0) AS 전체_평균,
        COALESCE(om.전체_중간값,0) AS 전체_중간값,
        COALESCE(os.상품_전체_평균,0) AS 상품_전체_평균,
        COALESCE(omp.상품_전체_중간값,0) AS 상품_전체_중간값,
        COALESCE(ds.요일별_평균,0) AS 요일별_평균,
        COALESCE(dm.요일별_중간값,0) AS 요일별_중간값,
        COALESCE(ds.상품_요일별_평균,0) AS 상품_요일별_평균,
        COALESCE(dmp.상품_요일별_중간값,0) AS 상품_요일별_중간값,
        dws.해당요일_최근주문일자,
        COALESCE(dws.해당요일_주문횟수,0) AS 해당요일_주문횟수
    FROM unordered_accounts ua
    LEFT JOIN overall_stats os ON os.account_id = ua.account_id
    LEFT JOIN overall_median om ON om.account_id = ua.account_id
    LEFT JOIN overall_median_product omp ON omp.account_id = ua.account_id
    LEFT JOIN dow_stats ds ON ds.account_id = ua.account_id
    LEFT JOIN dow_summary dws ON dws.account_id = ua.account_id
    LEFT JOIN dow_median dm ON dm.account_id = ua.account_id
    LEFT JOIN dow_median_product dmp ON dmp.account_id = ua.account_id
    ORDER BY
      CASE WHEN ua.order_day LIKE CONCAT('%', ELT(DAYOFWEEK(?), 'sun','mon','tue','wed','thu','fri','sat'), '%')
           THEN 0 ELSE 1 END ASC,
      dws.해당요일_최근주문일자 DESC,
      ua.name ASC
  `;

  try {
    const rows = await queryMySQL(sql, [
      date, date, date,
      date, date, date,
      date, date,
    ]);

    // ★ JS 쪽에서 숫자 변환 보장
    const parsed = (rows as Record<string, unknown>[]).map((row) => ({
      ...row,
      account_id: Number(row["account_id"]) || 0,
      전체_평균: Number(row["전체_평균"]) || 0,
      전체_중간값: Number(row["전체_중간값"]) || 0,
      상품_전체_평균: Number(row["상품_전체_평균"]) || 0,
      상품_전체_중간값: Number(row["상품_전체_중간값"]) || 0,
      요일별_평균: Number(row["요일별_평균"]) || 0,
      요일별_중간값: Number(row["요일별_중간값"]) || 0,
      상품_요일별_평균: Number(row["상품_요일별_평균"]) || 0,
      상품_요일별_중간값: Number(row["상품_요일별_중간값"]) || 0,
      해당요일_주문횟수: Number(row["해당요일_주문횟수"]) || 0,
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("MySQL query error:", error);
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 }
    );
  }
}

