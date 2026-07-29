import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

const FREE_LIMIT = 20;

export async function POST(req: Request) {
  // 1) Pastikan user sudah login
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Kamu belum login." }, { status: 401 });
  }

  const admin = createAdminClient();

  // 2) Ambil profil & reset hitungan kalau sudah ganti bulan
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profil user tidak ditemukan." }, { status: 500 });
  }

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${now.getMonth() + 1}-01`;
  const savedPeriod = new Date(profile.period_start);
  const isNewMonth =
    savedPeriod.getFullYear() !== now.getFullYear() || savedPeriod.getMonth() !== now.getMonth();

  let scanCount = isNewMonth ? 0 : profile.scan_count;

  // 3) Cek kuota kalau masih plan gratis
  if (profile.plan === "free" && scanCount >= FREE_LIMIT) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        message: `Jatah ${FREE_LIMIT} scan gratis bulan ini sudah habis. Upgrade ke paket Bisnis untuk scan tanpa batas.`,
      },
      { status: 403 }
    );
  }

  // 4) Ambil gambar dari request (base64)
  const body = await req.json();
  const { imageBase64, mediaType } = body as { imageBase64: string; mediaType: string };

  if (!imageBase64) {
    return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 400 });
  }

  // 5) Panggil Anthropic API (Claude Vision) -- KEY hanya ada di server, aman
  const prompt = `Kamu adalah asisten pembukuan. Baca gambar struk/nota belanja ini dan
kembalikan HANYA JSON valid (tanpa markdown, tanpa teks lain) dengan struktur persis ini:
{
  "store_name": string,
  "transaction_date": "YYYY-MM-DD" atau null kalau tidak terbaca,
  "total": number,
  "category": salah satu dari ["Makanan & Minuman","Transportasi","Bahan Baku","Operasional","Belanja Toko","Lainnya"],
  "items": [{"name": string, "qty": number, "price": number}],
  "confidence": "tinggi" | "sedang" | "rendah"
}
Kalau tulisan buram atau ada bagian yang tidak yakin, isi confidence "rendah" atau "sedang" dan tetap tebak nilai terbaik.`;

  const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("Anthropic API error:", errText);
    return NextResponse.json({ error: "Gagal memproses gambar oleh AI." }, { status: 502 });
  }

  const aiData = await aiResponse.json();
  const textBlock = aiData.content?.find((c: any) => c.type === "text")?.text ?? "{}";

  let parsed;
  try {
    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("Gagal parse JSON dari AI:", textBlock);
    return NextResponse.json({ error: "AI mengembalikan format tak terduga, coba foto ulang." }, { status: 500 });
  }

  // 6) Update kuota SEKARANG (biaya AI sudah kepakai walau user nanti batal simpan).
  // Insert ke tabel receipts baru terjadi saat user menekan "Simpan" di /api/save,
  // supaya user sempat cek/edit hasil bacaan AI dulu.
  await admin
    .from("profiles")
    .update({
      scan_count: scanCount + 1,
      period_start: isNewMonth ? currentPeriod : profile.period_start,
    })
    .eq("id", user.id);

  return NextResponse.json({
    result: parsed,
    usage: {
      plan: profile.plan,
      scan_count: scanCount + 1,
      limit: profile.plan === "free" ? FREE_LIMIT : null,
    },
  });
}
