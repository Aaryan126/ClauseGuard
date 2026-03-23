import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisReport } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generates a professional negotiation email based on the analysis results.
 * Includes all flagged clauses with their suggested actions and proposed revisions.
 */
export async function generateNegotiationEmail(
  report: AnalysisReport,
  fileName: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const flaggedClauses = report.clauses.filter((c) => c.severity !== "green");

  if (flaggedClauses.length === 0) {
    return "No flagged clauses found — no negotiation email needed. This contract appears to be standard.";
  }

  // Build clause summary for the prompt
  const clauseDetails = flaggedClauses.map((c, i) => {
    const parts = [`Clause ${i + 1}: "${c.clause.title}" (${c.severity === "red" ? "High Risk" : "Review"})`];
    if (c.suggestedAction) parts.push(`  Issue: ${c.suggestedAction}`);
    if (c.proposedRevision) parts.push(`  Proposed revision: "${c.proposedRevision.slice(0, 500)}"`);
    return parts.join("\n");
  }).join("\n\n");

  const missingDetails = report.missingClauses.length > 0
    ? `\n\nMISSING CLAUSES (not found in the contract):\n${report.missingClauses.map((m) => `- ${m.clauseName}: ${m.summary}`).join("\n")}`
    : "";

  const prompt = `You are a professional contract negotiation assistant. Generate a polite, professional email requesting amendments to a contract.

CONTRACT TYPE: ${report.contractType}
FILE: ${fileName}
TOTAL CLAUSES: ${report.totalClauses}
FLAGGED: ${flaggedClauses.length} clauses need attention
${report.missingClauses.length > 0 ? `MISSING: ${report.missingClauses.length} standard clauses not found` : ""}

FLAGGED CLAUSES:
${clauseDetails}
${missingDetails}

Write a professional negotiation email that:
1. Opens with a polite acknowledgment of receiving the contract
2. States that you've reviewed it and have some proposed amendments
3. Lists each flagged clause with a clear, specific request for change (use the proposed revisions where available)
4. If there are missing clauses, politely requests they be added
5. Closes professionally, expressing willingness to discuss

Rules:
- Be professional but firm — this is a business negotiation, not a complaint
- Reference specific clause titles and section numbers
- Use the proposed revision text where available — present it as your suggested alternative wording
- Keep each point concise — one paragraph per clause maximum
- Don't use legal jargon unnecessarily
- Don't mention AI, automated analysis, or ClauseGuard
- Format with clear numbered points for each requested change
- The email should be ready to send — include subject line, greeting, and sign-off with [Your Name] placeholder`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Failed to generate negotiation email:", error);
    return "Unable to generate negotiation email. Please try again.";
  }
}
