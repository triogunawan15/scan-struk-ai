import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { store_name, transaction_date, total, category, items } = body;

  const admin = createAdminClient();
  const { error } = await admin.from("receipts").insert({
    user_id: user.id,
    store_name,
    transaction_date: transaction_date || null,
    total,
    category,
    items,
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
