@AGENTS.md

# ClauseGuard

Contract clause analyzer that flags unusual or aggressive clauses compared to industry standards using semantic embeddings + rule-based detection.

## Documentation

- **[docs/PRD.md](docs/PRD.md)** — Product requirements document. Problem statement, solution overview, target users, user flow, tech stack, architecture, judging criteria alignment. Update when scope, goals, or user flow changes.
- **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)** — Comprehensive technical implementation guide. Covers every component in detail: parsing, segmentation, embeddings, comparison engine, rule engine, scoring, LLM explanations, frontend, API, costs, limitations. Update when any core algorithm, threshold, rule, or architectural pattern changes.

## Key Technical Context

- **Dual detection:** Embeddings (cosine similarity vs 28 lawyer-drafted standard clause templates) + 15 aggressive pattern rules. LLM (Gemini Flash) is only for explanations, not scoring.
- **Standard clause sources:** Common Paper Mutual NDA v1.0 (CC BY 4.0) for NDA, Bonterms Cloud Terms v1.0 (CC BY 4.0) for SaaS. Each entry tracks `source`, `sourceRef`, and `role` (anchor/variant).
- **Standard clause DB:** `src/data/standards.json` — 28 pre-embedded templates (10 NDA + 18 SaaS). Regenerate with `DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/seed-standards.ts`
- **Contract type selection:** User selects NDA or SaaS before uploading. Standards are filtered by selected type during comparison.
- **Scoring thresholds:** Green >= 0.82, Yellow >= 0.65, Red < 0.65 (configurable in `src/lib/scoring.ts`)
- **API keys:** `.env.local` — OPENAI_API_KEY (embeddings), GEMINI_API_KEY (explanations)
- **pdf-parse quirk:** Requires `test/data/05-versions-space.pdf` dummy file to exist at import time

## When Updating

- New standard clauses -> update `scripts/seed-standards.ts`, re-run seed script, update IMPLEMENTATION.md Section 5
- New aggressive rules -> update `src/lib/rules.ts`, update IMPLEMENTATION.md Section 7
- Threshold changes -> update `src/lib/scoring.ts`, update IMPLEMENTATION.md Section 8
- New contract types -> add to `ContractType` in `src/types/index.ts`, add to seed script, add to `CONTRACT_TYPE_LABELS` in `src/lib/analyzer.ts`, add to `CONTRACT_OPTIONS` in `src/app/page.tsx`, update both docs
- UI changes -> update IMPLEMENTATION.md Section 12
- API changes -> update IMPLEMENTATION.md Section 13
