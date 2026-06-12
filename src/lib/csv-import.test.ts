import { describe, it, expect } from 'vitest'
import { parseApplicationCsv, mergeAppData } from './csv-import'
import { AppData } from '@/types'

const DEFAULTS: AppData = {
  brand: 'Default Brand',
  classType: 'Default Type',
  abv: '40%',
  net: '750 mL',
  producer: 'Default Producer',
  origin: 'USA',
  type: 'distilled spirits',
}

describe('parseApplicationCsv', () => {
  it('parses a well-formed CSV with all columns', () => {
    const csv = [
      'filename,brand,class_type,abv,net_contents,producer,origin,beverage_type',
      'label1.png,Old Tom Distillery,Bourbon,45%,750 mL,Old Tom KY,USA,distilled spirits',
    ].join('\n')
    const { rows, errors } = parseApplicationCsv(csv)
    expect(errors).toEqual([])
    expect(rows.get('label1.png')).toEqual({
      brand: 'Old Tom Distillery',
      classType: 'Bourbon',
      abv: '45%',
      net: '750 mL',
      producer: 'Old Tom KY',
      origin: 'USA',
      type: 'distilled spirits',
    })
  })

  it('accepts header aliases and mixed case', () => {
    const csv = ['File,Brand Name,Alcohol Content', 'a.png,Silver Thistle,42%'].join('\n')
    const { rows, errors } = parseApplicationCsv(csv)
    expect(errors).toEqual([])
    expect(rows.get('a.png')).toEqual({ brand: 'Silver Thistle', abv: '42%' })
  })

  it('handles quoted fields with embedded commas', () => {
    const csv = [
      'filename,producer',
      'a.png,"Old Tom Distillery, Lawrenceburg, KY"',
    ].join('\n')
    const { rows } = parseApplicationCsv(csv)
    expect(rows.get('a.png')?.producer).toBe('Old Tom Distillery, Lawrenceburg, KY')
  })

  it('leaves blank cells undefined so defaults apply', () => {
    const csv = ['filename,brand,abv', 'a.png,,45%'].join('\n')
    const { rows } = parseApplicationCsv(csv)
    expect(rows.get('a.png')).toEqual({ abv: '45%' })
  })

  it('errors when filename column is absent', () => {
    const csv = ['brand,abv', 'X,45%'].join('\n')
    const { rows, errors } = parseApplicationCsv(csv)
    expect(rows.size).toBe(0)
    expect(errors[0]).toMatch(/filename/i)
  })

  it('reports duplicate filenames and skips blank-filename rows', () => {
    const csv = ['filename,brand', 'a.png,First', ',NoName', 'a.png,Second'].join('\n')
    const { rows, errors } = parseApplicationCsv(csv)
    expect(rows.get('a.png')?.brand).toBe('Second')
    expect(errors.some((e) => e.includes('duplicate'))).toBe(true)
    expect(errors.some((e) => e.includes('missing filename'))).toBe(true)
  })

  it('matches filenames case-insensitively', () => {
    const csv = ['filename,brand', 'MyLabel.PNG,Test Brand'].join('\n')
    const { rows } = parseApplicationCsv(csv)
    expect(rows.get('mylabel.png')?.brand).toBe('Test Brand')
  })
})

describe('mergeAppData', () => {
  it('returns defaults when no override exists', () => {
    expect(mergeAppData(DEFAULTS, undefined)).toEqual(DEFAULTS)
  })

  it('applies overrides only for provided fields', () => {
    const merged = mergeAppData(DEFAULTS, { brand: 'CSV Brand', abv: '45%' })
    expect(merged.brand).toBe('CSV Brand')
    expect(merged.abv).toBe('45%')
    expect(merged.net).toBe('750 mL')
    expect(merged.producer).toBe('Default Producer')
  })
})
