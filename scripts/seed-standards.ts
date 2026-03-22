import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { StandardClause } from "../src/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Standard Clause Templates ───────────────────────────────────────────────
// Sourced from authoritative, lawyer-drafted, open-source contract standards:
//   - Common Paper Mutual NDA v1.0 (CC BY 4.0) — 40+ attorney committee
//   - Bonterms Cloud Terms v1.0 (CC BY 4.0) — 120+ lawyer committee
//   - Manual entries clearly marked, modeled on established legal practice
//
// See: https://commonpaper.com/standards/mutual-nda/
//      https://github.com/Bonterms/Cloud-Terms

type RawStandard = Omit<StandardClause, "embedding">;

const rawStandards: RawStandard[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NDA CLAUSES — Source: Common Paper Mutual NDA v1.0
  // https://github.com/CommonPaper/Mutual-NDA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "nda-definition-001",
    contractType: "nda",
    category: "Definitions",
    clauseName: "Definition of Confidential Information",
    standardText:
      'This Mutual Non-Disclosure Agreement allows each party ("Disclosing Party") to disclose or make available information in connection with the Purpose which (1) the Disclosing Party identifies to the receiving party ("Receiving Party") as "confidential", "proprietary", or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure ("Confidential Information"). Each party\'s Confidential Information also includes the existence and status of the parties\' discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how.',
    summary:
      "Defines confidential information as anything marked confidential or reasonably understood to be confidential. Includes technical info, business plans, pricing, and the existence of discussions.",
    aggressiveIndicators: ["all information", "any information whatsoever", "without limitation"],
    normalRange: { description: "Should cover non-public info with a reasonableness test and specific examples. Overly broad definitions that cover 'all information' are aggressive." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §1",
    role: "anchor",
  },
  {
    id: "nda-obligations-001",
    contractType: "nda",
    category: "Obligations",
    clauseName: "Use and Protection of Confidential Information",
    standardText:
      "The Receiving Party shall: (a) use Confidential Information solely for the Purpose; (b) not disclose Confidential Information to third parties without the Disclosing Party's prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the Purpose, provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care.",
    summary:
      "Receiving party must use info only for the stated purpose, limit disclosure to need-to-know personnel bound by confidentiality, and protect it with at least reasonable care.",
    aggressiveIndicators: ["absolute secrecy", "guarantee", "strictly liable", "no disclosure under any circumstances"],
    normalRange: { description: "Reasonable care standard with need-to-know exceptions for employees and advisors is standard. Absolute secrecy requirements or strict liability are aggressive." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §2",
    role: "anchor",
  },
  {
    id: "nda-exclusions-001",
    contractType: "nda",
    category: "Exclusions",
    clauseName: "Exceptions to Confidentiality",
    standardText:
      "The Receiving Party's obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information.",
    summary:
      "Four standard exceptions: public information, prior knowledge, third-party receipt, and independent development. All require the receiving party to demonstrate the exception applies.",
    aggressiveIndicators: [],
    normalRange: { description: "All four standard exclusions should be present. Missing exclusions significantly tilt the agreement against the receiving party." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §3",
    role: "anchor",
  },
  {
    id: "nda-compelled-disclosure-001",
    contractType: "nda",
    category: "Required Disclosures",
    clauseName: "Disclosures Required by Law",
    standardText:
      "The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party's expense, with the Disclosing Party's efforts to obtain confidential treatment for the Confidential Information.",
    summary:
      "Allows disclosure when legally compelled (court orders, subpoenas, regulations), with advance notice and cooperation to seek protective treatment.",
    aggressiveIndicators: [],
    normalRange: { description: "Must allow legally compelled disclosure. Should include notice requirement and cooperation provisions. Absence of this carve-out is a major red flag." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §4",
    role: "anchor",
  },
  {
    id: "nda-term-001",
    contractType: "nda",
    category: "Term",
    clauseName: "Term and Termination",
    standardText:
      "This MNDA commences on the Effective Date and expires at the end of the MNDA Term. Either party may terminate this MNDA for any or no reason upon written notice to the other party. The Receiving Party's obligations relating to Confidential Information will survive for the Term of Confidentiality, despite any expiration or termination of this MNDA.",
    summary:
      "Either party can terminate the NDA at any time with written notice. Confidentiality obligations survive termination for the specified survival period.",
    aggressiveIndicators: ["perpetual", "indefinite", "in perpetuity", "forever", "irrevocable"],
    normalRange: { description: "Term of 1-3 years with a confidentiality survival period of 2-5 years is standard. Perpetual or indefinite obligations are unusual." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §5",
    role: "anchor",
  },
  {
    id: "nda-return-001",
    contractType: "nda",
    category: "Return of Information",
    clauseName: "Return or Destruction of Confidential Information",
    standardText:
      "Upon expiration or termination of this MNDA or upon the Disclosing Party's earlier request, the Receiving Party will: (a) cease using Confidential Information; (b) promptly after the Disclosing Party's written request, destroy all Confidential Information in the Receiving Party's possession or control or return it to the Disclosing Party; and (c) if requested by the Disclosing Party, confirm its compliance with these obligations in writing. As an exception to subsection (b), the Receiving Party may retain Confidential Information in accordance with its standard backup or record retention policies or as required by law, but the terms of this MNDA will continue to apply to the retained Confidential Information.",
    summary:
      "After termination, cease use and return or destroy confidential materials upon request, with written confirmation. Standard exception for legal retention and routine backups.",
    aggressiveIndicators: ["immediately destroy all", "no retention", "no copies whatsoever", "no backups"],
    normalRange: { description: "Return or destroy with written confirmation. Should allow retention for legal compliance and standard backup procedures." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §6",
    role: "anchor",
  },
  {
    id: "nda-remedies-001",
    contractType: "nda",
    category: "Remedies",
    clauseName: "Equitable Relief",
    standardText:
      "A breach of this MNDA may cause irreparable harm for which monetary damages are an insufficient remedy. Upon a breach of this MNDA, the Disclosing Party is entitled to seek appropriate equitable relief, including an injunction, in addition to its other remedies.",
    summary:
      "Allows the disclosing party to seek injunctive relief (court orders to stop the breach) in addition to monetary damages, without needing to prove damages first.",
    aggressiveIndicators: ["liquidated damages", "penalty", "forfeiture", "automatic termination fee"],
    normalRange: { description: "Equitable relief (injunctions) without requiring proof of damages is standard. Liquidated damages or financial penalties are unusual in NDAs." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §10",
    role: "anchor",
  },
  {
    id: "nda-nonsolicitation-001",
    contractType: "nda",
    category: "Non-Solicitation",
    clauseName: "Non-Solicitation of Employees",
    standardText:
      "During the term of this Agreement and for a period of twelve (12) months following its expiration or termination, neither Party shall directly solicit for employment any employee of the other Party with whom it had contact in connection with the Purpose, without the prior written consent of the other Party. This restriction shall not apply to general solicitations of employment not specifically directed at employees of the other Party, including public job postings.",
    summary:
      "Mutual non-solicitation of employees for 12 months, limited to employees with direct contact. General job postings are allowed.",
    aggressiveIndicators: ["all employees", "any personnel", "24 months", "36 months", "worldwide"],
    normalRange: { description: "6-12 months, mutual, limited to employees with direct contact. Should exclude general job postings. Broader restrictions are unusual." },
    source: "manual",
    sourceRef: "Based on standard NDA non-solicitation practice",
    role: "anchor",
  },
  {
    id: "nda-governing-law-001",
    contractType: "nda",
    category: "Governing Law",
    clauseName: "Governing Law and Jurisdiction",
    standardText:
      "This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the applicable state, without regard to the conflict of laws provisions thereof. Any legal suit, action, or proceeding relating to this MNDA must be instituted in the federal or state courts located in the agreed-upon jurisdiction. Each party irrevocably submits to the exclusive jurisdiction of such courts in any such suit, action, or proceeding.",
    summary:
      "Specifies which state's laws apply and which courts have exclusive jurisdiction over disputes.",
    aggressiveIndicators: [],
    normalRange: { description: "Should specify a reasonable jurisdiction convenient for both parties. Watch for distant or inconvenient venues that favor one party." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §9",
    role: "anchor",
  },
  {
    id: "nda-amendment-001",
    contractType: "nda",
    category: "Amendment",
    clauseName: "Amendment, Waiver, and Entire Agreement",
    standardText:
      "This MNDA constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, regarding such subject matter. This MNDA may only be amended, modified, waived, or supplemented by an agreement in writing signed by both parties. Waivers must be signed by the waiving party's authorized representative and cannot be implied from conduct. Neither party may assign this MNDA without the prior written consent of the other party, except that either party may assign this MNDA in connection with a merger, reorganization, acquisition or other transfer of all or substantially all its assets or voting securities.",
    summary:
      "This is the complete agreement; changes require mutual written consent. Waivers must be explicit. Assignment allowed for mergers/acquisitions without consent.",
    aggressiveIndicators: ["sole discretion", "unilaterally", "at any time without notice", "by posting on website"],
    normalRange: { description: "Mutual written consent required for amendments. Unilateral amendment rights are a major red flag. Assignment carve-out for M&A is standard." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §11",
    role: "anchor",
  },
  {
    id: "nda-proprietary-rights-001",
    contractType: "nda",
    category: "IP Rights",
    clauseName: "Proprietary Rights and No License",
    standardText:
      "Each party retains all of its intellectual property and other rights in its Confidential Information. Neither this MNDA nor any disclosure of Confidential Information grants the Receiving Party any rights or licenses to the Disclosing Party's Confidential Information, except the limited right to review and use the Confidential Information solely for the Purpose.",
    summary:
      "Disclosing party keeps all IP rights. Sharing info under the NDA does not transfer or license any intellectual property.",
    aggressiveIndicators: ["grants an irrevocable license", "assigns all rights", "work made for hire"],
    normalRange: { description: "Standard clause preserves IP ownership. Should not grant licenses beyond the NDA purpose. Any IP assignment or license grant language is unusual in an NDA." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §7",
    role: "anchor",
  },
  {
    id: "nda-disclaimer-001",
    contractType: "nda",
    category: "Disclaimer",
    clauseName: "Disclaimer of Warranties",
    standardText:
      'ALL CONFIDENTIAL INFORMATION IS PROVIDED "AS IS." THE DISCLOSING PARTY MAKES NO WARRANTIES, EXPRESS, IMPLIED, OR OTHERWISE, REGARDING THE ACCURACY, COMPLETENESS OR PERFORMANCE OF ANY SUCH INFORMATION.',
    summary:
      "Confidential information is shared as-is with no guarantees about its accuracy or completeness.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard disclaimer. Both parties should disclaim warranties on shared information. Absence of this clause is not aggressive but is unusual." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §8",
    role: "anchor",
  },
  {
    id: "nda-severability-001",
    contractType: "nda",
    category: "Severability",
    clauseName: "Severability",
    standardText:
      "If a court of competent jurisdiction finds any provision of this MNDA invalid or unenforceable, the remainder of this MNDA will be interpreted so as best to effect the intent of the parties. The parties agree to replace any invalid provision with a valid provision that most closely approximates the intent and economic effect of the invalid provision.",
    summary:
      "If one clause is struck down, the rest of the agreement survives. Invalid provisions are replaced with the closest valid alternative.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard boilerplate. Should preserve the rest of the agreement if one clause fails. Most contracts include this." },
    source: "common-paper",
    sourceRef: "Common Paper Mutual NDA v1.0 §11",
    role: "anchor",
  },
  {
    id: "nda-notices-001",
    contractType: "nda",
    category: "Notices",
    clauseName: "Notices",
    standardText:
      "All notices, requests and approvals under this MNDA must be in writing and delivered to the addresses specified by the parties, and will be deemed given: (1) upon receipt if by personal delivery, (2) upon receipt if by certified or registered mail (return receipt requested), or (3) one day after dispatch if by commercial overnight delivery service.",
    summary:
      "Legal notices must be in writing and delivered by mail, courier, or in person. Specifies when notice is considered received.",
    aggressiveIndicators: ["by posting on website", "at any time without notice"],
    normalRange: { description: "Standard notice provision. Should require written notice with a clear delivery mechanism. Notice 'by posting on a website' is aggressive." },
    source: "manual",
    sourceRef: "Standard NDA practice",
    role: "anchor",
  },
  {
    id: "nda-counterparts-001",
    contractType: "nda",
    category: "Execution",
    clauseName: "Counterparts and Electronic Signatures",
    standardText:
      "This MNDA may be executed in counterparts, each of which is deemed an original, but all of which together are considered one agreement. Execution may occur by electronic signature, which will be deemed an original signature for all purposes.",
    summary:
      "The agreement can be signed in separate copies and electronically. Each copy is treated as an original.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard boilerplate allowing flexible execution. Nearly universal in modern contracts." },
    source: "manual",
    sourceRef: "Standard NDA practice",
    role: "anchor",
  },
  {
    id: "nda-relationship-001",
    contractType: "nda",
    category: "Relationship",
    clauseName: "Relationship of the Parties",
    standardText:
      "This MNDA does not create a partnership, agency, joint venture, or employment relationship between the parties. Neither party has the authority to bind the other or incur obligations on the other's behalf without prior written consent.",
    summary:
      "The NDA does not make the parties partners, agents, or employers of each other. Neither can act on behalf of the other.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard clause clarifying no agency or partnership is created. Nearly universal in commercial contracts." },
    source: "manual",
    sourceRef: "Standard NDA practice",
    role: "anchor",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAAS AGREEMENT CLAUSES — Source: Bonterms Cloud Terms v1.0
  // https://github.com/Bonterms/Cloud-Terms
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "saas-term-001",
    contractType: "saas",
    category: "Term",
    clauseName: "Term and Renewal",
    standardText:
      "Each Subscription Term will last for an initial twelve (12) month period unless the Order states otherwise. Each Subscription Term will renew for successive periods unless (a) the parties agree on a different renewal Order or (b) either party notifies the other of non-renewal at least thirty (30) days prior to the end of the then-current Subscription Term.",
    summary:
      "12-month initial term with automatic renewal. Either party can opt out with 30 days notice before the term ends.",
    aggressiveIndicators: ["irrevocable", "non-cancellable", "minimum commitment of 3 years", "no termination"],
    normalRange: { description: "1-year terms with 30-90 day notice for non-renewal are standard. Multi-year lock-ins without opt-out are aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §14.1",
    role: "anchor",
  },
  {
    id: "saas-termination-convenience-001",
    contractType: "saas",
    category: "Termination",
    clauseName: "Termination for Convenience",
    standardText:
      "This Agreement starts on the Effective Date and continues until the end of all Subscription Terms, unless sooner terminated in accordance with its terms. If no Subscription Term is in effect, either party may terminate this Agreement for any or no reason with notice to the other party. Either party may terminate by providing written notice of non-renewal at least thirty (30) days prior to the end of the current Subscription Term.",
    summary:
      "Agreement runs until all subscriptions end. Either party can decline to renew with 30 days notice. Full termination for convenience available when no active subscription exists.",
    aggressiveIndicators: ["no refund", "non-refundable", "sole discretion", "immediately without notice"],
    normalRange: { description: "30-90 day notice for non-renewal is standard. Mid-term cancellation may or may not include pro-rata refunds depending on the agreement." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §14.1-14.2",
    role: "anchor",
  },
  {
    id: "saas-termination-cause-001",
    contractType: "saas",
    category: "Termination",
    clauseName: "Termination for Cause",
    standardText:
      "Either party may terminate this Agreement (including all Subscription Terms) if the other party (a) fails to cure a material breach of this Agreement within 30 days after notice, (b) ceases operation without a successor or (c) seeks protection under a bankruptcy, receivership, trust deed, creditors' arrangement, composition or comparable proceeding, or if such a proceeding is instituted against that party and not dismissed within 60 days.",
    summary:
      "Either party can terminate for material breach (with 30-day cure period), cessation of operations, or bankruptcy proceedings not dismissed within 60 days.",
    aggressiveIndicators: ["immediately without cure", "sole determination", "any breach", "minor breach"],
    normalRange: { description: "30-day cure period for material breach is standard. Immediate termination only for bankruptcy/insolvency. Termination for 'any breach' without cure is aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §14.3",
    role: "anchor",
  },
  {
    id: "saas-liability-001",
    contractType: "saas",
    category: "Liability",
    clauseName: "Limitation of Liability",
    standardText:
      "Each party's entire liability arising out of or related to this Agreement will not exceed amounts paid or payable by Customer to Provider under this Agreement in the 12 months immediately preceding the first incident giving rise to liability (the \"General Cap\"). Neither party will have any liability arising out of or related to this Agreement for indirect, special, incidental, reliance or consequential damages or damages for loss of use, lost profits or interruption of business, even if informed of their possibility in advance. The waivers and limitations in this section apply regardless of the form of action, whether in contract, tort (including negligence), strict liability or otherwise and will survive and apply even if any limited remedy in this Agreement fails of its essential purpose.",
    summary:
      "Liability capped at 12 months of fees paid. No liability for indirect, consequential, or lost-profit damages. Applies regardless of legal theory.",
    aggressiveIndicators: ["unlimited liability", "no limit", "10x", "without limitation as to amount"],
    normalRange: { description: "Liability cap of 12 months of fees (1x annual contract value) is standard. Some agreements use enhanced caps (2-3x) for specific claims like data breaches." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §16.1-16.2, §16.4",
    role: "anchor",
  },
  {
    id: "saas-indemnification-001",
    contractType: "saas",
    category: "Indemnification",
    clauseName: "Mutual Indemnification",
    standardText:
      "Provider, at its own cost, will defend Customer from and against any third-party claim that the Cloud Service, when used by Customer as authorized in this Agreement, infringes or misappropriates a third party's intellectual property rights, and will indemnify and hold harmless Customer from and against any damages or costs awarded against Customer (including reasonable attorneys' fees) or agreed in settlement by Provider. Customer, at its own cost, will defend Provider from and against any third-party claim arising from Customer's breach of usage rules or submission of unauthorized content, and will indemnify and hold harmless Provider from resulting damages or costs. The indemnifying party's obligations are subject to receiving from the indemnified party: (a) prompt notice of the claim, (b) the exclusive right to control the claim's investigation, defense and settlement and (c) reasonable cooperation at the indemnifying party's expense.",
    summary:
      "Provider covers IP infringement claims; Customer covers misuse claims. Standard procedure: prompt notice, exclusive control of defense, and cooperation.",
    aggressiveIndicators: ["sole expense", "all costs", "unlimited indemnification", "any claim whatsoever"],
    normalRange: { description: "Mutual indemnification is standard. Provider should cover IP infringement. Indemnification procedures (notice, control, cooperation) should be specified." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §17.1-17.4",
    role: "anchor",
  },
  {
    id: "saas-data-protection-001",
    contractType: "saas",
    category: "Data Protection",
    clauseName: "Data Protection and Security",
    standardText:
      "Provider will access and use Customer Data solely to provide and maintain the Cloud Service, Support and Professional Services under this Agreement. Provider will not otherwise disclose Customer Data to third parties except as this Agreement permits. Provider will implement and maintain appropriate technical and organizational security measures preventing unauthorized access, use, alteration or disclosure of Customer Data. The parties will adhere to the Data Protection Addendum (DPA), if any, identified on the Cover Page.",
    summary:
      "Provider can only use customer data to deliver the service. Must maintain appropriate security measures. Data processing governed by DPA if applicable.",
    aggressiveIndicators: ["no liability for data loss", "as-is", "no security guarantees", "may share with third parties"],
    normalRange: { description: "Purpose limitation on data use, appropriate security measures, and DPA for personal data are all standard requirements." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §5.1-5.3",
    role: "anchor",
  },
  {
    id: "saas-sla-001",
    contractType: "saas",
    category: "SLA",
    clauseName: "Service Level Agreement",
    standardText:
      "Provider will adhere to the Service Level Agreement (SLA) identified on the Cover Page. If no SLA is identified, Provider will use commercially reasonable efforts to make the Cloud Service available for Customer's use 99.9% of the time in each month. Provider will provide Support for the Cloud Service consistent with industry standards and its general business practices.",
    summary:
      "99.9% monthly uptime target with commercially reasonable efforts. Support provided per industry standards or specified support policy.",
    aggressiveIndicators: ["best efforts", "no guarantee", "no service credits", "no uptime commitment", "as available"],
    normalRange: { description: "99.5-99.99% uptime commitment with service credits for downtime is standard. 'Best efforts' or 'as available' without concrete targets are weak." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §7.1-7.2",
    role: "anchor",
  },
  {
    id: "saas-payment-001",
    contractType: "saas",
    category: "Payment",
    clauseName: "Payment Terms",
    standardText:
      "Customer will pay the fees described in the Order. Unless the Order states otherwise, all amounts are due within thirty (30) days after the invoice date. Late payments are subject to a charge of 1.5% per month or the maximum amount allowed by law, whichever is less. All fees and expenses are non-refundable except as expressly set out in this Agreement. Customer is responsible for any sales, use, GST, value-added, withholding or similar taxes or levies that apply to its Orders, other than Provider's income tax.",
    summary:
      "Net 30 payment terms. Late payments accrue 1.5% monthly interest. Customer responsible for applicable taxes (excluding provider's income tax).",
    aggressiveIndicators: ["due immediately", "net 120", "5% per month", "accelerated payment", "pay all future fees"],
    normalRange: { description: "Net 30 to Net 60 is standard. Late interest of 1-1.5% per month is typical. Customer tax responsibility (excluding provider income tax) is standard." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §12.1-12.2",
    role: "anchor",
  },
  {
    id: "saas-ip-001",
    contractType: "saas",
    category: "IP Ownership",
    clauseName: "Intellectual Property and Reserved Rights",
    standardText:
      "Neither party grants the other any rights or licenses not expressly set out in this Agreement. Except for Provider's express rights in this Agreement, as between the parties, Customer retains all intellectual property and other rights in Customer Data and Customer Materials provided to Provider. Except for Customer's express rights in this Agreement, as between the parties, Provider and its licensors retain all intellectual property and other rights in the Cloud Service, Professional Services deliverables and related Provider technology. If Customer gives Provider feedback regarding improvement or operation of the Cloud Service, Provider may use the feedback without restriction or obligation.",
    summary:
      "Clear IP separation: Customer owns their data, Provider owns the service and technology. Provider gets unrestricted rights to use customer feedback.",
    aggressiveIndicators: ["all data becomes property of", "exclusive license to customer data", "perpetual license to customer data", "provider owns customer data"],
    normalRange: { description: "Clear separation: provider owns service, customer owns data. Feedback assignment to provider is standard. Any claim to customer data ownership is aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §15.1-15.2",
    role: "anchor",
  },
  {
    id: "saas-confidentiality-001",
    contractType: "saas",
    category: "Confidentiality",
    clauseName: "Confidentiality",
    standardText:
      "As recipient, each party will (a) use Confidential Information only to fulfill its obligations and exercise its rights under this Agreement, (b) not disclose Confidential Information to third parties without the discloser's prior approval, except as permitted in this Agreement and (c) protect Confidential Information using at least the same precautions recipient uses for its own similar information and no less than a reasonable standard of care. The recipient may disclose Confidential Information to its employees, agents, contractors and other representatives having a legitimate need to know, provided it remains responsible for their compliance and they are bound to confidentiality obligations no less protective than this section. These confidentiality obligations do not apply to information that the recipient can document (a) is or becomes public knowledge through no fault of the recipient, (b) it rightfully knew or possessed prior to receipt, (c) it rightfully received from a third party without restrictions or (d) it independently developed without using Confidential Information.",
    summary:
      "Mutual confidentiality with reasonable care standard. Disclosure limited to need-to-know personnel. Standard four exceptions apply (public info, prior knowledge, third-party receipt, independent development).",
    aggressiveIndicators: ["perpetual", "indefinite", "absolute secrecy", "no exceptions"],
    normalRange: { description: "Mutual, reasonable care standard, need-to-know disclosure, all four standard exceptions. Survival period of 2-5 years after termination is typical." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §18.1-18.3",
    role: "anchor",
  },
  {
    id: "saas-warranty-001",
    contractType: "saas",
    category: "Warranty",
    clauseName: "Warranties and Disclaimers",
    standardText:
      "Each party represents and warrants that: (a) it has the legal power and authority to enter into this Agreement, and (b) it will use industry-standard measures to avoid introducing Viruses into the Cloud Service. Provider warrants that the Cloud Service will perform materially in accordance with the Documentation and Provider will not materially decrease the overall functionality of the Cloud Service during a Subscription Term. Except as expressly set out in this Agreement, each party disclaims all warranties, whether express, implied, statutory or otherwise, including warranties of merchantability, fitness for a particular purpose, title and noninfringement. These disclaimers apply to the full extent permitted by law.",
    summary:
      "Provider warrants the service works as documented and won't reduce functionality mid-term. Standard disclaimer of all implied warranties (merchantability, fitness, etc.).",
    aggressiveIndicators: ["no warranty whatsoever", "entire risk", "use at your own risk", "no documentation warranty"],
    normalRange: { description: "Material conformance with documentation is the standard warranty. Disclaimer of implied warranties is universal in SaaS. Complete absence of ANY warranty is aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §8.1-8.2, §8.4",
    role: "anchor",
  },
  {
    id: "saas-force-majeure-001",
    contractType: "saas",
    category: "Force Majeure",
    clauseName: "Force Majeure",
    standardText:
      "Neither party is liable for a delay or failure to perform this Agreement due to a Force Majeure. \"Force Majeure\" means an unforeseen event beyond a party's reasonable control, such as a strike, blockade, war, pandemic, act of terrorism, riot, third-party Internet or utility failure, refusal of government license or natural disaster, where the affected party takes reasonable and customary measures to avoid or mitigate such event's effects. If a Force Majeure materially adversely affects the Cloud Service for 15 or more consecutive days, either party may terminate the affected Orders upon notice to the other and Provider will refund to Customer any pre-paid, unused fees for the terminated portion of the Subscription Term.",
    summary:
      "Neither party liable for failures due to events beyond their control (war, pandemic, natural disasters, etc.). If force majeure lasts 15+ days, either party can terminate with a pro-rata refund.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard force majeure with defined events, mitigation duty, and termination right for prolonged events. Refund of prepaid fees for terminated period is fair." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.9",
    role: "anchor",
  },
  {
    id: "saas-assignment-001",
    contractType: "saas",
    category: "Assignment",
    clauseName: "Assignment",
    standardText:
      "Neither party may assign this Agreement without the prior consent of the other party, except that either party may assign this Agreement, with notice to the other party, in connection with the assigning party's merger, reorganization, acquisition or other transfer of all or substantially all of its assets or voting securities. Any non-permitted assignment is void. This Agreement will bind and inure to the benefit of each party's permitted successors and assigns.",
    summary:
      "Assignment requires consent, except for mergers, acquisitions, or asset transfers. Unauthorized assignments are void.",
    aggressiveIndicators: ["freely assign", "without consent", "sole discretion to assign", "assign to any affiliate"],
    normalRange: { description: "Mutual consent with carve-out for M&A is standard. Unilateral assignment rights (especially by the provider) are aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.1",
    role: "anchor",
  },
  {
    id: "saas-governing-law-001",
    contractType: "saas",
    category: "Governing Law",
    clauseName: "Governing Law and Courts",
    standardText:
      "The designated governing law governs this Agreement and any action arising out of or relating to this Agreement, without reference to conflict of law rules. The parties will adjudicate any such action in the designated courts and each party consents to the exclusive jurisdiction and venue of such courts for these purposes.",
    summary:
      "Specifies governing law and exclusive court jurisdiction for disputes. Conflict of law rules excluded.",
    aggressiveIndicators: [],
    normalRange: { description: "Should specify a reasonable jurisdiction agreeable to both parties. Watch for distant or inconvenient venues that heavily favor one party." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.2",
    role: "anchor",
  },
  {
    id: "saas-amendment-001",
    contractType: "saas",
    category: "Amendment",
    clauseName: "Amendments",
    standardText:
      "Any amendments to this Agreement must be in writing and signed by each party's authorized representatives. This Agreement is the parties' entire agreement regarding its subject matter and supersedes any prior or contemporaneous agreements regarding its subject matter. Terms in business forms, purchase orders or quotes used by either party will not amend or modify this Agreement; any such documents are for administrative purposes only. Waivers must be signed by the waiving party's authorized representative and cannot be implied from conduct.",
    summary:
      "Changes require written agreement signed by both parties. Purchase orders and business forms cannot modify the agreement. Waivers must be explicit and in writing.",
    aggressiveIndicators: ["unilaterally modify", "sole discretion", "change at any time", "by posting on website", "deemed accepted"],
    normalRange: { description: "Mutual written consent is the standard for amendments. Unilateral modification rights (especially 'by posting on website') are aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.4, §22.6, §22.8",
    role: "anchor",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW SAAS CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "saas-suspension-001",
    contractType: "saas",
    category: "Suspension",
    clauseName: "Suspension of Service",
    standardText:
      "Provider may suspend Customer's access to the Cloud Service and related services due to a Suspension Event, but where practicable will give Customer prior notice so that Customer may seek to resolve the issue and avoid suspension. Provider is not required to give prior notice in exigent circumstances or for a suspension made to avoid material harm or violation of law. Once the Suspension Event is resolved, Provider will promptly restore Customer's access to the Cloud Service in accordance with this Agreement. \"Suspension Event\" means (a) Customer's account is 30 days or more overdue, (b) Customer is in breach of Usage Rules or (c) Customer's use of the Cloud Service risks material harm to the Cloud Service or others.",
    summary:
      "Provider can suspend access for overdue payment (30+ days), usage violations, or risk of harm. Must give prior notice when practicable and promptly restore access once resolved.",
    aggressiveIndicators: ["suspend at any time", "sole discretion to suspend", "without notice", "no obligation to restore", "suspend for any reason"],
    normalRange: { description: "Suspension for defined events (overdue payment, usage violations, harm) with notice is standard. Broad 'suspend at any time for any reason' clauses are aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §13",
    role: "anchor",
  },
  {
    id: "saas-data-export-001",
    contractType: "saas",
    category: "Data Export",
    clauseName: "Data Export and Deletion",
    standardText:
      "During a Subscription Term, Customer may export Customer Data from the Cloud Service as described in the Documentation. After termination or expiration of this Agreement, within 60 days of request, Provider will delete Customer Data and each party will delete any Confidential Information of the other in its possession or control. Nonetheless, the recipient may retain Customer Data or Confidential Information in accordance with its standard backup or record retention policies or as required by law, subject to the Security and Confidentiality provisions of this Agreement.",
    summary:
      "Customer can export their data during the subscription. After termination, provider deletes customer data within 60 days of request. Retention allowed for legal compliance and standard backups.",
    aggressiveIndicators: ["no export", "no data portability", "data deleted immediately", "no transition period", "provider retains all data"],
    normalRange: { description: "Data export during term and deletion within 30-90 days post-termination is standard. Retention exceptions for legal compliance and backups are normal." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §14.4",
    role: "anchor",
  },
  {
    id: "saas-usage-restrictions-001",
    contractType: "saas",
    category: "Usage Restrictions",
    clauseName: "Usage Restrictions",
    standardText:
      "Customer will not and will not permit anyone else to: (a) sell, sublicense, distribute or rent the Cloud Service (in whole or part), grant non-Users access to the Cloud Service or use the Cloud Service to provide a hosted or managed service to others, (b) reverse engineer, decompile or seek to access the source code of the Cloud Service, except to the extent these restrictions are prohibited by applicable laws and then only upon advance notice to Provider, (c) copy, modify, create derivative works of or remove proprietary notices from the Cloud Service, (d) conduct security or vulnerability tests of the Cloud Service, interfere with its operation or circumvent its access restrictions or (e) use the Cloud Service to develop a product that competes with the Cloud Service. Customer represents and warrants that it has all rights necessary to use Customer Data with the Cloud Service without violating third-party intellectual property, privacy or other rights.",
    summary:
      "Standard restrictions: no reselling, no reverse engineering (except where law prohibits restriction), no copying/modifying, no security testing without permission, no competitive use.",
    aggressiveIndicators: ["no benchmarking", "no public comments", "no comparison", "no criticism"],
    normalRange: { description: "Restrictions on resale, reverse engineering, and competitive use are standard. Restrictions on benchmarking, public commentary, or criticism are aggressive and potentially anti-competitive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §9",
    role: "anchor",
  },
  {
    id: "saas-compliance-001",
    contractType: "saas",
    category: "Compliance",
    clauseName: "Mutual Compliance with Laws",
    standardText:
      "Each party will comply with all Laws that apply to its performance under this Agreement.",
    summary:
      "Both parties must follow all applicable laws in performing under the agreement.",
    aggressiveIndicators: ["customer shall indemnify for all regulatory fines", "regardless of fault"],
    normalRange: { description: "Standard mutual compliance obligation. Should be mutual, not one-sided. One-sided compliance indemnities are aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §6",
    role: "anchor",
  },
  {
    id: "saas-users-001",
    contractType: "saas",
    category: "Users",
    clauseName: "User Accounts and Responsibility",
    standardText:
      "Customer is responsible for provisioning and managing its User accounts, for its Users' actions through the Cloud Service and for their compliance with this Agreement. Customer will require that its Users keep their login credentials confidential and will promptly notify Provider if Customer becomes aware of any compromise of its User login credentials.",
    summary:
      "Customer manages user accounts and is responsible for user actions. Users must keep credentials confidential.",
    aggressiveIndicators: ["provider may access user accounts", "provider may change credentials"],
    normalRange: { description: "Standard user management responsibility clause. Customer should control its own accounts. Provider access to user accounts without consent is unusual." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §3",
    role: "anchor",
  },
  {
    id: "saas-third-party-001",
    contractType: "saas",
    category: "Third-Party",
    clauseName: "Third-Party Platforms",
    standardText:
      "Customer may choose to enable integrations with or exchange Customer Data with Third-Party Platforms. Customer's use of a Third-Party Platform is governed by its agreement with the relevant provider, not this Agreement, and Provider is not responsible for Third-Party Platforms or how their providers use Customer Data.",
    summary:
      "Third-party integrations are the customer's responsibility. The provider is not liable for third-party platforms.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard disclaimer of responsibility for third-party integrations. Provider should not be liable for platforms it doesn't control." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §10",
    role: "anchor",
  },
  {
    id: "saas-publicity-001",
    contractType: "saas",
    category: "Publicity",
    clauseName: "Publicity",
    standardText:
      "Neither party may publicly announce this Agreement without the other party's prior approval or except as required by Laws.",
    summary:
      "Neither party can publicly announce the agreement without the other's consent, unless required by law.",
    aggressiveIndicators: ["provider may use customer's name", "customer grants permission to use logo"],
    normalRange: { description: "Mutual approval required for publicity. One-sided rights to use the other party's name or logo without consent are aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §20",
    role: "anchor",
  },
  {
    id: "saas-notices-001",
    contractType: "saas",
    category: "Notices",
    clauseName: "Notices",
    standardText:
      "Except as set out in this Agreement, notices, requests and approvals under this Agreement must be in writing to the addresses on the Cover Page and will be deemed given: (1) upon receipt if by personal delivery, (2) upon receipt if by certified or registered U.S. mail (return receipt requested), (3) one day after dispatch if by a commercial overnight delivery or (4) upon delivery if by email. Either party may update its address with notice to the other. Provider may also send operational notices through the Cloud Service.",
    summary:
      "Legal notices must be in writing via mail, courier, personal delivery, or email. Addresses can be updated with notice. Provider may send operational notices through the service.",
    aggressiveIndicators: ["by posting on website without notice", "deemed received whether or not read"],
    normalRange: { description: "Standard notice clause with multiple delivery methods. Should allow address updates. Notice solely 'by posting on a website' is aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.3",
    role: "anchor",
  },
  {
    id: "saas-entire-agreement-001",
    contractType: "saas",
    category: "Entire Agreement",
    clauseName: "Entire Agreement",
    standardText:
      'This Agreement is the parties\' entire agreement regarding its subject matter and supersedes any prior or contemporaneous agreements regarding its subject matter. In this Agreement, headings are for convenience only and "including" and similar terms are to be construed without limitation. Terms in business forms, purchase orders or quotes used by either party will not amend or modify this Agreement; any such documents are for administrative purposes only. This Agreement may be executed in counterparts.',
    summary:
      "This is the complete agreement, replacing all prior agreements. Headings don't affect meaning. Standard business forms can't modify the agreement. Can be signed in counterparts.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard integration/merger clause. Should supersede prior agreements and prevent modification by purchase orders or other business forms." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.4",
    role: "anchor",
  },
  {
    id: "saas-severability-001",
    contractType: "saas",
    category: "Severability",
    clauseName: "Waivers and Severability",
    standardText:
      "Waivers must be signed by the waiving party's authorized representative and cannot be implied from conduct. If any provision of this Agreement is held invalid or unenforceable, it will be limited to the minimum extent necessary so that the remainder of this Agreement remains in effect.",
    summary:
      "Waivers must be explicit and signed. If a clause is invalid, it's trimmed rather than voiding the whole agreement.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard waivers and severability clause. Waivers should require written consent. Severability should preserve the rest of the agreement." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.8",
    role: "anchor",
  },
  {
    id: "saas-independent-contractors-001",
    contractType: "saas",
    category: "Relationship",
    clauseName: "Independent Contractors",
    standardText:
      "The parties are independent contractors, not agents, partners or joint venturers.",
    summary:
      "Clarifies that neither party is the other's employee, agent, or partner.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard boilerplate clarifying the relationship. Nearly universal in commercial contracts." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.11",
    role: "anchor",
  },
  {
    id: "saas-no-third-party-beneficiaries-001",
    contractType: "saas",
    category: "General",
    clauseName: "No Third-Party Beneficiaries",
    standardText:
      "There are no third-party beneficiaries to this Agreement.",
    summary:
      "Only the signing parties have rights under this agreement. No outside party can enforce it.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard boilerplate. Prevents non-parties from claiming rights under the agreement." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.12",
    role: "anchor",
  },
  {
    id: "saas-subcontractors-001",
    contractType: "saas",
    category: "Subcontractors",
    clauseName: "Subcontractors",
    standardText:
      "Provider may use subcontractors and permit them to exercise its rights and fulfill its obligations, but Provider remains responsible for their compliance with this Agreement and for its overall performance under this Agreement.",
    summary:
      "Provider can use subcontractors but stays responsible for their work and compliance with the agreement.",
    aggressiveIndicators: ["no responsibility for subcontractors", "customer assumes all risk"],
    normalRange: { description: "Standard subcontracting clause. Provider should remain responsible for subcontractor compliance. Disclaiming responsibility for subcontractors is aggressive." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.10",
    role: "anchor",
  },
  {
    id: "saas-export-001",
    contractType: "saas",
    category: "Export",
    clauseName: "Export Compliance",
    standardText:
      "Each party (a) will comply with all export and import Laws in performing this Agreement and (b) represents and warrants that it is not listed on any U.S. government list of prohibited or restricted parties or located in (or a national of) a country subject to a U.S. government embargo or designated by the U.S. government as a terrorist supporting country.",
    summary:
      "Both parties must comply with export/import laws and confirm they are not on any restricted party lists.",
    aggressiveIndicators: [],
    normalRange: { description: "Standard export compliance clause. Should be mutual. Required for any service with international reach." },
    source: "bonterms",
    sourceRef: "Bonterms Cloud Terms v1.0 §22.14",
    role: "anchor",
  },
];

// ─── Embedding Generation ────────────────────────────────────────────────────

async function generateEmbeddings(): Promise<StandardClause[]> {
  console.log(`Generating embeddings for ${rawStandards.length} standard clauses...`);
  console.log();

  const texts = rawStandards.map((s) => s.standardText);

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  const standards: StandardClause[] = rawStandards.map((raw, i) => ({
    ...raw,
    embedding: response.data[i].embedding,
  }));

  console.log(`Generated ${standards.length} embeddings (${response.data[0].embedding.length} dimensions each)`);
  return standards;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    console.error("Set it in .env.local or export it before running this script.");
    process.exit(1);
  }

  try {
    const standards = await generateEmbeddings();

    const outputPath = path.join(__dirname, "../src/data/standards.json");
    fs.writeFileSync(outputPath, JSON.stringify(standards, null, 2));
    console.log(`\nWrote ${standards.length} standard clauses to ${outputPath}`);

    // Print summary
    console.log();
    const types = [...new Set(standards.map((s) => s.contractType))];
    for (const type of types) {
      const count = standards.filter((s) => s.contractType === type).length;
      const sources = [...new Set(standards.filter((s) => s.contractType === type).map((s) => s.source))];
      console.log(`  ${type}: ${count} clauses (sources: ${sources.join(", ")})`);
    }

    console.log();
    const anchors = standards.filter((s) => s.role === "anchor").length;
    const variants = standards.filter((s) => s.role === "variant").length;
    console.log(`  ${anchors} anchors, ${variants} variants`);
  } catch (error) {
    console.error("Failed to generate embeddings:", error);
    process.exit(1);
  }
}

main();
