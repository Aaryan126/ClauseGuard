"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface AnalysisProgressProps {
  step?: string;
  detail?: string;
}

const ALL_STEPS = [
  "Extracting text from PDF",
  "Starting analysis",
  "Extracting clauses",
  "Loading standards",
  "Generating embeddings",
  "Matching against standards",
  "Scoring clauses with AI",
  "Checking for aggressive patterns",
  "Generating explanations",
  "Checking for missing clauses",
  "Building report",
];

export function AnalysisProgress({ step, detail }: AnalysisProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Track completed steps
  useEffect(() => {
    if (step && !completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
  }, [step, completedSteps]);

  // Find the current step index in ALL_STEPS for display
  const currentStepIdx = step ? ALL_STEPS.findIndex((s) => step.includes(s) || s.includes(step)) : -1;

  return (
    <div className="w-full max-w-lg mx-auto text-center py-20">
      <Loader2 className="w-8 h-8 text-blue-900 dark:text-blue-400 animate-spin mx-auto" />

      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6">
        Analyzing your contract
      </h2>
      <p className="text-[15px] text-gray-500 mt-2">
        This usually takes 1–2 minutes
      </p>

      {/* Current step */}
      <div className="mt-8">
        {step ? (
          <p className="text-[14px] text-blue-900 dark:text-blue-400 font-semibold">
            {step}
            <span className="animate-pulse">...</span>
          </p>
        ) : (
          <p className="text-[14px] text-gray-400">Preparing...</p>
        )}
        {detail && (
          <p className="text-[13px] text-gray-400 mt-1">{detail}</p>
        )}
      </div>

      {/* Step list */}
      <div className="mt-8 space-y-2.5 text-left max-w-xs mx-auto">
        {ALL_STEPS.map((s, i) => {
          const isCompleted = completedSteps.some((cs) => s.includes(cs) || cs.includes(s));
          const isCurrent = i === currentStepIdx;
          const isFuture = !isCompleted && !isCurrent;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 transition-all duration-300 ${
                isCompleted && !isCurrent
                  ? "text-gray-400"
                  : isCurrent
                    ? "text-blue-900 dark:text-blue-400"
                    : "text-gray-300 dark:text-gray-700"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all duration-300 ${
                isCompleted && !isCurrent
                  ? "bg-blue-900/10 text-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400/50"
                  : isCurrent
                    ? "bg-blue-900 text-white dark:bg-blue-600"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
              }`}>
                {isCompleted && !isCurrent ? "✓" : i + 1}
              </span>
              <span className={`text-[13px] ${isCurrent ? "font-semibold" : ""} ${isFuture ? "opacity-50" : ""}`}>
                {s}
              </span>
            </div>
          );
        })}
      </div>

      {/* Timer */}
      <p className="text-[12px] text-gray-400 mt-6 tabular-nums">
        {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")} elapsed
      </p>
    </div>
  );
}
