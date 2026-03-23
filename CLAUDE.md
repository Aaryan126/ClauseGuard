@AGENTS.md

# ClauseGuard

Contract clause analyzer that flags unusual or aggressive clauses compared to industry standards using semantic embeddings + rule-based detection.

## Documentation

- **[docs/PRD.md](docs/PRD.md)** — Product requirements document. Problem statement, solution overview, target users, user flow, tech stack, architecture, judging criteria alignment. Update when scope, goals, or user flow changes.
- **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)** — Comprehensive technical implementation guide. Covers every component in detail: parsing, segmentation, embeddings, comparison engine, rule engine, scoring, LLM explanations, frontend, API, costs, limitations. Update when any core algorithm, threshold, rule, or architectural pattern changes.

## Key Technical Context

- **Three-layer detection:** Embeddings (cosine similarity for finding closest standard match) → LLM scoring (Gemini 2.5 Pro judges functional equivalence — replaces rigid similarity thresholds) → 15 aggressive pattern rules with 3 tiers (critical/serious/caution). LLM also generates explanations for flagged clauses.
- **Rule tiers:** Critical rules (unlimited liability, blanket IP, unilateral amendment) always override to red. Serious rules (non-compete scope/duration, unilateral termination) respect embedding — green→yellow not red. Caution rules (all yellow rules + no compelled disclosure) never escalate severity, shown as informational. Caution rules (all yellow rules) never escalate severity, shown as informational.
- **Standard clause sources:** Common Paper Mutual NDA v1.0 (CC BY 4.0) for NDA, Bonterms Cloud Terms v1.0 (CC BY 4.0) for SaaS, Bonterms PSA v1.2 (CC BY 4.0) for Consulting. Each entry tracks `source`, `sourceRef`, and `role` (anchor/variant).
- **Standard clause DB:** `src/data/standards.json` — 68 pre-embedded templates (16 NDA + 29 SaaS + 23 Consulting). Regenerate with `DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/seed-standards.ts`
- **Contract type selection:** User selects NDA or SaaS before uploading. Standards are filtered by selected type during comparison.
- **Scoring:** LLM (Gemini 2.5 Pro) judges each clause as green/yellow/red based on functional equivalence to the matched standard. Embedding similarity thresholds (0.82/0.65) are fallback only. Rule tiers can override LLM scores.
- **API keys:** `.env.local` — OPENAI_API_KEY (embeddings), GEMINI_API_KEY (LLM scoring + explanations)
- **pdf-parse quirk:** Requires `test/data/05-versions-space.pdf` dummy file to exist at import time

## When Updating

- New standard clauses -> update `scripts/seed-standards.ts`, re-run seed script, update IMPLEMENTATION.md Section 5
- New aggressive rules -> update `src/lib/rules.ts` (include `tier` field), update IMPLEMENTATION.md Section 7
- Rule tier changes -> update tier assignment in `src/lib/rules.ts`, update IMPLEMENTATION.md Section 7 tier table
- Threshold changes -> update `src/lib/scoring.ts`, update IMPLEMENTATION.md Section 8
- New contract types -> add to `ContractType` in `src/types/index.ts`, add to seed script, add to `CONTRACT_TYPE_LABELS` in `src/lib/analyzer.ts`, add to `CONTRACT_OPTIONS` in `src/app/page.tsx`, update both docs
- UI changes -> update IMPLEMENTATION.md Section 12
- API changes -> update IMPLEMENTATION.md Section 13
