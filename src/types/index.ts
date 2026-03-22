export type ContractType = "nda" | "saas";

export interface StandardClause {
  id: string;
  contractType: ContractType;
  category: string;
  clauseName: string;
  standardText: string;
  summary: string;
  embedding: number[];
  aggressiveIndicators: string[];
  normalRange: {
    description: string;
  };
  source: "common-paper" | "bonterms" | "cuad" | "manual";
  sourceRef: string;
  role: "anchor" | "variant";
}

export interface ExtractedClause {
  index: number;
  title: string;
  text: string;
  startChar: number;
  endChar: number;
}

export type Severity = "green" | "yellow" | "red";

export type RuleTier = "critical" | "serious" | "caution";

export type FlagSource = "similarity" | "pattern" | "both" | null;

export interface RuleHit {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  tier: RuleTier;
  details: string;
}

export interface ClauseAnalysis {
  clause: ExtractedClause;
  bestMatch: {
    standardClause: StandardClause;
    similarity: number;
  } | null;
  ruleHits: RuleHit[];
  severity: Severity;
  flagSource: FlagSource;
  explanation?: string;
  normalVersion?: string;
}

export interface AnalysisReport {
  contractType: string;
  totalClauses: number;
  summary: {
    green: number;
    yellow: number;
    red: number;
  };
  overallRiskScore: number; // 0-100
  clauses: ClauseAnalysis[];
  rawText: string;
}
