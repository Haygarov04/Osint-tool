"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import type { Lead } from "@/lib/types";
import { extractDomain } from "@/lib/utils/dedup";

interface Node {
  id: string;
  lead: Lead;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Link {
  source: string;
  target: string;
  type: "city" | "domain" | "industry";
}

interface LeadGraphProps {
  leads: Lead[];
  onNodeClick?: (lead: Lead) => void;
}

const WIDTH = 820;
const HEIGHT = 520;
const NODE_RADIUS = 11;

export default function LeadGraph({ leads, onNodeClick }: LeadGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<"all" | "city" | "domain" | "industry">("all");
  const [simulationRunning, setSimulationRunning] = useState(true);

  // Build nodes + links from current leads (cap for performance)
  const { builtNodes, builtLinks } = useMemo(() => {
    const input = leads.slice(0, 90); // cap at 90 nodes for nice visuals
    const n: Node[] = input.map((lead, i) => ({
      id: lead.id,
      lead,
      x: 80 + (i % 9) * 78 + Math.random() * 30,
      y: 70 + Math.floor(i / 9) * 58 + Math.random() * 30,
      vx: 0,
      vy: 0,
    }));

    const linkList: Link[] = [];
    const byCity = new Map<string, string[]>();
    const byDomain = new Map<string, string[]>();
    const byIndustry = new Map<string, string[]>();

    for (const nd of n) {
      const l = nd.lead;
      if (l.city) {
        const key = l.city.toLowerCase().trim();
        if (!byCity.has(key)) byCity.set(key, []);
        byCity.get(key)!.push(nd.id);
      }
      const dom = l.domain || extractDomain(l.website || "");
      if (dom) {
        if (!byDomain.has(dom)) byDomain.set(dom, []);
        byDomain.get(dom)!.push(nd.id);
      }
      if (l.industry) {
        if (!byIndustry.has(l.industry)) byIndustry.set(l.industry, []);
        byIndustry.get(l.industry)!.push(nd.id);
      }
    }

    function addLinks(groups: Map<string, string[]>, type: Link["type"]) {
      for (const ids of groups.values()) {
        if (ids.length < 2) continue;
        // Connect in a light way — star or chain to avoid total hairball
        for (let i = 1; i < ids.length && i < 6; i++) {
          linkList.push({ source: ids[0], target: ids[i], type });
        }
        // a few extra cross links for bigger groups
        if (ids.length > 4) {
          linkList.push({ source: ids[1], target: ids[2], type });
        }
      }
    }

    if (linkMode === "all" || linkMode === "city") addLinks(byCity, "city");
    if (linkMode === "all" || linkMode === "domain") addLinks(byDomain, "domain");
    if (linkMode === "all" || linkMode === "industry") addLinks(byIndustry, "industry");

    return { builtNodes: n, builtLinks: linkList };
  }, [leads, linkMode]);

  // Initialize / reset positions when leads or mode change
  useEffect(() => {
    setNodes(builtNodes.map(n => ({ ...n })));
    setLinks(builtLinks);
  }, [builtNodes, builtLinks]);

  // Very lightweight force-directed simulation
  useEffect(() => {
    if (!simulationRunning || nodes.length === 0) return;

    let raf = 0;
    let iters = 0;
    const maxIters = 420;

    const step = () => {
      setNodes(prev => {
        const next = prev.map(n => ({ ...n, vx: n.vx * 0.88, vy: n.vy * 0.88 }));

        // Repulsion
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i];
            const b = next[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const force = 420 / (dist * dist + 0.1);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }

        // Attraction for links
        for (const lnk of links) {
          const a = next.find(n => n.id === lnk.source);
          const b = next.find(n => n.id === lnk.target);
          if (!a || !b) continue;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (dist - 92) * 0.028; // ideal distance ~92
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }

        // Apply + bounds
        for (const n of next) {
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(30, Math.min(WIDTH - 30, n.x));
          n.y = Math.max(30, Math.min(HEIGHT - 30, n.y));
        }

        return next;
      });

      iters++;
      if (iters < maxIters && simulationRunning) {
        raf = requestAnimationFrame(step);
      } else {
        setSimulationRunning(false);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes.length, links, simulationRunning]);

  // Mouse drag handlers
  const onMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(id);
    setSimulationRunning(false);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;

      setNodes(prev =>
        prev.map(n =>
          n.id === dragging
            ? { ...n, x: Math.max(25, Math.min(WIDTH - 25, x)), y: Math.max(25, Math.min(HEIGHT - 25, y)), vx: 0, vy: 0 }
            : n
        )
      );
    };

    const handleUp = () => {
      setDragging(null);
      // give a little life again
      setTimeout(() => setSimulationRunning(true), 60);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  const resetLayout = () => {
    setNodes(builtNodes.map((n, i) => ({
      ...n,
      x: 80 + (i % 9) * 78 + Math.random() * 40,
      y: 70 + Math.floor(i / 9) * 58 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
    })));
    setSimulationRunning(true);
  };

  const getNodeColor = (lead: Lead) => {
    if (lead.status === "customer") return "#16a34a";
    if (lead.status === "contacted") return "#ca8a04";
    if (lead.status === "replied") return "#2563eb";
    if (lead.status === "processed") return "#64748b";
    return "#7c3aed"; // new / default
  };

  const getLinkColor = (type: Link["type"]) => {
    if (type === "city") return "#3b82f6";
    if (type === "domain") return "#10b981";
    return "#a855f7";
  };

  // Current nodes for render (with live positions)
  const currentNodes = nodes.length > 0 ? nodes : builtNodes;

  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    currentNodes.forEach(n => m.set(n.id, n));
    return m;
  }, [currentNodes]);

  const visibleLinks = useMemo(() => {
    return links.filter(l => nodeById.has(l.source) && nodeById.has(l.target));
  }, [links, nodeById]);

  const handleNodeClick = (lead: Lead) => {
    onNodeClick?.(lead);
  };

  return (
    <div className="select-none">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <div className="text-slate-500 mr-1">Връзки:</div>
        {(["all", "city", "domain", "industry"] as const).map(m => (
          <button
            key={m}
            onClick={() => { setLinkMode(m); setSimulationRunning(true); }}
            className={`px-3 py-1 rounded-full border text-xs transition ${linkMode === m ? "bg-violet-600 text-white border-violet-600" : "hover:bg-slate-100"}`}
          >
            {m === "all" ? "Всички" : m === "city" ? "Град" : m === "domain" ? "Домейн" : "Индустрия"}
          </button>
        ))}

        <button
          onClick={resetLayout}
          className="ml-auto px-3 py-1 rounded-full border text-xs hover:bg-slate-50"
        >
          Reset layout
        </button>
        <button
          onClick={() => setSimulationRunning(s => !s)}
          className="px-3 py-1 rounded-full border text-xs hover:bg-slate-50"
        >
          {simulationRunning ? "Пауза" : "Пусни симулация"}
        </button>
        <div className="text-[10px] text-slate-400 ml-2">
          {currentNodes.length} nodes • drag nodes • click за детайли
        </div>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="bg-white border rounded-3xl shadow-inner cursor-crosshair"
        onClick={() => setDragging(null)}
      >
        {/* subtle grid */}
        <defs>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#f1f5f9" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#grid)" />

        {/* Edges */}
        {visibleLinks.map((lnk, idx) => {
          const a = nodeById.get(lnk.source)!;
          const b = nodeById.get(lnk.target)!;
          const color = getLinkColor(lnk.type);
          return (
            <line
              key={`${lnk.source}-${lnk.target}-${idx}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeOpacity={0.35}
              strokeWidth={lnk.type === "domain" ? 1.8 : 1.2}
            />
          );
        })}

        {/* Nodes */}
        {currentNodes.map((node) => {
          const lead = node.lead;
          const color = getNodeColor(lead);
          const isDraggingThis = dragging === node.id;
          const short = (lead.name || "?").slice(0, 18);

          return (
            <g
              key={node.id}
              onMouseDown={(e) => onMouseDown(node.id, e)}
              onClick={() => handleNodeClick(lead)}
              className="cursor-grab active:cursor-grabbing"
            >
              {/* glow */}
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + 4}
                fill={color}
                opacity={0.12}
              />
              {/* main node */}
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS}
                fill={color}
                stroke="#fff"
                strokeWidth={2.5}
                style={{ transition: isDraggingThis ? "none" : "all 0.05s" }}
              />
              {/* label */}
              <text
                x={node.x}
                y={node.y + 26}
                textAnchor="middle"
                fontSize="9"
                fill="#334155"
                className="font-medium pointer-events-none select-none"
              >
                {short}
              </text>
              {/* small quality badge */}
              {lead.qualityScore > 40 && (
                <text
                  x={node.x + NODE_RADIUS + 2}
                  y={node.y - NODE_RADIUS + 3}
                  fontSize="8"
                  fill="#0f766e"
                  className="pointer-events-none"
                >
                  {lead.qualityScore}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#7c3aed]" /> new</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#16a34a]" /> customer</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ca8a04]" /> contacted</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> city link</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" /> domain link</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#a855f7]" /> industry link</span>
      </div>
      <div className="text-[10px] text-slate-400 mt-1">
        Реален force-directed граф. Влачи възлите. Променяй филтъра за връзки горе.
      </div>
    </div>
  );
}
