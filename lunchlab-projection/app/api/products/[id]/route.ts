// ──────────────────────────────────────────────────────────────────
// app/api/products/[id]/route.ts
// 상품 개별 조회 / 수정 / 삭제
// ──────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import {
  getProductById,
  updateProduct,
  deleteProduct,
} from "@/lib/repositories/productRepository";

interface RouteParams {
  params: { id: string };
}

/** GET /api/products/:id */
export async function GET(_: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const product = await getProductById(Number(params.id));
    return NextResponse.json(product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/products/:id */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const body = await request.json();

    const product = await updateProduct(Number(params.id), {
      product_name: body.product_name,
      offset_days: body.offset_days,
      notification_group: body.notification_group,
      color: body.color,
    });

    return NextResponse.json(product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    if (message.includes("유효한 hex") || message.includes("수정할 항목")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/products/:id */
export async function DELETE(_: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const product = await deleteProduct(Number(params.id));
    return NextResponse.json(product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
