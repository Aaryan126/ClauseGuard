import { parseDocument } from "./parser";
import { segmentClauses } from "./segmenter";
import { getEmbeddings } from "./embeddings";
import { findBestMatch } from "./comparison";
import { getSeverityFromSimilarity, combineSeverity, calculateOverallRiskScore, THRESHOLDS } from "./scoring";
import { checkAggressivePatterns } from "./rules";
import { explainFlaggedClauses } from "./explainer";
import { loadStandards } from "@/data/standards-loader";
import { AnalysisReport, ClauseAnalysis, ContractType, Severity } from "@/types";

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

  // Step 3: Load standard clauses filtered by contract type
  const allStandards = await loadStandards();
  const standards = allStandards.filter((s) => s.contractType === contractType);

  // Step 4: Generate embeddings for all extracted clauses
  const clauseTexts = clauses.map((c) => c.text);
  const embeddings = await getEmbeddings(clauseTexts);

  // Step 5: Compare each clause against standards + run rules
  const analyses: ClauseAnalysis[] = clauses.map((clause, i) => {
    const embedding = embeddings[i];
    const bestMatch = findBestMatch(embedding, standards);
    const ruleHits = checkAggressivePatterns(clause.text);

    const embeddingSeverity: Severity = bestMatch
      ? getSeverityFromSimilarity(bestMatch.similarity)
      : "red";

    const severity = combineSeverity(embeddingSeverity, ruleHits);

    return {
      clause,
      bestMatch: bestMatch && bestMatch.similarity >= THRESHOLDS.novel
        ? { standardClause: bestMatch.standardClause, similarity: bestMatch.similarity }
        : null,
      ruleHits,
      severity,
    };
  });

  // Step 6: Get LLM explanations for flagged clauses
  await explainFlaggedClauses(analyses);

  // Step 7: Build the report
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
