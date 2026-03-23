import { GoogleGenerativeAI } from "@google/generative-ai";
import { StandardClause, ClauseAnalysis, MissingClause, ContractType } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Important standard clause categories per contract type.
 */
const IMPORTANT_CATEGORIES: Record<ContractType, { category: string; importance: "high" | "medium" | "low" }[]> = {
  nda: [
    { category: "Definitions", importance: "high" },
    { category: "Obligations", importance: "high" },
    { category: "Exclusions", importance: "high" },
    { category: "Required Disclosures", importance: "high" },
    { category: "Term", importance: "high" },
    { category: "Return of Information", importance: "medium" },
    { category: "Governing Law", importance: "medium" },
    { category: "Amendment", importance: "medium" },
    { category: "Remedies", importance: "low" },
    { category: "Severability", importance: "low" },
  ],
  saas: [
    { category: "Term", importance: "high" },
    { category: "Termination", importance: "high" },
    { category: "Liability", importance: "high" },
    { category: "Data Protection", importance: "high" },
    { category: "Payment", importance: "high" },
    { category: "IP Ownership", importance: "medium" },
    { category: "Confidentiality", importance: "medium" },
    { category: "Warranty", importance: "medium" },
    { category: "Indemnification", importance: "medium" },
    { category: "SLA", importance: "medium" },
    { category: "Severability", importance: "low" },
    { category: "Force Majeure", importance: "low" },
  ],
  consulting: [
    { category: "Services", importance: "high" },
    { category: "IP Rights", importance: "high" },
    { category: "Payment", importance: "high" },
    { category: "Term", importance: "high" },
    { category: "Liability", importance: "high" },
    { category: "Confidentiality", importance: "medium" },
    { category: "Warranty", importance: "medium" },
    { category: "Indemnification", importance: "medium" },
    { category: "Subcontractors", importance: "medium" },
    { category: "Relationship", importance: "low" },
    { category: "Severability", importance: "low" },
    { category: "Insurance", importance: "low" },
  ],
};

/**
 * Two-step missing clause detection:
 * 1. Fast category check — which standard categories have no embedding match?
 * 2. LLM verification — is the topic truly absent, or covered within another clause?
 */
export async function detectMissingClauses(
  analyses: ClauseAnalysis[],
  standards: StandardClause[],
  contractType: ContractType,
  rawText: string
): Promise<MissingClause[]> {
  // Step 1: Fast category check
  const coveredCategories = new Set<string>();
  for (const analysis of analyses) {
    if (analysis.bestMatch) {
      coveredCategories.add(analysis.bestMatch.standardClause.category);
    }
  }

  const importantCategories = IMPORTANT_CATEGORIES[contractType] || [];
  const candidates: { category: string; importance: "high" | "medium" | "low"; clauseName: string; summary: string }[] = [];

  for (const { category, importance } of importantCategories) {
    if (coveredCategories.has(category)) continue;

    const representative = standards.find(
      (s) => s.contractType === contractType && s.category === category
    );
    if (representative) {
      candidates.push({
        category,
        importance,
        clauseName: representative.clauseName,
        summary: representative.summary,
      });
    }
  }

  if (candidates.length === 0) return [];

  // Step 2: LLM verification — check if topics are truly absent
  try {
    const verified = await verifyMissingWithLLM(candidates, rawText);
    return verified;
  } catch (error) {
    console.error("LLM missing clause verification failed, using category-based results:", error);
    // Fallback: return all candidates
    return candidates.map((c) => ({
      clauseName: c.clauseName,
      category: c.category,
      summary: c.summary,
      importance: c.importance,
    }));
  }
}

async function verifyMissingWithLLM(
  candidates: { category: string; importance: "high" | "medium" | "low"; clauseName: string; summary: string }[],
  rawText: string
): Promise<MissingClause[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const candidateList = candidates
    .map((c, i) => `${i + 1}. "${c.clauseName}" — ${c.summary}`)
    .join("\n");

  // Truncate contract text to avoid token limits
  const contractExcerpt = rawText.slice(0, 8000);

  const prompt = `You are a legal contract analyst. I have a contract and a list of standard clauses that were NOT matched by our embedding system. Some of these may actually be covered within other clauses of the contract, just not as standalone sections.

CONTRACT TEXT:
"${contractExcerpt}"

POTENTIALLY MISSING CLAUSES:
${candidateList}

For each potentially missing clause, determine if the contract ACTUALLY addresses that topic anywhere — even if it's embedded within another clause, mentioned briefly, or covered by a different section title.

Respond with a JSON array of ONLY the clauses that are TRULY missing (not addressed anywhere in the contract). Use this format:
[
  { "index": 1, "missing": true },
  { "index": 2, "missing": false }
]

Rules:
- If the topic is addressed ANYWHERE in the contract, even partially or within another clause, mark it as missing: false
- Only mark missing: true if the contract has NO provision at all addressing that topic
- A clause that says "as defined below" or references another section counts as addressed
- Respond ONLY with the JSON array`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return candidates.map((c) => ({ ...c }));

  const parsed = JSON.parse(jsonMatch[0]) as { index: number; missing: boolean }[];
  const trulyMissing: MissingClause[] = [];

  for (const item of parsed) {
    if (item.missing && item.index >= 1 && item.index <= candidates.length) {
      const c = candidates[item.index - 1];
      trulyMissing.push({
        clauseName: c.clauseName,
        category: c.category,
        summary: c.summary,
        importance: c.importance,
      });
    }
  }

  return trulyMissing;
}
