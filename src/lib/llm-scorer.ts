import { GoogleGenerativeAI } from "@google/generative-ai";
import { Severity, StandardClause, ExtractedClause } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export type LLMSeverity = Severity | "skip";

export interface LLMScoreResult {
  severity: LLMSeverity;
  reasoning: string;
}

/**
 * Uses Gemini 2.5 Pro to judge whether an uploaded clause is functionally
 * equivalent to the closest standard clause. This replaces rigid cosine
 * similarity thresholds with LLM judgment for severity determination.
 *
 * Embeddings are still used to find the best match — the LLM only scores
 * the matched pair.
 */
export async function scoreClausesWithLLM(
  clauses: ExtractedClause[],
  bestMatches: (StandardClause | null)[],
  similarities: number[]
): Promise<LLMScoreResult[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const BATCH_SIZE = 5;
  const results: LLMScoreResult[] = new Array(clauses.length);

  for (let i = 0; i < clauses.length; i += BATCH_SIZE) {
    const batchIndices = Array.from(
      { length: Math.min(BATCH_SIZE, clauses.length - i) },
      (_, k) => i + k
    );

    await Promise.all(
      batchIndices.map(async (idx) => {
        results[idx] = await scoreSingle(
          model,
          clauses[idx],
          bestMatches[idx],
          similarities[idx]
        );
      })
    );
  }

  return results;
}

async function scoreSingle(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  clause: ExtractedClause,
  bestMatch: StandardClause | null,
  similarity: number
): Promise<LLMScoreResult> {
  if (!bestMatch) {
    // No standard match at all — novel clause
    return {
      severity: "red",
      reasoning: "No matching standard clause found. This clause appears novel or highly unusual.",
    };
  }

  const prompt = `You are a legal contract analyst. Your task is to judge whether an uploaded contract clause is functionally equivalent to an industry-standard clause.

UPLOADED CLAUSE:
"${clause.text.slice(0, 3000)}"

CLOSEST STANDARD CLAUSE: "${bestMatch.clauseName}"
STANDARD TEXT:
"${bestMatch.standardText.slice(0, 3000)}"

EMBEDDING SIMILARITY: ${(similarity * 100).toFixed(1)}% (this is a rough semantic similarity score — use it as context but make your own judgment)

FIRST: Determine if the uploaded text is actually a substantive legal clause. The following should be classified as "skip":
- Signature blocks (name/date/signature lines)
- Page numbers, headers, footers, copyright notices
- Preambles and recitals (introductory text that identifies the parties, states the date, and describes the general purpose — these are not substantive obligations)
- Title pages or contract identification sections
- Definitions-only sections that merely label parties (e.g., "Disclosing Party", "Receiving Party") without creating obligations

If it IS a substantive clause, judge it against the standard on these criteria:
1. Does it achieve the SAME LEGAL EFFECT as the standard?
2. Are there any MISSING PROTECTIONS that the standard includes but this clause omits?
3. Are there any ADDITIONAL OBLIGATIONS or restrictions beyond what the standard requires?
4. Is the SCOPE broader or narrower than standard (duration, geography, parties affected)?

Classify the clause as one of:
- "skip" — Not a substantive legal clause (signature block, header, footer, page number, copyright notice, formatting).
- "green" — Functionally equivalent to standard. Minor wording differences are fine. No meaningful risk difference.
- "yellow" — Partially equivalent but has notable deviations. Missing a protection, broader scope, or additional obligation that the signer should review.
- "red" — Significantly different from standard. Missing critical protections, imposes unusual obligations, or contains terms that could be harmful.

Respond ONLY with this JSON:
{
  "severity": "skip" | "green" | "yellow" | "red",
  "reasoning": "One sentence explaining your judgment."
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const sev = parsed.severity;
      if (sev === "skip" || sev === "green" || sev === "yellow" || sev === "red") {
        return { severity: sev, reasoning: parsed.reasoning || "" };
      }
    }
  } catch (error) {
    console.error(`LLM scoring failed for clause: ${clause.title}`, error);
  }

  // Fallback: use embedding similarity thresholds
  if (similarity >= 0.82) return { severity: "green", reasoning: "LLM scoring unavailable. Based on embedding similarity." };
  if (similarity >= 0.65) return { severity: "yellow", reasoning: "LLM scoring unavailable. Based on embedding similarity." };
  return { severity: "red", reasoning: "LLM scoring unavailable. Based on embedding similarity." };
}
