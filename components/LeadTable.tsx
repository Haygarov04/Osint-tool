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

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  processed: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  replied: "bg-emerald-100 text-emerald-700",
  customer: "bg-green-600 text-white",
  unsubscribed: "bg-red-100 text-red-700",
};

const STATUSES: LeadStatus[] = ["new", "processed", "contacted", "replied", "customer", "unsubscribed"];

export default function LeadTable({
  leads,
  onUpdated,
  onGenerateMessage,
  generatingId,
  onSelectLead,
  selectedIds,
  onToggleSelect,
  onDragStartLead,
  folders = [],
  onMoveToFolder,
}: {
  leads: Lead[];
  onUpdated?: () => void;
  onGenerateMessage?: (lead: Lead) => void;
  generatingId?: string | null;
  onSelectLead?: (lead: Lead) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onDragStartLead?: (leadId: string, e: React.DragEvent<HTMLDivElement>) => void;
  folders?: string[];
  onMoveToFolder?: (leadId: string, folder: string) => void;
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

  // Beautiful vertical cards - no horizontal scroll, premium Apple-like
  return (
    <div className="space-y-3">
      {leads.length === 0 && (
        <div className="p-8 text-center text-slate-400 bg-white rounded-3xl border">Няма лийдове за показване.</div>
      )}
      {leads.map((l) => {
        return (
          <div 
            key={l.id} 
            className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row gap-4 group"
            onClick={() => onSelectLead?.(l)}
            draggable
            onDragStart={(e) => onDragStartLead?.(l.id, e)}
          >
            {/* Status */}
            <div className="pt-1">
              <select 
                value={l.status} 
                onChange={(e) => { e.stopPropagation(); updateStatus(l.id, e.target.value as LeadStatus); }}
                className="rounded-full border px-3 py-0.5 text-xs bg-white"
              >
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0" onClick={() => onSelectLead?.(l)}>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-lg">{l.name}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{l.source}</span>
                {l.category && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">{l.category}</span>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{l.city || '—'}</div>

              <div className="mt-2 text-sm flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600">
                {l.phone && <a href={`tel:${l.phone}`} onClick={e=>e.stopPropagation()} className="text-blue-600 hover:underline">📞 {l.phone}</a>}
                {l.email && <a href={`mailto:${l.email}`} onClick={e=>e.stopPropagation()} className="text-blue-600 hover:underline truncate">✉ {l.email}</a>}
                {l.website ? <a href={l.website} target="_blank" onClick={e=>e.stopPropagation()} className="text-blue-600 hover:underline truncate">🌐 {l.domain || 'website'}</a> : <span className="text-amber-600">Няма сайт</span>}
              </div>
            </div>

            {/* Quality */}
            <div className="text-right tabular-nums min-w-[80px]">
              <div className="text-3xl font-semibold text-blue-600">{l.qualityScore}</div>
              <div className="text-[10px] text-slate-400 -mt-1">quality</div>
              {l.rating != null && <div className="text-emerald-600 text-sm mt-1">{l.rating}★</div>}
            </div>

            {/* Folder & AI */}
            <div className="flex flex-col items-end gap-2 min-w-[120px]" onClick={e=>e.stopPropagation()}>
              <select onChange={(e) => onMoveToFolder?.(l.id, e.target.value)} className="rounded-2xl border px-3 py-1 text-xs bg-white w-full">
                <option>Inbox</option>
                <option>Archive</option>
                {(folders || []).map(f => <option key={f} value={f}>{f}</option>)}
              </select>

              <button 
                onClick={(e) => { e.stopPropagation(); onGenerateMessage?.(l); }} 
                className="text-lg px-2 py-0.5 rounded-full hover:bg-violet-100"
                title="AI съобщение"
              >
                ✨
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
