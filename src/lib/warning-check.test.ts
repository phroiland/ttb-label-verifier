import { describe, it, expect } from 'vitest'
import { checkGovernmentWarning, GOVT_WARNING } from './warning-check'

describe('checkGovernmentWarning', () => {
  it('passes the exact statutory text', () => {
    const r = checkGovernmentWarning(GOVT_WARNING)
    expect(r.status).toBe('pass')
    expect(r.diff.every((t) => t.type === 'same')).toBe(true)
  })

  it('passes when OCR introduces line breaks and extra whitespace', () => {
    const mangled = GOVT_WARNING.replace(/ /g, '  \n ')
    const r = checkGovernmentWarning(mangled)
    expect(r.status).toBe('pass')
  })

  it("fails a title-case prefix even when wording is otherwise correct (Jenny's catch)", () => {
    const titleCase = GOVT_WARNING.replace('GOVERNMENT WARNING:', 'Government Warning:')
    const r = checkGovernmentWarning(titleCase)
    expect(r.status).toBe('fail')
    expect(r.note).toMatch(/all caps/i)
    // wording itself matched — no word-level deviations
    expect(r.diff.every((t) => t.type === 'same')).toBe(true)
  })

  it('fails modified wording and identifies the exact deviating words', () => {
    const modified = GOVT_WARNING.replace('should not drink', 'should not consume')
    const r = checkGovernmentWarning(modified)
    expect(r.status).toBe('fail')
    const missing = r.diff.filter((t) => t.type === 'missing').map((t) => t.word)
    const extra = r.diff.filter((t) => t.type === 'extra').map((t) => t.word)
    expect(missing).toEqual(['drink'])
    expect(extra).toEqual(['consume'])
  })

  it('fails a truncated warning with many missing words', () => {
    const truncated = GOVT_WARNING.slice(0, 120)
    const r = checkGovernmentWarning(truncated)
    expect(r.status).toBe('fail')
    expect(r.diff.filter((t) => t.type === 'missing').length).toBeGreaterThan(10)
  })

  it('reports missing when the warning is absent', () => {
    expect(checkGovernmentWarning(null).status).toBe('missing')
    expect(checkGovernmentWarning('').status).toBe('missing')
    expect(checkGovernmentWarning('   ').status).toBe('missing')
  })

  it('fails extra inserted words', () => {
    const padded = GOVT_WARNING.replace(
      'health problems.',
      'serious health problems.',
    )
    const r = checkGovernmentWarning(padded)
    expect(r.status).toBe('fail')
    expect(r.diff.filter((t) => t.type === 'extra').map((t) => t.word)).toEqual(['serious'])
  })

  it('is case-insensitive on the body (all-caps body still passes)', () => {
    // Some labels print the entire warning in caps — TTB requires caps only on the prefix
    const allCaps = GOVT_WARNING.toUpperCase()
    const r = checkGovernmentWarning(allCaps)
    expect(r.status).toBe('pass')
  })
})
