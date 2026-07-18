import { NextResponse } from "next/server";
import { resolveBearerToken } from "@/lib/auth-token";
import { createServiceClient } from "@/lib/supabase/service";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const userId = await resolveBearerToken(request);
  if (!userId) return withCors(NextResponse.json({ error: "unauthorized" }, { status: 401 }));

  const body = await request.json();
  const listId = String(body.list_id ?? "");
  const productUrl = String(body.product_url ?? "").trim();
  const title = body.title ? String(body.title).trim() : null;
  if (!listId || !productUrl) {
    return withCors(
      NextResponse.json({ error: "list_id and product_url are required" }, { status: 400 })
    );
  }

  const supabase = createServiceClient();

  // Service-role bypasses RLS, so membership has to be checked by hand here --
  // this mirrors the is_list_member() rule from the migration.
  const { data: list } = await supabase.from("lists").select("owner_id").eq("id", listId).single();
  if (!list) return withCors(NextResponse.json({ error: "list not found" }, { status: 404 }));

  const isOwner = list.owner_id === userId;
  let isMember = isOwner;
  if (!isMember) {
    const { data: membership } = await supabase
      .from("list_members")
      .select("id")
      .eq("list_id", listId)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .maybeSingle();
    isMember = Boolean(membership);
  }
  if (!isMember) return withCors(NextResponse.json({ error: "forbidden" }, { status: 403 }));

  let retailer: string | null = null;
  try {
    retailer = new URL(productUrl).hostname.replace(/^www\./, "");
  } catch {
    // leave retailer null if the URL doesn't parse
  }

  const { data: item, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, added_by: userId, product_url: productUrl, title, retailer })
    .select("id")
    .single();

  if (error) return withCors(NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(NextResponse.json({ item }, { status: 201 }));
}
