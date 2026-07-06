"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

import { useEffect } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [from, setFrom] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("from");
    if (fromParam) setFrom(fromParam);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        setError("Грешна парола. Опитай отново.");
      }
    } catch {
      setError("Грешка при вход.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow">
        <h1 className="mb-1 text-2xl font-bold">OSINT Lead Tool</h1>
        <p className="mb-6 text-sm text-slate-500">Въведи паролата за достъп</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border px-3 py-2 text-lg"
              placeholder="Парола"
              autoFocus
              required
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-slate-900 py-2.5 font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {loading ? "Влизам..." : "Вход"}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] text-slate-400">
          Защитен с парола. Само за вътрешно ползване.
        </p>
      </div>
    </div>
  );
}
