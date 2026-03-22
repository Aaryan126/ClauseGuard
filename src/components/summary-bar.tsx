"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalysisReport } from "@/types";

interface SummaryBarProps {
  report: AnalysisReport;
  fileName: string;
  onNewAnalysis: () => void;
  onExportPdf: () => void;
}

export function SummaryBar({ report, fileName, onNewAnalysis, onExportPdf }: SummaryBarProps) {
  const { summary, overallRiskScore, contractType, totalClauses } = report;

  const riskLabel =
    overallRiskScore <= 20
      ? "Low Risk"
      : overallRiskScore <= 50
        ? "Moderate Risk"
        : "High Risk";

  const riskBarBg =
    overallRiskScore <= 20
      ? "bg-emerald-500"
      : overallRiskScore <= 50
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="bg-white dark:bg-gray-950 border-b-2 border-blue-900/10 dark:border-blue-400/10 px-5 py-4">
      <div className="flex items-center gap-8 flex-wrap">
        {/* Risk score */}
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold tabular-nums tracking-tight text-blue-900 dark:text-blue-300">
            {overallRiskScore}
          </span>
          <div>
            <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 leading-tight">{riskLabel}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{contractType}</p>
          </div>
        </div>

        {/* Risk bar */}
        <div className="flex-1 min-w-[100px] max-w-[180px]">
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${riskBarBg}`}
              style={{ width: `${Math.min(overallRiskScore, 100)}%` }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex items-center gap-4 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-bold text-gray-800 dark:text-gray-200">{summary.green}</span>
            <span className="text-gray-400 text-[11px]">ok</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-bold text-gray-800 dark:text-gray-200">{summary.yellow}</span>
            <span className="text-gray-400 text-[11px]">review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="font-bold text-gray-800 dark:text-gray-200">{summary.red}</span>
            <span className="text-gray-400 text-[11px]">risk</span>
          </div>
        </div>

        <span className="text-[11px] text-gray-400">{totalClauses} clauses</span>

        {/* Export */}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={onExportPdf}>
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
