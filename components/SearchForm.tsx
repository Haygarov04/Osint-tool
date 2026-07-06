"use client";

import { useState } from "react";
import { INDUSTRIES } from "@/lib/industries";

export interface CollectParams {
  source: string;
  location: string;
  industry: string;
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
  const [industry, setIndustry] = useState(INDUSTRIES[0].key);
  const [limit, setLimit] = useState(60);

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!location.trim()) return;
        onCollect({ source, location: location.trim(), industry, limit });
      }}
    >
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

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs text-slate-500">Локация</label>
        <input
          className="rounded border border-slate-300 px-2 py-1.5"
          placeholder="напр. Plovdiv"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Индустрия</label>
        <select
          className="rounded border border-slate-300 px-2 py-1.5"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        >
          {INDUSTRIES.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Лимит</label>
          <input
            type="number"
            min={1}
            max={200}
            className="w-20 rounded border border-slate-300 px-2 py-1.5"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-9 flex-1 rounded bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Събирам…" : "Събери"}
        </button>
      </div>
    </form>
  );
}
