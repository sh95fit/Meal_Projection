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

/** GET /api/products/:id */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const product = await getProductById(Number(id));
    return NextResponse.json(product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/products/:id */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const product = await updateProduct(Number(id), {
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
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const product = await deleteProduct(Number(id));
    return NextResponse.json(product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
