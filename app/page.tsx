"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SearchForm, { CollectParams } from "@/components/SearchForm";
import LeadTable from "@/components/LeadTable";
import StatsBar from "@/components/StatsBar";
import { INDUSTRIES } from "@/lib/industries";
import type { Lead, StatsResult } from "@/lib/types";

interface Filters {
  source: string;
  website: string;
  industry: string;
  city: string;
  status: string;
  ratingMin: string;
  reviewsMin: string;
  qualityMin: string;
  hasPhone: boolean;
  hasEmail: boolean;
  emailVerified: boolean;
  hasSocial: boolean;
  siteOutdated: boolean;
  noSsl: boolean;
  notMobile: boolean;
  tech: string;
  sortBy: string;
  sortDir: string;
}

const EMPTY_FILTERS: Filters = {
  source: "",
  website: "",
  industry: "",
  city: "",
  status: "",
  ratingMin: "",
  reviewsMin: "",
  qualityMin: "",
  hasPhone: false,
  hasEmail: false,
  emailVerified: false,
  hasSocial: false,
  siteOutdated: false,
  noSsl: false,
  notMobile: false,
  tech: "",
  sortBy: "quality",
  sortDir: "desc",
};

const STATUSES: [string, string][] = [
  ["new", "Нов"],
  ["processed", "Обработен"],
  ["contacted", "Контактиран"],
  ["replied", "Отговорил"],
  ["customer", "Клиент"],
  ["unsubscribed", "Отписан"],
];

function buildQuery(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.source) sp.set("source", f.source);
  if (f.website) sp.set("website", f.website);
  if (f.industry) sp.set("industry", f.industry);
  if (f.city) sp.set("city", f.city);
  if (f.status) sp.set("status", f.status);
  if (f.ratingMin) sp.set("ratingMin", f.ratingMin);
  if (f.reviewsMin) sp.set("reviewsMin", f.reviewsMin);
  if (f.qualityMin) sp.set("qualityMin", f.qualityMin);
  if (f.hasPhone) sp.set("hasPhone", "true");
  if (f.hasEmail) sp.set("hasEmail", "true");
  if (f.emailVerified) sp.set("emailVerified", "true");
  if (f.hasSocial) sp.set("hasSocial", "true");
  if (f.siteOutdated) sp.set("siteOutdated", "true");
  if (f.noSsl) sp.set("noSsl", "true");
  if (f.notMobile) sp.set("notMobile", "true");
  if (f.tech) sp.set("tech", f.tech);
  if (f.sortBy) sp.set("sortBy", f.sortBy);
  if (f.sortDir) sp.set("sortDir", f.sortDir);
  return sp.toString();
}

export default function Home() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  // === xAI Outreach ===
  const [aiOffer, setAiOffer] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem("aiOffer") || "" : "")
  );
  const [aiGeneratingFor, setAiGeneratingFor] = useState<string | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<{
    leadName: string;
    subject: string;
    body: string;
  } | null>(null);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }));

  // Запазваме офертата в localStorage
  const updateAiOffer = (value: string) => {
    setAiOffer(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("aiOffer", value);
    }
  };

  const loadLeads = useCallback(async (f: Filters) => {
    setError(null);
    const res = await fetch(`/api/leads?${buildQuery(f)}&limit=300`);
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
          `Претърсени ${data.combos} комбинации. Намерени ${data.collected}: ${data.added} нови, ${data.updated} обновени. Общо в базата: ${data.total}.`
        );
        if (data.errors?.length) {
          setError(`Пропуснати комбинации: ${data.errors.join(" · ")}`);
        }
        await Promise.all([loadLeads(filters), loadStats()]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мрежова грешка.");
    } finally {
      setBusy(false);
    }
  }

  async function enrichAll() {
    setEnriching(true);
    setMessage(null);
    setError(null);
    stopRef.current = false;
    let processed = 0;
    let enriched = 0;
    try {
      while (!stopRef.current) {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 15 }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Грешка при обогатяване.");
          break;
        }
        processed += data.processed;
        enriched += data.enriched;
        setMessage(
          `Обогатяване… проверени ${processed} сайта, намерени ${enriched} имейла, остават ${data.remaining}.`
        );
        await loadStats();
        if (data.processed === 0 || data.remaining === 0) break;
      }
      await Promise.all([loadLeads(filters), loadStats()]);
      setMessage(
        `Готово. Намерени ${enriched} имейла от ${processed} проверени сайта.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мрежова грешка.");
    } finally {
      setEnriching(false);
    }
  }

  // === xAI: Генериране на персонализирано съобщение ===
  async function generateAiMessage(lead: Lead) {
    if (!aiOffer.trim()) {
      setError("Първо опиши офертата си в секцията „AI Outreach“ горе.");
      return;
    }

    setAiGeneratingFor(lead.id);
    setError(null);

    try {
      const res = await fetch("/api/ai/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          offer: aiOffer.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Грешка при генериране.");
        return;
      }

      setGeneratedMessage({
        leadName: lead.name,
        subject: data.subject,
        body: data.body,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мрежова грешка при xAI.");
    } finally {
      setAiGeneratingFor(null);
    }
  }

  function closeAiModal() {
    setGeneratedMessage(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setMessage("Копирано в клипборда ✓");
    setTimeout(() => setMessage(null), 1500);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">OSINT Lead Tool</h1>
        <p className="text-sm text-slate-500">
          Събиране на лийдове от OSM + Google Places • Обогатяване с имейли/соц/сигнали за сайта • Филтри + статус • CSV експорт.
          Перфектно за B2B услуги (сайтове, SEO, услуги) — таргетирай "без сайт" или "стар сайт".
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

      <section className="mb-4">
        <StatsBar stats={stats} />
      </section>

      {/* Обогатяване */}
      <section className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm">
          <span className="font-medium">Обогатяване с имейли</span>
          <span className="ml-2 text-slate-500">
            вади имейл + соц. профили от сайтовете и верифицира (MX). Кандидати:{" "}
            {stats?.enrichable ?? 0}.
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          {!enriching ? (
            <button
              onClick={enrichAll}
              disabled={(stats?.enrichable ?? 0) === 0}
              className="h-9 rounded bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Обогати имейли
            </button>
          ) : (
            <button
              onClick={() => (stopRef.current = true)}
              className="h-9 rounded bg-amber-600 px-4 font-medium text-white hover:bg-amber-700"
            >
              Спри
            </button>
          )}
        </div>
      </section>

      {/* xAI Outreach */}
      <section className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-violet-900">✨ AI Outreach с xAI (Grok)</span>
          <span className="text-xs text-violet-600">персонализирани съобщения за всеки лийд</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-violet-700">Твоята оферта / услуга</label>
            <input
              className="mt-1 w-full rounded border border-violet-300 bg-white px-3 py-2 text-sm placeholder:text-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="напр. Модерен уеб сайт + SEO за локални бизнеси"
              value={aiOffer}
              onChange={(e) => updateAiOffer(e.target.value)}
            />
          </div>
          <div className="text-xs text-violet-600 sm:pb-2">
            Grok ще генерира уникално съобщение, базирано на данните за бизнеса.
          </div>
        </div>
      </section>

      {/* Social OSINT Enrichment */}
      <section className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm">
          <span className="font-medium text-blue-900">Социални профили (OSINT)</span>
          <span className="ml-2 text-blue-600">
            Търси Facebook/Instagram/LinkedIn по име + град (полезно за бизнеси без сайт).
          </span>
        </div>
        <button
          onClick={async () => {
            setMessage("Търся социални профили...");
            const res = await fetch("/api/enrich-social", { method: "POST", body: JSON.stringify({ limit: 25 }) });
            const data = await res.json();
            setMessage(`Намерени ${data.enriched} нови социални профила.`);
            loadLeads(filters);
            loadStats();
          }}
          className="ml-auto rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Намери социални профили
        </button>
      </section>

      {/* Филтри */}
      <section className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <Select
          label="Източник"
          value={filters.source}
          onChange={(v) => set("source", v)}
          options={[
            ["", "всички"],
            ["osm", "OSM"],
            ["google", "Google"],
          ]}
        />
        <Select
          label="Сайт"
          value={filters.website}
          onChange={(v) => set("website", v)}
          options={[
            ["", "всички"],
            ["without", "без сайт"],
            ["with", "със сайт"],
          ]}
        />
        <Select
          label="Индустрия"
          value={filters.industry}
          onChange={(v) => set("industry", v)}
          options={[["", "всички"], ...INDUSTRIES.map((i): [string, string] => [i.key, i.label])]}
        />
        <Select
          label="Статус"
          value={filters.status}
          onChange={(v) => set("status", v)}
          options={[["", "всички"], ...STATUSES]}
        />

        <Field label="Град">
          <input
            className="w-28 rounded border border-slate-300 px-2 py-1.5"
            value={filters.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label="Рейтинг мин">
          <input
            type="number"
            step="0.1"
            className="w-20 rounded border border-slate-300 px-2 py-1.5"
            value={filters.ratingMin}
            onChange={(e) => set("ratingMin", e.target.value)}
          />
        </Field>
        <Field label="Ревюта мин">
          <input
            type="number"
            className="w-20 rounded border border-slate-300 px-2 py-1.5"
            value={filters.reviewsMin}
            onChange={(e) => set("reviewsMin", e.target.value)}
          />
        </Field>
        <Field label="Качество мин">
          <input
            type="number"
            className="w-20 rounded border border-slate-300 px-2 py-1.5"
            value={filters.qualityMin}
            onChange={(e) => set("qualityMin", e.target.value)}
          />
        </Field>

        <Field label="Tech (напр. WordPress)">
          <input
            className="w-28 rounded border border-slate-300 px-2 py-1.5"
            placeholder="WordPress"
            value={filters.tech}
            onChange={(e) => set("tech", e.target.value)}
          />
        </Field>

        <Check
          label="има телефон"
          checked={filters.hasPhone}
          onChange={(v) => set("hasPhone", v)}
        />
        <Check
          label="има имейл"
          checked={filters.hasEmail}
          onChange={(v) => set("hasEmail", v)}
        />
        <Check
          label="верифициран имейл"
          checked={filters.emailVerified}
          onChange={(v) => set("emailVerified", v)}
        />
        <Check
          label="има соц. мрежи"
          checked={filters.hasSocial}
          onChange={(v) => set("hasSocial", v)}
        />

        <Check
          label="стар сайт"
          checked={filters.siteOutdated}
          onChange={(v) => set("siteOutdated", v)}
        />
        <Check
          label="без SSL"
          checked={filters.noSsl}
          onChange={(v) => set("noSsl", v)}
        />
        <Check
          label="немобилен"
          checked={filters.notMobile}
          onChange={(v) => set("notMobile", v)}
        />

        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Field label="Сортирай">
            <select
              className="rounded border border-slate-300 px-2 py-1.5"
              value={filters.sortBy}
              onChange={(e) => set("sortBy", e.target.value)}
            >
              <option value="quality">Качество</option>
              <option value="rating">Рейтинг</option>
              <option value="reviews">Ревюта</option>
              <option value="created">Дата</option>
              <option value="name">Име</option>
            </select>
          </Field>
          <Field label="Посока">
            <select
              className="rounded border border-slate-300 px-2 py-1.5"
              value={filters.sortDir}
              onChange={(e) => set("sortDir", e.target.value)}
            >
              <option value="desc">Низх. ↓</option>
              <option value="asc">Възх. ↑</option>
            </select>
          </Field>

          <button
            onClick={() => loadLeads(filters)}
            className="h-9 rounded bg-slate-800 px-4 font-medium text-white hover:bg-slate-900"
          >
            Приложи филтри
          </button>
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              loadLeads(EMPTY_FILTERS);
            }}
            className="h-9 rounded border border-slate-300 bg-white px-3 font-medium hover:bg-slate-50"
          >
            Изчисти
          </button>
          <a
            href={`/api/export?${buildQuery(filters)}`}
            className="flex h-9 items-center rounded border border-slate-300 bg-white px-4 font-medium hover:bg-slate-50"
          >
            Свали CSV
          </a>

          {/* Delete filtered - опасна, но полезна */}
          <button
            onClick={async () => {
              if (!confirm(`Изтриване на всички лийдове, които отговарят на филтрите?\nТова е НЕОБРАТИМО.`)) return;
              const res = await fetch("/api/leads/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filters: buildQuery(filters) }),
              });
              const d = await res.json();
              if (res.ok) {
                setMessage(`Изтрити ${d.deleted} записа.`);
                loadLeads(filters);
                loadStats();
              } else {
                setError(d.error || "Грешка");
              }
            }}
            className="h-9 rounded border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Изтрий филтрираните
          </button>
        </div>
      </section>

      <div className="mb-2 text-sm text-slate-500">
        Показани {leads.length} от {total} съвпадащи.
      </div>
      <LeadTable
        leads={leads}
        onUpdated={() => loadLeads(filters)}
        onGenerateMessage={generateAiMessage}
        generatingId={aiGeneratingFor}
      />

      {/* AI Message Modal */}
      {generatedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <div className="font-semibold">✨ Персонализирано съобщение</div>
                <div className="text-sm text-slate-500">{generatedMessage.leadName}</div>
              </div>
              <button
                onClick={closeAiModal}
                className="text-2xl leading-none text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>SUBJECT</span>
                  <button
                    onClick={() => copyToClipboard(generatedMessage.subject)}
                    className="text-violet-600 hover:underline"
                  >
                    Копирай
                  </button>
                </div>
                <div className="rounded border bg-slate-50 px-3 py-2 font-medium">
                  {generatedMessage.subject}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>СЪОБЩЕНИЕ</span>
                  <button
                    onClick={() => copyToClipboard(generatedMessage.body)}
                    className="text-violet-600 hover:underline"
                  >
                    Копирай
                  </button>
                </div>
                <textarea
                  readOnly
                  value={generatedMessage.body}
                  className="h-52 w-full resize-y rounded border bg-white p-3 text-sm leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-sm">
              <button
                onClick={closeAiModal}
                className="rounded border border-slate-300 bg-white px-4 py-1.5 hover:bg-slate-100"
              >
                Затвори
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (generatedMessage) {
                      // regenerate could be added later
                      closeAiModal();
                    }
                  }}
                  className="rounded border border-violet-300 px-4 py-1.5 text-violet-700 hover:bg-violet-100"
                >
                  Затвори
                </button>
                <button
                  onClick={() => copyToClipboard(generatedMessage.subject + "\n\n" + generatedMessage.body)}
                  className="rounded bg-violet-600 px-4 py-1.5 font-medium text-white hover:bg-violet-700"
                >
                  Копирай всичко
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Field label={label}>
      <select
        className="rounded border border-slate-300 px-2 py-1.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
