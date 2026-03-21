"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, ArrowLeft, FileText, Cloud, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import { AnalysisProgress } from "@/components/analysis-progress";
import { SummaryBar } from "@/components/summary-bar";
import { DocumentViewer } from "@/components/document-viewer";
import { DetailPanel } from "@/components/detail-panel";
import { HistoryDropdown } from "@/components/history-dropdown";
import { saveAnalysis, type HistoryEntry } from "@/lib/history-db";
import { AnalysisReport, ContractType } from "@/types";

type ViewState = "select-type" | "upload" | "analyzing" | "report" | "error";

const CONTRACT_OPTIONS: { type: ContractType; label: string; description: string; icon: typeof FileText }[] = [
  {
    type: "nda",
    label: "Non-Disclosure Agreement",
    description: "Confidentiality agreements, mutual NDAs, unilateral NDAs",
    icon: FileText,
  },
  {
    type: "saas",
    label: "SaaS Agreement",
    description: "Software subscriptions, cloud service terms, service agreements",
    icon: Cloud,
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
    setView("upload");
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
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold tracking-tight">ClauseGuard</span>
          </div>
          <div className="flex items-center gap-3">
            {view === "report" && report && (
              <>
                <span className="text-sm text-gray-400">{fileName}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { exportAnalysisPdf } = await import("@/lib/export-pdf");
                    exportAnalysisPdf(report, fileName);
                  }}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  New Analysis
                </Button>
              </>
            )}
            {view === "upload" && (
              <Button variant="outline" size="sm" onClick={() => setView("select-type")}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Change Type
              </Button>
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
          <div className="max-w-5xl mx-auto px-4 py-8">
            {view === "select-type" && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                    Is This Clause Normal?
                  </h1>
                  <p className="text-lg text-gray-500 max-w-xl mx-auto">
                    Upload a contract and instantly see which clauses are standard, which need review,
                    and which are aggressive compared to industry norms.
                  </p>
                </div>

                <div className="max-w-2xl mx-auto">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 text-center">
                    What type of contract are you reviewing?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CONTRACT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.type}
                          onClick={() => handleTypeSelected(option.type)}
                          className="group border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 text-left
                            hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20
                            transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                              <Icon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                                {option.label}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                  {[
                    { title: "Select", desc: "Choose your contract type so we compare against the right standards." },
                    { title: "Upload", desc: "Drop your contract in PDF, DOCX, or TXT format." },
                    { title: "Review", desc: "Get a traffic-light report showing which clauses are standard, unusual, or aggressive." },
                  ].map((step, i) => (
                    <div key={i} className="text-center p-6">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 font-bold text-sm flex items-center justify-center mx-auto mb-3">
                        {i + 1}
                      </div>
                      <h3 className="font-semibold mb-1">{step.title}</h3>
                      <p className="text-sm text-gray-500">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === "upload" && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full text-sm font-medium">
                    {selectedLabel}
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                    Upload Your Contract
                  </h2>
                  <p className="text-gray-500 max-w-md mx-auto">
                    We will compare each clause against lawyer-drafted {selectedLabel} standards.
                  </p>
                </div>
                <UploadZone onFileSelected={handleFileSelected} isAnalyzing={false} />
              </div>
            )}

            {view === "analyzing" && <AnalysisProgress />}

            {view === "error" && (
              <div className="text-center space-y-4 py-12">
                <p className="text-red-600 text-lg">{error}</p>
                <Button onClick={handleReset}>Try Again</Button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Report view */}
      {view === "report" && report && (
        <>
          <SummaryBar report={report} />
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto border-r bg-white dark:bg-gray-950 p-4">
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
