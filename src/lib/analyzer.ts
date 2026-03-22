import { parseDocument } from "./parser";
import { segmentClauses } from "./segmenter";
import { getEmbeddings } from "./embeddings";
import { findBestMatch } from "./comparison";
import { combineSeverity, calculateOverallRiskScore, THRESHOLDS } from "./scoring";
import { scoreClausesWithLLM } from "./llm-scorer";
import { checkAggressivePatterns } from "./rules";
import { explainFlaggedClauses } from "./explainer";
import { loadStandards } from "@/data/standards-loader";
import { AnalysisReport, ClauseAnalysis, ContractType } from "@/types";

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  nda: "Non-Disclosure Agreement (NDA)",
  saas: "SaaS Agreement",
};

// Analyze from pre-extracted text (used for PDFs where client extracts text via pdfjs)
export async function analyzeText(
  text: string,
  contractType: ContractType
): Promise<AnalysisReport> {
  return runAnalysisPipeline(text, contractType);
}

// Analyze from file buffer (used for DOCX/TXT where server parses the file)
export async function analyzeContract(
  buffer: Buffer,
  filename: string,
  contractType: ContractType
): Promise<AnalysisReport> {
  const text = await parseDocument(buffer, filename);
  return runAnalysisPipeline(text, contractType);
}

async function runAnalysisPipeline(
  text: string,
  contractType: ContractType
): Promise<AnalysisReport> {
  const clauses = segmentClauses(text);

  if (clauses.length === 0) {
    throw new Error("No clauses could be extracted from the document.");
  }

  // Step 1: Load standard clauses filtered by contract type
  const allStandards = await loadStandards();
  const standards = allStandards.filter((s) => s.contractType === contractType);

  // Step 2: Generate embeddings for all extracted clauses
  const clauseTexts = clauses.map((c) => c.text);
  const embeddings = await getEmbeddings(clauseTexts);

  // Step 3: Find best embedding match for each clause
  const matchResults = clauses.map((_, i) => findBestMatch(embeddings[i], standards));
  const bestMatchStandards = matchResults.map((m) => m?.standardClause ?? null);
  const similarities = matchResults.map((m) => m?.similarity ?? 0);

  // Step 4: LLM-based severity scoring (replaces rigid cosine thresholds)
  const llmScores = await scoreClausesWithLLM(clauses, bestMatchStandards, similarities);

  // Step 5: Run pattern rules on each clause
  const allRuleHits = clauses.map((clause) => checkAggressivePatterns(clause.text));

  // Step 6: Combine LLM severity + rule hits using tier system
  const analyses: ClauseAnalysis[] = clauses.map((clause, i) => {
    const similarity = similarities[i];
    const bestMatch = matchResults[i];
    const llmScore = llmScores[i];
    const ruleHits = allRuleHits[i];

    const { severity, flagSource } = combineSeverity(llmScore.severity, ruleHits);

    return {
      clause,
      bestMatch: bestMatch && similarity >= THRESHOLDS.novel
        ? { standardClause: bestMatch.standardClause, similarity }
        : null,
      ruleHits,
      severity,
      flagSource,
    };
  });

  // Step 7: Get LLM explanations for flagged clauses only
  await explainFlaggedClauses(analyses);

  // Step 8: Build the report
  const severities = analyses.map((a) => a.severity);
  const summary = {
    green: severities.filter((s) => s === "green").length,
    yellow: severities.filter((s) => s === "yellow").length,
    red: severities.filter((s) => s === "red").length,
  };

  return {
    contractType: CONTRACT_TYPE_LABELS[contractType],
    totalClauses: clauses.length,
    summary,
    overallRiskScore: calculateOverallRiskScore(severities),
    clauses: analyses,
    rawText: text,
  };
}
