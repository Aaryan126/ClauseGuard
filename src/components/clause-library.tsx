"use client";

import { useEffect, useState, useRef } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listClauses, deleteClause, type SavedClause } from "@/lib/clause-library";

export function ClauseLibraryDropdown() {
  const [open, setOpen] = useState(false);
  const [clauses, setClauses] = useState<SavedClause[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    const data = await listClauses();
    setClauses(data);
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteClause(id);
    setClauses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCopy = (e: React.MouseEvent, clause: SavedClause) => {
    e.stopPropagation();
    navigator.clipboard.writeText(clause.text);
    setCopiedId(clause.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={toggle}>
        <BookOpen className="w-4 h-4 mr-1" />
        Library
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Clause Library</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="text-center text-[12px] text-gray-400 py-6">Loading...</p>
            )}

            {!loading && clauses.length === 0 && (
              <p className="text-center text-[12px] text-gray-400 py-6">No saved clauses yet.</p>
            )}

            {!loading && clauses.map((clause) => {
              const isExpanded = expandedId === clause.id;

              return (
                <div key={clause.id} className="border-b border-gray-50 dark:border-gray-900 last:border-b-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : clause.id)}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">
                          {clause.title}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                          <span>{clause.contractType.toUpperCase()}</span>
                          <span>·</span>
                          <span>{clause.category}</span>
                        </div>
                      </div>
                      <span
                        role="button"
                        onClick={(e) => handleDelete(e, clause.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-gray-300 transition-all cursor-pointer flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {clause.text}
                      </div>
                      <button
                        onClick={(e) => handleCopy(e, clause)}
                        className="mt-2 text-[11px] font-medium text-blue-900/50 hover:text-blue-900 dark:text-blue-400/50 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {copiedId === clause.id ? "Copied" : "Copy clause text"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
