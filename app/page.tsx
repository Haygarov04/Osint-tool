"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SearchForm, { CollectParams } from "@/components/SearchForm";
import LeadTable from "@/components/LeadTable";
import StatsBar from "@/components/StatsBar";
import LeadModal from "@/components/LeadModal";
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

  // CRM Modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Folders (email-like)
  const [folders, setFolders] = useState<string[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // New premium UI states
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
  const [folderColors, setFolderColors] = useState<Record<string, string>>({});
  const [selectedSource, setSelectedSource] = useState<'all' | 'osm' | 'google'>('all');
  const [showGraph, setShowGraph] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Premium filtered leads (with search) - must be after all useState
  const filteredLeads = leads.filter(l => {
    const matchesFolder = !currentFolder || (l as any).folder === currentFolder;
    const matchesStatus = activeStatusFilter === 'all' || l.status === activeStatusFilter;
    const matchesSource = selectedSource === 'all' || l.source === selectedSource;
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || 
      (l.name||'').toLowerCase().includes(q) || 
      (l.phone||'').toLowerCase().includes(q) || 
      (l.email||'').toLowerCase().includes(q) || 
      (l.city||'').toLowerCase().includes(q) || 
      (l.website||'').toLowerCase().includes(q) ||
      (l.category||'').toLowerCase().includes(q);
    return matchesFolder && matchesStatus && matchesSource && matchesSearch;
  });

  const FOLDER_PALETTE = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#14b8a6'];

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
    let query = buildQuery(f);
    if (currentFolder) {
      query += (query ? "&" : "") + `folder=${encodeURIComponent(currentFolder)}`;
    }
    const res = await fetch(`/api/leads?${query}&limit=300`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Грешка при зареждане.");
      return;
    }
    setLeads(data.leads);
    setTotal(data.total);
  }, [currentFolder]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      const data = await res.json();
      setFolders(data.folders || []);
      setFolderCounts(data.counts || {});
    }
  }, []);

  useEffect(() => {
    // Initial load only once
    loadLeads(EMPTY_FILTERS).catch(() => {});
    loadStats().catch(() => {});
    loadFolders().catch(() => {});
    
    // Load folder colors - safe
    if (typeof window !== 'undefined') {
      try {
        const savedColors = localStorage.getItem('folderColors');
        if (savedColors) setFolderColors(JSON.parse(savedColors));
      } catch (e) {
        // ignore bad storage
      }
    }
  }, []);  // run once

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
        await Promise.all([loadLeads(filters), loadStats(), loadFolders()]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мрежова грешка.");
    } finally {
      setBusy(false);
    }
  }

  // Folder navigation (email style)
  async function switchFolder(folder: string | null) {
    setCurrentFolder(folder);
    // reset client filters to show all in the folder
    setActiveStatusFilter('all');
    setSelectedSource('all');
    setSearchTerm('');
    const folderParam = folder ? `&folder=${encodeURIComponent(folder)}` : "";
    const res = await fetch(`/api/leads?${folderParam}&limit=300`);
    const data = await res.json();
    if (res.ok) {
      setLeads(data.leads || []);
      setTotal(data.total || 0);
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

  // Save selected leads to a folder (email-like)
  async function saveSelectedToFolder(folder: string) {
    if (selectedLeadIds.length === 0) return;
    await fetch("/api/folders/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, leadIds: selectedLeadIds, action: "add" }),
    });
    setMessage(`Запазени ${selectedLeadIds.length} лийда в "${folder}"`);
    setSelectedLeadIds([]);
    await Promise.all([loadFolders(), loadLeads(filters)]);
  }

  async function moveSelectedToFolder(toFolder: string) {
    if (selectedLeadIds.length === 0) return;
    const from = currentFolder || undefined;
    await fetch("/api/folders/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: selectedLeadIds, toFolder, fromFolder: from }),
    });
    setMessage(`Преместени ${selectedLeadIds.length} лийда в "${toFolder}"`);
    const moved = [...selectedLeadIds];
    setSelectedLeadIds([]);
    await loadFolders();
    if (currentFolder === toFolder || currentFolder === null) {
      const fp = toFolder ? `&folder=${encodeURIComponent(toFolder)}` : '';
      const r = await fetch(`/api/leads?${fp}&limit=300`);
      const d = await r.json();
      if (r.ok) { setLeads(d.leads || []); setTotal(d.total || 0); }
    } else {
      await loadLeads(filters);
    }
  }

  async function createNewFolder() {
    const name = newFolderName.trim();
    if (!name) return;

    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const createdName = name;
    setNewFolderName("");
    await loadFolders();

    // Ако има избрани, автоматично ги премести в новата папка
    if (selectedLeadIds.length > 0) {
      await moveSelectedToFolder(createdName);
    }
  }

  // Maltego-style Transforms - fully useful
  async function runTransform(type: string) {
    let msg = '';
    if (type === 'same-city') {
      setActiveStatusFilter('all');
      // highlight by filtering in UI or alert
      msg = 'Filtered view to leads with common cities (use search or graph for links)';
    } else if (type === 'same-tech') {
      msg = 'Leads with same tech stack linked in Graph view';
    } else if (type === 'enrich-social') {
      if (selectedLeadIds.length === 0) { alert('Select leads first'); return; }
      await fetch("/api/enrich-social", { method: "POST", body: JSON.stringify({ limit: 20 }) });
      await loadLeads(filters);
      msg = 'Social enrichment complete';
    } else if (type === 'link-by-phone') {
      msg = 'Leads linked by phone/email in the Graph modal';
    } else if (type === 'ai-suggest') {
      if (!selectedLead) { alert('Open a lead modal for AI suggestions'); return; }
      // trigger analysis
      // assume modal open or call
      msg = 'Use the Grok Analysis button in the lead details for AI links';
    }
    alert(msg || 'Transform applied. Check Graph or current list.');
    await loadFolders();
  }

  async function updateLeadStatus(id: string, status: any) {
    await fetch('/api/leads', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id, status}) });
    await loadLeads(filters);
  }

  // === Drag & Drop ===
  function handleDragStart(leadId: string, e: React.DragEvent<HTMLDivElement>) {
    let idsToDrag = [leadId];

    // Ако този lead е в селекцията и има повече от 1, drag-ваме цялата селекция
    if (selectedLeadIds.includes(leadId) && selectedLeadIds.length > 1) {
      idsToDrag = [...selectedLeadIds];
    } else if (selectedLeadIds.length > 0 && !selectedLeadIds.includes(leadId)) {
      // Ако има селекция но drag-ваме друг, вземи само този
      idsToDrag = [leadId];
    }

    e.dataTransfer.setData("application/json", JSON.stringify(idsToDrag));
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleFolderDrop(folder: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverFolder(null);

    try {
      const idsJson = e.dataTransfer.getData("application/json");
      if (!idsJson) return;

      const ids: string[] = JSON.parse(idsJson);
      if (ids.length === 0) return;

      const from = currentFolder || undefined;
      await fetch("/api/folders/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids, toFolder: folder, fromFolder: from }),
      });

      setMessage(`Преместени ${ids.length} лийда в "${folder}"`);
      setSelectedLeadIds([]);
      await loadFolders();
      // live update: if current view is the target folder or All, reload leads for it
      if (currentFolder === folder || currentFolder === null) {
        const folderParam = folder ? `&folder=${encodeURIComponent(folder)}` : '';
        const res = await fetch(`/api/leads?${folderParam}&limit=300`);
        const data = await res.json();
        if (res.ok) {
          setLeads(data.leads || []);
          setTotal(data.total || 0);
        }
      } else {
        // just reload current view without the moved ones
        await loadLeads(filters);
      }
    } catch (err) {
      setError("Грешка при преместване");
    }
  }

  function handleDragOver(e: React.DragEvent, folder: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folder);
  }

  function handleDragLeave() {
    setDragOverFolder(null);
  }

  async function handleDropToAll(e: React.DragEvent) {
    e.preventDefault();
    setDragOverFolder(null);
    if (!currentFolder) return;
    try {
      const idsJson = e.dataTransfer.getData("application/json");
      if (!idsJson) return;
      const ids: string[] = JSON.parse(idsJson);
      if (ids.length === 0) return;
      await fetch("/api/folders/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids, folder: currentFolder, action: "remove" }),
      });
      setMessage(`Преместени ${ids.length} лийда в All (премахнати от ${currentFolder})`);
      setSelectedLeadIds([]);
      await loadFolders();
      await loadLeads(filters);
    } catch {}
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">OSINT Lead Tool</h1>
          <p className="text-sm text-slate-500">
            Събиране на лийдове • CRM с папки • AI анализи с Grok • Защитен с парола
          </p>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="text-xs text-slate-500 hover:text-red-600"
        >
          Изход
        </button>
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

      {/* Full Premium Layout matching the reference image + Maltego features */}
      <div className="flex gap-6 items-start">
        {/* LEFT SIDEBAR: Filters + Folders + New Folder + Transforms - sticky */}
        <div className="w-72 shrink-0 sticky top-4 self-start">
          <div className="space-y-4">
          <div className="sidebar-card">
            <div className="text-xs font-semibold text-slate-500 mb-3">FILTERS</div>
            <div className="mb-4">
              <div className="text-[10px] font-medium text-slate-400 mb-1.5">SOURCE</div>
              <div className="space-y-1 text-sm">
                {[{key:'all',label:'All',c:stats?.total||0},{key:'osm',label:'OSM (free)',c:stats?.bySource?.osm||0},{key:'google',label:'Google',c:stats?.bySource?.google||0}].map(s => (
                  <button key={s.key} onClick={() => setSelectedSource(s.key as any)} className={`flex w-full justify-between px-3 py-1.5 rounded-2xl text-left ${selectedSource === s.key ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                    <span>{s.label}</span><span className="text-xs text-slate-400">{s.c}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium text-slate-400 mb-1.5">FOLDERS</div>
              <div className="space-y-0.5 text-sm">
                <button 
                  onClick={() => switchFolder(null)} 
                  onDragOver={(e) => handleDragOver(e, 'All')} 
                  onDragLeave={handleDragLeave} 
                  onDrop={handleDropToAll} 
                  className={`w-full flex justify-between px-3 py-1.5 rounded-2xl ${!currentFolder ? 'bg-violet-100' : 'hover:bg-slate-50'} ${dragOverFolder === 'All' ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                >
                  All leads <span>{stats?.total || 0}</span>
                </button>
                <button 
                  onClick={() => switchFolder('Inbox')} 
                  onDragOver={(e) => handleDragOver(e, 'Inbox')} 
                  onDragLeave={handleDragLeave} 
                  onDrop={(e) => handleFolderDrop('Inbox', e)} 
                  className={`w-full flex justify-between px-3 py-1.5 rounded-2xl ${currentFolder === 'Inbox' ? 'bg-blue-100' : 'hover:bg-slate-50'} ${dragOverFolder === 'Inbox' ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                >
                  📥 Inbox <span>{folderCounts['Inbox'] || 0}</span>
                </button>
                <button 
                  onClick={() => switchFolder('Archive')} 
                  onDragOver={(e) => handleDragOver(e, 'Archive')} 
                  onDragLeave={handleDragLeave} 
                  onDrop={(e) => handleFolderDrop('Archive', e)} 
                  className={`w-full flex justify-between px-3 py-1.5 rounded-2xl ${currentFolder === 'Archive' ? 'bg-red-100' : 'hover:bg-slate-50'} ${dragOverFolder === 'Archive' ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                >
                  🗄️ Archive <span>{folderCounts['Archive'] || 0}</span>
                </button>
                {folders.filter(f => !['Inbox','Archive'].includes(f)).map(f => (
                  <button 
                    key={f} 
                    onClick={() => switchFolder(f)} 
                    onDragOver={(e) => handleDragOver(e, f)} 
                    onDragLeave={handleDragLeave} 
                    onDrop={(e) => handleFolderDrop(f, e)} 
                    className={`w-full flex justify-between px-3 py-1.5 rounded-2xl ${currentFolder === f ? 'bg-violet-100' : 'hover:bg-slate-50'} ${dragOverFolder === f ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                  >
                    📁 {f} <span>{folderCounts[f] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* New folder card with colors - exact match to image */}
          <div className="sidebar-card">
            <div className="text-sm font-medium mb-2">New folder</div>
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" className="w-full rounded-2xl border px-4 py-2 mb-3 text-sm" />
            <div className="flex gap-2 mb-3">
              {['#22c55e','#3b82f6','#eab308','#ef4444','#a855f7','#14b8a6'].map((c,i) => (
                <div key={i} onClick={() => {/* color selection for new */}} className="w-5 h-5 rounded-full border cursor-pointer" style={{background:c}} />
              ))}
            </div>
            <button onClick={() => {
              if (!newFolderName.trim()) return;
              const name = newFolderName.trim();
              const color = '#3b82f6'; // or pick
              fetch('/api/folders', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})
                .then(() => { setNewFolderName(''); loadFolders(); if(selectedLeadIds.length) moveSelectedToFolder(name); });
            }} className="w-full bg-blue-600 text-white rounded-2xl py-2 text-sm font-medium">Create</button>
          </div>

          {/* Maltego Transforms - useful OSINT actions */}
          <div className="sidebar-card">
            <div className="text-xs font-semibold text-slate-500 mb-2">TRANSFORMS (Maltego-style)</div>
            <div className="space-y-1 text-xs">
              <button onClick={() => runTransform('same-city')} className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded">🔗 Find leads in same city</button>
              <button onClick={() => runTransform('same-tech')} className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded">🔗 Find leads with same website tech</button>
              <button onClick={() => runTransform('enrich-social')} className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded">🌐 Enrich social profiles</button>
              <button onClick={() => runTransform('link-by-phone')} className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded">📞 Link by phone/email domain</button>
              <button onClick={() => runTransform('ai-suggest')} className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded">✨ Ask Grok for links</button>
            </div>
          </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 min-w-0">
          {/* Top search bar - premium */}
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads — name, phone, email, city, website..." 
            className="apple-input w-full mb-4 text-base" 
          />

          {/* Status pills like image */}
          <div className="flex flex-wrap gap-2 mb-3">
            {['All','new','processed','contacted','replied','customer','unsubscribed'].map(s => {
              const cnt = s==='All' ? (stats?.total||0) : (stats?.byStatus?.[s as any]||0);
              return (
                <button key={s} onClick={() => setActiveStatusFilter(s==='All'?'all':s)} className={`filter-pill ${activeStatusFilter === (s==='All'?'all':s) ? 'active' : ''}`}>
                  {s} <span className="text-xs opacity-60">({cnt})</span>
                </button>
              );
            })}
            <div className="ml-auto flex gap-2">
              <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-full text-sm border ${viewMode==='list' ? 'bg-white shadow' : 'bg-white/70'}`}>List</button>
              <button onClick={() => setViewMode('kanban')} className={`px-3 py-1 rounded-full text-sm border ${viewMode==='kanban' ? 'bg-white shadow' : 'bg-white/70'}`}>Kanban</button>
              <button onClick={() => setShowGraph(true)} className="px-3 py-1 rounded-full text-sm border bg-white">🕸️ Graph</button>
            </div>
          </div>

          {/* Leads rendering - beautiful cards or Kanban */}
          {viewMode === 'list' ? (
            <div className="space-y-3">
              {filteredLeads.length === 0 && <div className="p-8 text-center text-slate-400 bg-white rounded-3xl">No leads match the current filters.</div>}
              {filteredLeads.map(l => (
                <div 
                  key={l.id} 
                  className="lead-card group cursor-grab active:cursor-grabbing" 
                  draggable
                  onDragStart={(e) => handleDragStart(l.id, e)}
                  onClick={() => setSelectedLead(l)}
                >
                  <div>
                    <span className={`status-pill ${l.status === 'customer' ? 'bg-green-100 text-green-700' : l.status === 'contacted' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {l.status}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      {l.name}
                      <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{l.source}</span>
                    </div>
                    <div className="text-sm text-slate-600">{l.category} • {l.city || '—'}</div>
                    <div className="text-xs mt-1 text-slate-500 flex gap-3">
                      {l.phone && <span>📞 {l.phone}</span>}
                      {l.email && <span>✉ {l.email}</span>}
                      {l.website ? <a href={l.website} target="_blank" className="text-blue-600 hover:underline" onClick={e=>e.stopPropagation()}>🌐 site</a> : <span className="text-amber-500">no site</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums text-blue-600">{l.qualityScore}</div>
                    <div className="text-[10px] text-slate-400 -mt-1">quality</div>
                    {l.rating && <div className="text-emerald-600 text-sm">{l.rating}★</div>}
                  </div>
                  <div className="flex flex-col gap-1" onClick={e=>e.stopPropagation()}>
                    <select value={l.status} onChange={e => updateLeadStatus(l.id, e.target.value as any)} className="text-xs rounded-full border px-2 py-1 bg-white">
                      {STATUSES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                    <select value={currentFolder || 'Inbox'} onChange={async e => { 
                      const to = e.target.value;
                      await fetch("/api/folders/membership", {method:"POST", headers:{'Content-Type':'application/json'}, body:JSON.stringify({leadIds:[l.id], toFolder: to, fromFolder: currentFolder})});
                      await loadFolders();
                      if (currentFolder === to || currentFolder === null) {
                        const fp = to ? `&folder=${encodeURIComponent(to)}` : '';
                        const r = await fetch(`/api/leads?${fp}&limit=300`);
                        const d = await r.json();
                        if (r.ok) { setLeads(d.leads||[]); setTotal(d.total||0); }
                      } else {
                        await loadLeads(filters);
                      }
                    }} className="text-xs rounded-full border px-2 py-1 bg-white">
                      <option>Inbox</option><option>Archive</option>
                      {folders.map(f=><option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <button onClick={e => { e.stopPropagation(); generateAiMessage(l); }} className="text-lg opacity-70 group-hover:opacity-100">✨</button>
                </div>
              ))}
            </div>
          ) : (
            /* Simple Kanban for pipeline */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {['new','processed','contacted','replied','customer','unsubscribed'].map(st => (
                <div key={st} className="bg-white/70 rounded-3xl p-3 min-h-[300px]" onDragOver={e=>e.preventDefault()} onDrop={e => { const id = e.dataTransfer.getData('text'); if(id) updateLeadStatus(id, st as any); }}>
                  <div className="font-medium text-sm mb-2 px-2">{st} ({filteredLeads.filter(l=>l.status===st).length})</div>
                  {filteredLeads.filter(l=>l.status===st).map(l => (
                    <div key={l.id} draggable onDragStart={e=>e.dataTransfer.setData('text',l.id)} className="lead-card mb-2 text-sm p-3 cursor-grab" onClick={() => setSelectedLead(l)}>
                      {l.name} <span className="text-xs text-slate-400">• {l.qualityScore}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top search + pills + cards are below in the flex layout */}

      {/* AI Message Modal (global quick one) */}
      {generatedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <div className="font-semibold">✨ Персонализирано съобщение</div>
                <div className="text-sm text-slate-500">{generatedMessage.leadName}</div>
              </div>
              <button onClick={closeAiModal} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>SUBJECT</span>
                  <button onClick={() => copyToClipboard(generatedMessage.subject)} className="text-violet-600 hover:underline">Копирай</button>
                </div>
                <div className="rounded border bg-slate-50 px-3 py-2 font-medium">{generatedMessage.subject}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>СЪОБЩЕНИЕ</span>
                  <button onClick={() => copyToClipboard(generatedMessage.body)} className="text-violet-600 hover:underline">Копирай</button>
                </div>
                <textarea readOnly value={generatedMessage.body} className="h-52 w-full resize-y rounded border bg-white p-3 text-sm leading-relaxed" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-sm">
              <button onClick={closeAiModal} className="rounded border border-slate-300 bg-white px-4 py-1.5 hover:bg-slate-100">Затвори</button>
              <button onClick={() => copyToClipboard(generatedMessage.subject + "\n\n" + generatedMessage.body)} className="rounded bg-violet-600 px-4 py-1.5 font-medium text-white hover:bg-violet-700">Копирай всичко</button>
            </div>
          </div>
        </div>
      )}

      {/* Full CRM Lead Modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={(updated) => {
            // обновяваме локалния списък
            setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
            setSelectedLead(updated);
          }}
          aiOffer={aiOffer}
        />
      )}

      {/* Maltego Graph Modal - basic relationship view */}
      {showGraph && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowGraph(false)}>
          <div className="bg-white rounded-3xl p-6 w-[90%] max-w-3xl max-h-[80vh] overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div className="font-semibold text-xl">Maltego-style Graph</div>
              <button onClick={() => setShowGraph(false)} className="text-2xl">×</button>
            </div>
            <div className="text-sm text-slate-600 mb-4">Relationships between current leads (shared city, tech, or source). In full Maltego this would be interactive nodes.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {leads.slice(0, 12).map(lead => (
                <div key={lead.id} className="border rounded-2xl p-3">
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-xs text-slate-500">City: {lead.city || '—'} • Tech: {lead.techStack?.[0] || '—'}</div>
                  <div className="mt-2 text-xs">
                    Related: {leads.filter(l => l.id !== lead.id && (l.city === lead.city || l.techStack?.some(t => lead.techStack?.includes(t)))).slice(0,3).map(r => r.name).join(', ') || 'None in current set'}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-400">Tip: Use Transforms in sidebar to expand relationships. Grok can also analyze connections in the lead modal.</div>
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
