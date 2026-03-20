"use client";

import { Loader2 } from "lucide-react";

const steps = [
  "Parsing document...",
  "Extracting clauses...",
  "Generating embeddings...",
  "Comparing against standards...",
  "Checking for aggressive patterns...",
  "Generating explanations...",
];

export function AnalysisProgress() {
  return (
    <div className="w-full max-w-md mx-auto text-center space-y-6 py-12">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Analyzing your contract</h3>
        <p className="text-sm text-gray-500 mt-1">This typically takes 15-30 seconds</p>
      </div>
      <div className="space-y-2 text-left">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
