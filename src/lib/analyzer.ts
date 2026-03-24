import { segmentClauses } from "./segmenter";
import { getEmbeddings } from "./embeddings";
import { findBestMatch } from "./comparison";
import { combineSeverity, calculateOverallRiskScore, THRESHOLDS } from "./scoring";
import { scoreClausesWithLLM } from "./llm-scorer";
import { checkAggressivePatterns } from "./rules";
import { explainFlaggedClauses } from "./explainer";
import { detectMissingClauses } from "./missing-clauses";
import { loadStandards } from "@/data/standards-loader";
import { AnalysisReport, ClauseAnalysis, ContractType } from "@/types";

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  nda: "Non-Disclosure Agreement (NDA)",
  saas: "SaaS Agreement",
  consulting: "Consulting / Professional Services Agreement",
};

export type ProgressCallback = (step: string, detail?: string) => void;

// Analyze from pre-extracted text (used for PDFs where client extracts text via pdfjs)
export async function analyzeText(
  text: string,
  contractType: ContractType,
  onProgress?: ProgressCallback
): Promise<AnalysisReport> {
  return runAnalysisPipeline(text, contractType, onProgress);
}


async function runAnalysisPipeline(
  text: string,
  contractType: ContractType,
  onProgress?: ProgressCallback
): Promise<AnalysisReport> {
  onProgress?.("Extracting clauses");
  const clauses = segmentClauses(text);

  if (clauses.length === 0) {
    throw new Error("No clauses could be extracted from the document.");
  }

  onProgress?.("Loading standards", `${clauses.length} clauses found`);

  // Step 1: Load standard clauses filtered by contract type
  const allStandards = await loadStandards();
  const standards = allStandards.filter((s) => s.contractType === contractType);

  // Step 2: Generate embeddings for all extracted clauses
  onProgress?.("Generating embeddings", `Embedding ${clauses.length} clauses`);
  const clauseTexts = clauses.map((c) => c.text);
  const embeddings = await getEmbeddings(clauseTexts);

  // Step 3: Find best embedding match for each clause
  onProgress?.("Matching against standards");
  const matchResults = clauses.map((_, i) => findBestMatch(embeddings[i], standards));
  const bestMatchStandards = matchResults.map((m) => m?.standardClause ?? null);
  const similarities = matchResults.map((m) => m?.similarity ?? 0);

  // Debug: log similarity scores
  clauses.forEach((c, i) => {
    const matchName = bestMatchStandards[i]?.clauseName ?? "none";
    console.log(`[ClauseGuard] Clause "${c.title}" → ${(similarities[i] * 100).toFixed(1)}% similar to "${matchName}"`);
  });

  // Step 4: LLM-based severity scoring
  onProgress?.("Scoring clauses with AI", `Evaluating ${clauses.length} clauses`);
  const llmScores = await scoreClausesWithLLM(clauses, bestMatchStandards, similarities);

  // Step 5: Run pattern rules on each clause
  onProgress?.("Checking for aggressive patterns");
  const allRuleHits = clauses.map((clause) => checkAggressivePatterns(clause.text));

  // Step 6: Combine LLM severity + rule hits, filtering out non-clauses
  const analyses: ClauseAnalysis[] = [];
  for (let i = 0; i < clauses.length; i++) {
    const llmScore = llmScores[i];
    if (llmScore.severity === "skip") continue;

    const similarity = similarities[i];
    const bestMatch = matchResults[i];
    const ruleHits = allRuleHits[i];
    const { severity, flagSource } = combineSeverity(llmScore.severity, ruleHits);

    analyses.push({
      clause: clauses[i],
      bestMatch: bestMatch && similarity >= THRESHOLDS.novel
        ? { standardClause: bestMatch.standardClause, similarity }
        : null,
      ruleHits,
      severity,
      flagSource,
    });
  }

  // Step 7: Get LLM explanations for flagged clauses only
  const flaggedCount = analyses.filter((a) => a.severity !== "green").length;
  onProgress?.("Generating explanations", `${flaggedCount} flagged clauses`);
  await explainFlaggedClauses(analyses);

  // Step 8: Detect missing clauses
  onProgress?.("Checking for missing clauses");
  const missingClauses = await detectMissingClauses(analyses, standards, contractType, text);

  // Step 9: Build the report
  onProgress?.("Building report");
  const severities = analyses.map((a) => a.severity);
  const summary = {
    green: severities.filter((s) => s === "green").length,
    yellow: severities.filter((s) => s === "yellow").length,
    red: severities.filter((s) => s === "red").length,
  };

  return {
    contractType: CONTRACT_TYPE_LABELS[contractType],
    totalClauses: analyses.length,
    summary,
    overallRiskScore: calculateOverallRiskScore(severities),
    clauses: analyses,
    missingClauses,
    rawText: text,
  };
}
