# ClauseGuard — Product Requirements Document

## One-Liner
Upload a contract, instantly see which clauses are standard, which need review, and which are aggressive — compared to real industry norms.

---

## Problem Statement

Every day, freelancers, small business owners, and individuals sign contracts they don't fully understand. Legal review costs $300-500/hour. Most people just sign and hope for the best.

The specific problem: **people can't tell if a clause is "normal" or unusually aggressive**. A non-compete clause might look like standard boilerplate, but actually have a 5-year worldwide scope that no reasonable contract would include. Without legal expertise or a reference point, there's no way to know.

Existing AI tools (ChatGPT, generic "summarize my contract" apps) can read clauses, but they have no concept of what's *normal*. They summarize what's there, but can't tell you if it's unusual compared to industry standards.

---

## Solution

ClauseGuard is a contract clause analyzer that **compares each clause against a curated database of industry-standard clause templates** using semantic embeddings. It flags deviations with a traffic-light system and explains — in plain English — what's unusual and what "normal" looks like.

### Key Differentiator
The analysis is **data-driven, not vibes-driven**. Instead of asking an LLM "does this look aggressive?", we:
1. Embed each clause and each standard template as vectors
2. Find the closest standard match using cosine similarity
3. Quantify the deviation mathematically
4. Layer on rule-based detection for specific aggressive patterns
5. Only then use an LLM to *explain* the findings in plain English

This means the traffic-light scores are **reproducible and defensible** — the same clause will always get the same score against the same baseline.

---

## Target Users
- Freelancers signing client contracts
- Small business owners reviewing vendor agreements
- Individuals signing employment contracts, NDAs, or leases
- Anyone who wants a "second opinion" before signing

---

## How It Works (User Flow)

1. **Select Type** — User selects their contract type (NDA or SaaS Agreement)
2. **Upload** — User drops a PDF, DOCX, or TXT contract file
3. **Parse** — System extracts text from the document
4. **Segment** — Contract is split into individual clauses using structural analysis (section headers, numbered paragraphs)
5. **Embed** — Each clause is converted to a semantic vector using OpenAI's text-embedding-3-small
6. **Compare** — Each clause vector is compared against pre-computed vectors of 28 lawyer-drafted standard clause templates (filtered by selected type) via cosine similarity
7. **Rule Check** — 15 aggressive pattern rules (regex + keyword) check for specific dangers like "non-compete > 2 years" or "unlimited liability"
8. **Score** — Each clause gets a traffic-light rating:
   - **Green (≥ 82% match)** — Standard clause, consistent with industry norms
   - **Yellow (65-81% match)** — Unusual deviation, worth reviewing carefully
   - **Red (< 65% match)** — Significantly different from any standard, or matches an aggressive pattern
9. **Explain** — For yellow and red clauses, Gemini 2.0 Flash generates a plain-English explanation of the risk and what "normal" looks like
10. **Report** — User sees a summary dashboard + clause-by-clause breakdown

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend + Backend | Next.js 14+ (App Router) | Single deployment, API routes built in |
| UI Framework | Tailwind CSS + shadcn/ui | Polished, accessible components |
| Embeddings | OpenAI text-embedding-3-small | $0.02/MTok, high quality, 1536 dimensions |
| Vector Storage | In-memory (JSON file) | No database to provision, instant lookups for <100 standard clauses |
| LLM Explanations | Gemini 2.0 Flash | Fast, cheap, good quality for plain-English explanations |
| Document Parsing | officeparser | Handles PDF + DOCX natively |
| Deployment | Vercel | Free tier, zero-config for Next.js |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│                                                          │
│  Upload Page ──→ Analysis Loading ──→ Report View        │
│  (drag & drop)   (progress steps)    (traffic lights,    │
│                                       clause cards,      │
│                                       explanations)      │
└─────────────────────────┬────────────────────────────────┘
                          │ POST /api/analyze
                          ▼
┌──────────────────────────────────────────────────────────┐
│                    API ROUTE (/api/analyze)               │
│                                                          │
│  1. Parse document (officeparser)                        │
│  2. Segment into clauses (regex + structure detection)   │
│  3. Generate embeddings (OpenAI API)                     │
│  4. Compare against standard clause DB (cosine sim)      │
│  5. Run aggressive pattern rules (regex/keyword)         │
│  6. Score each clause (green/yellow/red)                 │
│  7. Explain flagged clauses (Gemini 2.0 Flash)           │
│  8. Return full report as JSON                           │
└──────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
     ┌────────────┐ ┌──────────┐ ┌───────────┐
     │ Standard   │ │ OpenAI   │ │ Gemini    │
     │ Clause DB  │ │ Embed    │ │ Flash     │
     │ (JSON +    │ │ API      │ │ API       │
     │ embeddings)│ │          │ │           │
     └────────────┘ └──────────┘ └───────────┘
```

---

## Standard Clause Database

The heart of the system. 28 lawyer-drafted standard clause templates sourced from authoritative open-source contract standards, with pre-computed embedding vectors.

### Sources
- **Common Paper Mutual NDA v1.0** (CC BY 4.0) — 40+ attorney committee, YC-backed
- **Bonterms Cloud Terms v1.0** (CC BY 4.0) — 120+ lawyer committee

### Contract Types Supported
1. **Non-Disclosure Agreement (NDA)** — 10 clauses from Common Paper
2. **SaaS / Software Service Agreement** — 18 clauses from Bonterms

### NDA Categories (10)
Definitions, obligations, exclusions, required disclosures, term/termination, return of materials, equitable relief, non-solicitation, governing law, amendment

### SaaS Categories (18)
Term/renewal, termination (convenience + cause), liability, indemnification, data protection, SLA/uptime, payment, IP ownership, confidentiality, warranty, force majeure, assignment, governing law, amendments, suspension, data export/deletion, usage restrictions

### Each Standard Clause Entry Contains:
- `id` — Unique identifier (e.g., "nda-definition-001")
- `contractType` — Which contract type it belongs to
- `category` — Clause category (e.g., "termination", "liability")
- `clauseName` — Human-readable name
- `standardText` — The actual standard clause text (verbatim from source)
- `summary` — 1-2 sentence plain-English summary
- `embedding` — Pre-computed 1536-dimension vector
- `aggressiveIndicators` — Keywords that signal aggressive variants
- `normalRange` — Description of what's considered acceptable
- `source` — Provenance (common-paper, bonterms, cuad, manual)
- `sourceRef` — Specific section reference (e.g., "Common Paper Mutual NDA v1.0 §2")
- `role` — anchor (primary template) or variant (additional real-world wording)

---

## Aggressive Pattern Detection (Rule Engine)

15 pattern rules that catch specific dangers embeddings might miss:

### RED Severity (High Risk)
- Non-compete duration > 2 years
- Worldwide non-compete scope
- Unlimited liability
- Unilateral termination without cause
- Blanket IP assignment including pre-existing IP
- Unilateral amendment rights
- No carve-out for legally compelled disclosure

### YELLOW Severity (Review Recommended)
- No cure period for breach
- Auto-renewal without opt-out notice
- Payment terms > Net 90
- Perpetual confidentiality obligation
- Waiver of jury trial
- One-sided arbitration venue
- Class action waiver
- Immediate termination for convenience

Rule hits **override** embedding scores — a clause that matches a standard template but contains "unlimited liability" will still be flagged red.

---

## Scoring System

### Per-Clause Score
```
Final Score = worst(Embedding Similarity Score, Rule Hit Severity)
```

- Embedding similarity ≥ 0.82 → Green
- Embedding similarity 0.65–0.81 → Yellow
- Embedding similarity < 0.65 → Red
- Any RED rule hit → Red (regardless of embedding score)
- Any YELLOW rule hit + Green embedding → Yellow

### Overall Risk Score (0-100)
Weighted average across all clauses:
- Green clauses contribute 0 points
- Yellow clauses contribute 40 points
- Red clauses contribute 100 points

Score = sum of weights / number of clauses

---

## Project Structure

```
clauseguard/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Main page (upload → analyze → report)
│   │   ├── layout.tsx               # Root layout
│   │   └── api/analyze/route.ts     # Analysis API endpoint
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── upload-zone.tsx          # Drag-and-drop file upload
│   │   ├── analysis-progress.tsx    # Loading state animation
│   │   ├── report-summary.tsx       # Risk score dashboard
│   │   ├── clause-card.tsx          # Individual clause with traffic light
│   │   └── traffic-light.tsx        # Green/yellow/red indicator
│   ├── lib/
│   │   ├── parser.ts               # PDF/DOCX → raw text
│   │   ├── segmenter.ts            # Raw text → individual clauses
│   │   ├── embeddings.ts           # OpenAI embedding API wrapper
│   │   ├── comparison.ts           # Cosine similarity + matching
│   │   ├── rules.ts                # Aggressive pattern detection (15 rules)
│   │   ├── analyzer.ts             # Orchestrator (full pipeline)
│   │   ├── explainer.ts            # Gemini Flash explanations
│   │   └── scoring.ts              # Traffic-light scoring logic
│   ├── data/
│   │   ├── standards.json          # Standard clause DB + embeddings
│   │   └── standards-loader.ts     # Loads + caches standards
│   └── types/
│       └── index.ts                # TypeScript type definitions
├── scripts/
│   └── seed-standards.ts           # Script to compute embeddings for standards
├── docs/
│   └── PRD.md                      # This document
├── .env.local                      # API keys (not committed)
└── .env.example                    # Template for API keys
```

---

## Implementation Phases

### Phase 1 — Foundation ✅ DONE
- Next.js project with TypeScript, Tailwind, shadcn/ui
- Upload page with drag-and-drop
- Document parser, clause segmenter
- Embeddings module, comparison engine, scoring engine
- 15 aggressive pattern rules
- Gemini Flash explainer
- Full analysis pipeline orchestrator
- API route + all UI components
- Builds and type-checks cleanly

### Phase 2 — Standard Clause Database (Current)
- Generate ~60-75 standard clauses across 3 contract types
- Compute and store embeddings via OpenAI
- This is the baseline the comparison engine compares against

### Phase 3 — Integration Testing
- Test the full pipeline end-to-end with real contracts
- Tune similarity thresholds
- Verify rule detection accuracy

### Phase 4 — UI Polish
- Summary dashboard with risk visualization
- Loading states, animations
- Download report feature
- Responsive design

### Phase 5 — Ship
- README with screenshots
- Deploy to Vercel
- Record demo video
- Final testing

---

## Judging Criteria Alignment

| Criteria | How We Score |
|----------|-------------|
| **Innovation & Creativity** | Embedding-based comparison engine is novel — not just an LLM wrapper. Dual detection (embeddings + rules) is a genuine technical contribution. |
| **Technical Implementation** | Clean architecture, typed throughout, separation of concerns, real algorithmic work (cosine similarity, threshold calibration). |
| **Real-World Impact** | Access-to-justice problem — helps people who can't afford lawyers understand what they're signing. |
| **Scalability & Feasibility** | Easy to add more contract types, more rules, more standard clauses. Architecture supports growth. |
| **Presentation & Clarity** | Traffic-light UI is immediately intuitive. Demo tells a clear story: upload → red flags → explanations. |
