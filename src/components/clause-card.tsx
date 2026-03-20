"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrafficLight } from "./traffic-light";
import { ClauseAnalysis } from "@/types";

interface ClauseCardProps {
  analysis: ClauseAnalysis;
}

export function ClauseCard({ analysis }: ClauseCardProps) {
  const [expanded, setExpanded] = useState(analysis.severity === "red");

  const { clause, bestMatch, ruleHits, severity, explanation, normalVersion } = analysis;

  const SeverityIcon = severity === "green" ? CheckCircle : severity === "yellow" ? AlertTriangle : XCircle;

  return (
    <Card
      className={`transition-all duration-200 ${
        severity === "red"
          ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10"
          : severity === "yellow"
            ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10"
            : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-t-lg"
      >
        <SeverityIcon
          className={`w-5 h-5 flex-shrink-0 ${
            severity === "green"
              ? "text-emerald-600"
              : severity === "yellow"
                ? "text-amber-500"
                : "text-red-500"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{clause.title}</h3>
            <TrafficLight severity={severity} size="sm" />
          </div>
          {bestMatch && (
            <p className="text-xs text-gray-500 mt-0.5">
              {(bestMatch.similarity * 100).toFixed(0)}% match to &ldquo;{bestMatch.standardClause.clauseName}&rdquo;
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ruleHits.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {ruleHits.length} {ruleHits.length === 1 ? "flag" : "flags"}
            </Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-4">
          {/* Clause text */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Clause Text</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded-md border">
              {clause.text}
            </p>
          </div>

          {/* Rule hits */}
          {ruleHits.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Flagged Patterns</p>
              <div className="space-y-2">
                {ruleHits.map((hit) => (
                  <div
                    key={hit.ruleId}
                    className={`text-sm p-2 rounded-md border-l-4 ${
                      hit.severity === "red"
                        ? "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                        : "border-l-amber-400 bg-amber-50 dark:bg-amber-950/20"
                    }`}
                  >
                    <span className="font-medium">{hit.ruleName}:</span> {hit.details}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Explanation */}
          {explanation && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> Analysis
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{explanation}</p>
            </div>
          )}

          {/* What normal looks like */}
          {normalVersion && (
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> What Standard Looks Like
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md border border-emerald-200 dark:border-emerald-900">
                {normalVersion}
              </p>
            </div>
          )}

          {/* Matched standard clause */}
          {bestMatch && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Closest Standard Clause ({(bestMatch.similarity * 100).toFixed(0)}% match)
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-md border">
                <span className="font-medium">{bestMatch.standardClause.clauseName}:</span>{" "}
                {bestMatch.standardClause.summary}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
