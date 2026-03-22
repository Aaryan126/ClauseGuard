"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { ClauseAnalysis, Severity } from "@/types";

interface DetailPanelProps {
  clauses: ClauseAnalysis[];
  selectedIndex: number | null;
  onClauseClick: (index: number) => void;
}

const severityConfig: Record<
  Severity,
  { label: string; accent: string; bg: string; bgHover: string; border: string; dot: string }
> = {
  green: {
    label: "Standard",
    accent: "text-emerald-700",
    bg: "bg-emerald-50/60",
    bgHover: "hover:bg-gray-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  yellow: {
    label: "Needs Review",
    accent: "text-amber-700",
    bg: "bg-amber-50/60",
    bgHover: "hover:bg-gray-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  red: {
    label: "High Risk",
    accent: "text-red-700",
    bg: "bg-red-50/60",
    bgHover: "hover:bg-gray-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
};

export function DetailPanel({ clauses, selectedIndex, onClauseClick }: DetailPanelProps) {
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  if (clauses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-8">
        <p className="text-sm text-center leading-relaxed">No clauses found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-blue-900/10 bg-white sticky top-0 z-10">
        <h3 className="text-[13px] font-semibold text-blue-900">Clause Analysis</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">{clauses.length} clauses found</p>
      </div>

      <div className="divide-y divide-gray-100">
        {clauses.map((analysis, index) => {
          const isSelected = selectedIndex === index;
          const config = severityConfig[analysis.severity];

          return (
            <div key={index} ref={isSelected ? selectedRef : undefined}>
              {/* Collapsed row */}
              <button
                onClick={() => onClauseClick(isSelected ? -1 : index)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                  isSelected ? config.bg : `bg-white ${config.bgHover}`
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                    {analysis.clause.title || `Clause ${index + 1}`}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${config.accent}`}>
                    {config.label}
                    {analysis.flagSource && (
                      <span className="text-gray-400 ml-1.5 font-normal">
                        · {analysis.flagSource === "similarity" ? "by similarity" : analysis.flagSource === "pattern" ? "by pattern" : "by both"}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${
                    isSelected ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded detail */}
              {isSelected && (
                <ExpandedDetail
                  analysis={analysis}
                  config={config}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Expanded clause detail ── */

function ExpandedDetail({
  analysis,
  config,
}: {
  analysis: ClauseAnalysis;
  config: (typeof severityConfig)[Severity];
  textExpanded?: boolean;
  onToggleText?: () => void;
}) {
  const [refOpen, setRefOpen] = useState(false);
  const { bestMatch, ruleHits, severity, flagSource, explanation, normalVersion } = analysis;

  return (
    <div className={`border-t ${config.border} ${config.bg} px-4 pb-5 pt-3 space-y-5`}>
      {/* Closest standard match */}
      {bestMatch && (
        <p className="text-[11px] text-gray-400">
          Compared against: <span className="text-gray-500 font-medium">{bestMatch.standardClause.clauseName}</span>
        </p>
      )}

      {/* Flagged patterns */}
      {ruleHits.length > 0 && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Flagged Patterns
          </h4>
          <div className="space-y-1.5">
            {ruleHits.map((hit) => (
              <div
                key={hit.ruleId}
                className={`rounded-md border p-2.5 ${
                  hit.severity === "red" ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/60"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      hit.severity === "red" ? "bg-red-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="font-semibold text-[12px] text-gray-800">{hit.ruleName}</span>
                </div>
                <p className="text-[12px] text-gray-600 leading-relaxed pl-3.5">{hit.details}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Flag source */}
      {flagSource && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Why This Was Flagged
          </h4>
          <p className="text-[12px] text-gray-600 leading-relaxed">
            {flagSource === "similarity" && "This clause was flagged because its text differs significantly from industry-standard templates."}
            {flagSource === "pattern" && "This clause was flagged because it matches known aggressive contract patterns, even though its overall structure is close to standard."}
            {flagSource === "both" && "This clause was flagged both for differing from standard templates and for matching known aggressive patterns."}
          </p>
        </section>
      )}

      {/* What this means */}
      {explanation && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            What This Means
          </h4>
          <p className="text-[13px] text-gray-700 leading-[1.7]">{explanation}</p>
        </section>
      )}

      {/* What standard looks like */}
      {normalVersion && (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-400 mb-1.5">
            What Standard Looks Like
          </h4>
          <div className="rounded-md border border-blue-900/15 bg-blue-950/5 p-3">
            <p className="text-[13px] text-gray-700 leading-[1.7]">{normalVersion}</p>
          </div>
        </section>
      )}

      {/* Reference — collapsible */}
      {bestMatch && (
        <section className="border-t border-gray-200/60 pt-3">
          <button
            onClick={(e) => { e.stopPropagation(); setRefOpen(!refOpen); }}
            className="w-full flex items-center justify-between cursor-pointer group"
          >
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 group-hover:text-gray-500 transition-colors">
              Reference Standard
            </h4>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${refOpen ? "rotate-180" : ""}`} />
          </button>
          {refOpen && (
            <div className="mt-2.5">
              <p className="text-[13px] font-semibold text-gray-800">{bestMatch.standardClause.clauseName}</p>
              {bestMatch.standardClause.sourceRef && (
                <p className="text-[11px] text-gray-400 mt-0.5">{bestMatch.standardClause.sourceRef}</p>
              )}
              <p className="text-[12px] text-gray-500 leading-relaxed mt-1.5">
                {bestMatch.standardClause.summary}
              </p>
              {bestMatch.standardClause.normalRange?.description && (
                <div className="mt-2.5 pt-2.5 border-t border-gray-200/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                    Acceptable Range
                  </p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">
                    {bestMatch.standardClause.normalRange.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
