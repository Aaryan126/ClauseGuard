import { GoogleGenerativeAI } from "@google/generative-ai";
import { ClauseAnalysis } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function explainFlaggedClauses(
  analyses: ClauseAnalysis[]
): Promise<ClauseAnalysis[]> {
  const flagged = analyses.filter((a) => a.severity !== "green");

  if (flagged.length === 0) return analyses;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Process flagged clauses in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < flagged.length; i += BATCH_SIZE) {
    const batch = flagged.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((analysis) => explainSingle(model, analysis)));
  }

  return analyses;
}

async function explainSingle(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  analysis: ClauseAnalysis
): Promise<void> {
  const matchInfo = analysis.bestMatch
    ? `\nClosest standard clause: "${analysis.bestMatch.standardClause.clauseName}"\nStandard text: "${analysis.bestMatch.standardClause.standardText}"\nSimilarity score: ${(analysis.bestMatch.similarity * 100).toFixed(1)}%`
    : "\nNo matching standard clause found in our database.";

  const ruleInfo =
    analysis.ruleHits.length > 0
      ? `\nAggressive patterns detected:\n${analysis.ruleHits.map((r) => `- ${r.ruleName}: ${r.details}`).join("\n")}`
      : "";

  const prompt = `You are a contract analysis assistant. Analyze this contract clause and explain the risks in plain English.

CLAUSE TEXT:
"${analysis.clause.text}"
${matchInfo}
${ruleInfo}

Provide your response in this exact JSON format:
{
  "explanation": "2-3 sentences explaining what this clause does and why it's flagged. Be specific about the risk to the person signing.",
  "normalVersion": "1-2 sentences describing what a standard/fair version of this clause would look like."
}

Be concise and practical. Avoid legal jargon. Focus on what the person signing should know.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis.explanation = parsed.explanation;
      analysis.normalVersion = parsed.normalVersion;
    }
  } catch (error) {
    console.error(`Failed to explain clause: ${analysis.clause.title}`, error);
    analysis.explanation = "Unable to generate explanation. Please review this clause manually.";
  }
}
