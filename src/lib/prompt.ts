import { AppData } from '@/types'

export const GOVT_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'

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

REQUIRED GOVERNMENT WARNING (must appear word-for-word, with "GOVERNMENT WARNING:" in ALL CAPS and bold):
"${GOVT_WARNING}"

INSTRUCTIONS:
For each field, extract what is visible on the label and compare to the application data.

Matching rules:
- Use judgment for minor formatting differences (e.g. "STONE'S THROW" vs "Stone's Throw" = WARN, not FAIL — note it's a case difference)
- Hard FAIL: wrong numbers (ABV, net contents off by any amount), completely different brand name, missing or materially incorrect government warning
- WARN: case differences, minor punctuation differences, stylistic variations that don't change meaning
- PASS: matches exactly or with trivial whitespace differences
- MISSING: field cannot be found on the label at all
- If a field was not provided in the application data, mark status "pass" with note "Not specified in application"

Government warning check: must be word-for-word exact (except the bold/caps requirement on "GOVERNMENT WARNING:" — that prefix MUST be all caps). Any deviation in wording = FAIL.

Respond ONLY with valid JSON, no markdown fences, no preamble, no trailing text:
{
  "overallStatus": "pass" | "warn" | "fail",
  "overallSummary": "One sentence for the compliance agent explaining the outcome",
  "checks": [
    {
      "field": "Brand name",
      "status": "pass" | "warn" | "fail" | "missing",
      "applicationValue": "value from application data",
      "labelValue": "what was extracted from the label image, or null if not found",
      "note": "brief explanation (required if status is warn/fail/missing)"
    }
  ]
}

Include a check for every field: Brand name, Class/type, Alcohol content, Net contents, Producer/bottler, Country of origin, Government warning statement.`
}
