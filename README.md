# TTB Label Verifier

AI-powered alcohol label compliance verification for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance agents.

**Live demo:** https://ttb-label-verifier-pi.vercel.app

## What it does

Upload a label image and enter application data (brand name, ABV, net contents, etc.) — the app uses Claude's vision to extract what's actually on the label and compare it against the COLA application, flagging any discrepancies.

**Key features:**
- Single label verification with full field-by-field breakdown
- Batch upload — up to 300 labels processed concurrently (5 at a time)
- Exact government warning statement checking (word-for-word, GOVERNMENT WARNING: must be all-caps)
- Fuzzy/semantic matching with judgment — case differences become warnings, not hard failures
- Pass / Review needed / Rejected outcomes per label
- Clean, accessible UI designed for non-technical users
- Fast: typically 2–4 seconds per label using Claude claude-opus-4-5

---

## Local setup

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/ttb-label-verifier.git
cd ttb-label-verifier

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In the Vercel dashboard, go to **Settings → Environment Variables**
4. Add: `ANTHROPIC_API_KEY` = your key
5. Click **Deploy**

That's it — Vercel handles the rest. The API key stays server-side and is never exposed to the browser.

---

## Architecture

```
src/
  app/
    page.tsx           # Main React UI (tabs: single / batch / results)
    page.module.css    # Scoped styles
    globals.css        # CSS variables + resets
    layout.tsx         # Root layout + metadata
    api/
      verify/
        route.ts       # POST /api/verify — single label → Claude vision → JSON result
  lib/
    prompt.ts          # Shared verification prompt + TTB government warning constant
  types.ts             # Shared TypeScript types
```

**Data flow:**
1. User uploads image(s) + fills in application data fields
2. Frontend converts image to base64 and sends to `/api/verify`
3. API route calls Claude claude-opus-4-5 with the image + a structured compliance prompt
4. Claude extracts each required field from the label and compares against application data
5. Result JSON (overall status + per-field checks) is returned and rendered

**Security:** The Anthropic API key lives in `process.env.ANTHROPIC_API_KEY` on the server. It is never sent to the browser. Image data travels from browser → Next.js API route → Anthropic, and is not stored anywhere.

---

## Technical decisions & trade-offs

**Why Next.js?** API routes give us a server-side proxy so the API key never leaves the server — critical for any real deployment. The framework also makes Vercel deployment trivial.

**Why base64 over URL?** Label images may be local files or from internal systems with no public URL. Base64 works universally at the cost of slightly larger request payloads (acceptable for label images, typically under 2 MB).

**Concurrency = 5 for batch.** Balances throughput vs. Anthropic rate limits. Agents processing 300 labels will see all results within ~2–3 minutes. Easily tunable.

**Fuzzy matching is Claude's job.** Rather than implementing complex string-matching logic, the prompt instructs the model to apply judgment — same approach a human agent uses. This handles edge cases like "STONE'S THROW" vs "Stone's Throw" naturally.

**Government warning is checked exactly.** The TTB-required text is hardcoded in `src/lib/prompt.ts`. Any deviation in wording is a hard FAIL; the model is instructed to check word-for-word.

**Known limitations / future work:**
- Per-label application data in batch mode (currently uses shared defaults)
- CSV import for batch application data
- Export results to CSV/PDF for audit trail
- Integration with COLA system (requires TTB authorization — out of scope for prototype)
- Authentication layer before any production deployment

---

## Testing

For test labels, TTB's public COLA database has thousands of approved labels. AI image generation tools (e.g. DALL-E, Midjourney) work well for generating synthetic test cases with specific compliance issues.

Suggested test cases:
- ✅ Correct label matching all fields
- ⚠️ Brand name in different case than application
- ✗ Missing or modified government warning
- ✗ ABV mismatch (e.g. 40% on label, 45% in application)
- ✗ Net contents mismatch

---

## Questions?

See the [TTB label requirements](https://www.ttb.gov/labeling) for the full regulatory context.
