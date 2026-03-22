"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import { AnalysisProgress } from "@/components/analysis-progress";
import { SummaryBar } from "@/components/summary-bar";
import { DocumentViewer } from "@/components/document-viewer";
import { DetailPanel } from "@/components/detail-panel";
import { HistoryDropdown } from "@/components/history-dropdown";
import { saveAnalysis, type HistoryEntry } from "@/lib/history-db";
import { AnalysisReport, ContractType } from "@/types";

type ViewState = "select-type" | "analyzing" | "report" | "error";

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

export default function Home() {
  const [view, setView] = useState<ViewState>("select-type");
  const [contractType, setContractType] = useState<ContractType | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const [selectedClause, setSelectedClause] = useState<number | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

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
      let data: AnalysisReport;

      if (ext === "pdf") {
        const { extractPdfText } = await import("@/components/pdf-viewer");
        const pdfText = await extractPdfText(url);

        const response = await fetch("/api/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pdfText, contractType }),
        });

        data = await response.json();
        if (!response.ok) throw new Error(data && "error" in data ? (data as Record<string, string>).error : "Analysis failed.");
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("contractType", contractType);

        const response = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });

        data = await response.json();
        if (!response.ok) throw new Error(data && "error" in data ? (data as Record<string, string>).error : "Analysis failed.");
      }

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
    // Revoke any previous blob URL
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);

    // Restore original file as blob URL if stored
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
            {view !== "analyzing" && (
              <HistoryDropdown onSelect={handleHistorySelect} />
            )}
          </div>
        </div>
      </header>

      {/* Pre-report views */}
      {view !== "report" && (
        <div className="flex-1 overflow-auto">
          {view === "select-type" && (
            <div className="max-w-4xl mx-auto px-4 py-14">
              {/* Hero */}
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 bg-blue-950/5 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 px-3 py-1 rounded-full text-[12px] font-medium mb-5 tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-900 dark:bg-blue-400" />
                  Powered by semantic analysis
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-[1.15]">
                  Know what you&apos;re signing<span className="text-blue-900 dark:text-blue-400">.</span>
                </h1>
                <p className="text-[16px] text-gray-500 max-w-lg mx-auto leading-relaxed mt-4">
                  Upload a contract and see how each clause compares to lawyer-drafted
                  industry standards. Aggressive or unusual terms are flagged
                  with clear, plain-English explanations.
                </p>
              </div>

              {/* Contract type selection */}
              <div className="mt-12">
                <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-3 text-center uppercase tracking-wider">
                  Select contract type
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {CONTRACT_OPTIONS.map((option) => {
                    const isActive = contractType === option.type;
                    return (
                      <button
                        key={option.type}
                        onClick={() => handleTypeSelected(option.type)}
                        className={`group text-left rounded-xl border-2 p-5 transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "border-blue-900 bg-blue-950/5 dark:border-blue-400 dark:bg-blue-900/15 shadow-sm"
                            : "border-gray-200 dark:border-gray-800 hover:border-gray-300 hover:shadow-sm dark:hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[16px] font-bold ${isActive ? "text-blue-900 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}>
                            {option.label}
                          </span>
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isActive ? "border-blue-900 bg-blue-900 dark:border-blue-400 dark:bg-blue-400" : "border-gray-300 dark:border-gray-600 group-hover:border-gray-400"
                          }`}>
                            {isActive && <span className="w-2 h-2 rounded-full bg-white dark:bg-gray-900" />}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">{option.description}</p>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            isActive
                              ? "bg-blue-900/10 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                          }`}>
                            {option.clauseCount} clauses
                          </span>
                          <span className="text-[11px] text-gray-400">{option.standards}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload zone */}
              <div ref={uploadRef} className={`mt-10 transition-all duration-300 ${contractType ? "opacity-100 translate-y-0" : "opacity-25 translate-y-1 pointer-events-none"}`}>
                <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-3 text-center uppercase tracking-wider">
                  Upload document
                </p>
                <UploadZone onFileSelected={handleFileSelected} isAnalyzing={false} active={!!contractType} />
                <p className="text-[12px] text-gray-400 text-center mt-2.5">
                  PDF, DOCX, or TXT — up to 10 MB
                </p>
              </div>

              {/* How it works */}
              <div className="mt-16 pt-10 border-t border-gray-200 dark:border-gray-800">
                <p className="text-[12px] font-semibold text-gray-400 mb-6 text-center uppercase tracking-wider">
                  How it works
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    {
                      number: "01",
                      title: "Compare",
                      desc: "Each clause is embedded and compared against 68 lawyer-drafted standard templates using semantic similarity.",
                    },
                    {
                      number: "02",
                      title: "Detect",
                      desc: "15 pattern rules scan for aggressive terms — unlimited liability, blanket IP assignment, unilateral amendments, and more.",
                    },
                    {
                      number: "03",
                      title: "Explain",
                      desc: "Flagged clauses get a plain-English explanation of the risk, what a standard version looks like, and the specific rule triggered.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="text-center">
                      <span className="text-[28px] font-extrabold text-blue-900/20 dark:text-blue-400/20">
                        {item.number}
                      </span>
                      <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-200 mt-1">
                        {item.title}
                      </h3>
                      <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust bar */}
              <div className="mt-12 text-center">
                <p className="text-[11px] text-gray-400">
                  Standards sourced from{" "}
                  <span className="font-medium text-gray-500">Common Paper</span> and{" "}
                  <span className="font-medium text-gray-500">Bonterms</span>{" "}
                  — open-source, lawyer-drafted by committees of 40–120+ attorneys.
                </p>
              </div>
            </div>
          )}

          {view === "analyzing" && (
            <div className="max-w-5xl mx-auto px-4 py-8">
              <AnalysisProgress />
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
            <div className="flex-1 overflow-y-auto border-r border-gray-200 bg-gray-50/50 dark:bg-gray-950 p-4">
              <div className="mb-3">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-900/60 hover:text-blue-900 dark:text-blue-400/60 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to home
                </button>
              </div>
              <DocumentViewer
                fileUrl={fileUrl}
                fileType={fileType}
                rawText={report.rawText}
                clauses={report.clauses}
                selectedIndex={selectedClause}
                onClauseClick={setSelectedClause}
              />
            </div>
            <div className="w-[400px] flex-shrink-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
              <DetailPanel
                clauses={report.clauses}
                selectedIndex={selectedClause}
                onClauseClick={(i) => setSelectedClause(i < 0 ? null : i)}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
