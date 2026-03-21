"use client";

import { useEffect, useState, useRef } from "react";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAnalyses, getAnalysis, deleteAnalysis, type HistoryEntry } from "@/lib/history-db";

interface HistoryDropdownProps {
  onSelect: (entry: HistoryEntry) => void;
}

const riskDot = (score: number) => {
  if (score <= 20) return "bg-emerald-500";
  if (score <= 50) return "bg-amber-500";
  return "bg-red-500";
};

type ListEntry = Omit<HistoryEntry, "fileBlob">;

export function HistoryDropdown({ onSelect }: HistoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const data = await listAnalyses();
    setEntries(data);
    setLoading(false);
  };

  const handleSelect = async (id: string) => {
    setLoadingId(id);
    const full = await getAnalysis(id);
    setLoadingId(null);
    setOpen(false);
    if (full) onSelect(full);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteAnalysis(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={toggle}>
        <Clock className="w-4 h-4 mr-1" />
        History
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Recent Analyses</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="text-center text-[12px] text-gray-400 py-6">Loading...</p>
            )}

            {!loading && entries.length === 0 && (
              <p className="text-center text-[12px] text-gray-400 py-6">No history yet.</p>
            )}

            {!loading && entries.map((entry) => {
              const date = new Date(entry.analyzedAt);
              const isLoading = loadingId === entry.id;

              return (
                <button
                  key={entry.id}
                  onClick={() => handleSelect(entry.id)}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer group border-b border-gray-50 dark:border-gray-900 last:border-b-0 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${riskDot(entry.report.overallRiskScore)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">
                        {entry.fileName}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                        <span>{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <span>·</span>
                        <span>{entry.report.totalClauses} clauses</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          {entry.report.summary.red > 0 && (
                            <span className="text-red-500">{entry.report.summary.red}R</span>
                          )}
                          {entry.report.summary.yellow > 0 && (
                            <span className="text-amber-500">{entry.report.summary.yellow}Y</span>
                          )}
                          <span className="text-emerald-500">{entry.report.summary.green}G</span>
                        </span>
                        {isLoading && <span className="text-blue-500">Loading...</span>}
                      </div>
                    </div>
                    <span
                      role="button"
                      onClick={(e) => handleDelete(e, entry.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-gray-300 transition-all cursor-pointer flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
