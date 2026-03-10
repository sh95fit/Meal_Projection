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

  if (!mappings || mappings.length === 0) {
    return NextResponse.json(
      { error: "No product ID mappings found" },
      { status: 404 }
    );
  }

  const webIds = mappings
    .filter((m) => m.channel === "web")
    .map((m) => m.external_id);
  const appIds = mappings
    .filter((m) => m.channel === "app")
    .map((m) => m.external_id);

  // ★ CAST AS SIGNED 로 감싸서 숫자 타입 보장
  const webCaseExpr =
    webIds.length > 0
      ? `CAST(SUM(CASE WHEN od.product_id IN (${webIds.join(",")}) THEN od.quantity ELSE 0 END) AS SIGNED)`
      : "0";

  const appCaseExprs = appIds.map(
    (id) =>
      `SUM(CASE WHEN sm2.product_id = '${id}' THEN 1 ELSE 0 END)`
  );
  const appCaseExpr =
    appCaseExprs.length > 0
      ? `CAST(${appCaseExprs.join(" + ")} AS SIGNED)`
      : "0";

  // trial_orders 내부에서도 od → od2 alias 를 쓰므로 별도 생성
  const webCaseExprTrial =
    webIds.length > 0
      ? `CAST(SUM(CASE WHEN od2.product_id IN (${webIds.join(",")}) THEN od2.quantity ELSE 0 END) AS SIGNED)`
      : "0";

  const sql = `
    WITH
    trial_orders AS (
        SELECT a.id AS account_id,
               a.name AS account_name,
               a.status AS account_status,
               ${webCaseExprTrial} AS 상품수량,
               CAST(SUM(od2.quantity) AS SIGNED) AS 총주문수량
        FROM trial_schedules ts
        JOIN trial_schedule_orders tso ON tso.trial_schedule_id = ts.id
        JOIN lead_applications la ON la.id = ts.lead_application_id
        JOIN orders o ON o.id = tso.order_id
        JOIN \`order-details\` od2 ON od2.order_id = o.id
        LEFT JOIN accounts a ON la.account_id = a.id
        WHERE ts.trial_at >= '2025-09-01'
          AND ts.trial_at = ?
          AND ts.deleted_at IS NULL
          AND tso.deleted_at IS NULL
          AND od2.deleted_at IS NULL
          AND o.deleted_at IS NULL
        GROUP BY a.id, a.name, a.status
    ),
    trial_order_ids_considering AS (
        SELECT DISTINCT tso.order_id
        FROM trial_schedules ts
        JOIN trial_schedule_orders tso ON tso.trial_schedule_id = ts.id
        JOIN lead_applications la ON la.id = ts.lead_application_id
        LEFT JOIN accounts a ON la.account_id = a.id
        WHERE ts.trial_at >= '2025-09-01'
          AND ts.trial_at = ?
          AND ts.deleted_at IS NULL
          AND tso.deleted_at IS NULL
          AND (a.status = 'considering' OR a.status IS NULL)
    ),
    web_orders AS (
        SELECT a.id AS account_id,
               a.name AS account_name,
               ${webCaseExpr} AS 상품수량,
               CAST(SUM(od.quantity) AS SIGNED) AS 총주문수량
        FROM orders o
        JOIN \`order-details\` od ON od.order_id = o.id
        JOIN accounts a ON a.id = o.account_id
        WHERE o.delivery_date >= '2025-09-01'
          AND o.delivery_date = ?
          AND o.deleted_at IS NULL
          AND od.deleted_at IS NULL
          AND o.id NOT IN (SELECT order_id FROM trial_order_ids_considering)
        GROUP BY a.id, a.name
    ),
    app_orders AS (
        SELECT a.id AS account_id,
               a.name AS account_name,
               a.min_order_quantity,
               ${appCaseExpr} AS 상품수량,
               CAST(COUNT(*) AS SIGNED) AS 총주문수량
        FROM selected_menus sm
        JOIN scheduled_menus sm2 ON sm.scheduled_menu_id = sm2.id
        JOIN schedules s ON s.id = sm.schedule_id
        JOIN order_profiles op ON op.id = sm.order_profile_id
        JOIN accounts a ON a.record_id = op.company_id
        WHERE a.status = 'available'
          AND sm.is_skipped = 0
          AND s.delivery_on >= '2025-09-01'
          AND s.delivery_on = ?
        GROUP BY a.id, a.name, a.min_order_quantity
    ),
    regular_combined AS (
        SELECT w.account_id,
               w.account_name,
               CASE WHEN ap.account_id IS NOT NULL THEN '앱,웹' ELSE '웹' END AS 주문채널,
               CAST(w.상품수량 + COALESCE(ap.상품수량,0) AS SIGNED) AS 상품수량,
               CAST(w.총주문수량 + COALESCE(ap.총주문수량,0) AS SIGNED) AS 총주문수량,
               CASE WHEN ap.account_id IS NULL THEN '조건충족'
                    WHEN w.총주문수량 + COALESCE(ap.총주문수량,0) >= COALESCE(ap.min_order_quantity,0) THEN '조건충족'
                    ELSE '조건불충족' END AS 조건충족여부
        FROM web_orders w
        LEFT JOIN app_orders ap ON w.account_id = ap.account_id
        UNION ALL
        SELECT ap.account_id,
               ap.account_name,
               '앱' AS 주문채널,
               CAST(ap.상품수량 AS SIGNED) AS 상품수량,
               CAST(ap.총주문수량 AS SIGNED) AS 총주문수량,
               CASE WHEN ap.총주문수량 >= COALESCE(ap.min_order_quantity,0) THEN '조건충족' ELSE '조건불충족' END AS 조건충족여부
        FROM app_orders ap
        LEFT JOIN web_orders w ON w.account_id = ap.account_id
        WHERE w.account_id IS NULL
    )
    SELECT account_id, account_name AS 고객사명, 주문채널, 조건충족여부,
           CAST(상품수량 AS SIGNED) AS 상품수량,
           CAST(총주문수량 AS SIGNED) AS 총주문수량
    FROM regular_combined
    UNION ALL
    SELECT t.account_id, t.account_name, '체험', '조건충족',
           CAST(t.상품수량 AS SIGNED),
           CAST(t.총주문수량 AS SIGNED)
    FROM trial_orders t
    WHERE t.account_status = 'considering'
    ORDER BY 주문채널, 고객사명
  `;

  try {
    const rows = await queryMySQL(sql, [date, date, date, date]);

    // ★ JS 쪽에서도 숫자 변환 보장 (이중 안전장치)
    const parsed = (rows as Record<string, unknown>[]).map((row) => ({
      ...row,
      상품수량: Number(row["상품수량"]) || 0,
      총주문수량: Number(row["총주문수량"]) || 0,
      account_id: Number(row["account_id"]) || 0,
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
