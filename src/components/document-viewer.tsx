"use client";

import { useRef, useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { ClauseAnalysis, Severity } from "@/types";

interface DocumentViewerProps {
  clauses: ClauseAnalysis[];
  selectedIndex: number | null;
  onClauseClick: (index: number) => void;
}

const severityBg: Record<Severity, string> = {
  green: "bg-emerald-50 hover:bg-emerald-100/80 border-l-emerald-400",
  yellow: "bg-amber-50 hover:bg-amber-100/80 border-l-amber-400",
  red: "bg-red-50 hover:bg-red-100/80 border-l-red-400",
};

const severityBgSelected: Record<Severity, string> = {
  green: "bg-emerald-100 border-l-emerald-600 ring-2 ring-emerald-300",
  yellow: "bg-amber-100 border-l-amber-600 ring-2 ring-amber-300",
  red: "bg-red-100 border-l-red-600 ring-2 ring-red-300",
};

const SeverityIcon = ({ severity, className }: { severity: Severity; className?: string }) => {
  const props = { className: `w-4 h-4 flex-shrink-0 ${className || ""}` };
  switch (severity) {
    case "green": return <CheckCircle {...props} />;
    case "yellow": return <AlertTriangle {...props} />;
    case "red": return <XCircle {...props} />;
  }
};

const severityIconColor: Record<Severity, string> = {
  green: "text-emerald-600",
  yellow: "text-amber-500",
  red: "text-red-500",
};

export function DocumentViewer({ clauses, selectedIndex, onClauseClick }: DocumentViewerProps) {
  const clauseRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (selectedIndex !== null && clauseRefs.current[selectedIndex]) {
      clauseRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedIndex]);

  return (
    <div className="space-y-1">
      {clauses.map((analysis, i) => {
        const isSelected = selectedIndex === i;
        const bg = isSelected
          ? severityBgSelected[analysis.severity]
          : severityBg[analysis.severity];

        return (
          <div
            key={i}
            ref={(el) => { clauseRefs.current[i] = el; }}
            onClick={() => onClauseClick(i)}
            className={`
              border-l-4 rounded-r-md px-4 py-3 cursor-pointer transition-all duration-150
              ${bg}
            `}
          >
            {/* Clause header */}
            <div className="flex items-center gap-2 mb-1">
              <SeverityIcon
                severity={analysis.severity}
                className={severityIconColor[analysis.severity]}
              />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {analysis.clause.title}
              </span>
              {analysis.ruleHits.length > 0 && (
                <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                  {analysis.ruleHits.length} {analysis.ruleHits.length === 1 ? "flag" : "flags"}
                </span>
              )}
              {analysis.bestMatch && (
                <span className="text-[10px] text-gray-400 ml-auto">
                  {(analysis.bestMatch.similarity * 100).toFixed(0)}% match
                </span>
              )}
            </div>

            {/* Clause text */}
            <p className={`text-sm leading-relaxed whitespace-pre-wrap text-gray-800 ${
              isSelected ? "" : "line-clamp-4"
            }`}>
              {analysis.clause.text}
            </p>

            {!isSelected && analysis.clause.text.length > 300 && (
              <span className="text-xs text-gray-400 mt-1 block">Click to expand...</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
