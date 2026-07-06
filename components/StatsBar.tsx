import type { StatsResult } from "@/lib/types";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function StatsBar({ stats }: { stats: StatsResult | null }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Stat label="Общо лийдове" value={stats.total} />
      <Stat label="Без сайт" value={stats.withoutWebsite} />
      <Stat label="С имейл" value={stats.withEmail} />
      <Stat label="OSM" value={stats.bySource.osm ?? 0} />
      <Stat label="Google" value={stats.bySource.google ?? 0} />
    </div>
  );
}
