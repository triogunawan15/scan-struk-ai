"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type ScanResult = {
  store_name: string;
  transaction_date: string | null;
  total: number;
  category: string;
  items: { name: string; qty: number; price: number }[];
  confidence: string;
};

export default function Home() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [usage, setUsage] = useState<{ plan: string; scan_count: number; limit: number | null } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    refreshUsage();
  }, []);

  async function refreshUsage() {
    const res = await fetch("/api/usage");
    if (res.ok) setUsage(await res.json());
  }

  async function sendOtp() {
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setOtpSent(true);
  }

  async function verifyOtp() {
    setError("");
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "email",
    });
    setVerifying(false);
    if (error) setError(error.message);
    else {
      setLoggedIn(true);
      refreshUsage();
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || data.error || "Terjadi kesalahan.");
        } else {
          setResult(data.result);
          setUsage(data.usage);
        }
      } catch (err) {
        setError("Gagal terhubung ke server.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!result) return;
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (res.ok) setSaved(true);
    else setError("Gagal menyimpan ke pembukuan.");
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold">Masuk ke Scan Struk AI</h1>
          {!otpSent ? (
            <>
              <input
                type="email"
                placeholder="Email kamu"
                className="w-full border rounded-lg p-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button onClick={sendOtp} className="w-full bg-indigo-600 text-white rounded-lg p-3 font-medium">
                Kirim Kode Login
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Kode 6 digit sudah dikirim ke {email}. Buka email kamu, cari kodenya, lalu masukkan di bawah ini.
              </p>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Masukkan kode 6 digit"
                className="w-full border rounded-lg p-3 tracking-widest text-center text-lg"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
              />
              <button
                onClick={verifyOtp}
                disabled={verifying}
                className="w-full bg-indigo-600 text-white rounded-lg p-3 font-medium disabled:opacity-50"
              >
                {verifying ? "Memverifikasi..." : "Masuk"}
              </button>
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Scan Struk AI</h1>
        {usage && (
          <span className="text-xs text-gray-500">
            {usage.plan === "paid" ? "Bisnis · tanpa batas" : `${usage.scan_count}/${usage.limit} scan bulan ini`}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="w-full bg-indigo-600 text-white rounded-2xl p-6 text-center font-medium shadow disabled:opacity-50"
      >
        {loading ? "AI sedang membaca struk..." : "📷 Foto Struk"}
      </button>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3">
          {error}
          {error.toLowerCase().includes("upgrade") && (
            <div className="mt-2 font-medium">Upgrade ke paket Bisnis untuk lanjut scan tanpa batas.</div>
          )}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-medium">Cek hasil bacaan AI</h2>
            {result.confidence !== "tinggi" && (
              <span className="text-xs bg-yellow-100 text-yellow-800 rounded-full px-2 py-0.5">
                Yakin: {result.confidence}
              </span>
            )}
          </div>

          <label className="block text-sm">
            Nama Toko
            <input
              className="w-full border rounded-lg p-2 mt-1"
              value={result.store_name || ""}
              onChange={(e) => setResult({ ...result, store_name: e.target.value })}
            />
          </label>

          <label className="block text-sm">
            Tanggal
            <input
              type="date"
              className="w-full border rounded-lg p-2 mt-1"
              value={result.transaction_date || ""}
              onChange={(e) => setResult({ ...result, transaction_date: e.target.value })}
            />
          </label>

          <label className="block text-sm">
            Total
            <input
              type="number"
              className="w-full border rounded-lg p-2 mt-1"
              value={result.total || 0}
              onChange={(e) => setResult({ ...result, total: Number(e.target.value) })}
            />
          </label>

          <label className="block text-sm">
            Kategori
            <select
              className="w-full border rounded-lg p-2 mt-1"
              value={result.category}
              onChange={(e) => setResult({ ...result, category: e.target.value })}
            >
              {["Makanan & Minuman", "Transportasi", "Bahan Baku", "Operasional", "Belanja Toko", "Lainnya"].map(
                (c) => (
                  <option key={c}>{c}</option>
                )
              )}
            </select>
          </label>

          {saved ? (
            <div className="text-center text-green-600 font-medium py-2">✓ Tersimpan ke pembukuan</div>
          ) : (
            <button onClick={handleSave} className="w-full bg-green-600 text-white rounded-lg p-3 font-medium">
              Simpan ke Pembukuan
            </button>
          )}
        </div>
      )}
    </main>
  );
}