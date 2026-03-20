"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ClauseAnalysis, Severity } from "@/types";

// Pin worker to the exact pdfjs-dist version bundled by react-pdf (5.4.296)
// to avoid version mismatch with any other pdfjs-dist in node_modules
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  clauses: ClauseAnalysis[];
  selectedIndex: number | null;
  onClauseClick: (index: number) => void;
}

const severityColors: Record<Severity, string> = {
  green: "rgba(16, 185, 129, 0.15)",
  yellow: "rgba(245, 158, 11, 0.2)",
  red: "rgba(239, 68, 68, 0.2)",
};

const severityColorsSelected: Record<Severity, string> = {
  green: "rgba(16, 185, 129, 0.35)",
  yellow: "rgba(245, 158, 11, 0.4)",
  red: "rgba(239, 68, 68, 0.4)",
};

// Build a mapping of which clause each character offset belongs to
function buildClauseMap(clauses: ClauseAnalysis[]): Map<number, { clauseIndex: number; severity: Severity }> {
  const map = new Map<number, { clauseIndex: number; severity: Severity }>();
  clauses.forEach((c, idx) => {
    map.set(c.clause.startChar, {
      clauseIndex: idx,
      severity: c.severity,
    });
  });
  return map;
}

export function PdfViewer({ fileUrl, clauses, selectedIndex, onClauseClick }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageTexts, setPageTexts] = useState<Map<number, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Track cumulative text offsets per page for clause-to-page mapping
  const [pageOffsets, setPageOffsets] = useState<{ page: number; start: number; end: number }[]>([]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  // When we get text content for a page, store it
  const handlePageTextContent = useCallback((pageNumber: number, text: string) => {
    setPageTexts((prev) => {
      const next = new Map(prev);
      next.set(pageNumber, text);
      return next;
    });
  }, []);

  // Rebuild page offsets whenever we have all page texts
  useEffect(() => {
    if (numPages === 0 || pageTexts.size < numPages) return;

    let cursor = 0;
    const offsets: { page: number; start: number; end: number }[] = [];
    for (let p = 1; p <= numPages; p++) {
      const text = pageTexts.get(p) || "";
      offsets.push({ page: p, start: cursor, end: cursor + text.length });
      cursor += text.length + 1; // +1 for page separator
    }
    setPageOffsets(offsets);
  }, [numPages, pageTexts]);

  // Apply highlights to text layer spans after render
  useEffect(() => {
    if (pageOffsets.length === 0) return;

    for (const { page, start: pageStart } of pageOffsets) {
      const pageEl = pageRefs.current.get(page);
      if (!pageEl) continue;

      const textLayer = pageEl.querySelector(".react-pdf__Page__textContent");
      if (!textLayer) continue;

      const spans = Array.from(textLayer.querySelectorAll("span")) as HTMLSpanElement[];

      let charOffset = pageStart;
      for (const span of spans) {
        const spanText = span.textContent || "";
        const spanStart = charOffset;
        const spanEnd = charOffset + spanText.length;

        // Find which clause this span belongs to
        let matchedClause: { clauseIndex: number; severity: Severity } | null = null;
        for (let ci = 0; ci < clauses.length; ci++) {
          const c = clauses[ci];
          // Check if this span overlaps with the clause
          if (spanStart < c.clause.endChar && spanEnd > c.clause.startChar) {
            matchedClause = { clauseIndex: ci, severity: c.severity };
            break;
          }
        }

        if (matchedClause) {
          const isSelected = matchedClause.clauseIndex === selectedIndex;
          const colors = isSelected ? severityColorsSelected : severityColors;
          span.style.backgroundColor = colors[matchedClause.severity];
          span.style.cursor = "pointer";
          span.style.borderRadius = "2px";
          // Store clause index as data attribute for click handling
          span.dataset.clauseIndex = String(matchedClause.clauseIndex);
        } else {
          span.style.backgroundColor = "";
          span.style.cursor = "";
          delete span.dataset.clauseIndex;
        }

        charOffset = spanEnd;
      }
    }
  }, [pageOffsets, clauses, selectedIndex]);

  // Handle clicks on text layer spans
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clauseIdx = target.dataset?.clauseIndex;
      if (clauseIdx !== undefined) {
        onClauseClick(parseInt(clauseIdx, 10));
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [onClauseClick]);

  // Scroll to selected clause's page
  useEffect(() => {
    if (selectedIndex === null || pageOffsets.length === 0) return;
    const clause = clauses[selectedIndex];
    if (!clause) return;

    const pageInfo = pageOffsets.find(
      (p) => clause.clause.startChar >= p.start && clause.clause.startChar < p.end
    );
    if (pageInfo) {
      const pageEl = pageRefs.current.get(pageInfo.page);
      pageEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedIndex, pageOffsets, clauses]);

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4">
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div className="text-sm text-gray-400 py-8">Loading document...</div>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <HighlightablePage
            key={i + 1}
            pageNumber={i + 1}
            pageRef={(el) => {
              if (el) pageRefs.current.set(i + 1, el);
            }}
            onTextExtracted={handlePageTextContent}
          />
        ))}
      </Document>
    </div>
  );
}

// Individual page that extracts text on render
function HighlightablePage({
  pageNumber,
  pageRef,
  onTextExtracted,
}: {
  pageNumber: number;
  pageRef: (el: HTMLDivElement | null) => void;
  onTextExtracted: (pageNumber: number, text: string) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);

  const handleRef = useCallback(
    (el: HTMLDivElement | null) => {
      (divRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      pageRef(el);
    },
    [pageRef]
  );

  return (
    <div ref={handleRef} className="shadow-md mb-4">
      <Page
        pageNumber={pageNumber}
        width={700}
        renderAnnotationLayer={false}
        onGetTextSuccess={(textContent) => {
          const text = textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join("");
          onTextExtracted(pageNumber, text);
        }}
      />
    </div>
  );
}
