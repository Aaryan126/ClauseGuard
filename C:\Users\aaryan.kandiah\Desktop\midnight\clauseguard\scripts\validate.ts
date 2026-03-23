/**
 * Validation script — runs known contracts through the analysis pipeline
 * and reports how each clause is scored. Used to spot-check calibration.
 *
 * Usage: DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/validate.ts
 */

import { analyzeText } from "../src/lib/analyzer";
import { ContractType } from "../src/types";

// ── Test contracts ──

const COMMON_PAPER_NDA = `
1. Confidential Information. This Mutual Non-Disclosure Agreement allows each party ("Disclosing Party") to disclose or make available information in connection with the Purpose which (1) the Disclosing Party identifies to the receiving party ("Receiving Party") as "confidential", "proprietary", or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure ("Confidential Information"). Each party's Confidential Information also includes the existence and status of the parties' discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how.

2. Use and Protection. The Receiving Party shall: (a) use Confidential Information solely for the Purpose; (b) not disclose Confidential Information to third parties without the Disclosing Party's prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the Purpose, provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care.

3. Exceptions. The Receiving Party's obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information.

4. Required Disclosures. The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party's expense, with the Disclosing Party's efforts to obtain confidential treatment for the Confidential Information.

5. Term. This MNDA starts on the Effective Date and remains in effect during the Term of Confidentiality specified on the Cover Page. The Receiving Party's obligations relating to Confidential Information will survive for the Term of Confidentiality, despite any expiration or termination.

6. Return of Materials. Upon termination or expiration, the Receiving Party will cease use and, upon written request, destroy or return all Confidential Information, with confirmation of destruction if requested. Exception: retention permitted for legal compliance and standard backup procedures.

7. Proprietary Rights. Each party retains all intellectual property and other rights in its Confidential Information. Neither this MNDA nor any disclosure grants any license to the Receiving Party, except the limited right to use Confidential Information for the Purpose.

8. Disclaimer. ALL CONFIDENTIAL INFORMATION IS PROVIDED "AS IS." THE DISCLOSING PARTY MAKES NO WARRANTIES, EXPRESS, IMPLIED, OR OTHERWISE, REGARDING THE ACCURACY, COMPLETENESS OR PERFORMANCE OF ANY SUCH INFORMATION.

9. Governing Law. This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the applicable state, without regard to the conflict of laws provisions thereof.

10. Equitable Relief. The Receiving Party acknowledges that any breach may cause irreparable harm for which monetary damages alone would be insufficient. The Disclosing Party is entitled to seek equitable relief, including injunction and specific performance, in addition to other available remedies.

11. General. This MNDA constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties. This MNDA may only be amended by written agreement signed by both parties. Waivers must be signed by the waiving party and cannot be implied from conduct. If any provision is held invalid or unenforceable, the remainder will be interpreted to best effect the intent of the parties. Neither party may assign without prior written consent, except in connection with a merger, acquisition, or transfer of substantially all assets.
`;

const AGGRESSIVE_NDA = `
1. Confidential Information. ALL information disclosed by the Company to the Recipient, whether written, oral, electronic, or otherwise, regardless of whether marked as confidential, shall be deemed Confidential Information. This includes any and all information whatsoever that the Company shares, without limitation.

2. Non-Compete. The Recipient agrees to a non-compete for a period of five (5) years worldwide. During this period, Recipient shall not engage in any business that competes with the Company anywhere in the world.

3. Unlimited Liability. The Recipient acknowledges unlimited liability for any breach of this Agreement. There shall be no limit on liability for damages arising from any breach or alleged breach.

4. Unilateral Termination. The Company may terminate this Agreement at any time, for any reason, in its sole discretion, with immediate effect. The Recipient may not terminate this Agreement under any circumstances.

5. IP Assignment. The Recipient hereby assigns to the Company all intellectual property rights, including all pre-existing inventions, prior inventions, and all inventions conceived during or after the term of this Agreement, whether or not related to the Company's business.

6. Unilateral Amendment. The Company may modify, amend, or change any terms of this Agreement at any time, in its sole discretion, without notice to or consent from the Recipient.

7. Confidentiality Obligation. The Recipient shall not disclose any Confidential Information to any third party under any circumstances. This obligation shall remain in effect in perpetuity.

8. Payment Terms. All fees shall be paid within Net 120 days of invoice receipt.

9. Governing Law. This Agreement shall be governed by the laws of the State of Delaware.
`;

// ── Run validation ──

async function validate() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CLAUSEGUARD VALIDATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Test 1: Common Paper NDA (should be mostly/all green)
  console.log("TEST 1: Common Paper Mutual NDA v1.0 (our source document)");
  console.log("Expected: All clauses should score GREEN");
  console.log("─────────────────────────────────────────────────────────\n");

  try {
    const report1 = await analyzeText(COMMON_PAPER_NDA, "nda" as ContractType);
    printReport(report1);
  } catch (err) {
    console.error("TEST 1 FAILED:", err);
  }

  console.log("\n");

  // Test 2: Aggressive NDA (should catch multiple red flags)
  console.log("TEST 2: Deliberately aggressive NDA");
  console.log("Expected: Multiple RED and YELLOW flags");
  console.log("─────────────────────────────────────────────────────────\n");

  try {
    const report2 = await analyzeText(AGGRESSIVE_NDA, "nda" as ContractType);
    printReport(report2);
  } catch (err) {
    console.error("TEST 2 FAILED:", err);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  VALIDATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
}

function printReport(report: Awaited<ReturnType<typeof analyzeText>>) {
  const icon = { green: "✅", yellow: "⚠️ ", red: "❌" };

  for (const clause of report.clauses) {
    const sev = clause.severity;
    const match = clause.bestMatch
      ? `${(clause.bestMatch.similarity * 100).toFixed(0)}% → ${clause.bestMatch.standardClause.clauseName}`
      : "no match";
    const rules = clause.ruleHits.length > 0
      ? ` | Rules: ${clause.ruleHits.map(r => `${r.ruleName} (${r.tier})`).join(", ")}`
      : "";
    const flag = clause.flagSource ? ` | Flag: ${clause.flagSource}` : "";

    console.log(`  ${icon[sev]} ${sev.toUpperCase().padEnd(6)} │ ${clause.clause.title}${flag}`);
    console.log(`           │ Match: ${match}${rules}`);
  }

  console.log(`\n  Summary: ${report.summary.green} green, ${report.summary.yellow} yellow, ${report.summary.red} red (${report.totalClauses} clauses)`);
}

validate().catch(console.error);
