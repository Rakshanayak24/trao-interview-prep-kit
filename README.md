# Trao Prep — interview preparation kits

Trao Prep turns a pasted job description and company URL into an evidence-led interview preparation kit: company brief, role requirements, requirement-linked questions, flashcards, coverage report, and an exactly-sized study schedule.

## Stack

Next.js 15 + Tailwind CSS power the responsive client. Express provides the API. MongoDB Atlas is used automatically when `MONGODB_URI` is configured; clean-clone evaluator runs use a JSON fallback through the same storage interface. Node 20+ is required.

## Setup and local run

In PowerShell, from the repository root:

```powershell
npm.cmd install
# Run only once, when .env does not already exist:
Copy-Item .env.example .env
npm.cmd run dev
```

Open `http://localhost:3000`. The API health endpoint is `http://localhost:4000/health`.

For local development, leave `MONGODB_URI=` empty in `.env`; the app will persist to `data/store.json`.

## Testing and evaluation

Run these commands separately in PowerShell:

```powershell
# Unit tests: extraction, coverage, scheduling, schema validation, and robots rules
npm.cmd test

# Production compilation check
npm.cmd run build

# Required Appendix-B batch evaluation with the included demo case
npm.cmd run evaluate -- --input examples/demo-case.json --output kits.json
```

The batch evaluator uses the same pipeline as the web API and writes one result per input case. Inspect `kits.json`: each entry is either `status: "ok"` with a kit or a structured failure, so one unreachable company does not abort the run.

## Architecture and generation sequence

`server/research.js` validates URLs, blocks private/loopback targets in production, uses timeout/retry/backoff, reads `robots.txt`, follows same-origin links ranked for hiring/about signals, limits content size, and seeks public interview-process discussion. Missing sources create warnings rather than fabricated claims.

`server/kit.js` extracts requirements only from the pasted JD, marks must versus nice from posting language, validates the exact kit shape, computes coverage, and allocates the schedule deterministically. `server/pipeline.js` composes: research → extraction → category-specific questions → coverage check → gap pass → validation → schedule. Stable requirement/question IDs make coverage auditable.

With `OPENAI_API_KEY`, `server/llm.js` enriches each question category independently through OpenAI-compatible Chat Completions, requests JSON, retries transient errors, and safely falls back to deterministic questions. The model never decides requirements, priorities, coverage, or scheduling.

## Builder and practice

Question edits record `state: edited`; hand-added records are `pinned`. Category regeneration replaces only generated questions, preserving user work. The builder supports inline editing, add/delete, reorder, category changes, and section-level regeneration. Practice tracks 1–3 confidence; **Weak spots** orders unreviewed and low-confidence cards first.

Fetched and pasted text is always reference content, not instructions. The crawler applies content-type/size limits, retry limits, robots handling, and SSRF protections.

## Deployment

Deploy the Express API using `render.yaml` as a starting point. Configure `PORT`, `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN`, `MONGODB_URI`, `MONGODB_DB`, and optional `OPENAI_API_KEY`. Deploy the Next app using `vercel.json`, then set `NEXT_PUBLIC_API_URL` to the public API URL.

Verify `/health`, registration, kit generation, persistence after restart, and the batch command from a clean clone before submission.

## Demo scenario

Use the prefilled realistic Senior Full-Stack / Developer Experience scenario and `https://about.gitlab.com` for the walkthrough. The equivalent batch input is [examples/demo-case.json](examples/demo-case.json). Follow [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the 3–4 minute recording.
