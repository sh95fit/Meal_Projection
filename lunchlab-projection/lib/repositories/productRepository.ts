import { createClient } from "@/lib/supabase/server";
import type { ProductWithMappings } from "@/types";

export async function getProducts(): Promise<ProductWithMappings[]> {
    const supabase = await createClient();
  
    const { data, error } = await supabase
      .from("products")
      .select("*, product_id_mappings(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
  
    if (error) throw new Error(error.message);
  
    return (data ?? []).map((p) => {
      const raw = p as Record<string, unknown>;
      return {
        ...raw,
        mappings: raw.product_id_mappings || [],
        product_id_mappings: undefined,
      };
    }) as unknown as ProductWithMappings[];
  }
export async function createProduct(payload: {
  product_name: string;
  offset_days: number;
  notification_group: string | null;
  mappings?: { channel: string; external_id: string }[];
}) {
  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      product_name: payload.product_name,
      offset_days: payload.offset_days,
      notification_group: payload.notification_group,
    })
    .select()
    .single();

  if (productError) throw new Error(productError.message);

  if (payload.mappings && payload.mappings.length > 0) {
    const mappingRows = payload.mappings.map((m) => ({
      product_id: product.id,
      channel: m.channel,
      external_id: m.external_id,
    }));

    const { error: mappingError } = await supabase
      .from("product_id_mappings")
      .insert(mappingRows);

    if (mappingError) throw new Error(mappingError.message);
  }

  return product;
}

export async function updateProduct(
  id: number,
  payload: {
    product_name: string;
    offset_days: number;
    notification_group: string | null;
    mappings?: { channel: string; external_id: string }[];
  }
) {
  const supabase = await createClient();

  const { error: productError } = await supabase
    .from("products")
    .update({
      product_name: payload.product_name,
      offset_days: payload.offset_days,
      notification_group: payload.notification_group,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (productError) throw new Error(productError.message);

  if (payload.mappings) {
    await supabase.from("product_id_mappings").delete().eq("product_id", id);

    if (payload.mappings.length > 0) {
      const mappingRows = payload.mappings.map((m) => ({
        product_id: id,
        channel: m.channel,
        external_id: m.external_id,
      }));
      await supabase.from("product_id_mappings").insert(mappingRows);
    }
  }
}

export async function deleteProduct(id: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getProductMappings(productId: number) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("product_id_mappings")
    .select("*")
    .eq("product_id", productId);

  return data || [];
}