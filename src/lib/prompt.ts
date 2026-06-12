import { AppData } from '@/types'
import { GOVT_WARNING } from './warning-check'

export { GOVT_WARNING }

export function buildVerificationPrompt(appData: AppData): string {
  return `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label compliance checker.

Analyze this alcohol beverage label image and compare it against the application data provided below.

APPLICATION DATA:
- Brand Name: ${appData.brand || '(not provided)'}
- Class/Type: ${appData.classType || '(not provided)'}
- Alcohol Content: ${appData.abv || '(not provided)'}
- Net Contents: ${appData.net || '(not provided)'}
- Producer/Bottler: ${appData.producer || '(not provided)'}
- Country of Origin: ${appData.origin || '(not provided)'}
- Beverage Type: ${appData.type}

IMAGE QUALITY GATE (check this FIRST):
If the image is too blurry, glared, angled, dark, or low-resolution to read the label text reliably, do NOT guess. Set overallStatus to "unreadable", explain what makes it unreadable in overallSummary, and set every check's status to "missing" with labelValue null. A wrong extraction is worse than asking the agent for a better photo.

MATCHING RULES (for all fields EXCEPT the government warning):
- Use judgment for minor formatting differences (e.g. "STONE'S THROW" vs "Stone's Throw" = WARN, not FAIL — note it's a case difference)
- Hard FAIL: wrong numbers (ABV, net contents off by any amount), completely different brand name
- WARN: case differences, minor punctuation differences, stylistic variations that don't change meaning
- PASS: matches exactly or with trivial whitespace differences
- MISSING: field cannot be found on the label at all
- If a field was not provided in the application data, mark status "pass" with note "Not specified in application"

GOVERNMENT WARNING — EXTRACTION ONLY, DO NOT JUDGE:
For the "Government warning statement" check, your ONLY job is transcription. Set labelValue to the warning text EXACTLY as printed on the label — verbatim, character for character, preserving the original capitalization, punctuation, and numbering. Do not correct it, do not normalize it, do not omit anything. If no warning appears on the label, set labelValue to null. Set status to "pass" and leave note empty — the exactness judgment is performed separately by deterministic code, not by you.

Respond ONLY with valid JSON, no markdown fences, no preamble, no trailing text. Keep it COMPACT — overallSummary one short sentence, notes only when status is not "pass" and at most ~12 words. Do NOT repeat the application data back; output only what you read from the label:
{
  "overallStatus": "pass" | "warn" | "fail" | "unreadable",
  "overallSummary": "One short sentence",
  "checks": [
    {
      "field": "Brand name",
      "status": "pass" | "warn" | "fail" | "missing",
      "labelValue": "text extracted from the label, or null if not found",
      "note": "only if status is warn/fail/missing; brief"
    }
  ]
}

Include a check for every field: Brand name, Class/type, Alcohol content, Net contents, Producer/bottler, Country of origin, Government warning statement.`
}
