import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { StandardClause } from "../src/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Standard Clause Templates ───────────────────────────────────────────────
// These are industry-standard clause texts curated from public templates
// (YC SAFE, Bonterms, SHRM, SEC EDGAR filings) and legal best practices.

const rawStandards: Omit<StandardClause, "embedding">[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NDA CLAUSES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "nda-definition-001",
    contractType: "nda",
    category: "Definitions",
    clauseName: "Definition of Confidential Information",
    standardText:
      '"Confidential Information" means any non-public information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or by inspection, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, but is not limited to, trade secrets, business plans, financial data, customer lists, technical specifications, and product roadmaps.',
    summary:
      "Defines what counts as confidential information. Standard definitions cover non-public info disclosed in any form, with a reasonableness standard.",
    aggressiveIndicators: ["all information", "any information whatsoever", "without limitation"],
    normalRange: { description: "Should cover non-public info with a reasonableness test and specific examples." },
  },
  {
    id: "nda-obligations-001",
    contractType: "nda",
    category: "Obligations",
    clauseName: "Obligations of Receiving Party",
    standardText:
      'The Receiving Party shall: (a) hold the Confidential Information in strict confidence; (b) not disclose the Confidential Information to any third party without the prior written consent of the Disclosing Party, except to its employees, contractors, and advisors who have a need to know and are bound by confidentiality obligations at least as protective as those in this Agreement; (c) use the Confidential Information solely for the Purpose; and (d) protect the Confidential Information using the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.',
    summary:
      "Receiving party must keep info confidential, limit disclosure to need-to-know personnel, and use reasonable care.",
    aggressiveIndicators: ["absolute secrecy", "guarantee", "strictly liable"],
    normalRange: { description: "Reasonable care standard with need-to-know exceptions for employees and advisors." },
  },
  {
    id: "nda-exclusions-001",
    contractType: "nda",
    category: "Exclusions",
    clauseName: "Exclusions from Confidential Information",
    standardText:
      "Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was already in the Receiving Party's possession before receipt from the Disclosing Party, as evidenced by written records; (c) is independently developed by the Receiving Party without use of or reference to the Confidential Information; or (d) is rightfully received from a third party without restriction on disclosure.",
    summary:
      "Standard carve-outs: public info, prior knowledge, independent development, and third-party sources.",
    aggressiveIndicators: [],
    normalRange: { description: "Should include all four standard exclusions. Missing exclusions are a red flag." },
  },
  {
    id: "nda-compelled-disclosure-001",
    contractType: "nda",
    category: "Exclusions",
    clauseName: "Compelled Disclosure",
    standardText:
      "If the Receiving Party is compelled by law, regulation, or court order to disclose Confidential Information, the Receiving Party shall: (a) provide prompt written notice to the Disclosing Party, to the extent legally permitted; (b) cooperate with the Disclosing Party in seeking a protective order or other appropriate remedy; and (c) disclose only that portion of the Confidential Information that is legally required to be disclosed.",
    summary:
      "Allows disclosure when legally required, with notice to the disclosing party and minimal disclosure.",
    aggressiveIndicators: [],
    normalRange: { description: "Must allow compelled disclosure with notice and cooperation provisions." },
  },
  {
    id: "nda-term-001",
    contractType: "nda",
    category: "Term",
    clauseName: "Term and Duration",
    standardText:
      "This Agreement shall remain in effect for a period of two (2) years from the Effective Date (the \"Term\"). The confidentiality obligations set forth herein shall survive the expiration or termination of this Agreement for a period of three (3) years following such expiration or termination.",
    summary:
      "NDA lasts 2 years, with confidentiality obligations surviving for 3 years after termination.",
    aggressiveIndicators: ["perpetual", "indefinite", "in perpetuity", "forever"],
    normalRange: { description: "Term of 1-3 years with survival period of 2-5 years. Perpetual obligations are unusual." },
  },
  {
    id: "nda-return-001",
    contractType: "nda",
    category: "Return of Information",
    clauseName: "Return or Destruction of Confidential Information",
    standardText:
      "Upon the expiration or termination of this Agreement, or upon written request by the Disclosing Party, the Receiving Party shall promptly return or destroy all copies of the Confidential Information in its possession or control, and shall certify such return or destruction in writing. Notwithstanding the foregoing, the Receiving Party may retain copies of Confidential Information to the extent required by applicable law or regulation, or as part of its routine backup procedures, provided that such retained information remains subject to the confidentiality obligations of this Agreement.",
    summary:
      "After NDA ends, return or destroy confidential materials. Standard exception for legally required retention.",
    aggressiveIndicators: ["immediately destroy all", "no retention", "no copies whatsoever"],
    normalRange: { description: "Return or destroy with certification. Should allow retention for legal compliance and backups." },
  },
  {
    id: "nda-remedies-001",
    contractType: "nda",
    category: "Remedies",
    clauseName: "Remedies for Breach",
    standardText:
      "The Receiving Party acknowledges that a breach of this Agreement may cause irreparable harm to the Disclosing Party for which monetary damages may not be an adequate remedy. Accordingly, the Disclosing Party shall be entitled to seek equitable relief, including injunction and specific performance, in addition to all other remedies available at law or in equity, without the necessity of proving actual damages or posting a bond.",
    summary:
      "Allows the disclosing party to seek injunctive relief for breaches, in addition to monetary damages.",
    aggressiveIndicators: ["liquidated damages", "penalty", "forfeiture"],
    normalRange: { description: "Injunctive relief without requiring proof of damages. Liquidated damages are unusual in NDAs." },
  },
  {
    id: "nda-nonsolicitation-001",
    contractType: "nda",
    category: "Non-Solicitation",
    clauseName: "Non-Solicitation of Employees",
    standardText:
      "During the Term and for a period of twelve (12) months following the expiration or termination of this Agreement, neither Party shall directly solicit for employment any employee of the other Party with whom it had contact in connection with the Purpose, without the prior written consent of the other Party. This restriction shall not apply to general solicitations of employment not specifically directed at employees of the other Party.",
    summary:
      "Mutual non-solicitation of employees for 12 months. Allows general job postings.",
    aggressiveIndicators: ["all employees", "any personnel", "24 months", "36 months"],
    normalRange: { description: "6-12 months, mutual, limited to employees with direct contact. Should exclude general job postings." },
  },
  {
    id: "nda-governing-law-001",
    contractType: "nda",
    category: "Governing Law",
    clauseName: "Governing Law and Jurisdiction",
    standardText:
      "This Agreement shall be governed by and construed in accordance with the laws of the State of [State], without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be submitted to the exclusive jurisdiction of the state and federal courts located in [County], [State].",
    summary:
      "Specifies which state's laws apply and where disputes will be resolved.",
    aggressiveIndicators: [],
    normalRange: { description: "Should specify a reasonable jurisdiction. Watch for distant or inconvenient venues." },
  },
  {
    id: "nda-amendment-001",
    contractType: "nda",
    category: "Amendment",
    clauseName: "Amendment and Waiver",
    standardText:
      "This Agreement may not be amended, modified, or supplemented except by a written instrument signed by both Parties. No waiver of any provision of this Agreement shall be effective unless in writing and signed by the waiving Party. The failure of either Party to enforce any provision of this Agreement shall not be construed as a waiver of such provision or the right to enforce it at a later time.",
    summary:
      "Changes require written agreement from both parties. Not enforcing a clause doesn't mean waiving it.",
    aggressiveIndicators: ["sole discretion", "unilaterally", "at any time without notice"],
    normalRange: { description: "Mutual written consent required. Unilateral amendment rights are a major red flag." },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAAS AGREEMENT CLAUSES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "saas-term-001",
    contractType: "saas",
    category: "Term",
    clauseName: "Term and Renewal",
    standardText:
      'This Agreement shall commence on the Effective Date and continue for an initial term of one (1) year (the "Initial Term"). Thereafter, this Agreement shall automatically renew for successive one (1) year periods (each, a "Renewal Term"), unless either Party provides written notice of non-renewal at least thirty (30) days prior to the end of the then-current term.',
    summary:
      "1-year initial term with automatic annual renewal. Either party can opt out with 30 days notice.",
    aggressiveIndicators: ["irrevocable", "non-cancellable", "minimum commitment of 3 years"],
    normalRange: { description: "1-year terms with 30-90 day notice for non-renewal are standard." },
  },
  {
    id: "saas-termination-convenience-001",
    contractType: "saas",
    category: "Termination",
    clauseName: "Termination for Convenience",
    standardText:
      "Either Party may terminate this Agreement for convenience upon sixty (60) days' prior written notice to the other Party. In the event of termination for convenience by Customer, Provider shall refund any prepaid fees covering the remainder of the term after the effective date of termination on a pro-rata basis.",
    summary:
      "Either party can cancel with 60 days notice. Customer gets a pro-rata refund of prepaid fees.",
    aggressiveIndicators: ["no refund", "non-refundable", "immediately", "sole discretion"],
    normalRange: { description: "30-90 day notice, mutual right, pro-rata refund of prepaid fees." },
  },
  {
    id: "saas-termination-cause-001",
    contractType: "saas",
    category: "Termination",
    clauseName: "Termination for Cause",
    standardText:
      "Either Party may terminate this Agreement for cause: (a) upon thirty (30) days' written notice of a material breach, if such breach remains uncured at the expiration of such notice period; or (b) immediately upon written notice if the other Party becomes the subject of a petition in bankruptcy or any proceeding relating to insolvency, receivership, or liquidation that is not dismissed within sixty (60) days.",
    summary:
      "Either party can terminate for material breach with 30 days to cure. Immediate termination for bankruptcy.",
    aggressiveIndicators: ["immediately without cure", "sole determination", "any breach"],
    normalRange: { description: "30-day cure period for material breach is standard. Immediate termination only for bankruptcy/insolvency." },
  },
  {
    id: "saas-liability-001",
    contractType: "saas",
    category: "Liability",
    clauseName: "Limitation of Liability",
    standardText:
      'IN NO EVENT SHALL EITHER PARTY\'S AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT EXCEED THE TOTAL AMOUNTS PAID OR PAYABLE BY CUSTOMER DURING THE TWELVE (12) MONTH PERIOD IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM (THE "LIABILITY CAP"). IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, REGARDLESS OF THE THEORY OF LIABILITY.',
    summary:
      "Liability capped at 12 months of fees. No liability for indirect/consequential damages.",
    aggressiveIndicators: ["unlimited liability", "no limit", "10x", "without limitation as to amount"],
    normalRange: { description: "Liability cap of 12 months of fees is standard. Some agreements use 1x-2x annual fees." },
  },
  {
    id: "saas-indemnification-001",
    contractType: "saas",
    category: "Indemnification",
    clauseName: "Mutual Indemnification",
    standardText:
      "Each Party (the \"Indemnifying Party\") shall defend, indemnify, and hold harmless the other Party and its officers, directors, employees, and agents (the \"Indemnified Party\") from and against any third-party claims, damages, losses, and expenses (including reasonable attorneys' fees) arising out of: (a) the Indemnifying Party's breach of this Agreement; or (b) the Indemnifying Party's negligence or willful misconduct. Provider shall additionally indemnify Customer against any third-party claim that the Service infringes a valid patent, copyright, or trademark.",
    summary:
      "Both parties indemnify each other for breaches and negligence. Provider additionally covers IP infringement claims.",
    aggressiveIndicators: ["sole expense", "all costs", "unlimited indemnification"],
    normalRange: { description: "Mutual indemnification is standard. Provider should cover IP infringement." },
  },
  {
    id: "saas-data-protection-001",
    contractType: "saas",
    category: "Data Protection",
    clauseName: "Data Protection and Privacy",
    standardText:
      "Provider shall implement and maintain reasonable administrative, technical, and organizational security measures to protect Customer Data against unauthorized access, loss, or alteration. Provider shall process Customer Data solely for the purpose of providing the Service and in accordance with Customer's instructions. Provider shall promptly notify Customer of any data breach affecting Customer Data, and in no event later than seventy-two (72) hours after becoming aware of such breach.",
    summary:
      "Provider must protect customer data with reasonable security, only process it for the service, and notify within 72 hours of any breach.",
    aggressiveIndicators: ["no liability for data loss", "as-is", "no security guarantees"],
    normalRange: { description: "Reasonable security measures, purpose limitation, 72-hour breach notification." },
  },
  {
    id: "saas-sla-001",
    contractType: "saas",
    category: "SLA",
    clauseName: "Service Level Agreement",
    standardText:
      'Provider shall use commercially reasonable efforts to maintain the Service availability of at least 99.9% uptime during each calendar month, measured as total minutes in the month minus downtime minutes, divided by total minutes in the month ("Uptime Percentage"). Scheduled maintenance windows shall be excluded from downtime calculations, provided that Provider gives Customer at least forty-eight (48) hours advance notice. If the Uptime Percentage falls below 99.9% in any calendar month, Customer shall be entitled to service credits as set forth in the SLA Policy.',
    summary:
      "99.9% uptime guarantee with service credits for downtime. Scheduled maintenance excluded with 48h notice.",
    aggressiveIndicators: ["best efforts", "no guarantee", "no service credits", "no uptime commitment"],
    normalRange: { description: "99.5-99.99% uptime with service credits. Scheduled maintenance excluded with advance notice." },
  },
  {
    id: "saas-payment-001",
    contractType: "saas",
    category: "Payment",
    clauseName: "Payment Terms",
    standardText:
      "Customer shall pay all fees specified in the applicable Order Form. Unless otherwise stated, fees are due within thirty (30) days of the invoice date. All fees are stated in U.S. dollars and are non-cancellable and non-refundable except as expressly set forth herein. Late payments shall accrue interest at the lesser of 1.5% per month or the maximum rate permitted by applicable law.",
    summary:
      "Net 30 payment terms. Late payments accrue 1.5% monthly interest.",
    aggressiveIndicators: ["due immediately", "net 120", "5% per month", "accelerated payment"],
    normalRange: { description: "Net 30 to Net 60 is standard. Late interest of 1-1.5% per month is typical." },
  },
  {
    id: "saas-ip-001",
    contractType: "saas",
    category: "IP Ownership",
    clauseName: "Intellectual Property Ownership",
    standardText:
      "As between the Parties, Provider retains all right, title, and interest in and to the Service, including all related intellectual property rights. Customer retains all right, title, and interest in and to Customer Data. Provider shall not acquire any rights in Customer Data except the limited license to process Customer Data solely for the purpose of providing the Service. Any feedback, suggestions, or recommendations provided by Customer regarding the Service shall be the property of Provider.",
    summary:
      "Provider owns the service/platform. Customer owns their data. Provider gets rights to general feedback.",
    aggressiveIndicators: ["all data becomes property of", "exclusive license to customer data", "perpetual license to customer data"],
    normalRange: { description: "Clear separation: provider owns service, customer owns data. Feedback assignment is standard." },
  },
  {
    id: "saas-confidentiality-001",
    contractType: "saas",
    category: "Confidentiality",
    clauseName: "Confidentiality",
    standardText:
      "Each Party agrees to hold in confidence all Confidential Information of the other Party and not to disclose such information to any third party except as expressly permitted herein. Each Party shall use the same degree of care to protect the other Party's Confidential Information as it uses to protect its own confidential information, but in no event less than reasonable care. The confidentiality obligations shall survive termination of this Agreement for a period of three (3) years.",
    summary:
      "Mutual confidentiality with reasonable care standard. Obligations survive 3 years after termination.",
    aggressiveIndicators: ["perpetual", "indefinite", "absolute secrecy"],
    normalRange: { description: "Mutual, reasonable care standard, 2-5 year survival period." },
  },
  {
    id: "saas-warranty-001",
    contractType: "saas",
    category: "Warranty",
    clauseName: "Warranty and Disclaimer",
    standardText:
      'Provider warrants that the Service shall perform materially in accordance with the applicable documentation during the subscription term. EXCEPT AS EXPRESSLY SET FORTH HEREIN, THE SERVICE IS PROVIDED "AS IS" AND PROVIDER DISCLAIMS ALL OTHER WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
    summary:
      "Provider warrants the service works as documented. Standard disclaimer of all other warranties.",
    aggressiveIndicators: ["no warranty whatsoever", "entire risk", "use at your own risk"],
    normalRange: { description: "Material conformance with documentation is the standard warranty for SaaS." },
  },
  {
    id: "saas-force-majeure-001",
    contractType: "saas",
    category: "Force Majeure",
    clauseName: "Force Majeure",
    standardText:
      "Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement where such failure or delay results from circumstances beyond the reasonable control of that Party, including but not limited to acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, epidemics, strikes, or failures of third-party telecommunications or power supply. The affected Party shall promptly notify the other Party and use commercially reasonable efforts to mitigate the impact.",
    summary:
      "Neither party is liable for failures caused by events beyond their control (natural disasters, war, etc.).",
    aggressiveIndicators: [],
    normalRange: { description: "Standard force majeure with notification requirement and mitigation duty." },
  },
  {
    id: "saas-assignment-001",
    contractType: "saas",
    category: "Assignment",
    clauseName: "Assignment",
    standardText:
      "Neither Party may assign this Agreement or any of its rights or obligations hereunder without the prior written consent of the other Party, which consent shall not be unreasonably withheld. Notwithstanding the foregoing, either Party may assign this Agreement without consent in connection with a merger, acquisition, or sale of all or substantially all of its assets, provided that the assignee agrees in writing to be bound by the terms of this Agreement.",
    summary:
      "Assignment requires consent, except for mergers/acquisitions where the buyer assumes the contract.",
    aggressiveIndicators: ["freely assign", "without consent", "sole discretion to assign"],
    normalRange: { description: "Mutual consent with carve-out for M&A is standard." },
  },
  {
    id: "saas-governing-law-001",
    contractType: "saas",
    category: "Governing Law",
    clauseName: "Governing Law",
    standardText:
      "This Agreement shall be governed by and construed in accordance with the laws of the State of [State], without regard to its conflict of laws provisions. Any legal action or proceeding arising under this Agreement shall be brought exclusively in the federal or state courts located in [County], [State], and the Parties hereby consent to the personal jurisdiction and venue therein.",
    summary:
      "Specifies governing law and exclusive court jurisdiction.",
    aggressiveIndicators: [],
    normalRange: { description: "Should specify a reasonable jurisdiction agreeable to both parties." },
  },
  {
    id: "saas-amendment-001",
    contractType: "saas",
    category: "Amendment",
    clauseName: "Amendments",
    standardText:
      "This Agreement may only be amended or modified by a written instrument executed by authorized representatives of both Parties. No terms or conditions contained in any purchase order, acknowledgment, or other business form shall modify or supplement the terms of this Agreement, even if such document is accepted by the other Party.",
    summary:
      "Changes require written agreement signed by both parties. Purchase orders don't override the agreement.",
    aggressiveIndicators: ["unilaterally modify", "sole discretion", "change at any time", "by posting on website"],
    normalRange: { description: "Mutual written consent is the standard for amendments." },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPLOYMENT AGREEMENT CLAUSES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "emp-at-will-001",
    contractType: "employment",
    category: "Employment Status",
    clauseName: "At-Will Employment",
    standardText:
      "Employee's employment with the Company is \"at-will,\" meaning that either the Employee or the Company may terminate the employment relationship at any time, with or without cause, and with or without notice. Nothing in this Agreement shall be construed to create an express or implied contract of employment for a definite period of time.",
    summary:
      "Either party can end employment at any time. No guaranteed employment period.",
    aggressiveIndicators: [],
    normalRange: { description: "At-will is standard in the US. Fixed-term contracts should specify clear terms." },
  },
  {
    id: "emp-compensation-001",
    contractType: "employment",
    category: "Compensation",
    clauseName: "Compensation and Benefits",
    standardText:
      "The Company shall pay Employee a base salary of $[Amount] per year, payable in accordance with the Company's standard payroll schedule, subject to applicable withholdings and deductions. Employee shall be eligible to participate in the Company's standard employee benefit programs, including health insurance, retirement plans, and paid time off, subject to the terms and conditions of such programs as in effect from time to time.",
    summary:
      "Specifies base salary and eligibility for standard benefits (health, retirement, PTO).",
    aggressiveIndicators: ["no benefits", "sole discretion to modify compensation", "compensation may be reduced"],
    normalRange: { description: "Should clearly state salary amount, payment schedule, and benefit eligibility." },
  },
  {
    id: "emp-noncompete-001",
    contractType: "employment",
    category: "Non-Compete",
    clauseName: "Non-Competition",
    standardText:
      "During Employee's employment and for a period of twelve (12) months following the termination of employment for any reason (the \"Restricted Period\"), Employee shall not, directly or indirectly, engage in, own, manage, operate, or be employed by any business that is in direct competition with the Company's business as conducted at the time of termination, within a fifty (50) mile radius of any Company office where Employee was primarily assigned (the \"Restricted Area\"). This restriction shall not prevent Employee from owning up to 5% of the outstanding shares of a publicly traded company.",
    summary:
      "12-month non-compete within 50 miles of assigned office. Does not block passive stock ownership under 5%.",
    aggressiveIndicators: ["worldwide", "globally", "any competitor", "any business", "3 years", "5 years", "24 months", "36 months"],
    normalRange: { description: "6-12 months, limited geographic scope, limited to direct competitors. Longer than 2 years or worldwide scope is aggressive." },
  },
  {
    id: "emp-nonsolicitation-001",
    contractType: "employment",
    category: "Non-Solicitation",
    clauseName: "Non-Solicitation",
    standardText:
      "During Employee's employment and for a period of twelve (12) months following the termination of employment, Employee shall not directly or indirectly: (a) solicit, recruit, or hire any employee of the Company, or encourage any employee to leave the Company; or (b) solicit or attempt to solicit business from any customer, client, or prospective client of the Company with whom Employee had material contact during the last twelve (12) months of employment.",
    summary:
      "12-month restriction on recruiting company employees or soliciting company clients after leaving.",
    aggressiveIndicators: ["all customers", "any person", "24 months", "36 months", "worldwide"],
    normalRange: { description: "12 months, limited to employees/clients with direct contact. Broader restrictions are unusual." },
  },
  {
    id: "emp-ip-assignment-001",
    contractType: "employment",
    category: "IP Assignment",
    clauseName: "Intellectual Property Assignment",
    standardText:
      'Employee agrees to assign and hereby assigns to the Company all right, title, and interest in and to any inventions, works of authorship, designs, discoveries, and improvements (collectively, "Work Product") that are: (a) created or conceived by Employee during the period of employment; (b) related to the Company\'s current or anticipated business or research; and (c) created using the Company\'s resources, time, or facilities. This assignment does not apply to any inventions that Employee develops entirely on their own time without using Company equipment or resources, and that are not related to the Company\'s business.',
    summary:
      "Company owns IP created during employment that's related to company business. Personal projects on own time are excluded.",
    aggressiveIndicators: ["all inventions", "all intellectual property", "pre-existing", "prior inventions", "regardless of when created"],
    normalRange: { description: "Assignment limited to work-related IP created during employment. Must exclude personal projects and pre-existing IP." },
  },
  {
    id: "emp-confidentiality-001",
    contractType: "employment",
    category: "Confidentiality",
    clauseName: "Confidentiality",
    standardText:
      "Employee agrees to hold in strict confidence all Confidential Information of the Company during and after employment. Employee shall not use or disclose any Confidential Information except as necessary in the performance of Employee's duties. Upon termination of employment, Employee shall return all Company property and Confidential Information. This confidentiality obligation shall survive the termination of employment for a period of three (3) years, except with respect to trade secrets, which shall be protected for as long as they remain trade secrets under applicable law.",
    summary:
      "Employee must keep company information confidential during and for 3 years after employment. Trade secrets protected indefinitely.",
    aggressiveIndicators: ["perpetual for all information", "indefinite", "any information learned"],
    normalRange: { description: "2-5 year confidentiality period, with trade secrets protected indefinitely. Perpetual obligations for all info are unusual." },
  },
  {
    id: "emp-termination-001",
    contractType: "employment",
    category: "Termination",
    clauseName: "Termination and Severance",
    standardText:
      "Either Party may terminate this Agreement at any time. If the Company terminates Employee's employment without Cause, the Company shall provide Employee with: (a) continued payment of base salary for a period of three (3) months following the termination date (the \"Severance Period\"); (b) continuation of health insurance benefits during the Severance Period at the Company's expense; and (c) payment of any earned but unpaid bonuses. Employee must execute a general release of claims as a condition of receiving severance benefits.",
    summary:
      "3 months severance pay plus health benefits for termination without cause. Requires signing a release.",
    aggressiveIndicators: ["no severance", "no notice required", "immediate termination", "forfeiture of all benefits"],
    normalRange: { description: "2-6 months severance for without-cause termination. Release requirement is standard." },
  },
  {
    id: "emp-governing-law-001",
    contractType: "employment",
    category: "Governing Law",
    clauseName: "Governing Law",
    standardText:
      "This Agreement shall be governed by and construed in accordance with the laws of the State of [State], without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be resolved through binding arbitration in [City], [State], in accordance with the rules of the American Arbitration Association, except that either Party may seek injunctive or equitable relief in any court of competent jurisdiction.",
    summary:
      "Disputes resolved through arbitration, with option for court injunctions.",
    aggressiveIndicators: [],
    normalRange: { description: "Arbitration with carve-out for injunctive relief is common in employment agreements." },
  },
  {
    id: "emp-entire-agreement-001",
    contractType: "employment",
    category: "General",
    clauseName: "Entire Agreement",
    standardText:
      "This Agreement, together with any exhibits and schedules attached hereto, constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, negotiations, and discussions, whether oral or written. This Agreement may not be amended except by a written instrument signed by both Parties.",
    summary:
      "This is the complete agreement, replacing any prior discussions or agreements. Changes require written mutual consent.",
    aggressiveIndicators: ["company may modify", "subject to change", "sole discretion"],
    normalRange: { description: "Standard entire agreement clause with mutual written amendment requirement." },
  },
  {
    id: "emp-dispute-resolution-001",
    contractType: "employment",
    category: "Dispute Resolution",
    clauseName: "Dispute Resolution",
    standardText:
      "Any dispute, claim, or controversy arising out of or relating to this Agreement shall first be submitted to good faith mediation. If mediation is unsuccessful within thirty (30) days, the dispute shall be resolved by binding arbitration administered by the American Arbitration Association under its Employment Arbitration Rules. The arbitration shall be conducted in [City], [State], before a single arbitrator. Each Party shall bear its own costs and attorneys' fees, except that the Company shall pay all arbitration filing fees and arbitrator compensation.",
    summary:
      "Disputes go to mediation first, then binding arbitration. Company pays arbitration costs.",
    aggressiveIndicators: ["employee pays all costs", "waive right to court", "exclusive venue in"],
    normalRange: { description: "Mediation-first, then arbitration. Company should bear arbitration costs." },
  },
];

// ─── Embedding Generation ────────────────────────────────────────────────────

async function generateEmbeddings(): Promise<StandardClause[]> {
  console.log(`Generating embeddings for ${rawStandards.length} standard clauses...`);

  const texts = rawStandards.map((s) => s.standardText);

  // Batch all embeddings in one API call
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
    console.log(`Wrote ${standards.length} standard clauses to ${outputPath}`);

    // Print summary
    const types = [...new Set(standards.map((s) => s.contractType))];
    for (const type of types) {
      const count = standards.filter((s) => s.contractType === type).length;
      console.log(`  ${type}: ${count} clauses`);
    }
  } catch (error) {
    console.error("Failed to generate embeddings:", error);
    process.exit(1);
  }
}

main();
