"use client";

import { useState } from "react";
import { INDUSTRIES } from "@/lib/industries";

export interface CollectParams {
  source: string;
  location: string;
  industries: string[];
  limit: number;
}

export default function SearchForm({
  onCollect,
  busy,
}: {
  onCollect: (p: CollectParams) => void;
  busy: boolean;
}) {
  const [source, setSource] = useState("osm");
  const [location, setLocation] = useState("");
  const [selected, setSelected] = useState<string[]>([INDUSTRIES[0].key]);
  const [limit, setLimit] = useState(60);

  const allKeys = INDUSTRIES.map((i) => i.key);
  const allSelected = selected.length === allKeys.length;

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const toggleAll = () =>
    setSelected(allSelected ? [INDUSTRIES[0].key] : allKeys);

  return (
    <form
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!location.trim() || selected.length === 0) return;
        onCollect({
          source,
          location: location.trim(),
          industries: selected,
          limit,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Източник</label>
          <select
            className="rounded border border-slate-300 px-2 py-1.5"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="osm">OSM (безплатно)</option>
            <option value="google">Google Places</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-3">
          <label className="text-xs text-slate-500">
            Локация (няколко града със запетая)
          </label>
          <input
            className="rounded border border-slate-300 px-2 py-1.5"
            placeholder="напр. Plovdiv  или  Plovdiv, Sofia, Varna"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Лимит / комбинация</label>
          <input
            type="number"
            min={1}
            max={200}
            className="rounded border border-slate-300 px-2 py-1.5"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="h-9 w-full rounded bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Събирам…" : "Събери"}
          </button>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs text-slate-500">
            Индустрии (може няколко) — избрани {selected.length}
          </label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-blue-600 hover:underline"
          >
            {allSelected ? "Изчисти" : "Избери всички"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((i) => {
            const on = selected.includes(i.key);
            return (
              <button
                key={i.key}
                type="button"
                onClick={() => toggle(i.key)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  on
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      </div>
    </form>
  );
}
