import { NextResponse } from "next/server";
import { resolveBearerToken } from "@/lib/auth-token";
import { createServiceClient } from "@/lib/supabase/service";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const userId = await resolveBearerToken(request);
  if (!userId) return withCors(NextResponse.json({ error: "unauthorized" }, { status: 401 }));

  const supabase = createServiceClient();

  const { data: memberships } = await supabase
    .from("list_members")
    .select("list_id")
    .eq("user_id", userId)
    .eq("status", "accepted");

  const memberListIds = (memberships ?? []).map((m) => m.list_id);

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, occasion")
    .or(
      [`owner_id.eq.${userId}`, memberListIds.length ? `id.in.(${memberListIds.join(",")})` : null]
        .filter(Boolean)
        .join(",")
    );

  return withCors(NextResponse.json({ lists: lists ?? [] }));
}
