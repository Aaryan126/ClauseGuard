"use client";

import { CheckCircle, AlertTriangle, XCircle, Info, Scale, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ClauseAnalysis, Severity } from "@/types";

interface DetailPanelProps {
  analysis: ClauseAnalysis | null;
}

const severityConfig: Record<Severity, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  green: { label: "Standard", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  yellow: { label: "Needs Review", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: AlertTriangle },
  red: { label: "High Risk", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
};

export function DetailPanel({ analysis }: DetailPanelProps) {
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
    <div className="space-y-4 overflow-y-auto">
      {/* Severity header */}
      <div className={`rounded-lg border p-4 ${config.bg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <span className={`text-lg font-bold ${config.color}`}>{config.label}</span>
        </div>
        <p className="text-sm font-medium mt-1 text-gray-800">{clause.title}</p>
        {bestMatch && (
          <p className="text-xs text-gray-500 mt-1">
            {(bestMatch.similarity * 100).toFixed(0)}% match to &ldquo;{bestMatch.standardClause.clauseName}&rdquo;
          </p>
        )}
      </div>

      {/* Similarity meter */}
      {bestMatch && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Similarity to Standard</span>
            <span className="font-mono">{(bestMatch.similarity * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                severity === "green"
                  ? "bg-emerald-500"
                  : severity === "yellow"
                    ? "bg-amber-400"
                    : "bg-red-500"
              }`}
              style={{ width: `${Math.max(bestMatch.similarity * 100, 5)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>0%</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-300">|</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Rule hits */}
      {ruleHits.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Flagged Patterns
          </h4>
          <div className="space-y-2">
            {ruleHits.map((hit) => (
              <div
                key={hit.ruleId}
                className={`text-sm p-3 rounded-lg border-l-4 ${
                  hit.severity === "red"
                    ? "border-l-red-500 bg-red-50"
                    : "border-l-amber-400 bg-amber-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge
                    variant={hit.severity === "red" ? "destructive" : "outline"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {hit.severity.toUpperCase()}
                  </Badge>
                  <span className="font-semibold text-xs">{hit.ruleName}</span>
                </div>
                <p className="text-xs text-gray-600">{hit.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Explanation */}
      {explanation && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1">
            <Info className="w-3 h-3" /> Analysis
          </h4>
          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border">
            {explanation}
          </p>
        </div>
      )}

      {/* What normal looks like */}
      {normalVersion && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> What Standard Looks Like
          </h4>
          <p className="text-sm text-gray-700 leading-relaxed bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            {normalVersion}
          </p>
        </div>
      )}

      {/* Matched standard clause */}
      {bestMatch && (
        <div>
          <Separator className="my-2" />
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1">
            <Scale className="w-3 h-3" /> Matched Standard Clause
          </h4>
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">
                {bestMatch.standardClause.clauseName}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {bestMatch.standardClause.summary}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
