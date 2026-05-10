"use client";

import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type NodeKind = "connector" | "classifier" | "risk" | "identity";
type Classification = "public" | "internal" | "sensitive";

interface GraphNode {
  id: string;
  label: string;
  meta: string;
  x: number;
  y: number;
  kind: NodeKind;
  classification: Classification;
  pulseDelay: number;
}

interface GraphEdge {
  from: string;
  to: string;
  delay: number;
}

interface DataGraphVisualProps {
  compact?: boolean;
  className?: string;
}

const NODES: GraphNode[] = [
  // Connectors (left)
  { id: "s3", label: "AWS S3", meta: "1.2M objects", x: 60, y: 60, kind: "connector", classification: "internal", pulseDelay: 0 },
  { id: "snow", label: "Snowflake", meta: "84 schemas", x: 60, y: 140, kind: "connector", classification: "sensitive", pulseDelay: 0.3 },
  { id: "sf", label: "Salesforce", meta: "412k records", x: 60, y: 220, kind: "connector", classification: "sensitive", pulseDelay: 0.6 },
  { id: "gh", label: "GitHub", meta: "238 repos", x: 60, y: 300, kind: "connector", classification: "public", pulseDelay: 0.9 },
  // Classifier (middle)
  { id: "clf", label: "Classifier", meta: "ML + rules", x: 250, y: 180, kind: "classifier", classification: "internal", pulseDelay: 0.2 },
  { id: "lin", label: "Lineage", meta: "Graph DB", x: 250, y: 90, kind: "classifier", classification: "internal", pulseDelay: 0.5 },
  { id: "tag", label: "Auto-Tag", meta: "1.4k labels", x: 250, y: 270, kind: "classifier", classification: "internal", pulseDelay: 0.8 },
  // Risk + Identity (right)
  { id: "risk", label: "Risk Engine", meta: "Score: 78", x: 440, y: 80, kind: "risk", classification: "sensitive", pulseDelay: 0.1 },
  { id: "pii", label: "PII Vault", meta: "82k subjects", x: 440, y: 170, kind: "risk", classification: "sensitive", pulseDelay: 0.4 },
  { id: "iam", label: "Identity", meta: "12.4k users", x: 440, y: 260, kind: "identity", classification: "internal", pulseDelay: 0.7 },
  { id: "dsr", label: "DSAR", meta: "47 open", x: 440, y: 340, kind: "identity", classification: "sensitive", pulseDelay: 1.0 },
];

const EDGES: GraphEdge[] = [
  { from: "s3", to: "lin", delay: 0 },
  { from: "s3", to: "clf", delay: 0.1 },
  { from: "snow", to: "clf", delay: 0.2 },
  { from: "sf", to: "clf", delay: 0.3 },
  { from: "sf", to: "tag", delay: 0.4 },
  { from: "gh", to: "tag", delay: 0.5 },
  { from: "lin", to: "risk", delay: 0.6 },
  { from: "clf", to: "risk", delay: 0.7 },
  { from: "clf", to: "pii", delay: 0.8 },
  { from: "tag", to: "pii", delay: 0.9 },
  { from: "tag", to: "iam", delay: 1.0 },
  { from: "pii", to: "dsr", delay: 1.1 },
  { from: "iam", to: "dsr", delay: 1.2 },
];

const classColor = (c: Classification) => {
  if (c === "public") return { stroke: "#10b981", fill: "rgba(16,185,129,0.18)" };
  if (c === "internal") return { stroke: "#f59e0b", fill: "rgba(245,158,11,0.16)" };
  return { stroke: "#ef4444", fill: "rgba(239,68,68,0.18)" };
};

export function DataGraphVisual({ compact = false, className }: DataGraphVisualProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const nodeMap = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);

  const height = compact ? 320 : 420;

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox="0 0 540 400"
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Data flow graph"
      >
        <defs>
          <linearGradient id="dg-edge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id="dg-node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
          <pattern id="dg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="540" height="400" fill="url(#dg-grid)" />

        {/* Cluster labels */}
        <text x="60" y="32" fill="rgba(148,163,184,0.7)" fontSize="10" fontWeight="600" letterSpacing="2">
          CONNECTORS
        </text>
        <text x="250" y="32" fill="rgba(148,163,184,0.7)" fontSize="10" fontWeight="600" letterSpacing="2">
          CLASSIFY
        </text>
        <text x="440" y="32" fill="rgba(148,163,184,0.7)" fontSize="10" fontWeight="600" letterSpacing="2">
          RISK · IDENTITY
        </text>

        {/* Edges */}
        {EDGES.map((edge) => {
          const a = nodeMap.get(edge.from);
          const b = nodeMap.get(edge.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const path = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
          const isActive = hovered === edge.from || hovered === edge.to;
          return (
            <motion.path
              key={`${edge.from}-${edge.to}`}
              d={path}
              fill="none"
              stroke="url(#dg-edge)"
              strokeWidth={isActive ? 2 : 1.2}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: isActive ? 1 : 0.55 }}
              transition={{
                pathLength: { duration: 1.4, delay: edge.delay, ease: "easeInOut" },
                opacity: { duration: 0.3 },
              }}
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((n) => {
          const c = classColor(n.classification);
          const isHovered = hovered === n.id;
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={26}
                fill="url(#dg-node-glow)"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: isHovered ? 0.9 : 0.5, scale: isHovered ? 1.2 : 1 }}
                transition={{ duration: 0.3 }}
              />
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={14}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth={1.5}
                className="animate-pulse-node"
                style={{ animationDelay: `${n.pulseDelay}s` }}
                initial={{ scale: 0 }}
                animate={{ scale: isHovered ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
              />
              <circle cx={n.x} cy={n.y} r={4} fill={c.stroke} />
              <text
                x={n.x}
                y={n.y + 32}
                textAnchor="middle"
                fill="rgba(226,232,240,0.95)"
                fontSize="11"
                fontWeight="600"
              >
                {n.label}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {hovered &&
          (() => {
            const n = nodeMap.get(hovered);
            if (!n) return null;
            const tx = Math.min(Math.max(n.x - 70, 8), 540 - 148);
            const ty = n.y - 60 < 8 ? n.y + 42 : n.y - 60;
            return (
              <motion.g
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <rect
                  x={tx}
                  y={ty}
                  width={140}
                  height={44}
                  rx={8}
                  fill="rgba(3,7,18,0.95)"
                  stroke="rgba(59,130,246,0.4)"
                />
                <text x={tx + 10} y={ty + 18} fill="#e2e8f0" fontSize="11" fontWeight="600">
                  {n.label}
                </text>
                <text x={tx + 10} y={ty + 34} fill="rgba(148,163,184,0.9)" fontSize="10">
                  {n.meta} · {n.classification}
                </text>
              </motion.g>
            );
          })()}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Public
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Internal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Sensitive / PII
        </span>
      </div>
    </div>
  );
}

export default DataGraphVisual;
