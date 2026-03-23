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

export function SummaryBar({ report, onExportPdf }: SummaryBarProps) {
  const { summary, contractType, totalClauses, missingClauses } = report;

  return (
    <div className="bg-white dark:bg-gray-950 border-b-2 border-blue-900/10 dark:border-blue-400/10 px-5 py-3.5">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Contract type */}
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
          {contractType}
        </span>

        <span className="text-gray-200 dark:text-gray-700">|</span>

        {/* Clause breakdown */}
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

        {missingClauses.length > 0 && (
          <>
            <span className="text-gray-200 dark:text-gray-700">|</span>
            <span className="text-[11px] text-blue-900/60 dark:text-blue-400/60 font-medium">
              {missingClauses.length} suggested
            </span>
          </>
        )}

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
