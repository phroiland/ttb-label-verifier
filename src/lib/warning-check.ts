import { DiffToken, CheckStatus } from '@/types'

export const GOVT_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'

export interface WarningCheckResult {
  status: CheckStatus
  note: string
  diff: DiffToken[]
}

/**
 * Deterministic, code-level check of the government warning statement.
 *
 * Design rationale: the AI model EXTRACTS the warning text verbatim from the
 * label image, but the compliance judgment is made here in code — an exact,
 * reproducible, word-for-word comparison against the statutory text
 * (27 CFR 16.21). We never let the LLM "judge" exactness; perception is the
 * model's job, compliance is the code's job.
 *
 * Rules enforced:
 * 1. Warning must be present.
 * 2. Wording must match the statutory text word-for-word
 *    (case-insensitive on the body — TTB requires caps/bold only on the
 *    "GOVERNMENT WARNING:" prefix).
 * 3. The "GOVERNMENT WARNING:" prefix must be in ALL CAPS exactly.
 */
export function checkGovernmentWarning(extracted: string | null | undefined): WarningCheckResult {
  if (!extracted || !extracted.trim()) {
    return {
      status: 'missing',
      note: 'No government warning statement found on the label. The warning is mandatory on all alcohol beverages (27 CFR Part 16).',
      diff: requiredWords().map((w) => ({ word: w, type: 'missing' })),
    }
  }

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()
  const ext = normalize(extracted)

  // Word-level diff (case-insensitive comparison, punctuation kept attached)
  const reqWords = requiredWords()
  const extWords = ext.split(' ')
  const diff = lcsDiff(reqWords, extWords)

  const missing = diff.filter((d) => d.type === 'missing').length
  const extra = diff.filter((d) => d.type === 'extra').length
  const wordingExact = missing === 0 && extra === 0

  // Prefix capitalization check — must literally start with "GOVERNMENT WARNING:"
  const prefixOk = ext.startsWith('GOVERNMENT WARNING:')

  if (wordingExact && prefixOk) {
    return {
      status: 'pass',
      note: 'Warning text matches the statutory wording exactly; GOVERNMENT WARNING prefix is in all caps.',
      diff,
    }
  }

  if (wordingExact && !prefixOk) {
    return {
      status: 'fail',
      note: `Warning wording is correct, but the prefix is not in all caps (found: "${ext.slice(0, 20)}…"). TTB requires "GOVERNMENT WARNING:" in capital letters and bold type.`,
      diff,
    }
  }

  return {
    status: 'fail',
    note: `Warning text deviates from the statutory wording: ${missing} word${missing !== 1 ? 's' : ''} missing, ${extra} unexpected word${extra !== 1 ? 's' : ''}. The warning must appear word-for-word.`,
    diff,
  }
}

function requiredWords(): string[] {
  return GOVT_WARNING.replace(/\s+/g, ' ').trim().split(' ')
}

/**
 * Classic LCS-based word diff. Comparison is case-insensitive; output tokens
 * preserve the original casing. 'missing' = in required text but not on label;
 * 'extra' = on label but not in required text; 'same' = matched.
 */
function lcsDiff(required: string[], actual: string[]): DiffToken[] {
  const n = required.length
  const m = actual.length
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

  // DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(required[i], actual[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  // Backtrack
  const out: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq(required[i], actual[j])) {
      out.push({ word: required[i], type: 'same' })
      i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ word: required[i], type: 'missing' })
      i++
    } else {
      out.push({ word: actual[j], type: 'extra' })
      j++
    }
  }
  while (i < n) { out.push({ word: required[i], type: 'missing' }); i++ }
  while (j < m) { out.push({ word: actual[j], type: 'extra' }); j++ }
  return out
}
