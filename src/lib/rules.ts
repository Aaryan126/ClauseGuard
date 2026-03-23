import { RuleHit, Severity, RuleTier } from "@/types";

interface AggressivePattern {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  tier: RuleTier;
  detect: (text: string) => { matched: boolean; details: string };
}

const patterns: AggressivePattern[] = [
  // === RED severity ===
  {
    id: "noncompete-duration",
    name: "Excessive Non-Compete Duration",
    category: "Non-Compete",
    severity: "red",
    tier: "serious",
    detect: (text) => {
      const lower = text.toLowerCase();
      if (!lower.includes("non-compete") && !lower.includes("noncompete") && !lower.includes("non compete") && !lower.includes("covenant not to compete")) {
        return { matched: false, details: "" };
      }
      const yearMatch = text.match(/(\d+)\s*(?:year|yr)/i);
      const monthMatch = text.match(/(\d+)\s*month/i);
      if (yearMatch && parseInt(yearMatch[1]) > 2) {
        return { matched: true, details: `Non-compete period of ${yearMatch[1]} years exceeds the typical maximum of 2 years.` };
      }
      if (monthMatch && parseInt(monthMatch[1]) > 24) {
        return { matched: true, details: `Non-compete period of ${monthMatch[1]} months exceeds the typical maximum of 24 months.` };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "noncompete-worldwide",
    name: "Worldwide Non-Compete Scope",
    category: "Non-Compete",
    severity: "red",
    tier: "serious",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasNonCompete = lower.includes("non-compete") || lower.includes("noncompete") || lower.includes("covenant not to compete");
      const hasWorldwide = lower.includes("worldwide") || lower.includes("globally") || lower.includes("anywhere in the world");
      if (hasNonCompete && hasWorldwide) {
        return { matched: true, details: "Non-compete clause applies worldwide, which is overly broad and often unenforceable." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "unlimited-liability",
    name: "Unlimited Liability",
    category: "Liability",
    severity: "red",
    tier: "critical",
    detect: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes("unlimited liability") || lower.includes("no limit on liability") || lower.includes("without limitation as to amount")) {
        return { matched: true, details: "Clause imposes unlimited liability, which is unusual. Standard contracts cap liability at a multiple of fees paid." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "unilateral-termination",
    name: "Unilateral Termination Without Cause",
    category: "Termination",
    severity: "red",
    tier: "serious",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasTermination = lower.includes("terminat");
      const hasUnilateral = lower.includes("at any time") || lower.includes("for any reason") || lower.includes("with or without cause") || lower.includes("in its sole discretion");
      const hasSingleParty = lower.includes("company may") || lower.includes("employer may") || lower.includes("provider may") || lower.includes("licensor may");
      if (hasTermination && hasUnilateral && hasSingleParty) {
        return { matched: true, details: "Only one party has the right to terminate without cause. Standard contracts provide mutual termination rights." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "blanket-ip-assignment",
    name: "Blanket IP Assignment Including Pre-Existing IP",
    category: "IP Assignment",
    severity: "red",
    tier: "critical",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasIPAssignment = lower.includes("assign") && (lower.includes("intellectual property") || lower.includes("work product") || lower.includes("inventions"));
      const hasBlanket = lower.includes("all intellectual property") || lower.includes("all inventions") || lower.includes("pre-existing") || lower.includes("prior inventions");
      if (hasIPAssignment && hasBlanket) {
        return { matched: true, details: "Clause assigns all IP including pre-existing work. Standard clauses only assign IP created during the engagement and within scope." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "unilateral-amendment",
    name: "Unilateral Amendment Rights",
    category: "General",
    severity: "red",
    tier: "critical",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasAmend = lower.includes("modify") || lower.includes("amend") || lower.includes("change");
      const hasUnilateral = lower.includes("at any time") || lower.includes("sole discretion") || lower.includes("without notice") || lower.includes("without consent");
      const hasTerms = lower.includes("terms") || lower.includes("agreement") || lower.includes("contract");
      if (hasAmend && hasUnilateral && hasTerms) {
        return { matched: true, details: "One party can unilaterally modify the agreement terms. Standard contracts require mutual written consent for amendments." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "no-compelled-disclosure",
    name: "No Carve-Out for Compelled Disclosure",
    category: "Confidentiality",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      // Only fire on clauses that are actually imposing a non-disclosure duty —
      // must contain an active prohibition on disclosure, not just mention confidentiality
      const hasNonDisclosureDuty =
        (lower.includes("shall not disclose") || lower.includes("not to disclose") ||
         lower.includes("will not disclose") || lower.includes("may not disclose") ||
         lower.includes("must not disclose") || lower.includes("not disclose confidential")) &&
        lower.includes("confidential");
      // Also catch "under any circumstances" blanket prohibitions
      const hasBlanketProhibition =
        lower.includes("confidential") && lower.includes("under any circumstances") && lower.includes("disclose");

      if (!hasNonDisclosureDuty && !hasBlanketProhibition) {
        return { matched: false, details: "" };
      }

      const hasCarveOut =
        lower.includes("court order") || lower.includes("subpoena") ||
        lower.includes("legal requirement") || lower.includes("compelled by law") ||
        lower.includes("required by law") || lower.includes("governmental order") ||
        lower.includes("required by applicable law") || lower.includes("legally required") ||
        lower.includes("pursuant to law") || lower.includes("order of a court");
      if (!hasCarveOut) {
        return { matched: true, details: "Confidentiality clause has no exception for legally compelled disclosure (court orders, subpoenas). This is a standard carve-out that should be present." };
      }
      return { matched: false, details: "" };
    },
  },

  // === YELLOW severity ===
  {
    id: "no-cure-period",
    name: "No Cure Period for Breach",
    category: "Termination",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasBreach = lower.includes("breach") && lower.includes("terminat");
      const hasCure = lower.includes("cure") || lower.includes("remedy") || lower.includes("right to correct") || lower.includes("days to");
      if (hasBreach && !hasCure) {
        return { matched: true, details: "Termination for breach with no cure period. Standard contracts typically allow 30 days to remedy a breach before termination." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "auto-renewal-no-optout",
    name: "Auto-Renewal Without Opt-Out Notice",
    category: "Term",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasAutoRenew = lower.includes("automatically renew") || lower.includes("auto-renew") || lower.includes("shall renew");
      const hasOptOut = lower.includes("written notice") || lower.includes("opt out") || lower.includes("notice of non-renewal") || lower.includes("days prior");
      if (hasAutoRenew && !hasOptOut) {
        return { matched: true, details: "Contract auto-renews with no clear opt-out mechanism or notice period. Standard contracts require 30-90 days written notice to prevent renewal." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "payment-over-net90",
    name: "Payment Terms Exceed Net 90",
    category: "Payment",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      const netMatch = text.match(/net\s*(\d+)/i);
      const dayMatch = text.match(/(\d+)\s*(?:calendar\s+)?days?\s*(?:of|from|after)\s*(?:receipt|invoice|billing)/i);
      const days = netMatch ? parseInt(netMatch[1]) : dayMatch ? parseInt(dayMatch[1]) : null;
      if (days && days > 90) {
        return { matched: true, details: `Payment terms of ${days} days exceed the standard maximum of Net 90. Typical terms are Net 30 or Net 60.` };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "perpetual-confidentiality",
    name: "Perpetual Confidentiality Obligation",
    category: "Confidentiality",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      const isConfidentiality = lower.includes("confidential");
      const isPerpetual = lower.includes("perpetual") || lower.includes("indefinite") || lower.includes("survive termination indefinitely") || lower.includes("in perpetuity");
      if (isConfidentiality && isPerpetual) {
        return { matched: true, details: "Confidentiality obligation is perpetual. Standard NDAs have a 2-5 year term after disclosure or termination." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "jury-trial-waiver",
    name: "Waiver of Jury Trial",
    category: "Dispute Resolution",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes("waive") && lower.includes("jury trial")) {
        return { matched: true, details: "Clause waives the right to a jury trial. While common in commercial contracts, this limits legal options and should be reviewed." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "one-sided-arbitration",
    name: "One-Sided Arbitration Venue",
    category: "Dispute Resolution",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasArbitration = lower.includes("arbitration");
      const hasExclusive = lower.includes("exclusive") || lower.includes("sole venue") || lower.includes("exclusively in");
      if (hasArbitration && hasExclusive) {
        return { matched: true, details: "Arbitration clause specifies an exclusive venue, which may favor one party. Consider whether the venue is reasonable for both parties." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "class-action-waiver",
    name: "Class Action Waiver",
    category: "Dispute Resolution",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes("waive") && (lower.includes("class action") || lower.includes("class-action") || lower.includes("collective action"))) {
        return { matched: true, details: "Clause waives the right to participate in class action lawsuits. This limits legal recourse for systemic issues." };
      }
      return { matched: false, details: "" };
    },
  },
  {
    id: "immediate-termination-convenience",
    name: "Immediate Termination for Convenience",
    category: "Termination",
    severity: "yellow",
    tier: "caution",
    detect: (text) => {
      const lower = text.toLowerCase();
      const hasConvenience = lower.includes("for convenience") || lower.includes("without cause");
      const hasImmediate = lower.includes("immediately") || lower.includes("effective immediately") || lower.includes("0 days");
      if (hasConvenience && hasImmediate) {
        return { matched: true, details: "Termination for convenience is effective immediately with no notice period. Standard contracts require 30-90 days notice." };
      }
      return { matched: false, details: "" };
    },
  },
];

export function checkAggressivePatterns(clauseText: string): RuleHit[] {
  const hits: RuleHit[] = [];

  for (const pattern of patterns) {
    const result = pattern.detect(clauseText);
    if (result.matched) {
      hits.push({
        ruleId: pattern.id,
        ruleName: pattern.name,
        severity: pattern.severity,
        tier: pattern.tier,
        details: result.details,
      });
    }
  }

  return hits;
}
