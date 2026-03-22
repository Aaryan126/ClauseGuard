import { GoogleGenerativeAI } from "@google/generative-ai";
import { ClauseAnalysis, FlagSource } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function explainFlaggedClauses(
  analyses: ClauseAnalysis[]
): Promise<ClauseAnalysis[]> {
  const flagged = analyses.filter((a) => a.severity !== "green");

  if (flagged.length === 0) return analyses;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  // Process flagged clauses in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < flagged.length; i += BATCH_SIZE) {
    const batch = flagged.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((analysis) => explainSingle(model, analysis)));
  }

  return analyses;
}

/* ── Flag-source-specific instructions ── */

function getFlagContext(analysis: ClauseAnalysis): string {
  const { flagSource, severity, bestMatch, ruleHits } = analysis;
  const simPct = bestMatch ? (bestMatch.similarity * 100).toFixed(1) : null;

  if (flagSource === "pattern") {
    const tiers = ruleHits.map((r) => r.tier);
    const tierLabel = tiers.includes("critical")
      ? "critical (high-severity, always flagged regardless of similarity)"
      : tiers.includes("serious")
        ? "serious (escalated because of the specific pattern detected)"
        : "caution";
    return `FLAG REASON: This clause was flagged by PATTERN DETECTION, not low similarity.
The embedding similarity is ${simPct}% (which would normally be green/standard), but an aggressive pattern was detected.
The detected pattern is classified as "${tierLabel}".
Focus your explanation on the SPECIFIC pattern that was detected and why it is risky, even though the clause structure is close to standard.`;
  }

  if (flagSource === "similarity") {
    return `FLAG REASON: This clause was flagged by LOW SIMILARITY to standard templates.
The embedding similarity is only ${simPct}% (threshold for standard is 82%). No aggressive keyword patterns were detected.
Focus your explanation on HOW this clause differs from the standard version. Compare the two texts and point out the specific differences in scope, duration, obligations, or rights.`;
  }

  if (flagSource === "both") {
    return `FLAG REASON: This clause was flagged by BOTH low similarity AND pattern detection.
The embedding similarity is ${simPct}% (below standard threshold) and aggressive patterns were also detected.
Address both concerns: explain how the clause structure differs from standard AND what the specific aggressive pattern means.`;
  }

  return `FLAG REASON: Severity is ${severity}. Explain the risk.`;
}

/* ── Build the full prompt ── */

function buildPrompt(analysis: ClauseAnalysis): string {
  const { clause, bestMatch, ruleHits } = analysis;

  const flagContext = getFlagContext(analysis);

  // Standard clause comparison
  let comparisonBlock = "";
  if (bestMatch) {
    comparisonBlock = `
CLOSEST STANDARD CLAUSE: "${bestMatch.standardClause.clauseName}"
SIMILARITY: ${(bestMatch.similarity * 100).toFixed(1)}%

STANDARD TEXT (for comparison):
"${bestMatch.standardClause.standardText}"

Compare the uploaded clause against this standard text. Identify specific phrases, terms, or obligations that differ.`;
  } else {
    comparisonBlock = `
No matching standard clause was found in our database. This clause appears novel or highly unusual.`;
  }

  // Rule hits with tier context
  let ruleBlock = "";
  if (ruleHits.length > 0) {
    const ruleLines = ruleHits.map((r) => {
      const tierNote =
        r.tier === "critical" ? " [CRITICAL — this is a serious issue regardless of context]"
        : r.tier === "serious" ? " [SERIOUS — significant concern]"
        : " [CAUTION — worth noting]";
      return `- ${r.ruleName}${tierNote}: ${r.details}`;
    });
    ruleBlock = `
DETECTED PATTERNS:
${ruleLines.join("\n")}`;
  }

  return `You are a contract review assistant helping a non-lawyer understand a flagged clause.

UPLOADED CLAUSE:
"${clause.text}"

${flagContext}
${comparisonBlock}
${ruleBlock}

Respond in this exact JSON format:
{
  "explanation": "2-3 sentences. What does this clause actually do, and what is the specific risk to the person signing? Reference the actual language in the clause. Do not be vague.",
  "normalVersion": "1-2 sentences. What would a fair, standard version of this clause say instead? Be specific about what would change (e.g., duration, scope, mutual vs one-sided). If you cannot identify a meaningful improvement, respond with null.",
  "suggestedAction": "One concrete sentence telling the signer what to do. Examples: 'Request a mutual termination right instead of one-sided.' or 'Ask to cap the non-compete at 12 months and limit to your geographic area.' or 'This is standard — no action needed.' Be specific and actionable.",
  "proposedRevision": "A rewritten version of the UPLOADED CLAUSE that fixes the identified issues. Keep the same structure, tone, and style as the original — this should read like a drop-in replacement the user can propose in a redline. Incorporate protections from the standard clause where the original is missing them. If no meaningful revision is needed, respond with null."
}

Rules:
- Be specific. Reference actual phrases from the clause.
- Compare against the standard text if provided. Name the differences.
- If a pattern was detected, explain what that specific pattern means practically.
- Avoid generic statements like "this is fairly standard" or "consult a lawyer."
- If the normalVersion would be essentially the same as the uploaded clause, set normalVersion to null.
- The suggestedAction must be a concrete negotiation point or confirmation that no action is needed. Never say "consult a lawyer" as the action.
- The proposedRevision must preserve the original clause's style and structure. It is NOT the standard clause — it is the user's clause rewritten to be fair. If the original is already fair, set proposedRevision to null.
- Respond ONLY with the JSON object, no markdown or extra text.`;
}

/* ── Call LLM ── */

async function explainSingle(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  analysis: ClauseAnalysis
): Promise<void> {
  const prompt = buildPrompt(analysis);

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis.explanation = parsed.explanation || undefined;
      analysis.normalVersion = parsed.normalVersion || undefined;
      analysis.suggestedAction = parsed.suggestedAction || undefined;
      analysis.proposedRevision = parsed.proposedRevision || undefined;
    }
  } catch (error) {
    console.error(`Failed to explain clause: ${analysis.clause.title}`, error);
    analysis.explanation = "Unable to generate explanation. Please review this clause manually.";
  }
}
