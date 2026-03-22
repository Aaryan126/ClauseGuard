import { Severity, RuleHit, FlagSource } from "@/types";

// Embedding thresholds — used as fallback when LLM scoring is unavailable
export const THRESHOLDS = {
  green: 0.82,
  yellow: 0.65,
  novel: 0.50,
};

export function getSeverityFromSimilarity(similarity: number): Severity {
  if (similarity >= THRESHOLDS.green) return "green";
  if (similarity >= THRESHOLDS.yellow) return "yellow";
  return "red";
}

/**
 * Combines LLM-judged severity with rule-engine hits using the tier system.
 *
 * The LLM severity is the primary signal (replaces rigid cosine thresholds).
 * Rule tiers can still override:
 *
 *   LLM Score  | No rules | Caution  | Serious  | Critical
 *   GREEN      | GREEN    | GREEN    | YELLOW   | RED
 *   YELLOW     | YELLOW   | YELLOW   | RED      | RED
 *   RED        | RED      | RED      | RED      | RED
 */
export function combineSeverity(
  llmSeverity: Severity,
  ruleHits: RuleHit[],
): { severity: Severity; flagSource: FlagSource } {
  const hasCritical = ruleHits.some((h) => h.tier === "critical");
  const hasSerious = ruleHits.some((h) => h.tier === "serious");
  const hasAnyRule = ruleHits.length > 0;

  let severity: Severity;

  if (llmSeverity === "red") {
    severity = "red";
  } else if (llmSeverity === "yellow") {
    severity = hasCritical || hasSerious ? "red" : "yellow";
  } else {
    // LLM says green
    if (hasCritical) {
      severity = "red";
    } else if (hasSerious) {
      severity = "yellow";
    } else {
      severity = "green";
    }
  }

  // Determine what drove the flag
  let flagSource: FlagSource;
  const llmFlagged = llmSeverity !== "green";
  const ruleContributed =
    hasAnyRule && (hasCritical || hasSerious || llmSeverity !== "green");

  if (severity === "green") {
    flagSource = null;
  } else if (llmFlagged && ruleContributed) {
    flagSource = "both";
  } else if (ruleContributed) {
    flagSource = "pattern";
  } else {
    flagSource = "similarity";
  }

  return { severity, flagSource };
}

export function calculateOverallRiskScore(
  severities: Severity[]
): number {
  if (severities.length === 0) return 0;

  const weights: Record<Severity, number> = {
    green: 0,
    yellow: 40,
    red: 100,
  };

  const totalWeight = severities.reduce((sum, s) => sum + weights[s], 0);
  return Math.round(totalWeight / severities.length);
}
