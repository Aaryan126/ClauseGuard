"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Shield, FileCheck, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { AnalysisReport } from "@/types";

interface ReportSummaryProps {
  report: AnalysisReport;
}

export function ReportSummary({ report }: ReportSummaryProps) {
  const { summary, overallRiskScore, contractType, totalClauses } = report;

  const riskColor =
    overallRiskScore <= 20
      ? "text-emerald-600"
      : overallRiskScore <= 50
        ? "text-amber-500"
        : "text-red-500";

  const riskLabel =
    overallRiskScore <= 20
      ? "Low Risk"
      : overallRiskScore <= 50
        ? "Moderate Risk"
        : "High Risk";

  const riskBg =
    overallRiskScore <= 20
      ? "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20"
      : overallRiskScore <= 50
        ? "from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20"
        : "from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20";

  return (
    <div className="space-y-4">
      {/* Overall Risk Score */}
      <Card className={`bg-gradient-to-br ${riskBg} border-none`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className={`w-5 h-5 ${riskColor}`} />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Risk Assessment</span>
              </div>
              <p className={`text-3xl font-bold ${riskColor}`}>{riskLabel}</p>
              <p className="text-sm text-gray-500 mt-1">
                {contractType} &middot; {totalClauses} clauses analyzed
              </p>
            </div>
            <div className={`text-5xl font-bold ${riskColor}`}>{overallRiskScore}</div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-emerald-600">{summary.green}</p>
              <p className="text-xs text-gray-500">Standard</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-amber-500">{summary.yellow}</p>
              <p className="text-xs text-gray-500">Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.red}</p>
              <p className="text-xs text-gray-500">Risk</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
