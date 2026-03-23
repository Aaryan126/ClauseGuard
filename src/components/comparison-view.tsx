"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnalysisReport, ClauseAnalysis, Severity } from "@/types";

interface ComparisonViewProps {
  reportA: AnalysisReport;
  reportB: AnalysisReport;
  fileNameA: string;
  fileNameB: string;
  onClauseSelect?: (indexA: number | null, indexB: number | null) => void;
}

type ChangeType = "worsened" | "added" | "removed" | "improved" | "unchanged";

interface FlatItem {
  id: string;
  title: string;
  change: ChangeType;
  clauseA?: ClauseAnalysis;
  clauseB?: ClauseAnalysis;
  indexA: number | null;
  indexB: number | null;
}

const severityOrder: Record<Severity, number> = { green: 0, yellow: 1, red: 2 };

const severityLabel: Record<Severity, string> = {
  green: "Standard",
  yellow: "Needs Review",
  red: "High Risk",
};

const severityColor: Record<Severity, string> = {
  green: "text-emerald-700",
  yellow: "text-amber-700",
  red: "text-red-700",
};

const changeConfig: Record<ChangeType, { label: string; color: string; bg: string }> = {
  worsened: { label: "Worsened", color: "text-red-600", bg: "bg-red-50" },
  added: { label: "New", color: "text-blue-900", bg: "bg-blue-50" },
  removed: { label: "Removed", color: "text-gray-500", bg: "bg-gray-50" },
  improved: { label: "Improved", color: "text-emerald-600", bg: "bg-emerald-50" },
  unchanged: { label: "Unchanged", color: "text-gray-400", bg: "bg-gray-50" },
};

const severityBg: Record<Severity, string> = {
  green: "bg-emerald-50/60",
  yellow: "bg-amber-50/60",
  red: "bg-red-50/60",
};

function buildFlatList(reportA: AnalysisReport, reportB: AnalysisReport): FlatItem[] {
  const items: FlatItem[] = [];
  const usedB = new Set<number>();

  // Match clauses
  for (let i = 0; i < reportA.clauses.length; i++) {
    const clauseA = reportA.clauses[i];
    const normalA = clauseA.clause.title.toLowerCase().trim();
    const categoryA = clauseA.bestMatch?.standardClause.category;
    const matchNameA = clauseA.bestMatch?.standardClause.clauseName;
    let bestIdx = -1;
    let bestScore = 0;

    for (let j = 0; j < reportB.clauses.length; j++) {
      if (usedB.has(j)) continue;
      const clauseB = reportB.clauses[j];
      const normalB = clauseB.clause.title.toLowerCase().trim();

      if (normalA === normalB) { bestIdx = j; bestScore = 1; break; }
      if ((normalA.includes(normalB) || normalB.includes(normalA)) && bestScore < 0.7) { bestIdx = j; bestScore = 0.7; }

      const matchNameB = clauseB.bestMatch?.standardClause.clauseName;
      if (matchNameA && matchNameB && matchNameA === matchNameB && bestScore < 0.6) { bestIdx = j; bestScore = 0.6; }

      const categoryB = clauseB.bestMatch?.standardClause.category;
      if (categoryA && categoryB && categoryA === categoryB && bestScore < 0.5) { bestIdx = j; bestScore = 0.5; }
    }

    if (bestIdx >= 0) {
      usedB.add(bestIdx);
      const clauseB = reportB.clauses[bestIdx];
      const sevA = severityOrder[clauseA.severity];
      const sevB = severityOrder[clauseB.severity];
      const change: ChangeType = sevB < sevA ? "improved" : sevB > sevA ? "worsened" : "unchanged";

      items.push({
        id: `matched-${i}`,
        title: clauseA.clause.title,
        change,
        clauseA,
        clauseB,
        indexA: i,
        indexB: bestIdx,
      });
    } else {
      items.push({
        id: `removed-${i}`,
        title: clauseA.clause.title,
        change: "removed",
        clauseA,
        indexA: i,
        indexB: null,
      });
    }
  }

  // Added in B
  for (let j = 0; j < reportB.clauses.length; j++) {
    if (usedB.has(j)) continue;
    items.push({
      id: `added-${j}`,
      title: reportB.clauses[j].clause.title,
      change: "added",
      clauseB: reportB.clauses[j],
      indexA: null,
      indexB: j,
    });
  }

  // Sort: worsened → added → removed → improved → unchanged
  const sortOrder: Record<ChangeType, number> = { worsened: 0, added: 1, removed: 2, improved: 3, unchanged: 4 };
  items.sort((a, b) => sortOrder[a.change] - sortOrder[b.change]);

  return items;
}

export function ComparisonView({ reportA, reportB, fileNameA, fileNameB, onClauseSelect }: ComparisonViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const items = buildFlatList(reportA, reportB);

  const counts: Record<ChangeType, number> = { worsened: 0, added: 0, removed: 0, improved: 0, unchanged: 0 };
  for (const item of items) counts[item.change]++;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-950 border-b-2 border-blue-900/10 px-3 py-3 flex-shrink-0">
        <p className="text-[10px] text-gray-400 truncate">{fileNameA}</p>
        <p className="text-[10px] text-gray-400 truncate">vs {fileNameB}</p>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2 text-[10px]">
          {counts.worsened > 0 && <span className="text-red-600 font-medium">{counts.worsened} worsened</span>}
          {counts.added > 0 && <span className="text-blue-900 font-medium">{counts.added} added</span>}
          {counts.removed > 0 && <span className="text-gray-500 font-medium">{counts.removed} removed</span>}
          {counts.improved > 0 && <span className="text-emerald-600 font-medium">{counts.improved} improved</span>}
          {counts.unchanged > 0 && <span className="text-gray-400">{counts.unchanged} unchanged</span>}
        </div>
      </div>

      {/* Flat clause list */}
      <div className="flex-1 overflow-y-auto divide-y divide-blue-900/20 dark:divide-blue-400/20">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const cfg = changeConfig[item.change];

          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  const next = isExpanded ? null : item.id;
                  setExpandedId(next);
                  onClauseSelect?.(next ? item.indexA : null, next ? item.indexB : null);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate">
                    {item.title}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${cfg.color}`}>
                    {cfg.label}
                    {item.clauseA && item.clauseB && (
                      <span className="text-gray-400 ml-1">
                        {severityLabel[item.clauseA.severity]} → {severityLabel[item.clauseB.severity]}
                      </span>
                    )}
                  </p>
                </div>
                {(item.clauseA?.explanation || item.clauseB?.explanation) && (
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                )}
              </button>

              {isExpanded && (item.clauseA?.explanation || item.clauseB?.explanation) && (
                <div className="px-3 pb-3 space-y-2">
                  {item.clauseA && (
                    <div className={`rounded-md border border-gray-200 p-2 ${severityBg[item.clauseA.severity]}`}>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                        Old · {severityLabel[item.clauseA.severity]}
                      </p>
                      {item.clauseA.explanation && (
                        <p className="text-[10px] text-gray-600 leading-relaxed">{item.clauseA.explanation}</p>
                      )}
                      {!item.clauseA.explanation && (
                        <p className="text-[10px] text-gray-500">Consistent with industry standards.</p>
                      )}
                    </div>
                  )}
                  {item.clauseB && (
                    <div className={`rounded-md border border-gray-200 p-2 ${severityBg[item.clauseB.severity]}`}>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                        New · {severityLabel[item.clauseB.severity]}
                      </p>
                      {item.clauseB.explanation && (
                        <p className="text-[10px] text-gray-600 leading-relaxed">{item.clauseB.explanation}</p>
                      )}
                      {!item.clauseB.explanation && (
                        <p className="text-[10px] text-gray-500">Consistent with industry standards.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
