"use client";

import { useState, useEffect } from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import { AnalysisProgress } from "@/components/analysis-progress";
import { SummaryBar } from "@/components/summary-bar";
import { DocumentViewer } from "@/components/document-viewer";
import { DetailPanel } from "@/components/detail-panel";
import { AnalysisReport } from "@/types";

type ViewState = "upload" | "analyzing" | "report" | "error";

export default function Home() {
  const [view, setView] = useState<ViewState>("upload");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [selectedClause, setSelectedClause] = useState<number | null>(null);

  // Auto-select the first red clause, or first yellow, or first clause
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

  const handleFileSelected = async (file: File) => {
    setView("analyzing");
    setFileName(file.name);
    setError(null);
    setSelectedClause(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setReport(data);
      setView("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setView("error");
    }
  };

  const handleReset = () => {
    setView("upload");
    setReport(null);
    setError(null);
    setFileName("");
    setSelectedClause(null);
  };

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
            {view === "report" && (
              <>
                <span className="text-sm text-gray-400">{fileName}</span>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  New Analysis
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Upload / Analyzing / Error views */}
      {view !== "report" && (
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-4 py-8">
            {view === "upload" && (
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

                <UploadZone onFileSelected={handleFileSelected} isAnalyzing={false} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                  {[
                    { title: "Upload", desc: "Drop your contract in PDF, DOCX, or TXT format." },
                    { title: "Compare", desc: "Each clause is compared against a database of industry-standard templates using semantic analysis." },
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

      {/* Report view — Turnitin-style split pane */}
      {view === "report" && report && (
        <>
          {/* Summary bar */}
          <SummaryBar report={report} />

          {/* Split pane */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Document with highlighted clauses */}
            <div className="flex-1 overflow-y-auto border-r bg-white dark:bg-gray-950 p-4">
              <DocumentViewer
                clauses={report.clauses}
                selectedIndex={selectedClause}
                onClauseClick={setSelectedClause}
              />
            </div>

            {/* Right: Detail panel */}
            <div className="w-[400px] flex-shrink-0 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4">
              <DetailPanel
                analysis={selectedClause !== null ? report.clauses[selectedClause] : null}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
