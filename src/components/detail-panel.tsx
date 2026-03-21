"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, Scale, FileText, ShieldAlert, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ClauseAnalysis, Severity } from "@/types";

interface DetailPanelProps {
  analysis: ClauseAnalysis | null;
}

const severityConfig: Record<Severity, { label: string; subtitle: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  green: {
    label: "Standard",
    subtitle: "This clause is consistent with industry norms.",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    icon: CheckCircle,
  },
  yellow: {
    label: "Needs Review",
    subtitle: "This clause deviates from standard and should be reviewed carefully.",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
  },
  red: {
    label: "High Risk",
    subtitle: "This clause is significantly different from industry standards or contains aggressive terms.",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: XCircle,
  },
};

export function DetailPanel({ analysis }: DetailPanelProps) {
  const [textExpanded, setTextExpanded] = useState(false);

  // Reset collapsed state when a different clause is selected
  useEffect(() => {
    setTextExpanded(false);
  }, [analysis?.clause.index]);

  if (!analysis) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-8">
        <div className="text-center space-y-2">
          <FileText className="w-10 h-10 mx-auto opacity-50" />
          <p className="text-sm">Click on a clause in the document to see its analysis</p>
        </div>
      </div>
    );
  }

  const { clause, bestMatch, ruleHits, severity, explanation, normalVersion } = analysis;
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div className="space-y-5 overflow-y-auto">
      {/* ── Severity header ── */}
      <div className={`rounded-lg border p-4 ${config.bg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <span className={`text-lg font-bold ${config.color}`}>{config.label}</span>
        </div>
        <p className="text-[15px] font-semibold mt-2 text-gray-900">{clause.title}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{config.subtitle}</p>
      </div>

      {/* ── Clause text from contract ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">From Your Contract</h4>
        </div>
        <div className="bg-white border rounded-lg overflow-hidden">
          <div
            className={`text-[12.5px] text-gray-700 leading-[1.65] p-3 whitespace-pre-wrap ${
              textExpanded ? "" : "max-h-[120px] overflow-hidden"
            }`}
          >
            {clause.text}
          </div>
          {clause.text.length > 200 && (
            <button
              onClick={() => setTextExpanded(!textExpanded)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 border-t transition-colors cursor-pointer"
            >
              {textExpanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Show full clause</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Similarity meter ── */}
      {bestMatch && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Similarity to Standard</span>
            <span className="text-sm font-bold font-mono tabular-nums"
              style={{ color: severity === "green" ? "#059669" : severity === "yellow" ? "#d97706" : "#dc2626" }}
            >
              {(bestMatch.similarity * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                severity === "green" ? "bg-emerald-500" : severity === "yellow" ? "bg-amber-400" : "bg-red-500"
              }`}
              style={{ width: `${Math.max(bestMatch.similarity * 100, 5)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Closest match: <span className="font-medium text-gray-500">{bestMatch.standardClause.clauseName}</span>
          </p>
        </div>
      )}

      {/* ── Flagged patterns ── */}
      {ruleHits.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-600">
              Flagged Patterns
              <span className="ml-1.5 text-red-500">({ruleHits.length})</span>
            </h4>
          </div>
          <div className="space-y-2.5">
            {ruleHits.map((hit) => (
              <div
                key={hit.ruleId}
                className={`p-3 rounded-lg border-l-4 ${
                  hit.severity === "red"
                    ? "border-l-red-500 bg-red-50"
                    : "border-l-amber-400 bg-amber-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Badge
                    variant={hit.severity === "red" ? "destructive" : "outline"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {hit.severity.toUpperCase()}
                  </Badge>
                  <span className="font-bold text-xs text-gray-800">{hit.ruleName}</span>
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed">{hit.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Explanation ── */}
      {explanation && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-600">What This Means</h4>
          </div>
          <div className="text-[13px] text-gray-700 leading-[1.7] bg-white p-4 rounded-lg border shadow-sm">
            {explanation}
          </div>
        </div>
      )}

      {/* ── What standard looks like ── */}
      {normalVersion && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-700">What Standard Looks Like</h4>
          </div>
          <div className="text-[13px] text-gray-700 leading-[1.7] bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            {normalVersion}
          </div>
        </div>
      )}

      {/* ── Matched standard clause reference ── */}
      {bestMatch && (
        <div>
          <Separator className="my-1" />
          <div className="flex items-center gap-1.5 mb-2.5 mt-3">
            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Reference Standard</h4>
          </div>
          <Card className="bg-gray-50/80 border-gray-200">
            <CardContent className="p-3.5">
              <p className="text-[13px] font-bold text-gray-800 mb-1">
                {bestMatch.standardClause.clauseName}
              </p>
              {bestMatch.standardClause.source && (
                <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wide">
                  Source: {bestMatch.standardClause.sourceRef}
                </p>
              )}
              <p className="text-[12px] text-gray-500 leading-relaxed">
                {bestMatch.standardClause.summary}
              </p>
              {bestMatch.standardClause.normalRange && (
                <p className="text-[11px] text-gray-400 leading-relaxed mt-2 pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-500">Acceptable range:</span>{" "}
                  {bestMatch.standardClause.normalRange.description}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
