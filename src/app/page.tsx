"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, ArrowLeft, ArrowRight, Plus, Minus, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import { AnalysisProgress } from "@/components/analysis-progress";
import { SummaryBar } from "@/components/summary-bar";
import { DocumentViewer } from "@/components/document-viewer";
import { DetailPanel } from "@/components/detail-panel";
import { HistoryDropdown } from "@/components/history-dropdown";
import { ClauseLibraryDropdown } from "@/components/clause-library";
import { saveAnalysis, saveComparison, type HistoryEntry } from "@/lib/history-db";
import { ComparisonView } from "@/components/comparison-view";
import { AnalysisReport, ContractType } from "@/types";

type ViewState = "select-type" | "analyzing" | "report" | "error" | "compare-report";
type AppMode = "analyze" | "compare";

const CONTRACT_OPTIONS: {
  type: ContractType;
  label: string;
  shortLabel: string;
  description: string;
  standards: string;
  clauseCount: number;
}[] = [
  {
    type: "nda",
    label: "Non-Disclosure Agreement",
    shortLabel: "NDA",
    description: "Confidentiality agreements, mutual NDAs, unilateral NDAs",
    standards: "Common Paper Mutual NDA v1.0",
    clauseCount: 16,
  },
  {
    type: "saas",
    label: "SaaS Agreement",
    shortLabel: "SaaS",
    description: "Software subscriptions, cloud service terms, service agreements",
    standards: "Bonterms Cloud Terms v1.0",
    clauseCount: 29,
  },
  {
    type: "consulting",
    label: "Consulting / Services Agreement",
    shortLabel: "Consulting",
    description: "Freelance contracts, professional services, consulting engagements",
    standards: "Bonterms PSA v1.2",
    clauseCount: 23,
  },
];

function ComparePanel({ reportA, reportB, fileNameA, fileNameB, onClauseSelect, open }: {
  reportA: AnalysisReport;
  reportB: AnalysisReport;
  fileNameA: string;
  fileNameB: string;
  onClauseSelect: (idxA: number | null, idxB: number | null) => void;
  open: boolean;
}) {
  return (
    <div className={`flex-shrink-0 overflow-hidden bg-gray-50 dark:bg-gray-900 border-l border-gray-200 transition-all duration-200 ${open ? "w-[320px]" : "w-0"}`}>
      <div className="flex flex-col h-full w-[320px]">
        <div className="flex-1 overflow-hidden">
          <ComparisonView
            reportA={reportA}
            reportB={reportB}
            fileNameA={fileNameA}
            fileNameB={fileNameB}
            onClauseSelect={onClauseSelect}
          />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<ViewState>("select-type");
  const [mode, setMode] = useState<AppMode>("analyze");
  const [contractType, setContractType] = useState<ContractType | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const [selectedClause, setSelectedClause] = useState<number | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  // Compare mode state
  const [compareFileA, setCompareFileA] = useState<File | null>(null);
  const [compareFileB, setCompareFileB] = useState<File | null>(null);
  const [reportA, setReportA] = useState<AnalysisReport | null>(null);
  const [reportB, setReportB] = useState<AnalysisReport | null>(null);
  const [fileNameA, setFileNameA] = useState("");
  const [fileNameB, setFileNameB] = useState("");
  const [fileUrlA, setFileUrlA] = useState<string | null>(null);
  const [fileUrlB, setFileUrlB] = useState<string | null>(null);
  const [fileTypeCompare, setFileTypeCompare] = useState("");
  const [selectedClauseA, setSelectedClauseA] = useState<number | null>(null);
  const [selectedClauseB, setSelectedClauseB] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoomA, setZoomA] = useState(0.7);
  const [zoomB, setZoomB] = useState(0.7);
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressDetail, setProgressDetail] = useState<string>("");

  /** Consume an SSE stream from the analysis API. Returns the final report. */
  async function consumeAnalysisStream(response: Response): Promise<AnalysisReport> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const dataLine = line.replace(/^data: /, "").trim();
        if (!dataLine) continue;

        try {
          const event = JSON.parse(dataLine);
          if (event.type === "progress") {
            setProgressStep(event.step || "");
            setProgressDetail(event.detail || "");
          } else if (event.type === "complete") {
            return event.report as AnalysisReport;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
    throw new Error("Stream ended without a complete response.");
  }

  useEffect(() => {
    if (view === "report" && report) {
      const firstRed = report.clauses.findIndex((c) => c.severity === "red");
      if (firstRed !== -1) {
        setSelectedClause(firstRed);
        return;
      }
      const firstYellow = report.clauses.findIndex((c) => c.severity === "yellow");
      if (firstYellow !== -1) {
        setSelectedClause(firstYellow);
        return;
      }
      setSelectedClause(0);
    }
  }, [view, report]);

  const handleTypeSelected = (type: ContractType) => {
    setContractType(type);
    setTimeout(() => {
      uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleFileSelected = async (file: File) => {
    if (!contractType) return;

    setView("analyzing");
    setFileName(file.name);
    setError(null);
    setSelectedClause(null);

    // Store original file as blob URL for the PDF viewer
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setFileUrl(url);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    setFileType(ext);

    try {
      setProgressStep("Extracting text from PDF");
      setProgressDetail("");

      const { extractPdfText } = await import("@/components/pdf-viewer");
      const pdfText = await extractPdfText(url);

      setProgressStep("Starting analysis");
      const response = await fetch("/api/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pdfText, contractType }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed.");
      }

      const data = await consumeAnalysisStream(response);

      setReport(data);
      setView("report");

      // Save to history (fire-and-forget)
      saveAnalysis(file.name, ext, file, data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setView("error");
    }
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    if (entry.isComparison && entry.reportB) {
      // Comparison entry — restore both files and reports
      if (fileUrlA) URL.revokeObjectURL(fileUrlA);
      if (fileUrlB) URL.revokeObjectURL(fileUrlB);

      const urlA = entry.fileBlob ? URL.createObjectURL(entry.fileBlob) : null;
      const urlB = entry.fileBlobB ? URL.createObjectURL(entry.fileBlobB) : null;
      setFileUrlA(urlA);
      setFileUrlB(urlB);
      setFileTypeCompare(entry.fileType);
      setReportA(entry.report);
      setReportB(entry.reportB);
      setFileNameA(entry.fileName);
      setFileNameB(entry.fileNameB || "");
      setSelectedClauseA(null);
      setSelectedClauseB(null);
      setView("compare-report");
    } else {
      // Single analysis entry
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);

      if (entry.fileBlob) {
        const url = URL.createObjectURL(entry.fileBlob);
        fileUrlRef.current = url;
        setFileUrl(url);
        setFileType(entry.fileType);
      } else {
        fileUrlRef.current = null;
        setFileUrl(null);
        setFileType("txt");
      }

      setReport(entry.report);
      setFileName(entry.fileName);
      setSelectedClause(null);
      setView("report");
    }
  };

  const handleCompare = async () => {
    if (!contractType || !compareFileA || !compareFileB) return;

    setView("analyzing");
    setError(null);
    setFileNameA(compareFileA.name);
    setFileNameB(compareFileB.name);

    const ext = compareFileA.name.split(".").pop()?.toLowerCase() || "";
    setFileTypeCompare(ext);

    // Create blob URLs for document viewers
    const urlA = URL.createObjectURL(compareFileA);
    const urlB = URL.createObjectURL(compareFileB);
    setFileUrlA(urlA);
    setFileUrlB(urlB);

    try {
      const analyzeFile = async (file: File, label: string): Promise<AnalysisReport> => {
        setProgressStep(`Extracting text from ${label}`);
        const { extractPdfText } = await import("@/components/pdf-viewer");
        const blobUrl = URL.createObjectURL(file);
        const text = await extractPdfText(blobUrl);
        URL.revokeObjectURL(blobUrl);

        setProgressStep(`Analyzing ${label}`);
        const res = await fetch("/api/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, contractType }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Analysis failed.");
        }

        return consumeAnalysisStream(res);
      };

      const rA = await analyzeFile(compareFileA, "Old Version");
      const rB = await analyzeFile(compareFileB, "New Version");
      setReportA(rA);
      setReportB(rB);
      setView("compare-report");

      // Save to history (fire-and-forget)
      saveComparison(compareFileA.name, compareFileB.name, ext, compareFileA, compareFileB, rA, rB).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
      setView("error");
    }
  };

  const handleReset = () => {
    setView("select-type");
    setContractType(null);
    setReport(null);
    setError(null);
    setFileName("");
    setSelectedClause(null);
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
    setFileUrl(null);
    setFileType("");
    setCompareFileA(null);
    setCompareFileB(null);
    setReportA(null);
    setReportB(null);
    setFileNameA("");
    setFileNameB("");
    if (fileUrlA) URL.revokeObjectURL(fileUrlA);
    if (fileUrlB) URL.revokeObjectURL(fileUrlB);
    setFileUrlA(null);
    setFileUrlB(null);
    setFileTypeCompare("");
    setSelectedClauseA(null);
    setSelectedClauseB(null);
  };

  const selectedLabel = CONTRACT_OPTIONS.find((o) => o.type === contractType)?.label;

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-950 sticky top-0 z-20 flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-900 dark:text-blue-400" />
            <span className="text-xl font-bold tracking-tight">ClauseGuard</span>
          </div>
          <div className="flex items-center gap-3">
            {view === "report" && (
              <span className="text-sm text-gray-400">{fileName}</span>
            )}
            {view === "compare-report" && (
              <span className="text-sm text-gray-400">{fileNameA} vs {fileNameB}</span>
            )}
            {(view === "report" || view === "compare-report") && (
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="px-2.5 py-1.5 rounded-md bg-blue-900 text-white hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors cursor-pointer flex items-center gap-1.5"
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                <span className="text-[11px] font-medium">{sidebarOpen ? "Hide" : "Show"}</span>
              </button>
            )}
            {view !== "analyzing" && (
              <>
                <ClauseLibraryDropdown />
                <HistoryDropdown onSelect={handleHistorySelect} />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Pre-report views */}
      {view !== "report" && view !== "compare-report" && (
        <div className="flex-1 overflow-auto">
          {view === "select-type" && (
            <div className="max-w-4xl mx-auto px-6 py-16">
              {/* Hero */}
              <div className="text-center mb-14">
                <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-[1.1]">
                  Know what you&apos;re signing<span className="text-blue-900 dark:text-blue-400">.</span>
                </h1>
                <p className="text-[18px] text-gray-500 max-w-xl mx-auto leading-relaxed mt-5">
                  Every clause checked against lawyer-drafted standards.
                  Risks explained in plain English. Revisions ready to copy.
                </p>
              </div>

              {/* Mode toggle — large, prominent */}
              <div className="flex justify-center mb-12">
                <div className="inline-flex rounded-xl border-2 border-gray-200 dark:border-gray-800 p-1 bg-gray-50 dark:bg-gray-900 gap-1">
                  <button
                    onClick={() => setMode("analyze")}
                    className={`px-6 py-3 text-[15px] font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                      mode === "analyze"
                        ? "bg-blue-900 text-white shadow-md dark:bg-blue-700"
                        : "text-gray-500 hover:text-gray-800 hover:bg-white dark:hover:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    Analyze Contract
                  </button>
                  <button
                    onClick={() => setMode("compare")}
                    className={`px-6 py-3 text-[15px] font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                      mode === "compare"
                        ? "bg-blue-900 text-white shadow-md dark:bg-blue-700"
                        : "text-gray-500 hover:text-gray-800 hover:bg-white dark:hover:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    Compare Versions
                  </button>
                </div>
              </div>

              {/* Contract type selection */}
              <div>
                <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 mb-4 text-center">
                  What type of contract?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {CONTRACT_OPTIONS.map((option) => {
                    const isActive = contractType === option.type;
                    return (
                      <button
                        key={option.type}
                        onClick={() => handleTypeSelected(option.type)}
                        className={`group text-center rounded-xl border-2 px-4 py-6 transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "border-blue-900 bg-blue-950/5 dark:border-blue-400 dark:bg-blue-900/15 shadow-md"
                            : "border-gray-200 dark:border-gray-800 hover:border-gray-300 hover:shadow-sm dark:hover:border-gray-700"
                        }`}
                      >
                        <span className={`text-[17px] font-bold block ${isActive ? "text-blue-900 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}>
                          {option.shortLabel}
                        </span>
                        <p className="text-[13px] text-gray-400 mt-1">{option.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload zone(s) */}
              <div ref={uploadRef} className={`mt-12 transition-all duration-500 ${contractType ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2 pointer-events-none"}`}>
                {mode === "analyze" ? (
                  <div className="max-w-2xl mx-auto">
                    <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 mb-4 text-center">
                      Upload your contract
                    </p>
                    <UploadZone onFileSelected={handleFileSelected} isAnalyzing={false} active={!!contractType} />
                    <p className="text-[13px] text-gray-400 text-center mt-3">
                      PDF format, up to 10 MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 mb-4 text-center">
                      Upload both versions
                    </p>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[11px] font-bold text-gray-500">1</span>
                          <p className="text-[14px] font-medium text-gray-700 dark:text-gray-300">Old Version</p>
                        </div>
                        <UploadZone
                          onFileSelected={(f) => setCompareFileA(f)}
                          isAnalyzing={false}
                          active={!!contractType}
                          showSelected
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-blue-900 dark:bg-blue-700 flex items-center justify-center text-[11px] font-bold text-white">2</span>
                          <p className="text-[14px] font-medium text-gray-700 dark:text-gray-300">New Version</p>
                        </div>
                        <UploadZone
                          onFileSelected={(f) => setCompareFileB(f)}
                          isAnalyzing={false}
                          active={!!contractType}
                          showSelected
                        />
                      </div>
                    </div>
                    {compareFileA && compareFileB && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={handleCompare}
                          className="px-8 py-3 bg-blue-900 text-white text-[15px] font-semibold rounded-lg hover:bg-blue-950 transition-colors cursor-pointer shadow-md"
                        >
                          Compare Versions
                        </button>
                      </div>
                    )}
                    <p className="text-[13px] text-gray-400 text-center mt-3">
                      PDF format, up to 10 MB each
                    </p>
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="mt-20 pt-12 border-t border-gray-200 dark:border-gray-800">
                <p className="text-[13px] font-semibold text-gray-400 mb-8 text-center uppercase tracking-wider">
                  How it works
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {[
                    {
                      number: "01",
                      title: "Compare",
                      desc: "Each clause is embedded and compared against 68 standard templates using cosine similarity. A domain-expert AI then judges functional equivalence, replacing rigid thresholds with contextual legal reasoning.",
                    },
                    {
                      number: "02",
                      title: "Detect",
                      desc: "15 tiered pattern rules scan for aggressive language. Critical patterns like unlimited liability always flag red. Serious and caution tiers adjust based on how closely the clause matches the standard.",
                    },
                    {
                      number: "03",
                      title: "Act",
                      desc: "Flagged clauses get a plain-English explanation, a negotiation recommendation, and a copy-ready proposed revision with changes highlighted in bold.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="text-center">
                      <span className="text-[32px] font-extrabold text-blue-900 dark:text-blue-400">
                        {item.number}
                      </span>
                      <h3 className="text-[17px] font-bold text-gray-800 dark:text-gray-200 mt-1">
                        {item.title}
                      </h3>
                      <p className="text-[14px] text-gray-500 mt-2 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust bar */}
              <div className="mt-14 text-center">
                <p className="text-[12px] text-gray-400">
                  Built on open-source standards from{" "}
                  <span className="font-medium text-gray-500">Common Paper</span> and{" "}
                  <span className="font-medium text-gray-500">Bonterms</span>,
                  {" "}drafted by committees of over 120 attorneys.
                </p>
              </div>
            </div>
          )}

          {view === "analyzing" && (
            <div className="max-w-5xl mx-auto px-4 py-8">
              <AnalysisProgress step={progressStep} detail={progressDetail} />
            </div>
          )}

          {view === "error" && (
            <div className="max-w-5xl mx-auto px-4 py-8">
              <div className="text-center space-y-4 py-12">
                <p className="text-red-600 text-lg">{error}</p>
                <Button onClick={handleReset}>Try Again</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report view */}
      {view === "report" && report && (
        <>
          <SummaryBar
            report={report}
            fileName={fileName}
            onNewAnalysis={handleReset}
            onExportPdf={async () => {
              const { exportAnalysisPdf } = await import("@/lib/export-pdf");
              exportAnalysisPdf(report, fileName);
            }}
          />
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto border-r border-gray-200 bg-gray-50/50 dark:bg-gray-950 p-4 relative">
              <button
                onClick={handleReset}
                className="sticky top-0 z-10 inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-900/60 hover:text-blue-900 dark:text-blue-400/60 dark:hover:text-blue-400 transition-colors cursor-pointer bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-md shadow-sm border border-gray-200 dark:border-gray-800 mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to home
              </button>
              <DocumentViewer
                fileUrl={fileUrl}
                fileType={fileType}
                rawText={report.rawText}
                clauses={report.clauses}
                selectedIndex={selectedClause}
                onClauseClick={setSelectedClause}
              />
            </div>
            <div className={`flex-shrink-0 overflow-hidden bg-gray-50 dark:bg-gray-900 transition-all duration-200 ${sidebarOpen ? "w-[400px]" : "w-0"}`}>
              <DetailPanel
                clauses={report.clauses}
                missingClauses={report.missingClauses}
                contractType={contractType || "nda"}
                selectedIndex={selectedClause}
                onClauseClick={(i) => setSelectedClause(i < 0 ? null : i)}
              />
            </div>
          </div>
        </>
      )}

      {/* Compare report view */}
      {view === "compare-report" && reportA && reportB && (
        <div className="flex-1 flex overflow-hidden">
          {/* Old Version document */}
          <div className="flex-1 min-w-0 overflow-hidden border-r border-gray-200 bg-gray-50/50 dark:bg-gray-950 relative flex flex-col">
            <div className="flex items-center justify-between px-2 py-1.5 flex-shrink-0 border-b border-gray-200 bg-white dark:bg-gray-950">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-900/60 hover:text-blue-900 dark:text-blue-400/60 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
              <span className="text-[10px] font-medium text-gray-400">Old Version</span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
              <div className="origin-top-left" style={{ transform: `scale(${zoomA})`, width: `${(100 / zoomA).toFixed(1)}%` }}>
                <div className="p-3">
                  <DocumentViewer
                    fileUrl={fileUrlA}
                    fileType={fileTypeCompare}
                    rawText={reportA.rawText}
                    clauses={reportA.clauses}
                    selectedIndex={selectedClauseA}
                    onClauseClick={setSelectedClauseA}
                  />
                </div>
              </div>
              {/* Zoom controls */}
              <div className="sticky bottom-2 float-right mr-2 flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm px-1 py-0.5 z-10">
                <button onClick={() => setZoomA((z) => Math.max(0.4, z - 0.1))} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"><Minus className="w-3 h-3" /></button>
                <span className="text-[10px] text-gray-500 w-8 text-center">{Math.round(zoomA * 100)}%</span>
                <button onClick={() => setZoomA((z) => Math.min(1, z + 0.1))} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"><Plus className="w-3 h-3" /></button>
              </div>
            </div>
          </div>

          {/* New Version document */}
          <div className="flex-1 min-w-0 overflow-hidden border-r border-gray-200 bg-gray-50/50 dark:bg-gray-950 flex flex-col">
            <div className="flex items-center justify-end px-2 py-1.5 flex-shrink-0 border-b border-gray-200 bg-white dark:bg-gray-950">
              <span className="text-[10px] font-medium text-gray-400">New Version</span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
              <div className="origin-top-left" style={{ transform: `scale(${zoomB})`, width: `${(100 / zoomB).toFixed(1)}%` }}>
                <div className="p-3">
                  <DocumentViewer
                    fileUrl={fileUrlB}
                    fileType={fileTypeCompare}
                    rawText={reportB.rawText}
                    clauses={reportB.clauses}
                    selectedIndex={selectedClauseB}
                    onClauseClick={setSelectedClauseB}
                  />
                </div>
              </div>
              {/* Zoom controls */}
              <div className="sticky bottom-2 float-right mr-2 flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm px-1 py-0.5 z-10">
                <button onClick={() => setZoomB((z) => Math.max(0.4, z - 0.1))} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"><Minus className="w-3 h-3" /></button>
                <span className="text-[10px] text-gray-500 w-8 text-center">{Math.round(zoomB * 100)}%</span>
                <button onClick={() => setZoomB((z) => Math.min(1, z + 0.1))} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"><Plus className="w-3 h-3" /></button>
              </div>
            </div>
          </div>

          {/* Comparison panel — collapsible */}
          <ComparePanel
            reportA={reportA}
            reportB={reportB}
            fileNameA={fileNameA}
            fileNameB={fileNameB}
            onClauseSelect={(idxA, idxB) => {
              setSelectedClauseA(idxA);
              setSelectedClauseB(idxB);
            }}
            open={sidebarOpen}
          />
        </div>
      )}
    </main>
  );
}
