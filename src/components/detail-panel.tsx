"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Bookmark } from "lucide-react";
import { ClauseAnalysis, ContractType, MissingClause, Severity } from "@/types";
import { saveClause, deleteClause } from "@/lib/clause-library";

/* ── Word-level diff for highlighting changes in proposed revision ── */

function tokenize(text: string): string[] {
  return text.split(/(\s+)/); // keeps whitespace as tokens so we can reconstruct
}

function computeLCS(a: string[], b: string[]): Set<number> {
  // Returns indices in `b` that are part of the longest common subsequence with `a`
  const m = a.length;
  const n = b.length;

  // Build LCS table (optimize: only need two rows)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i].toLowerCase() === b[j].toLowerCase()) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Trace back to find which indices in b are matched
  const matched = new Set<number>();
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i].toLowerCase() === b[j].toLowerCase()) {
      matched.add(j);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return matched;
}

function DiffRevision({ original, revision }: { original: string; revision: string }) {
  const origTokens = tokenize(original);
  const revTokens = tokenize(revision);
  const matched = computeLCS(origTokens, revTokens);

  return (
    <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-[1.7] whitespace-pre-wrap">
      {revTokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token);
        if (isWhitespace || matched.has(i)) {
          return <span key={i}>{token}</span>;
        }
        return (
          <span key={i} className="font-bold">
            {token}
          </span>
        );
      })}
    </p>
  );
}

interface DetailPanelProps {
  clauses: ClauseAnalysis[];
  missingClauses: MissingClause[];
  contractType: ContractType;
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
    label: "Review",
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

export function DetailPanel({ clauses, missingClauses, contractType, selectedIndex, onClauseClick }: DetailPanelProps) {
  const selectedRef = useRef<HTMLDivElement>(null);
  // Maps clause index → library ID (if saved)
  const [savedMap, setSavedMap] = useState<Map<number, string>>(new Map());

  const handleToggleSave = async (index: number, analysis: ClauseAnalysis) => {
    const existingId = savedMap.get(index);
    if (existingId) {
      // Already saved — remove from library
      await deleteClause(existingId);
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.delete(index);
        return next;
      });
    } else {
      // Save to library
      const text = analysis.proposedRevision || analysis.clause.text;
      const id = await saveClause({
        contractType,
        category: analysis.bestMatch?.standardClause.category || "General",
        title: analysis.clause.title,
        text,
      });
      setSavedMap((prev) => new Map(prev).set(index, id));
    }
  };

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  const [activeTab, setActiveTab] = useState<"clauses" | "suggestions">("clauses");

  if (clauses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-8">
        <p className="text-sm text-center leading-relaxed">No clauses found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b-2 border-blue-900/10 bg-white sticky top-0 z-10 flex-shrink-0">
        <button
          onClick={() => setActiveTab("clauses")}
          className={`flex-1 px-4 py-3 text-[13px] font-semibold transition-colors cursor-pointer ${
            activeTab === "clauses"
              ? "text-blue-900 border-b-2 border-blue-900 -mb-[2px]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Clauses
          <span className={`ml-1.5 text-[11px] font-medium ${activeTab === "clauses" ? "text-blue-900/60" : "text-gray-400"}`}>
            {clauses.length}
          </span>
        </button>
        {missingClauses.length > 0 && (
          <button
            onClick={() => setActiveTab("suggestions")}
            className={`flex-1 px-4 py-3 text-[13px] font-semibold transition-colors cursor-pointer ${
              activeTab === "suggestions"
                ? "text-blue-900 border-b-2 border-blue-900 -mb-[2px]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Suggestions
            <span className={`ml-1.5 text-[11px] font-medium ${activeTab === "suggestions" ? "text-blue-900/60" : "text-gray-400"}`}>
              {missingClauses.length}
            </span>
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "clauses" && (
          <div className="divide-y divide-blue-900/30 dark:divide-blue-400/30">
            {clauses.map((analysis, index) => {
              const isSelected = selectedIndex === index;
              const config = severityConfig[analysis.severity];
              const hasContent = analysis.explanation || analysis.ruleHits.length > 0 || analysis.suggestedAction || analysis.proposedRevision;

              return (
                <div key={index} ref={isSelected ? selectedRef : undefined}>
                  <button
                    onClick={() => hasContent ? onClauseClick(isSelected ? -1 : index) : undefined}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${hasContent ? "cursor-pointer" : "cursor-default"} ${
                      isSelected ? config.bg : `bg-white ${hasContent ? config.bgHover : ""}`
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                        {analysis.clause.title || `Clause ${index + 1}`}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${config.accent}`}>
                        {config.label}
                      </p>
                    </div>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSave(index, analysis);
                      }}
                      className={`flex-shrink-0 p-1 rounded transition-colors cursor-pointer ${
                        savedMap.has(index)
                          ? "text-blue-900 dark:text-blue-400"
                          : "text-gray-300 hover:text-blue-900/60 dark:hover:text-blue-400/60"
                      }`}
                      title={savedMap.has(index) ? "Remove from library" : "Save to library"}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${savedMap.has(index) ? "fill-current" : ""}`} />
                    </span>
                    {hasContent && (
                      <ChevronDown
                        className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${
                          isSelected ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </button>

                  {isSelected && hasContent && (
                    <ExpandedDetail
                      analysis={analysis}
                      config={config}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "suggestions" && (
          <div>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[12px] text-gray-500 leading-relaxed">
                Standard clauses commonly found in this type of contract that may be worth including.
              </p>
            </div>
            <div className="divide-y divide-blue-900/30 dark:divide-blue-400/30">
              {missingClauses.map((mc) => (
                <div key={mc.category} className="px-4 py-3 bg-white">
                  <p className="text-[13px] font-medium text-gray-800">{mc.clauseName}</p>
                  <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed">{mc.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Expanded clause detail — progressive disclosure ── */

function ExpandedDetail({
  analysis,
  config,
}: {
  analysis: ClauseAnalysis;
  config: (typeof severityConfig)[Severity];
}) {
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const { bestMatch, ruleHits, severity, explanation, normalVersion, suggestedAction, proposedRevision } = analysis;

  const hasMore = proposedRevision || normalVersion || (severity !== "green" && bestMatch && bestMatch.similarity >= 0.65);

  return (
    <div className={`border-t ${config.border} ${config.bg} px-4 pb-4 pt-3 space-y-4`}>

      {/* ── Primary: Explanation + suggested action (always visible) ── */}
      {explanation && (
        <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-[1.7]">{explanation}</p>
      )}

      {ruleHits.length > 0 && (
        <div className="space-y-1.5">
          {ruleHits.map((hit) => (
            <div key={hit.ruleId} className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                hit.severity === "red" ? "bg-red-500" : "bg-amber-500"
              }`} />
              <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{hit.ruleName}:</span> {hit.details}
              </p>
            </div>
          ))}
        </div>
      )}

      {suggestedAction && (
        <div className="rounded-md bg-blue-950/5 dark:bg-blue-900/10 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-900/60 dark:text-blue-400/60 mb-1">Recommended</p>
          <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-[1.6]">{suggestedAction}</p>
        </div>
      )}

      {/* ── Show more toggle ── */}
      {hasMore && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowMore(!showMore); }}
          className="text-[11px] font-medium text-blue-900/50 hover:text-blue-900 dark:text-blue-400/50 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1"
        >
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} />
          {showMore ? "Show less" : "Show revision & details"}
        </button>
      )}

      {/* ── Secondary: Proposed revision, standard comparison, reference ── */}
      {showMore && (
        <div className="space-y-4">
          {/* Proposed revision */}
          {proposedRevision && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-400">Proposed Revision</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(proposedRevision);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-[11px] font-medium text-blue-900/50 hover:text-blue-900 dark:text-blue-400/50 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="rounded-md border border-blue-900/15 dark:border-blue-400/15 bg-white dark:bg-gray-900 p-3">
                <DiffRevision original={analysis.clause.text} revision={proposedRevision} />
              </div>
            </div>
          )}

          {/* What standard looks like */}
          {normalVersion && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">What Standard Looks Like</p>
              <p className="text-[12px] text-gray-500 leading-[1.7]">{normalVersion}</p>
            </div>
          )}

          {/* Reference standard */}
          {severity !== "green" && bestMatch && bestMatch.similarity >= 0.65 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Reference Standard</p>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{bestMatch.standardClause.clauseName}</p>
              {bestMatch.standardClause.sourceRef && (
                <p className="text-[11px] text-gray-400 mt-0.5">{bestMatch.standardClause.sourceRef}</p>
              )}
              <p className="text-[12px] text-gray-500 leading-relaxed mt-1">{bestMatch.standardClause.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
