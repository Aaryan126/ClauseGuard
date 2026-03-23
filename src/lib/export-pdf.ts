import type { AnalysisReport, ClauseAnalysis, Severity } from "@/types";

/* ── Color palette ── */
const COLORS: Record<Severity, { r: number; g: number; b: number }> = {
  green: { r: 5, g: 150, b: 105 },
  yellow: { r: 217, g: 119, b: 6 },
  red: { r: 220, g: 38, b: 38 },
};

const BG_COLORS: Record<Severity, { r: number; g: number; b: number }> = {
  green: { r: 236, g: 253, b: 245 },
  yellow: { r: 255, g: 251, b: 235 },
  red: { r: 254, g: 242, b: 242 },
};

const SEVERITY_LABELS: Record<Severity, string> = {
  green: "Standard",
  yellow: "Review",
  red: "High Risk",
};

/* ── Layout constants ── */
const PAGE_W = 210; // A4 mm
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT_BODY = 10;
const FONT_SMALL = 8.5;
const FONT_LABEL = 7.5;
const LINE_H = 4.5; // line height for body text
const LINE_H_SMALL = 3.8;

export async function exportAnalysisPdf(report: AnalysisReport, fileName: string) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  /* ── Helpers ── */

  function ensureSpace(needed: number) {
    if (y + needed > 280) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function drawWrappedText(
    text: string,
    x: number,
    startY: number,
    maxW: number,
    lineH: number,
    fontSize: number
  ): number {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, x, y);
      y += lineH;
    }
    return y;
  }

  function drawSeverityDot(x: number, dotY: number, severity: Severity) {
    const c = COLORS[severity];
    doc.setFillColor(c.r, c.g, c.b);
    doc.circle(x, dotY, 1.3, "F");
  }

  /* ════════════════════════════════════════
     PAGE 1 — EXECUTIVE SUMMARY
     ════════════════════════════════════════ */

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text("ClauseGuard Report", MARGIN, y);
  y += 10;

  // File info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_BODY);
  doc.setTextColor(120, 120, 120);
  doc.text(`File: ${fileName}`, MARGIN, y);
  y += 5;
  doc.text(`Type: ${report.contractType}`, MARGIN, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`, MARGIN, y);
  y += 5;
  doc.text(`Clauses analyzed: ${report.totalClauses}`, MARGIN, y);
  y += 12;

  // Clause summary box
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, "F");

  doc.setFontSize(FONT_SMALL);
  const counts = [
    { label: "Standard", count: report.summary.green, severity: "green" as Severity },
    { label: "Review", count: report.summary.yellow, severity: "yellow" as Severity },
    { label: "High Risk", count: report.summary.red, severity: "red" as Severity },
  ];
  let cx = MARGIN + 6;
  counts.forEach((item) => {
    drawSeverityDot(cx, y + 6, item.severity);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const text = `${item.label}: ${item.count}`;
    doc.text(text, cx + 3, y + 7);
    cx += doc.getTextWidth(text) + 12;
  });
  y += 18;

  // Legend
  doc.setFontSize(FONT_LABEL);
  doc.setTextColor(160, 160, 160);
  doc.text(
    "Clauses are compared against lawyer-drafted standard templates using semantic similarity. Scores below 82% are flagged for review.",
    MARGIN,
    y,
    { maxWidth: CONTENT_W }
  );
  y += 10;

  // Separator
  doc.setDrawColor(230, 230, 230);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 8;

  /* ════════════════════════════════════════
     ANNOTATED DOCUMENT
     ════════════════════════════════════════ */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Annotated Contract", MARGIN, y);
  y += 8;

  // Build ordered clause map for interleaving
  const clausesByStart = report.clauses
    .map((c, i) => ({ analysis: c, originalIndex: i }))
    .sort((a, b) => a.analysis.clause.startChar - b.analysis.clause.startChar);

  let textCursor = 0;

  for (const { analysis } of clausesByStart) {
    const { clause, severity } = analysis;
    const start = clause.startChar;
    const end = clause.endChar;

    // Render any gap text before this clause
    if (start > textCursor) {
      const gap = report.rawText.slice(textCursor, start).trim();
      if (gap) {
        ensureSpace(LINE_H * 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FONT_BODY);
        doc.setTextColor(140, 140, 140);
        drawWrappedText(gap, MARGIN, y, CONTENT_W, LINE_H, FONT_BODY);
        y += 2;
      }
    }
    textCursor = end;

    // Clause header with severity
    ensureSpace(20);
    const bg = BG_COLORS[severity];
    const color = COLORS[severity];

    // Left color bar
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(MARGIN, y, 1.2, 6, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_BODY);
    doc.setTextColor(30, 30, 30);
    doc.text(clause.title || `Clause ${clause.index + 1}`, MARGIN + 4, y + 4);

    // Severity label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_LABEL);
    doc.setTextColor(color.r, color.g, color.b);
    const labelText = SEVERITY_LABELS[severity];
    const labelW = doc.getTextWidth(labelText) + 4;
    const labelX = MARGIN + CONTENT_W - labelW;
    doc.setFillColor(bg.r, bg.g, bg.b);
    doc.roundedRect(labelX - 1, y + 0.5, labelW + 2, 5, 1, 1, "F");
    doc.text(labelText, labelX, y + 4);

    y += 9;

    // Clause text with background highlight
    const clauseText = clause.text.trim();
    doc.setFontSize(FONT_SMALL);
    const clauseLines = doc.splitTextToSize(clauseText, CONTENT_W - 6) as string[];
    const blockH = clauseLines.length * LINE_H_SMALL + 4;

    ensureSpace(Math.min(blockH, 60)); // at least start the block

    doc.setFillColor(bg.r, bg.g, bg.b);
    // Draw background in chunks that respect page breaks
    const blockStartY = y;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);

    // Padding top
    y += 3;
    for (const line of clauseLines) {
      ensureSpace(LINE_H_SMALL + 1);
      // Draw line bg
      doc.setFillColor(bg.r, bg.g, bg.b);
      doc.rect(MARGIN + 1, y - 2.8, CONTENT_W - 2, LINE_H_SMALL, "F");
      doc.setTextColor(60, 60, 60);
      doc.text(line, MARGIN + 4, y);
      y += LINE_H_SMALL;
    }
    y += 3;

    // Closest standard match
    if (analysis.bestMatch) {
      ensureSpace(8);
      doc.setFontSize(FONT_LABEL);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Compared against: ${analysis.bestMatch.standardClause.clauseName}`,
        MARGIN + 4,
        y
      );
      y += 4;
    }

    // Annotation box for flagged clauses
    if (severity !== "green") {
      renderAnnotation(doc, analysis, ensureSpace);
    }

    y += 4;
  }

  // Any trailing text
  if (textCursor < report.rawText.length) {
    const trailing = report.rawText.slice(textCursor).trim();
    if (trailing) {
      ensureSpace(LINE_H * 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT_BODY);
      doc.setTextColor(140, 140, 140);
      drawWrappedText(trailing, MARGIN, y, CONTENT_W, LINE_H, FONT_BODY);
    }
  }

  // Missing clauses section
  if (report.missingClauses && report.missingClauses.length > 0) {
    ensureSpace(20);

    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 120);
    doc.text("Suggested Additions", MARGIN, y);
    y += 3;

    doc.setFontSize(FONT_LABEL);
    doc.setTextColor(140, 140, 140);
    doc.text(`${report.missingClauses.length} standard clauses you may want to include`, MARGIN, y);
    y += 6;

    for (const mc of report.missingClauses) {
      ensureSpace(12);

      // Importance dot
      const impColor = mc.importance === "high" ? COLORS.red : mc.importance === "medium" ? COLORS.yellow : { r: 180, g: 180, b: 180 };
      doc.setFillColor(impColor.r, impColor.g, impColor.b);
      doc.circle(MARGIN + 2, y - 0.5, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_SMALL);
      doc.setTextColor(60, 60, 60);
      doc.text(mc.clauseName, MARGIN + 6, y);
      y += 3.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT_LABEL);
      doc.setTextColor(100, 100, 100);
      const summaryLines = doc.splitTextToSize(mc.summary, CONTENT_W - 10) as string[];
      for (const line of summaryLines) {
        ensureSpace(LINE_H_SMALL);
        doc.text(line, MARGIN + 6, y);
        y += LINE_H_SMALL;
      }
      y += 3;
    }
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`ClauseGuard Analysis — ${fileName}`, MARGIN, 290);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, 290, { align: "right" });
  }

  // Download
  const safeName = fileName.replace(/\.[^.]+$/, "");
  doc.save(`${safeName} — ClauseGuard Report.pdf`);

  /* ── Annotation box renderer ── */

  function renderAnnotation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    analysis: ClauseAnalysis,
    ensureSpace: (n: number) => void
  ) {
    const { ruleHits, explanation, normalVersion, suggestedAction, proposedRevision, severity, flagSource } = analysis;
    const color = COLORS[severity];

    ensureSpace(12);

    // Left accent bar
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(MARGIN + 6, y, 0.8, 4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_LABEL);
    doc.setTextColor(color.r, color.g, color.b);
    doc.text("ANALYSIS", MARGIN + 10, y + 3);
    y += 6;

    // Flag source
    if (flagSource) {
      ensureSpace(5);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(FONT_LABEL);
      doc.setTextColor(140, 140, 140);
      const sourceText =
        flagSource === "similarity" ? "Flagged by: low similarity to standard"
        : flagSource === "pattern" ? "Flagged by: aggressive pattern detected"
        : "Flagged by: low similarity + aggressive pattern";
      doc.text(sourceText, MARGIN + 10, y);
      y += 4;
    }

    // Rule hits
    if (ruleHits.length > 0) {
      for (const hit of ruleHits) {
        ensureSpace(8);
        const hColor = COLORS[hit.severity];
        doc.setFillColor(hColor.r, hColor.g, hColor.b);
        doc.circle(MARGIN + 10, y - 0.5, 0.8, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(FONT_LABEL);
        doc.setTextColor(60, 60, 60);
        doc.text(hit.ruleName, MARGIN + 13, y);
        y += 3.5;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const hitLines = doc.splitTextToSize(hit.details, CONTENT_W - 16) as string[];
        for (const line of hitLines) {
          ensureSpace(LINE_H_SMALL);
          doc.text(line, MARGIN + 13, y);
          y += LINE_H_SMALL;
        }
        y += 1.5;
      }
    }

    // Explanation
    if (explanation) {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_LABEL);
      doc.setTextColor(80, 80, 80);
      doc.text("What this means:", MARGIN + 10, y);
      y += 3.5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const expLines = doc.splitTextToSize(explanation, CONTENT_W - 16) as string[];
      for (const line of expLines) {
        ensureSpace(LINE_H_SMALL);
        doc.text(line, MARGIN + 10, y);
        y += LINE_H_SMALL;
      }
      y += 2;
    }

    // Normal version
    if (normalVersion) {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_LABEL);
      doc.setTextColor(COLORS.green.r, COLORS.green.g, COLORS.green.b);
      doc.text("What standard looks like:", MARGIN + 10, y);
      y += 3.5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const normLines = doc.splitTextToSize(normalVersion, CONTENT_W - 16) as string[];
      for (const line of normLines) {
        ensureSpace(LINE_H_SMALL);
        doc.text(line, MARGIN + 10, y);
        y += LINE_H_SMALL;
      }
      y += 2;
    }

    // Suggested action
    if (suggestedAction) {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_LABEL);
      doc.setTextColor(30, 64, 120);
      doc.text("Suggested action:", MARGIN + 10, y);
      y += 3.5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const actionLines = doc.splitTextToSize(suggestedAction, CONTENT_W - 16) as string[];
      for (const line of actionLines) {
        ensureSpace(LINE_H_SMALL);
        doc.text(line, MARGIN + 10, y);
        y += LINE_H_SMALL;
      }
      y += 2;
    }

    // Proposed revision
    if (proposedRevision) {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_LABEL);
      doc.setTextColor(30, 64, 120);
      doc.text("Proposed revision:", MARGIN + 10, y);
      y += 3.5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const revLines = doc.splitTextToSize(proposedRevision, CONTENT_W - 16) as string[];
      for (const line of revLines) {
        ensureSpace(LINE_H_SMALL);
        doc.text(line, MARGIN + 10, y);
        y += LINE_H_SMALL;
      }
      y += 2;
    }
  }
}
