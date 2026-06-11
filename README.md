# TTB Label Verifier

AI-powered alcohol label compliance verification for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance agents.

**Live demo:** https://ttb-label-verifier-pi.vercel.app

## What it does

Upload a label image and enter application data (brand name, ABV, net contents, etc.) — the app uses Claude's vision to extract what's actually on the label and compare it against the COLA application, flagging any discrepancies.

**Key features:**

- Single label verification with full field-by-field breakdown
- Batch upload — up to 300 labels processed concurrently (5 at a time)
- **Deterministic government warning check** — the AI transcribes the warning verbatim; exactness is judged by code with a word-level diff against the statutory text (27 CFR Part 16), rendered visually so agents see exactly which words deviate
- Fuzzy/semantic matching with judgment for other fields — case differences become warnings, not hard failures
- **Image quality gate** — blurry, glared, or angled photos return "Image unreadable" instead of a guessed extraction
- **Per-label timing** displayed on every result (target: under 5 seconds)
- **CSV export and PDF audit report** — one page per label with thumbnail, field table, and status, for case files and document retention
- Pass / Review needed / Rejected / Unreadable outcomes per label
- Clean, accessible UI designed for non-technical users

## Requirements traceability

Every design decision maps to something a stakeholder said in discovery:

| Stakeholder input | Design response |
|---|---|
| **Sarah:** "If we can't get results back in about 5 seconds, nobody's going to use it" | Per-label verification time measured and displayed on every result card; batch concurrency tuned so individual labels stay fast |
| **Sarah:** "We need something my mother could figure out… Clean, obvious, no hunting for buttons" | Three tabs, one primary action per screen, large drop zones, plain-language status labels ("Approved", "Review needed", "Rejected") |
| **Sarah / Janet:** "Importers dump 200, 300 label applications on us at once… handle batch uploads" | Batch tab accepts up to 300 images with live per-thumbnail progress |
| **Dave:** "'STONE'S THROW' vs 'Stone's Throw'… You need judgment" | Non-warning fields use semantic matching: case/punctuation differences are flagged for review, not auto-rejected |
| **Jenny:** "The warning has to be exact… 'Government Warning' in title case instead of all caps. Rejected." | Warning check is deterministic code, not AI judgment: word-for-word comparison plus an explicit all-caps prefix check, with a visual diff. Test label #2 reproduces Jenny's exact title-case catch |
| **Jenny:** "Labels photographed at weird angles, or the lighting is bad, or there's glare" | Image quality gate: the model is instructed to return "unreadable" rather than guess; agents are told to request a better image |
| **Marcus:** "Our network blocks outbound traffic to a lot of domains" | Single external dependency (Anthropic API over HTTPS), documented below; no scattered third-party ML endpoints. A production deployment would need `api.anthropic.com` allowlisted — one firewall rule |
| **Marcus:** "PII considerations, document retention policies" | No image or result storage server-side; PDF/CSV export gives agents a local audit artifact compatible with existing retention processes |

## Why the warning check is code, not AI

The single most consequential design decision in this prototype: **the LLM transcribes, the code judges.**

For brand names and producer addresses, human-like judgment is the right tool — that's what the AI provides. But the government warning is a statutory exact-match requirement, and "the model felt it matched" is not an acceptable basis for a federal compliance decision. So the pipeline is:

1. Claude extracts the warning text **verbatim** from the image (perception)
2. Server-side code runs an LCS word-level diff against the statutory text, case-insensitive on the body, with a strict all-caps check on the "GOVERNMENT WARNING:" prefix (compliance)
3. The UI renders the diff — missing words struck through, unexpected words highlighted — so the agent sees precisely what deviates

This is reproducible, explainable, and auditable in a way a pure LLM judgment is not. See `src/lib/warning-check.ts`.

## Cost at scale

At current API pricing, a label verification costs roughly **$0.01–0.02 per label**. TTB processes ~150,000 label applications per year; running every single one through this tool would cost approximately **$1,500–3,000/year** in API spend. Against 47 agents spending (per Sarah) "half their day doing what's essentially data entry verification," the economics are not close.

## Test label suite

The [`test-labels/`](test-labels/) folder contains seven generated labels covering every outcome the app can produce — clean pass, title-case warning prefix, modified warning wording, missing warning, brand case mismatch, ABV mismatch, and an unreadable blurry image — with a [test matrix](test-labels/README.md) listing the application data to enter and the expected result for each. You can exercise the full app in about two minutes.

## Local setup

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/phroiland/ttb-label-verifier.git
cd ttb-label-verifier

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 4. Run the development server
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In the Vercel dashboard, go to **Settings → Environment Variables**
4. Add: `ANTHROPIC_API_KEY` = your key
5. Click **Deploy**

That's it — Vercel handles the rest. The API key stays server-side and is never exposed to the browser.

## Architecture

```
src/
  app/
    page.tsx           # Main React UI (tabs: single / batch / results)
    page.module.css    # Scoped styles
    globals.css        # CSS variables + resets
    layout.tsx         # Root layout + jsPDF loader
    api/
      verify/
        route.ts       # POST /api/verify — Claude vision extraction + deterministic warning check
  lib/
    prompt.ts          # Verification prompt (extraction rules, image quality gate)
    warning-check.ts   # Deterministic statutory warning comparison + LCS word diff
    export.ts          # CSV export + multi-page PDF audit report (jsPDF)
  types.ts             # Shared TypeScript types
test-labels/           # Generated test suite + expected-results matrix
```

**Data flow:**

1. User uploads image(s) + fills in application data fields
2. Frontend converts image to base64 and sends to `/api/verify`
3. API route calls claude-opus-4-5 with the image + a structured compliance prompt
4. Claude extracts each field; for the government warning it transcribes verbatim only
5. Server code runs the deterministic warning comparison, computes the word diff, and recomputes the overall status
6. Result JSON (overall status + per-field checks + warning diff + timing) is returned and rendered

**Security:** The Anthropic API key lives in `process.env.ANTHROPIC_API_KEY` on the server. It is never sent to the browser. Image data travels from browser → Next.js API route → Anthropic, and is not stored anywhere.

## Approach, tools, and assumptions

**Approach:** Split the problem by what each tool is good at. The AI vision model handles perception (reading messy real-world label images) and human-like judgment (is "Old Tom's Distillery" the same brand as "OLD TOM DISTILLERY"?). Deterministic code handles compliance rules that have exact statutory answers (the government warning). This hybrid keeps the system explainable where it must be and flexible where it should be.

**Tools used:**

- claude-opus-4-5 (Anthropic) — vision model for label extraction and semantic field comparison
- Next.js 14 — React framework with API routes for server-side key management
- TypeScript — type safety across frontend and backend
- jsPDF — client-side PDF report generation
- Vercel — deployment platform
- PIL (Python) — test label generation

**Assumptions made:**

- Label images are provided as uploads (not fetched from URLs), consistent with an agent's local workflow
- Batch mode uses shared application data across all labels; per-label data would require a CSV import feature (noted as future work)
- The government warning text is fixed to the current statutory requirement in `src/lib/warning-check.ts`
- Bold-type detection for the warning prefix is out of scope (capitalization is checked; reliable bold detection from arbitrary photos requires typography analysis beyond a prototype)
- This is a standalone prototype — no integration with the live COLA system, which would require TTB authorization
- No authentication is implemented; a production deployment would require an auth layer

## Technical decisions & trade-offs

**Why Next.js?** API routes give us a server-side proxy so the API key never leaves the server — critical for any real deployment. The framework also makes Vercel deployment trivial.

**Why base64 over URL?** Label images may be local files or from internal systems with no public URL. Base64 works universally at the cost of slightly larger request payloads (acceptable for label images, typically under 2 MB).

**Concurrency = 5 for batch.** Balances throughput vs. Anthropic rate limits. Agents processing 300 labels will see all results within ~2–3 minutes, with each individual label staying within the 5-second window. Easily tunable.

**Fuzzy matching is Claude's job — except the warning.** For most fields the prompt instructs the model to apply judgment, the same way a human agent does. The government warning is the exception: extraction by AI, judgment by code (see above).

**Client-side exports.** CSV and PDF are generated entirely in the browser — no server storage, no retention surface, and the export works even if the agent is offline after verification.

**Known limitations / future work:**

- Per-label application data in batch mode (currently uses shared defaults)
- CSV import for batch application data
- Bold-type detection on the warning prefix
- Integration with COLA system (requires TTB authorization — out of scope for prototype)
- Authentication layer before any production deployment

## Questions?

See the [TTB label requirements](https://www.ttb.gov/labeling) for the full regulatory context.
