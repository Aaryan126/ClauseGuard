"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ClauseAnalysis, Severity } from "@/types";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  clauses: ClauseAnalysis[];
  rawText: string;
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

const severityBadge: Record<Severity, { bg: string; text: string; border: string }> = {
  green: { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" },
  yellow: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  red: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

const severityBadgeSelected: Record<Severity, { bg: string; text: string; border: string }> = {
  green: { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  yellow: { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  red: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
};

const OVERLAY_CLASS = "clause-overlays";

export function PdfViewer({ fileUrl, clauses, rawText, selectedIndex, onClauseClick }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [highlightTrigger, setHighlightTrigger] = useState(0);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  // After document loads, poll until text layer spans exist, then trigger highlights
  useEffect(() => {
    if (numPages === 0) return;

    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    const checkSpans = () => {
      attempts++;
      let allReady = true;
      for (let p = 1; p <= numPages; p++) {
        const pageEl = pageRefs.current.get(p);
        if (!pageEl) { allReady = false; break; }
        const textLayer = pageEl.querySelector(".react-pdf__Page__textContent");
        if (!textLayer) { allReady = false; break; }
        const spans = textLayer.querySelectorAll('span[role="presentation"]');
        if (spans.length === 0) { allReady = false; break; }
        if (attempts <= 3) {
          console.info(`[ClauseGuard] Poll #${attempts}: page ${p} has ${spans.length} spans, textLayer children: ${textLayer.children.length}, innerHTML preview: "${textLayer.innerHTML.substring(0, 100)}"`);
        }
      }

      if (allReady) {
        console.info(`[ClauseGuard] All pages ready after ${attempts} polls`);
        setHighlightTrigger((c) => c + 1);
      } else if (attempts < maxAttempts) {
        setTimeout(checkSpans, 100);
      } else {
        console.warn(`[ClauseGuard] Gave up after ${attempts} polls. pageRefs: ${pageRefs.current.size}/${numPages}`);
      }
    };

    setTimeout(checkSpans, 300);
  }, [numPages]);

  // Main highlight effect
  useEffect(() => {
    if (numPages === 0 || highlightTrigger === 0) return;

    // ── Collect ALL spans across all pages in document order ──
    const allSpans: { span: HTMLSpanElement; page: number }[] = [];
    for (let p = 1; p <= numPages; p++) {
      const pageEl = pageRefs.current.get(p);
      if (!pageEl) continue;
      const textLayer = pageEl.querySelector(".react-pdf__Page__textContent");
      if (!textLayer) continue;
      const spans = Array.from(textLayer.querySelectorAll('span[role="presentation"]')) as HTMLSpanElement[];
      for (const span of spans) {
        allSpans.push({ span, page: p });
      }
    }

    // ── Map spans to rawText positions by parallel walk ──
    // pdfjs merges adjacent text items into single spans, concatenating across
    // what are newlines in rawText. Walk both in parallel, skipping newlines
    // in rawText to align with span characters.
    let rawCursor = 0;
    const spanPositions: { span: HTMLSpanElement; page: number; start: number; end: number }[] = [];

    for (const { span, page } of allSpans) {
      const spanText = span.textContent || "";
      if (!spanText) continue;

      // Skip any newlines at current position in rawText
      while (rawCursor < rawText.length && rawText[rawCursor] === "\n") {
        rawCursor++;
      }

      const spanStart = rawCursor;

      // Advance through rawText for each character in the span, skipping newlines
      for (let i = 0; i < spanText.length; i++) {
        while (rawCursor < rawText.length && rawText[rawCursor] === "\n") {
          rawCursor++;
        }
        rawCursor++;
      }

      spanPositions.push({ span, page, start: spanStart, end: rawCursor });
    }

    console.info(`[ClauseGuard] Highlight: ${allSpans.length} spans found, ${spanPositions.length} positioned, rawCursor=${rawCursor}/${rawText.length}`);
    if (spanPositions.length > 0) {
      const first = spanPositions[0];
      const last = spanPositions[spanPositions.length - 1];
      console.info(`[ClauseGuard] First span: "${first.span.textContent?.substring(0, 30)}" [${first.start}-${first.end}]`);
      console.info(`[ClauseGuard] Last span: "${last.span.textContent?.substring(0, 30)}" [${last.start}-${last.end}]`);
    }

    // ── Map spans to clauses using rawText positions ──
    const clauseFirstSpans = new Map<number, { span: HTMLSpanElement; page: number; severity: Severity }>();
    let prevClauseIdx = -1;

    for (const sp of spanPositions) {
      let matchedClause: { clauseIndex: number; severity: Severity } | null = null;

      for (let ci = 0; ci < clauses.length; ci++) {
        const c = clauses[ci];
        if (sp.start < c.clause.endChar && sp.end > c.clause.startChar) {
          matchedClause = { clauseIndex: ci, severity: c.severity };
          break;
        }
      }

      // Gap-fill: if no clause matched, use the last known clause
      if (!matchedClause && prevClauseIdx >= 0) {
        matchedClause = { clauseIndex: prevClauseIdx, severity: clauses[prevClauseIdx].severity };
      }

      if (matchedClause) {
        const isSelected = matchedClause.clauseIndex === selectedIndex;
        sp.span.style.backgroundColor = (isSelected ? severityColorsSelected : severityColors)[matchedClause.severity];
        sp.span.style.cursor = "pointer";
        sp.span.style.borderRadius = "2px";
        sp.span.dataset.clauseIndex = String(matchedClause.clauseIndex);

        if (matchedClause.clauseIndex !== prevClauseIdx) {
          if (!clauseFirstSpans.has(matchedClause.clauseIndex)) {
            clauseFirstSpans.set(matchedClause.clauseIndex, {
              span: sp.span, page: sp.page, severity: matchedClause.severity,
            });
          }
        }
        prevClauseIdx = matchedClause.clauseIndex;
      } else {
        sp.span.style.backgroundColor = "";
        sp.span.style.cursor = "";
        delete sp.span.dataset.clauseIndex;
      }
    }

    // ── Overlays: badges + separator lines ──
    for (let p = 1; p <= numPages; p++) {
      const pageEl = pageRefs.current.get(p);
      if (!pageEl) continue;
      const pageWrapper = pageEl.querySelector(".react-pdf__Page") as HTMLElement;
      if (!pageWrapper) continue;

      pageWrapper.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => el.remove());
      pageWrapper.style.position = "relative";

      const overlay = document.createElement("div");
      overlay.className = OVERLAY_CLASS;
      Object.assign(overlay.style, {
        position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
        pointerEvents: "none", zIndex: "5",
      });

      const pageRect = pageWrapper.getBoundingClientRect();

      clauseFirstSpans.forEach(({ span, page, severity }, clauseIndex) => {
        if (page !== p) return;

        const spanRect = span.getBoundingClientRect();
        const top = spanRect.top - pageRect.top;
        const isSelected = clauseIndex === selectedIndex;

        if (clauseIndex > 0 && top > 10) {
          const line = document.createElement("div");
          Object.assign(line.style, {
            position: "absolute", top: `${top - 5}px`,
            left: "28px", right: "16px", height: "1px",
            backgroundColor: "rgba(156, 163, 175, 0.35)",
          });
          overlay.appendChild(line);
        }

        const colors = isSelected ? severityBadgeSelected[severity] : severityBadge[severity];
        const badge = document.createElement("div");
        Object.assign(badge.style, {
          position: "absolute", top: `${top + 1}px`, left: "3px",
          minWidth: "22px", height: "22px", borderRadius: "11px",
          backgroundColor: colors.bg, border: `1.5px solid ${colors.border}`,
          color: colors.text, fontSize: "10px", fontWeight: "700",
          fontFamily: "system-ui, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 4px", pointerEvents: "auto", cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        });
        badge.textContent = String(clauseIndex + 1);
        badge.addEventListener("mouseenter", () => {
          badge.style.transform = "scale(1.15)";
          badge.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
        });
        badge.addEventListener("mouseleave", () => {
          badge.style.transform = "scale(1)";
          badge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
        });
        badge.addEventListener("click", () => onClauseClick(clauseIndex));
        overlay.appendChild(badge);
      });

      if (overlay.childNodes.length > 0) {
        pageWrapper.appendChild(overlay);
      }
    }
  }, [highlightTrigger, numPages, clauses, rawText, selectedIndex, onClauseClick]);

  // Click handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleClick = (e: MouseEvent) => {
      const idx = (e.target as HTMLElement).dataset?.clauseIndex;
      if (idx !== undefined) onClauseClick(parseInt(idx, 10));
    };
    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [onClauseClick]);

  // Scroll to selected clause
  useEffect(() => {
    if (selectedIndex === null || numPages === 0) return;
    for (let p = 1; p <= numPages; p++) {
      const pageEl = pageRefs.current.get(p);
      if (!pageEl) continue;
      const span = pageEl.querySelector(`span[data-clause-index="${selectedIndex}"]`);
      if (span) {
        span.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  }, [selectedIndex, numPages, highlightTrigger]);

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4">
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div className="text-sm text-gray-400 py-8">Loading document...</div>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i + 1} ref={(el) => { if (el) pageRefs.current.set(i + 1, el); }} className="shadow-md mb-4">
            <Page
              pageNumber={i + 1}
              width={700}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}

// Extract text from a PDF using pdfjs (called before analysis)
export async function extractPdfText(fileUrl: string): Promise<string> {
  const pdf = await pdfjs.getDocument(fileUrl).promise;
  let fullText = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 1) fullText += "\n";
      fullText += item.str;
      lastY = y;
    }

    if (p < pdf.numPages) fullText += "\n";
  }

  return fullText;
}
