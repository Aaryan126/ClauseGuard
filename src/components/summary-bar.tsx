"use client";

import { Shield, ArrowLeft, Download } from "lucide-react";
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

  const riskColor =
    overallRiskScore <= 20
      ? "text-emerald-600"
      : overallRiskScore <= 50
        ? "text-amber-500"
        : "text-red-500";

  const riskBgBar =
    overallRiskScore <= 20
      ? "bg-emerald-500"
      : overallRiskScore <= 50
        ? "bg-amber-400"
        : "bg-red-500";

  const riskLabel =
    overallRiskScore <= 20
      ? "Low Risk"
      : overallRiskScore <= 50
        ? "Moderate Risk"
        : "High Risk";

  return (
    <div className="bg-white dark:bg-gray-950 border-b px-4 py-4">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Risk score */}
        <div className="flex items-center gap-2">
          <Shield className={`w-5 h-5 ${riskColor}`} />
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${riskColor}`}>{overallRiskScore}</span>
            <div>
              <p className={`text-sm font-semibold leading-tight ${riskColor}`}>{riskLabel}</p>
              <p className="text-[10px] text-gray-400">{contractType}</p>
            </div>
          </div>
        </div>

        {/* Risk bar */}
        <div className="flex-1 min-w-[120px] max-w-[200px]">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${riskBgBar}`}
              style={{ width: `${Math.min(overallRiskScore, 100)}%` }}
            />
          </div>
        </div>

        {/* Breakdown counts */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-bold text-emerald-600">{summary.green}</span>
            <span className="text-xs text-gray-400">ok</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="font-bold text-amber-500">{summary.yellow}</span>
            <span className="text-xs text-gray-400">review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="font-bold text-red-600">{summary.red}</span>
            <span className="text-xs text-gray-400">risk</span>
          </div>
        </div>

        <span className="text-xs text-gray-400">{totalClauses} clauses</span>

        {/* Export — pushed to the right */}
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
