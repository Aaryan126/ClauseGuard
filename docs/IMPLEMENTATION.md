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

The LLM (Gemini 2.5 Pro) is used for **scoring** (judging functional equivalence of each clause against its matched standard) and **explanations** (plain-English risk summaries for flagged clauses). Embeddings handle retrieval (finding the closest standard), while the LLM handles judgment.

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
                    │  LLM SCORER │  Gemini 2.5 Pro (all clauses)
                    │  EXPLAINER  │  Gemini 2.5 Pro (yellow/red only)
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

A JSON file containing 45 standard clause templates sourced from **authoritative, lawyer-drafted, open-source contract standards**. Each entry includes the clause text, metadata, provenance information, and a pre-computed 1,536-dimension embedding vector.

### Where the Templates Come From

Templates are sourced verbatim (with minimal adaptation for variable references) from established, community-validated legal standards:

- **Common Paper Mutual NDA v1.0** (CC BY 4.0) — NDA clauses. Drafted by a committee of 40+ attorneys. YC-backed. Used by 2,000+ companies. [GitHub](https://github.com/CommonPaper/Mutual-NDA)
- **Bonterms Cloud Terms v1.0** (CC BY 4.0) — SaaS agreement clauses. Developed by a committee of 120+ lawyers over 7 months. [GitHub](https://github.com/Bonterms/Cloud-Terms)
- **Manual** — 1 clause (Non-Solicitation for NDA) where no authoritative open-source template exists, modeled on established legal practice.

### Multi-Anchor Architecture

Each standard clause entry has a `role` field:
- **anchor** — The primary, authoritative template for a clause category. Sourced from Common Paper or Bonterms.
- **variant** — Additional real-world wording for the same category (future: sourced from CUAD dataset). Expands the "surface area" of what's considered standard, reducing false flags for clauses that are standard but worded differently.

At comparison time, a user's clause is compared against all entries. The highest cosine similarity across all anchors and variants determines the match. This means a clause only needs to be similar to ANY standard version to score well.

### Coverage

| Contract Type | Clauses | Source | Categories |
|---------------|---------|--------|------------|
| **NDA** | 10 | Common Paper (9), Manual (1) | Definition of confidential info, obligations, exclusions, required disclosures, term/termination, return of materials, equitable relief, non-solicitation, governing law, amendment |
| **SaaS Agreement** | 18 | Bonterms (18) | Term/renewal, termination (convenience + cause), liability cap, indemnification, data protection, SLA/uptime, payment, IP ownership, confidentiality, warranty, force majeure, assignment, governing law, amendments, **suspension**, **data export/deletion**, **usage restrictions** |

### Schema Per Entry

```typescript
{
  id: "nda-term-001",                    // Unique identifier
  contractType: "nda",                   // Which contract family
  category: "Term",                      // Clause category
  clauseName: "Term and Termination",    // Human-readable name
  standardText: "This MNDA...",          // The actual standard clause text
  summary: "Either party can...",        // 1-2 sentence plain-English summary
  embedding: [0.023, -0.041, ...],       // Pre-computed 1536-dim vector
  aggressiveIndicators: ["perpetual"],   // Keywords signaling aggressive variants
  normalRange: {
    description: "Term of 1-3 years..."  // What's considered acceptable
  },
  source: "common-paper",               // Provenance: common-paper | bonterms | cuad | manual
  sourceRef: "Common Paper Mutual NDA v1.0 §5",  // Specific section reference
  role: "anchor"                         // anchor (primary) or variant (additional)
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
1. Filter standards to the user-selected contract type (NDA or SaaS)
2. Compute cosine similarity against all standards in that type (10 for NDA, 18 for SaaS)
3. Return the standard clause with the highest similarity score
4. This is the "closest match" — the most similar standard template

This is a brute-force linear scan. With only 10-18 standards per type, this takes microseconds. For larger databases (1,000+), you'd use an approximate nearest neighbor (ANN) algorithm or a vector database like Pinecone/ChromaDB.

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

### Rule Tiers

Each rule is assigned a **tier** that determines how it interacts with the embedding-derived severity. This prevents low-confidence pattern matches from overriding high embedding similarity.

| Tier | Behavior | Rules |
|------|----------|-------|
| **critical** | Always overrides to RED — these are poison-pill clauses regardless of similarity | `unlimited-liability`, `blanket-ip-assignment`, `unilateral-amendment`, `no-compelled-disclosure` |
| **serious** | Respects embedding confidence — escalates yellow→red, but only escalates green→yellow (not straight to red) | `noncompete-duration`, `noncompete-worldwide`, `unilateral-termination` |
| **caution** | Never escalates severity on its own — the rule hit is shown to the user but the traffic light stays at the embedding level | All 8 yellow rules |

### How Rules Interact With Embedding Scores (Tier-Based Matrix)

The combination is no longer "worst wins." Instead, the rule tier determines how much it can override the embedding:

| Embedding Severity | No Rules | Caution Rule | Serious Rule | Critical Rule |
|-------------------|----------|-------------|-------------|---------------|
| **GREEN** (≥0.82) | GREEN | GREEN (rule shown) | YELLOW | RED |
| **YELLOW** (≥0.65) | YELLOW | YELLOW | RED | RED |
| **RED** (<0.65) | RED | RED | RED | RED |

Key behaviors:
- A **caution** rule on a green clause doesn't change the score — it's informational. The user still sees the rule hit in the detail panel.
- A **serious** rule on a green clause downgrades to yellow, not red — the high embedding similarity provides confidence that the clause isn't fundamentally broken.
- A **critical** rule always forces red regardless of embedding — unlimited liability or blanket IP assignment is dangerous even in a well-structured clause.

### Flag Source Indicator

Each flagged clause includes a `flagSource` field indicating what drove the severity:
- `"similarity"` — flagged because embedding similarity was below threshold
- `"pattern"` — flagged because a rule detected aggressive language (embedding was green)
- `"both"` — flagged by both low similarity and pattern detection
- `null` — green clause, not flagged

---

## 8. Scoring System

**Files:** `src/lib/scoring.ts`, `src/lib/llm-scorer.ts`

### Hybrid Scoring Pipeline

Each clause is scored through a three-layer pipeline:

#### Layer 1: Embedding Match (Fast Retrieval)

Cosine similarity finds the closest standard clause. This is a **retrieval** step, not a scoring step — it identifies which standard to compare against. The similarity percentage is shown in the UI for transparency but does **not** determine severity.

Embedding similarity thresholds (0.82/0.65/0.50) are retained as fallback only, used when LLM scoring fails.

#### Layer 2: LLM Severity Scoring (Primary Signal)

**File:** `src/lib/llm-scorer.ts` | **Model:** Gemini 2.5 Pro

For each clause + its best standard match, the LLM judges **functional equivalence**:
- Does the uploaded clause achieve the same legal effect as the standard?
- Are there missing protections, additional obligations, or scope differences?
- Classification: green (equivalent), yellow (notable deviations), red (significant differences)

This replaces rigid cosine similarity thresholds. A severability clause that scores 63% cosine similarity but is functionally equivalent gets scored green by the LLM.

All clauses are scored (not just flagged ones). Processed in batches of 5 for concurrency. Falls back to embedding thresholds if the LLM call fails.

#### Layer 3: Rule Tier Override

```typescript
function combineSeverity(
  llmSeverity: Severity,
  ruleHits: RuleHit[],
): { severity: Severity; flagSource: FlagSource }
```

The tier-based matrix from Section 7 applies on top of the LLM score. Critical rules still override green LLM scores to red. Returns both the final severity and a `flagSource`.

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

**Google Gemini 2.5 Pro** via the `@google/generative-ai` SDK.

Used for both LLM-based severity scoring (`llm-scorer.ts`) and explanation generation (`explainer.ts`). Chosen for strong legal reasoning ability and structured output reliability.

### Prompt Design — Flag-Source-Specific

The prompt is tailored based on `flagSource` to produce targeted explanations instead of generic summaries. Three prompt variants:

1. **Flagged by similarity** (`flagSource === "similarity"`): The prompt tells the LLM the clause was flagged because its text differs from standard templates, and asks it to compare the uploaded clause against the standard text and point out specific differences in scope, duration, obligations, or rights.

2. **Flagged by pattern** (`flagSource === "pattern"`): The prompt tells the LLM the embedding similarity was actually high (green-level) but an aggressive pattern was detected. It includes the rule tier (critical/serious/caution) and asks the LLM to explain the specific pattern and why it's risky even though the clause structure is close to standard.

3. **Flagged by both** (`flagSource === "both"`): The prompt asks the LLM to address both concerns — structural deviation from standard and the specific aggressive pattern.

Each prompt includes:
- The clause text
- The full standard clause text for side-by-side comparison
- Similarity score with interpretation
- Rule hits with tier labels (e.g., `[CRITICAL — serious issue regardless of context]`)
- Explicit instructions to reference actual phrases from the clause and avoid vague statements

The prompt asks for a structured JSON response:

```json
{
  "explanation": "2-3 sentences referencing actual clause language and specific risks.",
  "normalVersion": "1-2 sentences describing what would change in a fair version, or null if the clause is already close to standard."
}
```

The `normalVersion` field can be `null` — if the LLM determines the clause doesn't need meaningful changes, the "What Standard Looks Like" section is not shown in the UI. This prevents generic filler responses.

### Concurrency

Flagged clauses are processed in parallel, with a concurrency limit of 5 to avoid rate limiting. If a contract has 10 flagged clauses, they're processed in 2 batches of 5.

### Error Handling

If the LLM call fails for any clause, the explanation falls back to: *"Unable to generate explanation. Please review this clause manually."* The scoring is unaffected since it doesn't depend on the LLM.

---

## 10. Contract Type Selection

### What It Does

The user explicitly selects their contract type (NDA or SaaS Agreement) before uploading. This replaced the previous auto-detection approach.

### Why User Selection Instead of Auto-Detection

1. **Accuracy** — The user knows what they're signing; keyword detection can misclassify.
2. **Better comparisons** — Standards are filtered by the selected type, so clauses are only compared against relevant templates (16 NDA standards or 29 SaaS standards).
3. **Simpler UX** — The user understands upfront what they're getting analyzed against.

### Supported Types

| Contract Type | Standards | Source |
|---------------|-----------|--------|
| **Non-Disclosure Agreement (NDA)** | 10 clauses | Common Paper Mutual NDA v1.0 (9), Manual (1) |
| **SaaS Agreement** | 18 clauses | Bonterms Cloud Terms v1.0 (18) |

---

## 11. Full Analysis Pipeline

**File:** `src/lib/analyzer.ts`

### Step-by-Step Execution

```
analyzeContract(buffer, filename, contractType)
│
├── Step 1: parseDocument(buffer, filename)
│   └── Returns: raw text string
│
├── Step 2: segmentClauses(text)
│   └── Returns: ExtractedClause[] (array of {title, text, index, startChar, endChar})
│
├── Step 3: loadStandards() → filter by contractType
│   └── Returns: StandardClause[] (10 for NDA, 18 for SaaS, cached after first load)
│
├── Step 4: getEmbeddings(clauseTexts)
│   └── Returns: number[][] (one 1536-dim vector per clause, via OpenAI API)
│
├── Step 5: For each clause:
│   ├── findBestMatch(embedding, filteredStandards) → closest standard + similarity score
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
    ├── Use user-selected contract type label
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

The app has a single page (`src/app/page.tsx`) with 5 view states:

```
select-type → upload → analyzing → report
                                ↘ error
```

| State | What's Shown |
|-------|-------------|
| `select-type` | Hero section ("Is This Clause Normal?"), contract type selection cards (NDA, SaaS Agreement), 3-step how-it-works |
| `upload` | Selected type badge, drag-and-drop zone, "Change Type" back button |
| `analyzing` | Spinning loader, animated step list (parsing, embedding, comparing, explaining) |
| `report` | Summary bar (risk score, green/yellow/red counts), split-pane document viewer + detail panel |
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
- Body: `file` field containing the uploaded document, `contractType` field (`"nda"` or `"saas"`)

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
| `src/lib/llm-scorer.ts` | ~100 | Gemini 2.5 Pro integration. LLM-based severity scoring — judges functional equivalence of each clause against its matched standard. |
| `src/lib/explainer.ts` | ~145 | Gemini 2.5 Pro integration. Generates flag-source-specific plain-English explanations for flagged clauses. |
| `src/lib/analyzer.ts` | ~70 | Orchestrator. Accepts contract type, filters standards, ties pipeline together: parse, segment, embed, compare, score, explain, report. |

### Data Layer

| File | Purpose |
|------|---------|
| `src/data/standards.json` | 45 standard clause templates with pre-computed embeddings. Sourced from Common Paper (NDA) and Bonterms (SaaS), covering both substantive and boilerplate clauses. |
| `src/data/standards-loader.ts` | Loads and caches standards.json in memory. |
| `src/types/index.ts` | All TypeScript type definitions (ContractType, StandardClause, ExtractedClause, ClauseAnalysis, AnalysisReport, etc.). |
| `scripts/seed-standards.ts` | Seed script. Defines all standard clause templates with source provenance, calls OpenAI to compute embeddings, writes standards.json. |

### Frontend

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main page. Manages select-type, upload, analyzing, report, error view states. |
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
| Gemini 2.5 Pro (scoring) | ~$0.005-0.015 | All clauses scored, batched by 5 |
| Gemini 2.5 Pro (explanations) | ~$0.003-0.010 | Only for flagged clauses |
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

1. **Not legal advice** — Standard clause templates are sourced from authoritative open-source agreements (Common Paper, Bonterms) but have not been independently reviewed by a licensed attorney for this specific application.
2. **No OCR** — Image-only PDFs (scanned documents) will fail. Only text-layer PDFs are supported.
3. **English only** — All templates and rules are in English.
4. **No jurisdiction awareness** — The same standards are applied regardless of legal jurisdiction. A non-compete that's standard in Delaware may be unenforceable in California.
5. **2 contract types** — Only NDA and SaaS agreements have standard templates. Employment agreements are planned (sourced from CUAD dataset).
6. **Segmentation assumes well-formatted contracts** — Contracts without clear section headers may segment poorly.
7. **Single anchor per category** — Each clause category currently has one reference point. Adding variant entries from CUAD would expand matching coverage.

### Future Improvements

- Employment agreement support (sourced from CUAD real-world clauses)
- More contract types (rental/lease, freelance, partnership, terms of service)
- CUAD dataset variants for multi-anchor matching per category
- Common Paper CSA variants for SaaS categories (dual-source coverage)
- Jurisdiction-specific analysis (e.g., California non-compete rules)
- OCR support for scanned PDFs
- Side-by-side diff view (uploaded clause vs. standard)
- Exportable PDF report
- Multi-language support
- User-customizable thresholds and rules
