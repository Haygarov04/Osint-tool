"use client";

import { useState } from "react";
import type { Lead, LeadStatus } from "@/lib/types";

const STATUSES: LeadStatus[] = ["new", "processed", "contacted", "replied", "customer", "unsubscribed"];

interface Props {
  lead: Lead;
  onClose: () => void;
  onUpdated: (updatedLead: Lead) => void;
  aiOffer: string;
}

export default function LeadModal({ lead, onClose, onUpdated, aiOffer }: Props) {
  const [current, setCurrent] = useState(lead);
  const [busy, setBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null);
  const [notes, setNotes] = useState(lead.notes || "");
  const [tags, setTags] = useState((lead.tags || []).join(", "));

  const updateField = async (patch: Partial<Lead>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, ...patch }),
      });
      if (res.ok) {
        const { lead: updated } = await res.json();
        setCurrent(updated);
        onUpdated(updated);
      }
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = () => updateField({ notes });
  const saveTags = () => {
    const arr = tags.split(",").map(t => t.trim()).filter(Boolean);
    updateField({ tags: arr });
  };

  const changeStatus = (status: LeadStatus) => updateField({ status });

  // Генерирай AI съобщение (в модала)
  const generateMessage = async () => {
    if (!aiOffer.trim()) {
      alert("Първо въведи офертата си в главния екран.");
      return;
    }
    setMessageBusy(true);
    try {
      const res = await fetch("/api/ai/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: current.id, offer: aiOffer }),
      });
      const data = await res.json();
      if (res.ok) setGenerated(data);
    } finally {
      setMessageBusy(false);
    }
  };

  // По-добър анализ с Grok (само при клик) - fixed to always work and show result or error
  const runAnalysis = async () => {
    setAnalysisBusy(true);
    try {
      const res = await fetch("/api/ai/analyze-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: current.id }),
      });
      const data = await res.json();
      if (res.ok && data.lead) {
        setCurrent(data.lead);
        onUpdated(data.lead);
      } else {
        alert(data.error || "Грешка при анализ с Grok. Провери XAI_API_KEY и опитай пак.");
      }
    } catch (err) {
      alert("Не успя да се свърже с xAI. Провери ключа и интернет.");
    } finally {
      setAnalysisBusy(false);
    }
  };

  // Deep enrich този лийд (максимално агресивно)
  const deepEnrich = async () => {
    setBusy(true);
    try {
      // Пускаме обогатяване на този конкретен лийд
      await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 1 }), // ще вземе първите, които имат сайт
      });
      await fetch("/api/enrich-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });

      // Презареждаме данните от родителя
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3 z-10">
          <div>
            <div className="font-semibold text-lg">{current.name}</div>
            <div className="text-sm text-slate-500">{current.category} • {current.city || current.region}</div>
          </div>
          <button onClick={onClose} className="text-3xl leading-none text-slate-400 hover:text-black">×</button>
        </div>

        <div className="p-5 space-y-6">
          {/* Quick Contacts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">ТЕЛЕФОН</div>
              {current.phone ? (
                <a href={`tel:${current.phone}`} className="text-lg font-medium text-blue-600 hover:underline">{current.phone}</a>
              ) : <span className="text-slate-400">—</span>}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">ИМЕЙЛ</div>
              {current.email ? (
                <a href={`mailto:${current.email}`} className="text-blue-600 hover:underline break-all">{current.email}</a>
              ) : <span className="text-amber-600">няма</span>}
            </div>
          </div>

          {/* Website & Signals */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">УЕБСАЙТ</div>
            {current.website ? (
              <a href={current.website} target="_blank" className="text-blue-600 hover:underline">{current.website}</a>
            ) : <span className="text-amber-600 font-medium">НЯМА САЙТ — отличен таргет</span>}

            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {current.hasWebsite && current.siteOutdated && <span className="rounded bg-orange-100 px-2 py-0.5 text-orange-700">⚠ Стар сайт</span>}
              {current.hasSsl === false && <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">Без SSL</span>}
              {current.mobileFriendly === false && <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-700">Немобилен</span>}
              {current.techStack?.length > 0 && current.techStack.map(t => (
                <span key={t} className="rounded bg-slate-100 px-2 py-0.5">{t}</span>
              ))}
            </div>
          </div>

          {/* Socials */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">СОЦИАЛНИ МРЕЖИ</div>
            <div className="flex flex-wrap gap-3 text-sm">
              {current.facebook && <a href={current.facebook} target="_blank" className="text-blue-600">Facebook</a>}
              {current.instagram && <a href={current.instagram} target="_blank" className="text-pink-600">Instagram</a>}
              {current.linkedin && <a href={current.linkedin} target="_blank" className="text-blue-700">LinkedIn</a>}
              {current.youtube && <a href={current.youtube} target="_blank" className="text-red-600">YouTube</a>}
              {current.tiktok && <a href={current.tiktok} target="_blank" className="text-black">TikTok</a>}
              {!current.facebook && !current.instagram && !current.linkedin && <span className="text-slate-400">Няма намерени</span>}
            </div>
          </div>

          {/* AI Insights (cached) */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Grok Анализ</div>
              <button
                onClick={runAnalysis}
                disabled={analysisBusy}
                className="text-xs rounded bg-violet-600 px-3 py-1 text-white disabled:opacity-50"
              >
                {analysisBusy ? "Анализирам..." : "По-добър анализ с Grok"}
              </button>
            </div>
            {current.aiInsights ? (
              <div className="whitespace-pre-wrap text-sm text-slate-700">{current.aiInsights}</div>
            ) : (
              <div className="text-sm text-slate-500">Натисни бутона за анализ (харчи 1 заявка към xAI).</div>
            )}
          </div>

          {/* CRM: Status + Notes + Tags */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500">СТАТУС</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={`px-3 py-1 text-xs rounded-full border ${current.status === s ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">БЕЛЕЖКИ (CRM)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveNotes}
                className="w-full rounded border p-2 text-sm h-20"
                placeholder="Обадих се на 05.07, интересува се от сайт..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">ТАГОВЕ (разделени със запетая)</label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                onBlur={saveTags}
                className="w-full rounded border p-2 text-sm"
                placeholder="висок приоритет, хотел, без сайт"
              />
            </div>
          </div>

          {/* AI Email Composer */}
          <div className="rounded-xl border border-violet-200 p-4 bg-violet-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-violet-900">✨ AI Съобщение</div>
              <button
                onClick={generateMessage}
                disabled={messageBusy}
                className="text-xs bg-violet-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {messageBusy ? "Генерирам..." : "Генерирай / Прегенерирай"}
              </button>
            </div>

            {generated && (
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-violet-700">SUBJECT</div>
                  <div className="font-medium bg-white p-2 rounded border">{generated.subject}</div>
                </div>
                <div>
                  <div className="text-xs text-violet-700">СЪОБЩЕНИЕ</div>
                  <textarea readOnly value={generated.body} className="w-full h-28 text-sm border p-2 rounded bg-white" />
                </div>
                <button onClick={() => navigator.clipboard.writeText(generated.subject + "\n\n" + generated.body)} className="text-sm text-violet-700 underline">
                  Копирай всичко
                </button>
              </div>
            )}
            {!generated && <div className="text-sm text-violet-600">Натисни бутона за да генерира Grok персонализирано съобщение.</div>}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <button onClick={deepEnrich} disabled={busy} className="px-3 py-1.5 text-sm rounded border hover:bg-slate-100">Deep Enrich (имейл + социални)</button>
            <button onClick={() => copy(current.phone || "")} className="px-3 py-1.5 text-sm rounded border">Копирай телефон</button>
            <button onClick={() => copy(current.email || "")} className="px-3 py-1.5 text-sm rounded border">Копирай имейл</button>
            <button onClick={() => { if (confirm("Изтрий този лийд?")) { /* simple delete */ alert("Изтриване на единичен лийд може да се добави лесно"); } }} className="px-3 py-1.5 text-sm rounded border border-red-300 text-red-600">Изтрий лийда</button>
          </div>

          <div className="text-[10px] text-slate-400">
            Източник: {current.source} • Качество: {current.qualityScore}/100 • Обновен: {new Date(current.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
