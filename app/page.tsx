"use client";

import { useCallback, useEffect, useState } from "react";
import SearchForm, { CollectParams } from "@/components/SearchForm";
import LeadTable from "@/components/LeadTable";
import StatsBar from "@/components/StatsBar";
import { INDUSTRIES } from "@/lib/industries";
import type { Lead, StatsResult } from "@/lib/types";

interface Filters {
  website: string; // "", "with", "without"
  hasPhone: boolean;
  hasEmail: boolean;
  industry: string;
  city: string;
  ratingMin: string;
  qualityMin: string;
}

const EMPTY_FILTERS: Filters = {
  website: "",
  hasPhone: false,
  hasEmail: false,
  industry: "",
  city: "",
  ratingMin: "",
  qualityMin: "",
};

function buildQuery(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.website) sp.set("website", f.website);
  if (f.hasPhone) sp.set("hasPhone", "true");
  if (f.hasEmail) sp.set("hasEmail", "true");
  if (f.industry) sp.set("industry", f.industry);
  if (f.city) sp.set("city", f.city);
  if (f.ratingMin) sp.set("ratingMin", f.ratingMin);
  if (f.qualityMin) sp.set("qualityMin", f.qualityMin);
  return sp.toString();
}

export default function Home() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }));

  const loadLeads = useCallback(async (f: Filters) => {
    setError(null);
    const res = await fetch(`/api/leads?${buildQuery(f)}&limit=200`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Грешка при зареждане.");
      return;
    }
    setLeads(data.leads);
    setTotal(data.total);
  }, []);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    loadLeads(EMPTY_FILTERS).catch(() => {});
    loadStats().catch(() => {});
  }, [loadLeads, loadStats]);

  async function collect(p: CollectParams) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Грешка при събиране.");
      } else {
        setMessage(
          `Намерени ${data.collected}: ${data.added} нови, ${data.updated} обновени. Общо в базата: ${data.total}.`
        );
        await Promise.all([loadLeads(filters), loadStats()]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мрежова грешка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">OSINT Lead Tool</h1>
        <p className="text-sm text-slate-500">
          Намиране на бизнеси от OpenStreetMap и Google Places, филтриране и експорт.
        </p>
      </header>

      <section className="mb-4">
        <SearchForm onCollect={collect} busy={busy} />
      </section>

      {message && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="mb-6">
        <StatsBar stats={stats} />
      </section>

      <section className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Сайт</label>
          <select
            className="rounded border border-slate-300 px-2 py-1.5"
            value={filters.website}
            onChange={(e) => set("website", e.target.value)}
          >
            <option value="">всички</option>
            <option value="without">без сайт</option>
            <option value="with">със сайт</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Индустрия</label>
          <select
            className="rounded border border-slate-300 px-2 py-1.5"
            value={filters.industry}
            onChange={(e) => set("industry", e.target.value)}
          >
            <option value="">всички</option>
            {INDUSTRIES.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Град</label>
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1.5"
            value={filters.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Рейтинг мин</label>
          <input
            type="number"
            step="0.1"
            className="w-24 rounded border border-slate-300 px-2 py-1.5"
            value={filters.ratingMin}
            onChange={(e) => set("ratingMin", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Качество мин</label>
          <input
            type="number"
            className="w-24 rounded border border-slate-300 px-2 py-1.5"
            value={filters.qualityMin}
            onChange={(e) => set("qualityMin", e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.hasPhone}
            onChange={(e) => set("hasPhone", e.target.checked)}
          />
          има телефон
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.hasEmail}
            onChange={(e) => set("hasEmail", e.target.checked)}
          />
          има имейл
        </label>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => loadLeads(filters)}
            className="h-9 rounded bg-slate-800 px-4 font-medium text-white hover:bg-slate-900"
          >
            Приложи филтри
          </button>
          <a
            href={`/api/export?${buildQuery(filters)}`}
            className="flex h-9 items-center rounded border border-slate-300 bg-white px-4 font-medium hover:bg-slate-50"
          >
            Свали CSV
          </a>
        </div>
      </section>

      <div className="mb-2 text-sm text-slate-500">
        Показани {leads.length} от {total} съвпадащи.
      </div>
      <LeadTable leads={leads} />
    </main>
  );
}
