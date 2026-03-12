import { queryMySQL } from "@/lib/mysql/client";
import { getProductMappings } from "./productRepository";
import type { OrderSummaryRow, UnorderedAccountRow } from "@/types";

// ─── 헬퍼: product mapping → SQL CASE 표현식 ───

function buildWebCaseExpr(webIds: string[], alias: string = "od"): string {
  if (webIds.length === 0) return "0";
  return `CAST(SUM(CASE WHEN ${alias}.product_id IN (${webIds.join(",")}) THEN ${alias}.quantity ELSE 0 END) AS SIGNED)`;
}

function buildAppCaseExpr(appIds: string[]): string {
  if (appIds.length === 0) return "0";
  const parts = appIds.map(
    (id) => `SUM(CASE WHEN sm2.product_id = '${id}' THEN 1 ELSE 0 END)`
  );
  return `CAST(${parts.join(" + ")} AS SIGNED)`;
}

// ─── 주문 고객사 조회 ───

export async function getOrderSummary(
  date: string,
  productId: number
): Promise<OrderSummaryRow[]> {
  const mappings = await getProductMappings(productId);

  if (mappings.length === 0) {
    throw new Error("No product ID mappings found");
  }

  const webIds = mappings.filter((m) => m.channel === "web").map((m) => m.external_id);
  const appIds = mappings.filter((m) => m.channel === "app").map((m) => m.external_id);

  const webCaseExpr = buildWebCaseExpr(webIds);
  const appCaseExpr = buildAppCaseExpr(appIds);
  const webCaseExprTrial = buildWebCaseExpr(webIds, "od2");
  const refProductCaseExpr = buildWebCaseExpr(webIds, "rod");

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
    ),
    all_ordered AS (
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
    ),
    ref_orders AS (
        SELECT
            o.account_id,
            o.delivery_date,
            DAYOFWEEK(o.delivery_date) AS dow,
            CAST(SUM(rod.quantity) AS SIGNED) AS daily_qty,
            ${refProductCaseExpr} AS product_qty
        FROM orders o
        JOIN \`order-details\` rod ON rod.order_id = o.id
        WHERE o.deleted_at IS NULL
          AND rod.deleted_at IS NULL
          AND o.delivery_date >= '2025-09-01'
          AND o.delivery_date < ?
          AND o.account_id IN (
              SELECT account_id FROM all_ordered WHERE 조건충족여부 = '조건불충족'
          )
        GROUP BY o.account_id, o.delivery_date
    ),
    ref_overall AS (
        SELECT account_id,
               ROUND(AVG(daily_qty),1) AS ref_전체_평균,
               ROUND(AVG(product_qty),1) AS ref_상품_전체_평균
        FROM ref_orders
        GROUP BY account_id
    ),
    ref_overall_ranked AS (
        SELECT account_id, daily_qty, product_qty,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY daily_qty) AS rn_total,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY product_qty) AS rn_product,
               COUNT(*) OVER (PARTITION BY account_id) AS cnt
        FROM ref_orders
    ),
    ref_overall_median AS (
        SELECT account_id, ROUND(AVG(daily_qty),1) AS ref_전체_중간값
        FROM ref_overall_ranked
        WHERE rn_total IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    ),
    ref_overall_median_product AS (
        SELECT account_id, ROUND(AVG(product_qty),1) AS ref_상품_전체_중간값
        FROM ref_overall_ranked
        WHERE rn_product IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    ),
    ref_dow AS (
        SELECT account_id,
               ROUND(AVG(daily_qty),1) AS ref_요일별_평균,
               ROUND(AVG(product_qty),1) AS ref_상품_요일별_평균
        FROM ref_orders
        WHERE dow = DAYOFWEEK(?)
        GROUP BY account_id
    ),
    ref_dow_ranked AS (
        SELECT account_id, daily_qty, product_qty,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY daily_qty) AS rn_total,
               ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY product_qty) AS rn_product,
               COUNT(*) OVER (PARTITION BY account_id) AS cnt
        FROM ref_orders
        WHERE dow = DAYOFWEEK(?)
    ),
    ref_dow_median AS (
        SELECT account_id, ROUND(AVG(daily_qty),1) AS ref_요일별_중간값
        FROM ref_dow_ranked
        WHERE rn_total IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    ),
    ref_dow_median_product AS (
        SELECT account_id, ROUND(AVG(product_qty),1) AS ref_상품_요일별_중간값
        FROM ref_dow_ranked
        WHERE rn_product IN (FLOOR((cnt+1)/2), CEIL((cnt+1)/2))
        GROUP BY account_id
    )
    SELECT
        ao.account_id,
        ao.고객사명,
        ao.주문채널,
        ao.조건충족여부,
        ao.상품수량,
        ao.총주문수량,
        COALESCE(ro.ref_전체_평균, 0)            AS ref_전체_평균,
        COALESCE(rom.ref_전체_중간값, 0)         AS ref_전체_중간값,
        COALESCE(ro.ref_상품_전체_평균, 0)       AS ref_상품_전체_평균,
        COALESCE(romp.ref_상품_전체_중간값, 0)   AS ref_상품_전체_중간값,
        COALESCE(rd.ref_요일별_평균, 0)          AS ref_요일별_평균,
        COALESCE(rdm.ref_요일별_중간값, 0)       AS ref_요일별_중간값,
        COALESCE(rd.ref_상품_요일별_평균, 0)     AS ref_상품_요일별_평균,
        COALESCE(rdmp.ref_상품_요일별_중간값, 0) AS ref_상품_요일별_중간값
    FROM all_ordered ao
    LEFT JOIN ref_overall ro                   ON ro.account_id = ao.account_id
    LEFT JOIN ref_overall_median rom           ON rom.account_id = ao.account_id
    LEFT JOIN ref_overall_median_product romp  ON romp.account_id = ao.account_id
    LEFT JOIN ref_dow rd                       ON rd.account_id = ao.account_id
    LEFT JOIN ref_dow_median rdm               ON rdm.account_id = ao.account_id
    LEFT JOIN ref_dow_median_product rdmp      ON rdmp.account_id = ao.account_id
    ORDER BY
      CASE ao.조건충족여부 WHEN '조건충족' THEN 0 ELSE 1 END,
      ao.주문채널,
      ao.고객사명
  `;

  const rows = await queryMySQL(sql, [
    date, date, date, date,
    date,
    date, date,
  ]);

  return (rows as Record<string, unknown>[]).map((row) => ({
    ...row,
    상품수량: Number(row["상품수량"]) || 0,
    총주문수량: Number(row["총주문수량"]) || 0,
    account_id: Number(row["account_id"]) || 0,
    ref_전체_평균: Number(row["ref_전체_평균"]) || 0,
    ref_전체_중간값: Number(row["ref_전체_중간값"]) || 0,
    ref_상품_전체_평균: Number(row["ref_상품_전체_평균"]) || 0,
    ref_상품_전체_중간값: Number(row["ref_상품_전체_중간값"]) || 0,
    ref_요일별_평균: Number(row["ref_요일별_평균"]) || 0,
    ref_요일별_중간값: Number(row["ref_요일별_중간값"]) || 0,
    ref_상품_요일별_평균: Number(row["ref_상품_요일별_평균"]) || 0,
    ref_상품_요일별_중간값: Number(row["ref_상품_요일별_중간값"]) || 0,
  })) as OrderSummaryRow[];
}

// ─── 미주문 고객사 조회 ───

export async function getUnorderedAccounts(
  date: string,
  productId: number
): Promise<UnorderedAccountRow[]> {
  const mappings = await getProductMappings(productId);

  const webIds = (mappings || [])
    .filter((m) => m.channel === "web")
    .map((m) => m.external_id);

  const productCaseExpr = buildWebCaseExpr(webIds);

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

  const rows = await queryMySQL(sql, [
    date, date, date,
    date, date, date,
    date, date,
  ]);

  return (rows as Record<string, unknown>[]).map((row) => ({
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
  })) as UnorderedAccountRow[];
}