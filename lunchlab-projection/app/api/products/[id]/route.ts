import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PUT /api/products/:id — 상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const { product_name, offset_days, notification_group, mappings } = body;

  // 상품 업데이트
  const { error: productError } = await supabase
    .from("products")
    .update({ product_name, offset_days, notification_group, updated_at: new Date().toISOString() })
    .eq("id", parseInt(id));

  if (productError) {
    return NextResponse.json(
      { error: productError.message },
      { status: 500 }
    );
  }

  // 기존 매핑 삭제 후 재등록
  if (mappings) {
    await supabase
      .from("product_id_mappings")
      .delete()
      .eq("product_id", parseInt(id));

    if (mappings.length > 0) {
      const mappingRows = mappings.map(
        (m: { channel: string; external_id: string }) => ({
          product_id: parseInt(id),
          channel: m.channel,
          external_id: m.external_id,
        })
      );
      await supabase.from("product_id_mappings").insert(mappingRows);
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/products/:id — 소프트 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parseInt(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
