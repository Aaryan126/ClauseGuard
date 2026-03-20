import { StandardClause } from "@/types";

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

export interface MatchResult {
  standardClause: StandardClause;
  similarity: number;
}

export function findBestMatch(
  clauseEmbedding: number[],
  standards: StandardClause[]
): MatchResult | null {
  if (standards.length === 0) return null;

  let bestMatch: MatchResult | null = null;

  for (const standard of standards) {
    if (!standard.embedding || standard.embedding.length === 0) continue;
    const sim = cosineSimilarity(clauseEmbedding, standard.embedding);
    if (!bestMatch || sim > bestMatch.similarity) {
      bestMatch = { standardClause: standard, similarity: sim };
    }
  }

  return bestMatch;
}

export function findTopMatches(
  clauseEmbedding: number[],
  standards: StandardClause[],
  topK: number = 3
): MatchResult[] {
  const results: MatchResult[] = standards
    .filter((s) => s.embedding && s.embedding.length > 0)
    .map((standard) => ({
      standardClause: standard,
      similarity: cosineSimilarity(clauseEmbedding, standard.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, topK);
}
