import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, scan_count")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    plan: profile?.plan ?? "free",
    scan_count: profile?.scan_count ?? 0,
    limit: profile?.plan === "paid" ? null : 20,
  });
}
