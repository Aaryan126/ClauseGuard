"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ClauseAnalysis, Severity } from "@/types";

// Pin worker to the exact pdfjs-dist version bundled by react-pdf
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

// Replicate pdf-parse's text joining: newline between items on different Y positions
function joinTextItems(items: TextItem[]): string {
  let text = "";
  let lastY: number | null = null;
  for (const item of items) {
    if (!("str" in item)) continue;
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 1) {
      text += "\n";
    }
    text += item.str;
    lastY = y;
  }
  return text;
}

export function PdfViewer({ fileUrl, clauses, selectedIndex, onClauseClick }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Store raw textContent items per page (with position info)
  const pageItemsRef = useRef<Map<number, TextItem[]>>(new Map());
  const [allPagesReady, setAllPagesReady] = useState(0); // counter to trigger re-highlight

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    pageItemsRef.current.clear();
  }, []);

  const handlePageTextContent = useCallback((pageNumber: number, items: TextItem[]) => {
    pageItemsRef.current.set(pageNumber, items);
    setAllPagesReady((c) => c + 1); // trigger re-render to apply highlights
  }, []);

  // Apply highlights whenever pages are ready or selection changes
  useEffect(() => {
    if (numPages === 0 || pageItemsRef.current.size < numPages) return;

    // Step 1: Build full document text matching pdf-parse behavior,
    // and track which text item each character offset maps to.
    // Each entry: { page, itemIndex, spanOffset (char position in full text) }
    interface CharMapping {
      page: number;
      itemIndex: number;
    }

    const itemMappings: { page: number; itemIndex: number; start: number; end: number }[] = [];
    let cursor = 0;

    for (let p = 1; p <= numPages; p++) {
      const items = pageItemsRef.current.get(p) || [];
      let lastY: number | null = null;

      for (let ii = 0; ii < items.length; ii++) {
        const item = items[ii];
        if (!("str" in item)) continue;

        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 1) {
          cursor += 1; // newline character
        }

        const start = cursor;
        const end = cursor + item.str.length;
        itemMappings.push({ page: p, itemIndex: ii, start, end });
        cursor = end;
        lastY = y;
      }

      // Page separator
      if (p < numPages) {
        cursor += 1;
      }
    }

    // Step 2: For each item mapping, find which clause it belongs to
    // Using the server-side startChar/endChar offsets
    const itemToClause = new Map<string, { clauseIndex: number; severity: Severity }>();

    for (const mapping of itemMappings) {
      const key = `${mapping.page}-${mapping.itemIndex}`;
      for (let ci = 0; ci < clauses.length; ci++) {
        const c = clauses[ci];
        // Check overlap with some tolerance for offset drift
        if (mapping.start < c.clause.endChar && mapping.end > c.clause.startChar) {
          itemToClause.set(key, { clauseIndex: ci, severity: c.severity });
          break;
        }
      }
    }

    // Step 3: Gap-fill — any item not matched gets its nearest neighbor's clause
    const orderedKeys = itemMappings.map((m) => `${m.page}-${m.itemIndex}`);
    let lastMatch: { clauseIndex: number; severity: Severity } | null = null;

    // Forward pass: fill gaps with the last known clause
    for (const key of orderedKeys) {
      if (itemToClause.has(key)) {
        lastMatch = itemToClause.get(key)!;
      } else if (lastMatch) {
        itemToClause.set(key, lastMatch);
      }
    }

    // Backward pass: fill any remaining gaps at the start
    lastMatch = null;
    for (let i = orderedKeys.length - 1; i >= 0; i--) {
      const key = orderedKeys[i];
      if (itemToClause.has(key)) {
        lastMatch = itemToClause.get(key)!;
      } else if (lastMatch) {
        itemToClause.set(key, lastMatch);
      }
    }

    // Step 4: Apply highlights to DOM spans
    for (let p = 1; p <= numPages; p++) {
      const pageEl = pageRefs.current.get(p);
      if (!pageEl) continue;

      const textLayer = pageEl.querySelector(".react-pdf__Page__textContent");
      if (!textLayer) continue;

      // react-pdf renders one <span> per text item, in order
      const spans = Array.from(textLayer.querySelectorAll("span")) as HTMLSpanElement[];
      const items = pageItemsRef.current.get(p) || [];

      // Filter to only real text items (items with "str" property)
      let spanIdx = 0;
      for (let ii = 0; ii < items.length; ii++) {
        if (!("str" in items[ii])) continue;
        if (spanIdx >= spans.length) break;

        const span = spans[spanIdx];
        const key = `${p}-${ii}`;
        const match = itemToClause.get(key);

        if (match) {
          const isSelected = match.clauseIndex === selectedIndex;
          const colors = isSelected ? severityColorsSelected : severityColors;
          span.style.backgroundColor = colors[match.severity];
          span.style.cursor = "pointer";
          span.style.borderRadius = "2px";
          span.dataset.clauseIndex = String(match.clauseIndex);
        } else {
          span.style.backgroundColor = "";
          span.style.cursor = "";
          delete span.dataset.clauseIndex;
        }

        spanIdx++;
      }
    }
  }, [allPagesReady, numPages, clauses, selectedIndex]);

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
    if (selectedIndex === null || numPages === 0) return;
    const clause = clauses[selectedIndex];
    if (!clause) return;

    // Find which page this clause is on by checking item mappings
    // Simple approach: find the page that contains items matching this clause
    for (let p = 1; p <= numPages; p++) {
      const items = pageItemsRef.current.get(p) || [];
      for (let ii = 0; ii < items.length; ii++) {
        const key = `${p}-${ii}`;
        const pageEl = pageRefs.current.get(p);
        if (pageEl) {
          const textLayer = pageEl.querySelector(".react-pdf__Page__textContent");
          if (textLayer) {
            const span = textLayer.querySelector(`span[data-clause-index="${selectedIndex}"]`);
            if (span) {
              span.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
          }
        }
      }
    }
  }, [selectedIndex, numPages, clauses, allPagesReady]);

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

function HighlightablePage({
  pageNumber,
  pageRef,
  onTextExtracted,
}: {
  pageNumber: number;
  pageRef: (el: HTMLDivElement | null) => void;
  onTextExtracted: (pageNumber: number, items: TextItem[]) => void;
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
        onGetTextSuccess={(textContent: TextContent) => {
          const items = textContent.items.filter((item): item is TextItem => "str" in item);
          onTextExtracted(pageNumber, items);
        }}
      />
    </div>
  );
}
