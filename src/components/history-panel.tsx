"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { listAnalyses, getAnalysis, deleteAnalysis, type HistoryEntry } from "@/lib/history-db";

interface HistoryPanelProps {
  onSelect: (entry: HistoryEntry) => void;
}

const riskColor = (score: number) => {
  if (score <= 20) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score <= 50) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
};

const riskLabel = (score: number) => {
  if (score <= 20) return "Low Risk";
  if (score <= 50) return "Moderate";
  return "High Risk";
};

type ListEntry = Omit<HistoryEntry, "fileBlob">;

export function HistoryPanel({ onSelect }: HistoryPanelProps) {
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await listAnalyses();
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelect = async (id: string) => {
    setLoadingId(id);
    const full = await getAnalysis(id);
    setLoadingId(null);
    if (full) onSelect(full);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteAnalysis(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">Loading history...</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-gray-400 text-sm">No analyses yet.</p>
        <p className="text-gray-400 text-xs">Upload a contract to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Analysis History
        </h2>
        <p className="text-sm text-gray-500">
          {entries.length} {entries.length === 1 ? "analysis" : "analyses"} saved
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-2">
        {entries.map((entry) => {
          const { report } = entry;
          const date = new Date(entry.analyzedAt);
          const isLoading = loadingId === entry.id;

          return (
            <button
              key={entry.id}
              onClick={() => handleSelect(entry.id)}
              disabled={isLoading}
              className="w-full text-left border border-gray-200 rounded-lg px-4 py-3.5 hover:border-gray-300 hover:bg-gray-50/50 transition-colors cursor-pointer group disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-gray-900 truncate">
                    {entry.fileName}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[12px] text-gray-400">
                    <span>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span>·</span>
                    <span>{report.contractType}</span>
                    <span>·</span>
                    <span>{report.totalClauses} clauses</span>
                    {isLoading && <span className="text-blue-500 ml-1">Loading...</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {/* Severity dots */}
                  <div className="flex items-center gap-2 text-[12px] tabular-nums">
                    {report.summary.red > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {report.summary.red}
                      </span>
                    )}
                    {report.summary.yellow > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {report.summary.yellow}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {report.summary.green}
                    </span>
                  </div>

                  {/* Risk badge */}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${riskColor(report.overallRiskScore)}`}>
                    {riskLabel(report.overallRiskScore)}
                  </span>

                  {/* Delete */}
                  <span
                    role="button"
                    onClick={(e) => handleDelete(e, entry.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-gray-300 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
