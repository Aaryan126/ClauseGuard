import { Severity, RuleHit } from "@/types";

// Configurable thresholds
export const THRESHOLDS = {
  green: 0.82,    // similarity >= 0.82 → green
  yellow: 0.65,   // similarity >= 0.65 → yellow
  // below 0.65 → red
  novel: 0.50,    // below 0.50 → no standard match found
};

export function getSeverityFromSimilarity(similarity: number): Severity {
  if (similarity >= THRESHOLDS.green) return "green";
  if (similarity >= THRESHOLDS.yellow) return "yellow";
  return "red";
}

export function combineSeverity(
  embeddingSeverity: Severity,
  ruleHits: RuleHit[]
): Severity {
  const severityOrder: Record<Severity, number> = {
    green: 0,
    yellow: 1,
    red: 2,
  };

  let worst = severityOrder[embeddingSeverity];

  for (const hit of ruleHits) {
    const hitLevel = severityOrder[hit.severity];
    if (hitLevel > worst) worst = hitLevel;
  }

  const reverseMap: Severity[] = ["green", "yellow", "red"];
  return reverseMap[worst];
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
