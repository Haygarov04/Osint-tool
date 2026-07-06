import { useState } from "react";
import type { Lead, LeadStatus } from "@/lib/types";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Нов",
  processed: "Обработен",
  contacted: "Контактиран",
  replied: "Отговорил",
  customer: "Клиент",
  unsubscribed: "Отписан",
};

const STATUSES: LeadStatus[] = ["new", "processed", "contacted", "replied", "customer", "unsubscribed"];

export default function LeadTable({
  leads,
  onUpdated,
}: {
  leads: Lead[];
  onUpdated?: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Няма лийдове. Събери от панела горе или разхлаби филтрите.
      </div>
    );
  }

  async function updateStatus(id: string, status: LeadStatus) {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        onUpdated?.();
      }
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Име</th>
            <th className="px-3 py-2">Категория</th>
            <th className="px-3 py-2">Телефон</th>
            <th className="px-3 py-2">Имейл</th>
            <th className="px-3 py-2">Сайт</th>
            <th className="px-3 py-2">Град</th>
            <th className="px-3 py-2">Рейтинг</th>
            <th className="px-3 py-2">Качество</th>
            <th className="px-3 py-2">Статус</th>
            <th className="px-3 py-2">Соц.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((l) => {
            const socialCount = [l.facebook, l.instagram, l.linkedin, l.youtube, l.tiktok].filter(Boolean).length;
            return (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium max-w-[220px] truncate" title={l.name}>{l.name}</td>
                <td className="px-3 py-2 text-slate-500">{l.category}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.phone || "—"}</td>
                <td className="px-3 py-2 text-xs max-w-[180px] truncate">
                  {l.email ? (
                    <a href={`mailto:${l.email}`} className="text-blue-600 hover:underline" title={l.email}>
                      {l.email}
                    </a>
                  ) : (
                    "—"
                  )}
                  {l.emailVerified === "valid" && <span className="ml-1 text-green-600" title="MX валиден">✓</span>}
                </td>
                <td className="px-3 py-2">
                  {l.website ? (
                    <a
                      href={l.website.startsWith("http") ? l.website : `https://${l.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {l.domain || "сайт"}
                    </a>
                  ) : (
                    <span className="text-amber-600">няма</span>
                  )}
                  {l.siteOutdated && <span className="ml-1 text-amber-500 text-[10px]" title="Сигнал за стар сайт">⚠</span>}
                </td>
                <td className="px-3 py-2">{l.city || "—"}</td>
                <td className="px-3 py-2 tabular-nums text-xs">
                  {l.rating != null ? `${l.rating} (${l.reviewsCount ?? 0})` : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums font-medium">{l.qualityScore}</td>
                <td className="px-3 py-2">
                  <select
                    value={l.status}
                    disabled={updatingId === l.id}
                    onChange={(e) => updateStatus(l.id, e.target.value as LeadStatus)}
                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs disabled:opacity-50"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs">
                  {socialCount > 0 ? (
                    <span title={`${socialCount} профила`}>🔗 {socialCount}</span>
                  ) : "—"}
                  {l.techStack?.length ? (
                    <span className="ml-1 text-[10px] text-slate-400" title={l.techStack.join(", ")}>
                      {l.techStack[0]}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
