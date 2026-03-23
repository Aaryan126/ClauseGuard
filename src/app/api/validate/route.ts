import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/analyzer";
import { ContractType } from "@/types";

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

const BONTERMS_SAAS = `
1. Term and Renewal. Each Subscription Term will last for an initial twelve (12) month period unless the Order states otherwise. Each Subscription Term will renew for successive periods unless (a) the parties agree on a different renewal Order or (b) either party notifies the other of non-renewal at least thirty (30) days prior to the end of the then-current Subscription Term.

2. Termination for Cause. Either party may terminate this Agreement (including all related Orders) if the other party (a) fails to cure a material breach of this Agreement within 30 days after notice, (b) ceases operation without a successor or (c) seeks protection under a bankruptcy, receivership, trust deed, creditors' arrangement, composition or comparable proceeding, or if such a proceeding is instituted against that party and not dismissed within 60 days.

3. Limitation of Liability. Each party's entire liability arising out of or related to this Agreement will not exceed the General Cap. Neither party will have any liability arising out of or related to this Agreement for indirect, special, incidental, reliance or consequential damages or damages for loss of use, lost profits or interruption of business, even if informed of their possibility in advance. General Cap means amounts paid or payable by Customer to Provider in the 12 months immediately preceding the first incident giving rise to liability.

4. Payment Terms. Customer will pay the fees described in each Order. Unless the Order states otherwise, all amounts are due within 30 days after the invoice date. Late payments are subject to a charge of 1.5% per month or the maximum amount allowed by Law, whichever is less.

5. Intellectual Property and Reserved Rights. Neither party grants the other any rights or licenses not expressly set out in this Agreement. Customer retains all intellectual property rights in Customer Data and Customer Materials. Except for Customer's express rights in this Agreement, as between the parties, Provider and its licensors retain all intellectual property and other rights in the Cloud Service, Professional Services deliverables and related Provider technology.

6. Confidentiality. Each party will (a) use Confidential Information only to fulfill its obligations and exercise its rights under this Agreement, (b) not disclose Confidential Information to third parties without the discloser's prior approval, except as permitted in this Agreement and (c) protect Confidential Information using at least the same precautions recipient uses for its own similar information and no less than a reasonable standard of care.

7. Warranties and Disclaimers. Each party represents and warrants that it has the legal power and authority to enter into this Agreement. Provider warrants that the Cloud Service will perform materially as described in the Documentation. Except as expressly set out in this Agreement, each party disclaims all warranties, whether express, implied, statutory or otherwise, including warranties of merchantability, fitness for a particular purpose, title and noninfringement.

8. Assignment. Neither party may assign this Agreement without the prior consent of the other party, except that either party may assign this Agreement, with notice to the other party, in connection with the assigning party's merger, reorganization, acquisition or other transfer of all or substantially all of its assets or voting securities.

9. Waivers and Severability. Waivers must be signed by the waiving party's authorized representative and cannot be implied from conduct. If any provision of this Agreement is held invalid or unenforceable, it will be limited to the minimum extent necessary so that the remainder of this Agreement remains in effect.

10. Independent Contractors. The parties are independent contractors, not agents, partners or joint venturers.

11. Force Majeure. Neither party is liable for a delay or failure to perform this Agreement due to a Force Majeure. If a Force Majeure materially adversely affects the Cloud Service for 15 or more consecutive days, either party may terminate the affected Orders upon notice.
`;

const BONTERMS_PSA = `
1. Services. Provider will provide the Services in a timely manner and provide each Deliverable no later than the delivery dates specified in the SOW. Provider's ability to provide a Deliverable may be dependent upon Customer's provision of information or other Customer Materials to Provider.

2. Change Orders. Either Customer or Provider may request a change to Deliverables, Services or other elements of a SOW upon notice to the other party. Within 10 days of receipt of a Change Request, each party's Project Leads will meet to discuss the Change Request. Provider will then prepare a change order describing proposed changes to the SOW. Change Orders are not binding unless executed by both parties.

3. Performance Warranty. Provider represents and warrants that it will perform the Services in a timely, professional and workmanlike manner and with a degree of quality equal to or higher than applicable industry standards for similar services and all Services and each Deliverable will conform in all material respects with the Specifications. Provider will use reasonable efforts to correct a verified breach of the Performance Warranty. If Provider fails to do so within 30 days, then either party may terminate the SOW with a refund.

4. IP Rights — Licensed Deliverables. Provider hereby grants to Customer a non-exclusive, royalty-free, irrevocable, worldwide, transferable, perpetual right and license (with right to sublicense through multiple tiers) to make, have made, sell, use, import, export, execute, reproduce, distribute, modify, adapt, publicly display, publicly perform, prepare derivative works of, and disclose Licensed Deliverables.

5. Fees and Payment. Customer will pay the fees described in the SOW. Unless the SOW states otherwise, all amounts are due within 30 days after the invoice date. Late payments are subject to a charge of 1.5% per month or the maximum amount allowed by Law, whichever is less. Customer will have no obligation to pay any fees or expenses that Provider invoices more than 120 days after incurred.

6. Term and Termination. This Agreement starts on the Effective Date and continues until the end of all SOW Terms. Customer may terminate any SOW for any or no reason at any time upon 30 days' notice to Provider, provided that termination will not become effective until Customer has paid all fees incurred through termination. Either party may terminate if the other fails to cure a material breach within 30 days after notice.

7. Limitation of Liability. Each party's entire liability arising out of or related to this Agreement will not exceed the General Cap. Neither party will have any liability for indirect, special, incidental, reliance or consequential damages or damages for loss of use, lost profits or interruption of business. General Cap means amounts paid or payable by Customer to Provider in the 12 months immediately preceding the first incident.

8. Confidentiality. Each party will use Confidential Information only to fulfill its obligations and exercise its rights under this Agreement, not disclose Confidential Information to third parties without the discloser's prior approval, and protect Confidential Information using at least the same precautions recipient uses for its own similar information and no less than a reasonable standard of care.

9. Independent Contractor Status. The parties are independent contractors, not agents, partners or joint venturers. Neither party will make any commitment binding upon the other. Provider is solely responsible for any employment-related taxes, insurance premiums or other employment benefits.

10. Subcontractors. Provider may not subcontract any element of the Services without the prior approval of Customer. Provider will remain directly responsible for the acts and omissions of each Subcontractor and ensure each Subcontractor is bound to equally protective terms.
`;

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: Standard NDA
  try {
    const report1 = await analyzeText(COMMON_PAPER_NDA, "nda" as ContractType);
    results.standardNDA = {
      expected: "All GREEN",
      summary: report1.summary,
      totalClauses: report1.totalClauses,
      clauses: report1.clauses.map((c) => ({
        title: c.clause.title,
        severity: c.severity,
        flagSource: c.flagSource,
        similarity: c.bestMatch ? (c.bestMatch.similarity * 100).toFixed(1) + "%" : "no match",
        matchedTo: c.bestMatch?.standardClause.clauseName ?? "none",
        ruleHits: c.ruleHits.map((r) => `${r.ruleName} (${r.tier})`),
      })),
    };
  } catch (err) {
    results.standardNDA = { error: String(err) };
  }

  // Test 2: Aggressive NDA
  try {
    const report2 = await analyzeText(AGGRESSIVE_NDA, "nda" as ContractType);
    results.aggressiveNDA = {
      expected: "Multiple RED and YELLOW",
      summary: report2.summary,
      totalClauses: report2.totalClauses,
      clauses: report2.clauses.map((c) => ({
        title: c.clause.title,
        severity: c.severity,
        flagSource: c.flagSource,
        similarity: c.bestMatch ? (c.bestMatch.similarity * 100).toFixed(1) + "%" : "no match",
        matchedTo: c.bestMatch?.standardClause.clauseName ?? "none",
        ruleHits: c.ruleHits.map((r) => `${r.ruleName} (${r.tier})`),
      })),
    };
  } catch (err) {
    results.aggressiveNDA = { error: String(err) };
  }

  // Test 3: Standard SaaS
  try {
    const report3 = await analyzeText(BONTERMS_SAAS, "saas" as ContractType);
    results.standardSaaS = {
      expected: "All GREEN",
      summary: report3.summary,
      totalClauses: report3.totalClauses,
      clauses: report3.clauses.map((c) => ({
        title: c.clause.title,
        severity: c.severity,
        flagSource: c.flagSource,
        similarity: c.bestMatch ? (c.bestMatch.similarity * 100).toFixed(1) + "%" : "no match",
        matchedTo: c.bestMatch?.standardClause.clauseName ?? "none",
        ruleHits: c.ruleHits.map((r) => `${r.ruleName} (${r.tier})`),
      })),
    };
  } catch (err) {
    results.standardSaaS = { error: String(err) };
  }

  // Test 4: Standard Consulting/PSA
  try {
    const report4 = await analyzeText(BONTERMS_PSA, "consulting" as ContractType);
    results.standardConsulting = {
      expected: "All GREEN",
      summary: report4.summary,
      totalClauses: report4.totalClauses,
      clauses: report4.clauses.map((c) => ({
        title: c.clause.title,
        severity: c.severity,
        flagSource: c.flagSource,
        similarity: c.bestMatch ? (c.bestMatch.similarity * 100).toFixed(1) + "%" : "no match",
        matchedTo: c.bestMatch?.standardClause.clauseName ?? "none",
        ruleHits: c.ruleHits.map((r) => `${r.ruleName} (${r.tier})`),
      })),
    };
  } catch (err) {
    results.standardConsulting = { error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
