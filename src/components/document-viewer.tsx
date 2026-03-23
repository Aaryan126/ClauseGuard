"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { ClauseAnalysis, Severity } from "@/types";

const PdfViewer = dynamic(() => import("./pdf-viewer").then((m) => ({ default: m.PdfViewer })), {
  ssr: false,
  loading: () => <div className="text-sm text-gray-400 py-8 text-center">Loading viewer...</div>,
});

interface DocumentViewerProps {
  fileUrl: string | null;
  fileType: string;
  rawText: string;
  clauses: ClauseAnalysis[];
  selectedIndex: number | null;
  onClauseClick: (index: number) => void;
  compact?: boolean;
}

export function DocumentViewer({ fileUrl, fileType, rawText, clauses, selectedIndex, onClauseClick, compact }: DocumentViewerProps) {
  if (fileType === "pdf" && fileUrl) {
    return (
      <PdfViewer
        fileUrl={fileUrl}
        clauses={clauses}
        rawText={rawText}
        selectedIndex={selectedIndex}
        onClauseClick={onClauseClick}
      />
    );
  }

  return (
    <TextDocumentViewer
      compact={compact}
      rawText={rawText}
      clauses={clauses}
      selectedIndex={selectedIndex}
      onClauseClick={onClauseClick}
    />
  );
}

// Text-based viewer (for DOCX/TXT files)

const severityBg: Record<Severity, string> = {
  green: "bg-emerald-100/50",
  yellow: "bg-amber-100/60",
  red: "bg-red-100/60",
};

const severityBgSelected: Record<Severity, string> = {
  green: "bg-emerald-200/70 ring-1 ring-emerald-400/40",
  yellow: "bg-amber-200/70 ring-1 ring-amber-400/40",
  red: "bg-red-200/70 ring-1 ring-red-400/40",
};

interface TextSegment {
  text: string;
  clauseIndex: number | null;
  severity: Severity | null;
}

function TextDocumentViewer({
  rawText,
  clauses,
  selectedIndex,
  onClauseClick,
  compact,
}: {
  rawText: string;
  clauses: ClauseAnalysis[];
  selectedIndex: number | null;
  onClauseClick: (index: number) => void;
  compact?: boolean;
}) {
  const segments = useMemo(() => {
    const result: TextSegment[] = [];
    let cursor = 0;

    const sorted = clauses
      .map((c, i) => ({ analysis: c, originalIndex: i }))
      .sort((a, b) => a.analysis.clause.startChar - b.analysis.clause.startChar);

    for (const { analysis, originalIndex } of sorted) {
      const start = analysis.clause.startChar;
      const end = analysis.clause.endChar;

      if (start > cursor) {
        result.push({ text: rawText.slice(cursor, start), clauseIndex: null, severity: null });
      }

      result.push({
        text: rawText.slice(start, end),
        clauseIndex: originalIndex,
        severity: analysis.severity,
      });

      cursor = end;
    }

    if (cursor < rawText.length) {
      result.push({ text: rawText.slice(cursor), clauseIndex: null, severity: null });
    }

    return result;
  }, [rawText, clauses]);

  return (
    <div className="max-w-3xl mx-auto px-2">
      <div className="text-[14px] leading-[1.75] text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {segments.map((seg, i) => {
          if (seg.clauseIndex === null) {
            return <span key={i}>{seg.text}</span>;
          }

          const isSelected = selectedIndex === seg.clauseIndex;
          const bg = isSelected
            ? severityBgSelected[seg.severity!]
            : severityBg[seg.severity!];

          return (
            <span
              key={i}
              onClick={() => onClauseClick(seg.clauseIndex!)}
              className={`rounded-sm cursor-pointer transition-colors duration-150 ${bg} hover:brightness-95`}
            >
              {seg.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
