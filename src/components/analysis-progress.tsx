"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const steps = [
  { label: "Parsing document", duration: 3 },
  { label: "Extracting clauses", duration: 5 },
  { label: "Generating embeddings", duration: 12 },
  { label: "Scoring each clause with AI", duration: 40 },
  { label: "Checking for aggressive patterns", duration: 5 },
  { label: "Generating explanations", duration: 30 },
  { label: "Detecting missing clauses", duration: 10 },
];

export function AnalysisProgress() {
  const [elapsed, setElapsed] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cumulative = 0;
    for (let i = 0; i < steps.length; i++) {
      cumulative += steps[i].duration;
      if (elapsed < cumulative) {
        setActiveStep(i);
        return;
      }
    }
    setActiveStep(steps.length - 1);
  }, [elapsed]);

  return (
    <div className="w-full max-w-lg mx-auto text-center py-20">
      <Loader2 className="w-8 h-8 text-blue-900 dark:text-blue-400 animate-spin mx-auto" />

      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6">
        Analyzing your contract
      </h2>
      <p className="text-[15px] text-gray-500 mt-2">
        This usually takes 1–2 minutes
      </p>

      {/* Steps */}
      <div className="mt-10 space-y-3 text-left max-w-xs mx-auto">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-500 ${
              i < activeStep
                ? "text-gray-400"
                : i === activeStep
                  ? "text-blue-900 dark:text-blue-400"
                  : "text-gray-300 dark:text-gray-700"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
              i < activeStep
                ? "bg-blue-900/10 text-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400/50"
                : i === activeStep
                  ? "bg-blue-900 text-white dark:bg-blue-600"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
            }`}>
              {i < activeStep ? "✓" : i + 1}
            </span>
            <span className={`text-[14px] ${i === activeStep ? "font-semibold" : ""}`}>
              {step.label}
              {i === activeStep && (
                <span className="ml-1.5 animate-pulse">...</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
