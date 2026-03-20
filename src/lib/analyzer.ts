import { parseDocument } from "./parser";
import { segmentClauses } from "./segmenter";
import { getEmbeddings } from "./embeddings";
import { findBestMatch } from "./comparison";
import { getSeverityFromSimilarity, combineSeverity, calculateOverallRiskScore, THRESHOLDS } from "./scoring";
import { checkAggressivePatterns } from "./rules";
import { explainFlaggedClauses } from "./explainer";
import { loadStandards } from "@/data/standards-loader";
import { AnalysisReport, ClauseAnalysis, Severity } from "@/types";

export async function analyzeContract(
  buffer: Buffer,
  filename: string
): Promise<AnalysisReport> {
  // Step 1: Parse the document
  const text = await parseDocument(buffer, filename);

  // Step 2: Segment into clauses
  const clauses = segmentClauses(text);

  if (clauses.length === 0) {
    throw new Error("No clauses could be extracted from the document.");
  }

  // Step 3: Load standard clauses
  const standards = await loadStandards();

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
    contractType: detectContractType(text),
    totalClauses: clauses.length,
    summary,
    overallRiskScore: calculateOverallRiskScore(severities),
    clauses: analyses,
  };
}

function detectContractType(text: string): string {
  const lower = text.toLowerCase();

  const signals: Record<string, string[]> = {
    "Non-Disclosure Agreement (NDA)": ["non-disclosure", "nda", "confidential information", "receiving party", "disclosing party"],
    "SaaS Agreement": ["software as a service", "saas", "subscription", "service level", "uptime", "sla"],
    "Employment Agreement": ["employee", "employer", "employment", "compensation", "benefits", "at-will"],
    "Freelance / Contractor Agreement": ["contractor", "independent contractor", "statement of work", "deliverables"],
  };

  let bestType = "General Contract";
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(signals)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}
