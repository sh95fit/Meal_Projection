// app/api/products/route.ts
// ──────────────────────────────────────────────────────────────────
// 상품 목록 조회 / 신규 등록
// ──────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getAllProductsWithMappings, createProduct } from "@/lib/repositories/productRepository";

/** GET /api/products */
export async function GET() {
  try {
    await requireAuth();
    const products = await getAllProductsWithMappings();
    return NextResponse.json(products);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/products */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    if (!body.product_name || typeof body.product_name !== "string") {
      return NextResponse.json(
        { error: "product_name은 필수입니다." },
        { status: 400 }
      );
    }

    const product = await createProduct({
      product_name: body.product_name,
      offset_days: body.offset_days,
      saturday_available: body.saturday_available,  // ★ 추가
      notification_group: body.notification_group,
      color: body.color,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}