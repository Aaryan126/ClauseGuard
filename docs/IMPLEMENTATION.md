# ClauseGuard — Technical Implementation Guide

A comprehensive breakdown of every component, algorithm, and design decision in ClauseGuard.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Document Parsing](#2-document-parsing)
3. [Clause Segmentation](#3-clause-segmentation)
4. [Embeddings — How and Why](#4-embeddings--how-and-why)
5. [Standard Clause Database](#5-standard-clause-database)
6. [Comparison Engine (Cosine Similarity)](#6-comparison-engine-cosine-similarity)
7. [Aggressive Pattern Rule Engine](#7-aggressive-pattern-rule-engine)
8. [Scoring System](#8-scoring-system)
9. [LLM Explanation Layer](#9-llm-explanation-layer)
10. [Contract Type Detection](#10-contract-type-detection)
11. [Full Analysis Pipeline](#11-full-analysis-pipeline)
12. [Frontend Architecture](#12-frontend-architecture)
13. [API Design](#13-api-design)
14. [File-by-File Reference](#14-file-by-file-reference)
15. [Cost Analysis](#15-cost-analysis)
16. [Limitations and Future Work](#16-limitations-and-future-work)

---

## 1. System Overview

ClauseGuard answers one question: **"Is this contract clause normal compared to industry standards?"**

It uses a **dual-detection architecture**:

1. **Semantic Comparison** — Convert text to mathematical vectors (embeddings), measure distance from known-good clause templates
2. **Rule-Based Detection** — Regex and keyword patterns that catch specific aggressive terms embeddings might miss

Neither layer alone is sufficient. Embeddings catch *semantic* deviations (the clause says something meaningfully different) while rules catch *specific* dangers (a single word like "unlimited" or "worldwide" changes everything, even if the overall clause structure looks normal).

The LLM (Gemini 2.0 Flash) is used **only for explanations** — it does not participate in scoring or classification. This makes the analysis reproducible: the same clause always gets the same score against the same baseline.

### Architecture Diagram

```
                    ┌─────────────┐
                    │   Upload    │
                    │  (PDF/DOCX/ │
                    │    TXT)     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   PARSER    │  pdf-parse (PDF) / officeparser (DOCX)
                    │  → raw text │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  SEGMENTER  │  Regex-based section header detection
                    │  → clauses  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │  EMBEDDINGS  │          │    RULES    │
       │  (OpenAI)    │          │  (15 regex  │
       │  → vectors   │          │   patterns) │
       └──────┬──────┘          └──────┬──────┘
              │                         │
       ┌──────▼──────┐                  │
       │  COMPARISON  │                  │
       │  (cosine     │                  │
       │   similarity │                  │
       │   vs 35      │                  │
       │   standards) │                  │
       └──────┬──────┘                  │
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼──────┐
                    │   SCORING   │  Combine embedding score + rule hits
                    │  → green/   │  → worst severity wins
                    │    yellow/  │
                    │    red      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  EXPLAINER  │  Gemini 2.0 Flash (yellow/red only)
                    │  → plain    │
                    │    English  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   REPORT    │  Summary + clause-by-clause breakdown
                    └─────────────┘
```

---

## 2. Document Parsing

**File:** `src/lib/parser.ts`

### What It Does
Converts uploaded binary files (PDF, DOCX, TXT) into raw text strings.

### How It Works

| File Type | Library Used | How It Works |
|-----------|-------------|-------------|
| **PDF** | `pdf-parse@1.1.1` | Uses Mozilla's `pdfjs-dist` under the hood. Extracts text layer from each page. Does NOT perform OCR — image-only PDFs will fail. |
| **DOCX** | `officeparser` | Unzips the DOCX file (which is a ZIP of XML files), parses the XML document structure, and extracts text content. |
| **TXT** | Built-in | Simply reads the buffer as UTF-8 text. |

### Known Limitation
`pdf-parse@1.1.1` attempts to load a test file (`test/data/05-versions-space.pdf`) on import. We work around this by creating a minimal dummy PDF at that path. This is a known quirk of this library version.

### Validation
- File type checked by extension
- Maximum file size: 10MB
- Empty text after parsing throws an error (catches image-only PDFs, corrupted files)

---

## 3. Clause Segmentation

**File:** `src/lib/segmenter.ts`

### What It Does
Takes a raw text string and splits it into individual, discrete clauses — each with a title and body text.

### How It Works

The segmenter uses a **multi-pass regex approach**:

**Pass 1 — Header Detection**

Each line is tested against 4 regex patterns that match common contract section header formats:

```
Pattern 1:  /^(\d+\.?\d*\.?\d*)\s+[A-Z]/     → "1. DEFINITIONS", "3.2 Payment Terms"
Pattern 2:  /^(Section|Article|Clause)\s+\d+/  → "Section 5", "Article III"
Pattern 3:  /^[A-Z][A-Z\s]{3,}$/               → "LIMITATION OF LIABILITY"
Pattern 4:  /^[IVXLCDM]+\.\s+/                 → "IV. Termination"
```

When a header line is detected, it marks the start of a new clause. All text between two consecutive headers is grouped as one clause's body.

**Pass 2 — Preamble Handling**

Text that appears before the first detected header is assigned to an implicit "Preamble" section, so nothing is lost.

**Pass 3 — Fragment Merging**

Any extracted section with body text shorter than 50 characters is merged into the previous section. This prevents false positives from sub-headers or stray formatting that creates tiny fragments.

**Pass 4 — Title Cleaning**

Removes leading numbers, dots, colons, and redundant prefixes from titles. Example: `"3.2 PAYMENT TERMS:"` becomes `"PAYMENT TERMS"`.

### Output Format
Each clause is returned as:
```typescript
{
  index: number;        // Sequential position (0-based)
  title: string;        // Cleaned section title
  text: string;         // Full clause body text
  startChar: number;    // Start position in original document
  endChar: number;      // End position in original document
}
```

### Why Not Use an LLM for Segmentation?
Cost and latency. A 10-page contract has ~5,000 tokens. Sending it to an LLM just for splitting adds $0.01+ and 5-10 seconds of latency. Regex handles ~90% of well-formatted contracts correctly and is instantaneous. The architecture supports adding an LLM fallback for poorly-structured documents (checked via `hasEnoughStructure()` which requires at least 3 detected sections).

---

## 4. Embeddings — How and Why

**File:** `src/lib/embeddings.ts`

### What Are Embeddings?

An embedding is a way to represent text as a **fixed-length array of numbers** (a vector) that captures the semantic meaning of the text. Texts with similar meanings produce similar vectors; texts with different meanings produce different vectors.

### Why We Use Them

The core challenge is: *"How similar is this clause to a known-standard clause?"* We can't do simple string matching because:
- "Either party may terminate with 30 days notice" and "Both sides can cancel this agreement by giving thirty days written notice" mean the same thing but share few words
- Embeddings capture meaning, not just words

### Model Used

**OpenAI `text-embedding-3-small`**

| Property | Value |
|----------|-------|
| Dimensions | 1,536 |
| Cost | $0.02 per million tokens |
| Max input | 8,191 tokens |
| Quality | High — optimized for semantic similarity tasks |

### How We Generate Them

```typescript
// Single embedding
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: "The party shall not disclose confidential information...",
});
const vector = response.data[0].embedding; // number[1536]

// Batch embedding (up to 100 texts per API call)
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: ["clause 1 text", "clause 2 text", "clause 3 text"],
});
```

We batch all clause texts into a single API call (up to 100 per batch) for efficiency.

### Two Contexts Where We Use Embeddings

1. **Seeding (one-time):** All 35 standard clause templates are embedded during the seed script (`scripts/seed-standards.ts`) and the resulting vectors are stored in `standards.json`. This is done once and the vectors ship with the codebase.

2. **Analysis (per request):** When a user uploads a contract, each extracted clause is embedded on-the-fly via the OpenAI API. These vectors are then compared against the pre-stored standard vectors.

---

## 5. Standard Clause Database

**File:** `src/data/standards.json` (generated by `scripts/seed-standards.ts`)

### What It Is

A JSON file containing 35 standard clause templates — representing what a **fair, industry-standard version** of each clause type looks like. Each entry includes the clause text, metadata, and a pre-computed 1,536-dimension embedding vector.

### Where the Templates Come From

The templates were authored based on established contract law patterns and informed by widely-used public templates:
- **YC's SAFE and standard NDA** — widely accepted startup contract templates
- **Bonterms Cloud Terms** — open-source SaaS agreement used by many tech companies
- **SHRM guidelines** — standard employment agreement practices
- **SEC EDGAR filings** — real NDAs from publicly traded companies
- **General contract law principles** — established legal drafting conventions

**Important:** These templates have not been reviewed by a licensed attorney. They represent reasonable approximations of industry norms for the purpose of deviation detection.

### Coverage

| Contract Type | Clauses | Categories |
|---------------|---------|------------|
| **NDA** | 10 | Definition of confidential info, obligations, exclusions, compelled disclosure, term/duration, return of materials, remedies, non-solicitation, governing law, amendment |
| **SaaS Agreement** | 15 | Term/renewal, termination (convenience + cause), liability cap, indemnification, data protection, SLA/uptime, payment, IP ownership, confidentiality, warranty, force majeure, assignment, governing law, amendments |
| **Employment** | 10 | At-will status, compensation, non-compete, non-solicitation, IP assignment, confidentiality, termination/severance, governing law, entire agreement, dispute resolution |

### Schema Per Entry

```typescript
{
  id: "nda-term-001",                    // Unique identifier
  contractType: "nda",                   // Which contract family
  category: "Term",                      // Clause category
  clauseName: "Term and Duration",       // Human-readable name
  standardText: "This Agreement...",     // The actual standard clause text
  summary: "NDA lasts 2 years...",       // 1-2 sentence plain-English summary
  embedding: [0.023, -0.041, ...],       // Pre-computed 1536-dim vector
  aggressiveIndicators: ["perpetual"],   // Keywords signaling aggressive variants
  normalRange: {
    description: "Term of 1-3 years..."  // What's considered acceptable
  }
}
```

### How to Add More Standards

Run the seed script after adding entries to the `rawStandards` array in `scripts/seed-standards.ts`:

```bash
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/seed-standards.ts
```

This regenerates all embeddings and overwrites `standards.json`.

---

## 6. Comparison Engine (Cosine Similarity)

**File:** `src/lib/comparison.ts`

### What It Does

For each uploaded clause, finds the most semantically similar standard clause from the database by measuring the mathematical distance between their embedding vectors.

### How Cosine Similarity Works

Cosine similarity measures the angle between two vectors. It ranges from -1 (opposite meaning) to 1 (identical meaning). For text embeddings, values typically fall between 0.3 and 1.0.

**The formula:**

```
                    A · B           Σ(Ai × Bi)
cosine(A, B) = ─────────── = ──────────────────────
                |A| × |B|    √(Σ Ai²) × √(Σ Bi²)
```

**In plain English:** Multiply each pair of corresponding numbers, sum them up, and divide by the product of each vector's length. The result tells you how much the two vectors "point in the same direction."

**Our implementation:**

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];   // numerator
    normA += a[i] * a[i];        // |A|²
    normB += b[i] * b[i];        // |B|²
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Matching Process

For each uploaded clause:
1. Compute cosine similarity against **all 35** standard clauses
2. Return the standard clause with the highest similarity score
3. This is the "closest match" — the most similar standard template

This is a brute-force linear scan. With only 35 standards, this takes microseconds. For larger databases (1,000+), you'd use an approximate nearest neighbor (ANN) algorithm or a vector database like Pinecone/ChromaDB.

### Example Scores

| Uploaded Clause | Best Match | Similarity | Meaning |
|----------------|------------|------------|---------|
| "Either party may terminate with 30 days notice" | Standard Termination for Convenience | 0.91 | Very standard (Green) |
| "Company may terminate at any time without cause" | Standard Termination for Convenience | 0.72 | One-sided variation (Yellow) |
| "Employee shall pay a $50,000 penalty upon departure" | Standard Termination/Severance | 0.48 | Nothing like this in standards (Red) |

---

## 7. Aggressive Pattern Rule Engine

**File:** `src/lib/rules.ts`

### What It Does

Scans each clause for specific aggressive terms, phrases, or patterns using regex and keyword matching. Catches dangers that embeddings alone might miss.

### Why Rules Alongside Embeddings?

Embeddings measure overall semantic similarity, but a single word can change everything:

> "The Employee agrees to a non-compete for a period of **twelve (12) months** within a **fifty (50) mile radius**."

vs.

> "The Employee agrees to a non-compete for a period of **five (5) years** **worldwide**."

These two clauses have very similar structure and most of the same words, so their embeddings will be quite close. But the second one is dramatically more aggressive. Rules catch this.

### All 15 Rules

#### RED Severity (High Risk — 7 rules)

| # | Rule ID | What It Detects | How It Detects |
|---|---------|----------------|---------------|
| 1 | `noncompete-duration` | Non-compete longer than 2 years | Regex extracts number before "year/yr/month", checks if > 2 years or > 24 months |
| 2 | `noncompete-worldwide` | Worldwide non-compete scope | Keyword match: "worldwide", "globally", "anywhere in the world" combined with non-compete keywords |
| 3 | `unlimited-liability` | No cap on liability | Keyword match: "unlimited liability", "no limit on liability", "without limitation as to amount" |
| 4 | `unilateral-termination` | Only one party can terminate | Checks for termination + unilateral language ("at any time", "sole discretion") + single-party identifier ("Company may", "Employer may") |
| 5 | `blanket-ip-assignment` | IP assignment includes pre-existing work | Checks for assignment + IP keywords + blanket language ("all intellectual property", "pre-existing", "prior inventions") |
| 6 | `unilateral-amendment` | One party can change the contract | Checks for modify/amend + unilateral language ("sole discretion", "without consent") + contract terms |
| 7 | `no-compelled-disclosure` | NDA with no court order exception | Checks for confidentiality obligation WITHOUT any carve-out keywords ("court order", "subpoena", "required by law") |

#### YELLOW Severity (Review Recommended — 8 rules)

| # | Rule ID | What It Detects | How It Detects |
|---|---------|----------------|---------------|
| 8 | `no-cure-period` | Termination for breach with no chance to fix | Checks for breach + termination WITHOUT cure language ("cure", "remedy", "right to correct") |
| 9 | `auto-renewal-no-optout` | Auto-renewal with no cancellation mechanism | Checks for auto-renewal keywords WITHOUT opt-out language ("written notice", "days prior") |
| 10 | `payment-over-net90` | Payment terms longer than Net 90 | Regex extracts number from "Net X" or "X days of receipt/invoice", flags if > 90 |
| 11 | `perpetual-confidentiality` | Never-ending confidentiality obligation | Checks for confidentiality + perpetual language ("perpetual", "indefinite", "in perpetuity") |
| 12 | `jury-trial-waiver` | Waives right to jury trial | Keyword match: "waive" + "jury trial" |
| 13 | `one-sided-arbitration` | Arbitration in one party's preferred location | Checks for "arbitration" + exclusive venue language ("exclusive", "sole venue") |
| 14 | `class-action-waiver` | Waives class action rights | Keyword match: "waive" + "class action" or "collective action" |
| 15 | `immediate-termination-convenience` | Can cancel immediately with zero notice | Checks for convenience/without-cause + "immediately" or "effective immediately" |

### How Rules Interact With Embedding Scores

Rule hits **always escalate** the severity — they never lower it:

```
Final Severity = worst(Embedding Severity, Worst Rule Hit Severity)
```

Examples:
- Embedding says Green + No rule hits → **Green**
- Embedding says Green + Yellow rule hit → **Yellow**
- Embedding says Green + Red rule hit → **Red**
- Embedding says Yellow + Red rule hit → **Red**
- Embedding says Red + No rule hits → **Red**

---

## 8. Scoring System

**File:** `src/lib/scoring.ts`

### Per-Clause Scoring

Each clause receives a traffic-light score based on two inputs:

#### Embedding Similarity Thresholds

| Similarity Score | Traffic Light | Meaning |
|-----------------|---------------|---------|
| ≥ 0.82 | Green | Clause closely matches an industry standard template. Low risk. |
| 0.65 – 0.81 | Yellow | Clause deviates meaningfully from standard. Worth reviewing. |
| < 0.65 | Red | Clause is substantially different from any known standard. High risk. |
| < 0.50 | No Match | Clause is so different it's considered "novel" — no standard reference point exists. Displayed as a special warning. |

These thresholds are stored in a config object and can be tuned:

```typescript
export const THRESHOLDS = {
  green: 0.82,
  yellow: 0.65,
  novel: 0.50,
};
```

#### Combined Scoring (Embedding + Rules)

```typescript
function combineSeverity(embeddingSeverity, ruleHits) {
  // Find the worst severity among all rule hits
  // Return whichever is worse: embedding score or rule hits
}
```

### Overall Risk Score (0–100)

A single number representing the contract's overall risk level. Calculated as a weighted average:

```
Green clauses  → 0 points
Yellow clauses → 40 points
Red clauses    → 100 points

Overall Score = sum(points) / number_of_clauses
```

| Score Range | Label | Meaning |
|------------|-------|---------|
| 0–20 | Low Risk | Mostly standard clauses, few concerns |
| 21–50 | Moderate Risk | Some unusual clauses worth reviewing |
| 51–100 | High Risk | Multiple aggressive or non-standard clauses |

---

## 9. LLM Explanation Layer

**File:** `src/lib/explainer.ts`

### What It Does

Generates plain-English explanations for flagged (yellow/red) clauses. This is the only component that uses a large language model. Green clauses do not get explanations — they're standard and don't need one.

### Model Used

**Google Gemini 2.0 Flash** via the `@google/generative-ai` SDK.

Chosen for: fast inference speed, low cost, and good-enough quality for generating plain-English summaries. The LLM does not make scoring decisions — it only explains decisions already made by the embedding + rule engine.

### Prompt Design

Each flagged clause is sent with context about:
1. The clause text itself
2. The closest matching standard clause (name + text + similarity %)
3. Any aggressive pattern rule hits

The prompt asks for a structured JSON response:

```json
{
  "explanation": "2-3 sentences explaining the risk to the person signing.",
  "normalVersion": "1-2 sentences describing what a standard version would look like."
}
```

### Concurrency

Flagged clauses are processed in parallel, with a concurrency limit of 5 to avoid rate limiting. If a contract has 10 flagged clauses, they're processed in 2 batches of 5.

### Error Handling

If the LLM call fails for any clause, the explanation falls back to: *"Unable to generate explanation. Please review this clause manually."* The scoring is unaffected since it doesn't depend on the LLM.

---

## 10. Contract Type Detection

**File:** `src/lib/analyzer.ts` (function `detectContractType`)

### What It Does

Automatically detects what type of contract was uploaded based on keyword frequency.

### How It Works

Scans the full document text for keywords associated with each contract type:

| Contract Type | Detection Keywords |
|---------------|-------------------|
| NDA | "non-disclosure", "nda", "confidential information", "receiving party", "disclosing party" |
| SaaS Agreement | "software as a service", "saas", "subscription", "service level", "uptime", "sla" |
| Employment Agreement | "employee", "employer", "employment", "compensation", "benefits", "at-will" |
| Freelance/Contractor | "contractor", "independent contractor", "statement of work", "deliverables" |

The type with the most keyword matches wins. If nothing matches well enough, it defaults to "General Contract."

This is used for display purposes in the report header — it does not affect scoring or comparison (all 35 standard clauses from all types are compared regardless).

---

## 11. Full Analysis Pipeline

**File:** `src/lib/analyzer.ts`

### Step-by-Step Execution

```
analyzeContract(buffer, filename)
│
├── Step 1: parseDocument(buffer, filename)
│   └── Returns: raw text string
│
├── Step 2: segmentClauses(text)
│   └── Returns: ExtractedClause[] (array of {title, text, index, startChar, endChar})
│
├── Step 3: loadStandards()
│   └── Returns: StandardClause[] (35 entries from standards.json, cached after first load)
│
├── Step 4: getEmbeddings(clauseTexts)
│   └── Returns: number[][] (one 1536-dim vector per clause, via OpenAI API)
│
├── Step 5: For each clause:
│   ├── findBestMatch(embedding, standards) → closest standard + similarity score
│   ├── checkAggressivePatterns(clause.text) → array of rule hits
│   ├── getSeverityFromSimilarity(similarity) → green/yellow/red
│   └── combineSeverity(embeddingSeverity, ruleHits) → final severity
│
├── Step 6: explainFlaggedClauses(analyses)
│   └── For yellow/red clauses: call Gemini for explanation + normal version
│
└── Step 7: Build report
    ├── Count green/yellow/red
    ├── Calculate overall risk score
    ├── Detect contract type
    └── Return AnalysisReport JSON
```

### Timing (Typical 10-page contract with ~20 clauses)

| Step | Duration | Bottleneck |
|------|----------|-----------|
| Parse | 0.5-2s | PDF text extraction |
| Segment | <10ms | Pure regex, in-memory |
| Load Standards | <1ms | Cached after first request |
| Embed | 1-3s | OpenAI API call (single batch) |
| Compare + Rules | <10ms | In-memory math + regex |
| Explain | 3-10s | Gemini API calls (parallel, only for flagged clauses) |
| **Total** | **5-15s** | |

---

## 12. Frontend Architecture

### Tech Stack
- **Next.js 14+ App Router** — React framework with server-side rendering
- **Tailwind CSS** — Utility-first CSS
- **shadcn/ui** — Pre-built accessible UI components (Card, Badge, Button, Accordion, etc.)
- **Lucide React** — Icon library
- **react-dropzone** — File upload drag-and-drop

### View States

The app has a single page (`src/app/page.tsx`) with 4 view states:

```
upload → analyzing → report
                  ↘ error
```

| State | What's Shown |
|-------|-------------|
| `upload` | Hero section ("Is This Clause Normal?"), drag-and-drop zone, 3-step how-it-works |
| `analyzing` | Spinning loader, animated step list (parsing, embedding, comparing, explaining) |
| `report` | Summary dashboard (risk score, green/yellow/red counts), clause-by-clause cards |
| `error` | Error message with "Try Again" button |

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `UploadZone` | `upload-zone.tsx` | Drag-and-drop file upload with validation |
| `AnalysisProgress` | `analysis-progress.tsx` | Animated loading state |
| `ReportSummary` | `report-summary.tsx` | Overall risk score + green/yellow/red count cards |
| `ClauseCard` | `clause-card.tsx` | Individual clause with traffic light, expandable details |
| `TrafficLight` | `traffic-light.tsx` | Reusable green/yellow/red dot + label |

### ClauseCard Behavior
- Red clauses are **expanded by default** (most important to see)
- Green/yellow clauses are collapsed, click to expand
- Expanded view shows: clause text, rule hits, AI explanation, "what normal looks like", matched standard clause

---

## 13. API Design

### `POST /api/analyze`

**File:** `src/app/api/analyze/route.ts`

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` field containing the uploaded document

**Response (success):**
```json
{
  "contractType": "Non-Disclosure Agreement (NDA)",
  "totalClauses": 12,
  "summary": { "green": 7, "yellow": 3, "red": 2 },
  "overallRiskScore": 38,
  "clauses": [
    {
      "clause": {
        "index": 0,
        "title": "Definition of Confidential Information",
        "text": "...",
        "startChar": 0,
        "endChar": 450
      },
      "bestMatch": {
        "standardClause": { "id": "nda-definition-001", "clauseName": "...", ... },
        "similarity": 0.89
      },
      "ruleHits": [],
      "severity": "green",
      "explanation": null,
      "normalVersion": null
    },
    ...
  ]
}
```

**Response (error):**
```json
{
  "error": "Could not extract text from the document."
}
```

---

## 14. File-by-File Reference

### Core Analysis Engine

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/parser.ts` | ~35 | Document → raw text. Routes to pdf-parse (PDF) or officeparser (DOCX). |
| `src/lib/segmenter.ts` | ~95 | Raw text → individual clauses. Regex header detection + fragment merging. |
| `src/lib/embeddings.ts` | ~30 | Wrapper around OpenAI embeddings API. Single + batch embedding generation. |
| `src/lib/comparison.ts` | ~55 | Cosine similarity calculation + best-match finder against standard clause database. |
| `src/lib/rules.ts` | ~260 | 15 aggressive pattern detection rules (7 RED, 8 YELLOW). Regex + keyword matching. |
| `src/lib/scoring.ts` | ~50 | Traffic-light thresholds, severity combination logic, overall risk score calculation. |
| `src/lib/explainer.ts` | ~70 | Gemini 2.0 Flash integration. Generates plain-English explanations for flagged clauses. |
| `src/lib/analyzer.ts` | ~95 | Orchestrator. Ties the entire pipeline together: parse → segment → embed → compare → score → explain → report. |

### Data Layer

| File | Purpose |
|------|---------|
| `src/data/standards.json` | 35 standard clause templates with pre-computed embeddings (~2MB). |
| `src/data/standards-loader.ts` | Loads and caches standards.json in memory. |
| `src/types/index.ts` | All TypeScript type definitions (StandardClause, ExtractedClause, ClauseAnalysis, AnalysisReport, etc.). |
| `scripts/seed-standards.ts` | One-time script. Defines all standard clause templates, calls OpenAI to compute embeddings, writes standards.json. |

### Frontend

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main page. Manages upload → analyzing → report view states. |
| `src/app/layout.tsx` | Root layout with fonts and metadata. |
| `src/app/api/analyze/route.ts` | API endpoint. Accepts file upload, calls analyzer, returns JSON report. |
| `src/components/upload-zone.tsx` | Drag-and-drop file upload with file type/size validation. |
| `src/components/analysis-progress.tsx` | Animated loading state during analysis. |
| `src/components/report-summary.tsx` | Risk score dashboard + green/yellow/red count cards. |
| `src/components/clause-card.tsx` | Individual clause display with expandable details, rule hits, explanations. |
| `src/components/traffic-light.tsx` | Reusable green/yellow/red indicator dot + label. |

---

## 15. Cost Analysis

### Per-Contract Analysis Cost

| Component | Cost | Notes |
|-----------|------|-------|
| OpenAI Embeddings | ~$0.0002 | ~10K tokens per contract at $0.02/MTok |
| Gemini 2.0 Flash | ~$0.001-0.005 | Only for flagged clauses, depends on how many |
| **Total per analysis** | **~$0.001-0.006** | |

### Seeding Cost (One-Time)

| Component | Cost | Notes |
|-----------|------|-------|
| OpenAI Embeddings for 35 standards | ~$0.001 | ~50K tokens total |

### At Scale

- 1,000 contracts analyzed = **~$1-6**
- 10,000 contracts analyzed = **~$10-60**

---

## 16. Limitations and Future Work

### Current Limitations

1. **Standard clause database is AI-generated** — Not reviewed by a licensed attorney. Suitable for a prototype, not legal advice.
2. **No OCR** — Image-only PDFs (scanned documents) will fail. Only text-layer PDFs are supported.
3. **English only** — All templates and rules are in English.
4. **No jurisdiction awareness** — The same standards are applied regardless of legal jurisdiction. A non-compete that's standard in Delaware may be unenforceable in California.
5. **3 contract types** — Only NDA, SaaS, and Employment agreements have standard templates. Other contract types will still be analyzed but with less accurate matching.
6. **Segmentation assumes well-formatted contracts** — Contracts without clear section headers may segment poorly.

### Future Improvements

- Lawyer-reviewed standard clause database
- More contract types (rental/lease, freelance, partnership, terms of service)
- Jurisdiction-specific analysis (e.g., California non-compete rules)
- OCR support for scanned PDFs
- Side-by-side diff view (uploaded clause vs. standard)
- Exportable PDF report
- Multi-language support
- User-customizable thresholds and rules
- Clause-level recommendations (not just flags)
