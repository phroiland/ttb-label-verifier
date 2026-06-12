import { AppData } from '@/types'

/**
 * Parses a per-label application data CSV for batch mode.
 *
 * Expected header (case-insensitive, order-independent):
 *   filename, brand, class_type, abv, net_contents, producer, origin, beverage_type
 *
 * Only `filename` is required; any other column may be omitted entirely or left
 * blank per-row, in which case the batch-level defaults apply for that field.
 * Matching against uploaded files is by exact filename (case-insensitive).
 */

export interface CsvParseResult {
  rows: Map<string, Partial<AppData>>
  errors: string[]
}

const HEADER_ALIASES: Record<string, keyof AppData | 'filename'> = {
  filename: 'filename',
  file: 'filename',
  brand: 'brand',
  brand_name: 'brand',
  brandname: 'brand',
  class_type: 'classType',
  classtype: 'classType',
  class: 'classType',
  type: 'classType',
  abv: 'abv',
  alcohol: 'abv',
  alcohol_content: 'abv',
  net: 'net',
  net_contents: 'net',
  netcontents: 'net',
  producer: 'producer',
  bottler: 'producer',
  producer_bottler: 'producer',
  origin: 'origin',
  country: 'origin',
  country_of_origin: 'origin',
  beverage_type: 'type',
  beveragetype: 'type',
}

export function parseApplicationCsv(text: string): CsvParseResult {
  const errors: string[] = []
  const rows = new Map<string, Partial<AppData>>()

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return { rows, errors: ['CSV file is empty.'] }
  }

  const headerCells = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/[\s-]+/g, '_'),
  )

  const columnMap: (keyof AppData | 'filename' | null)[] = headerCells.map(
    (h) => HEADER_ALIASES[h] ?? null,
  )

  const filenameIdx = columnMap.indexOf('filename')
  if (filenameIdx === -1) {
    return {
      rows,
      errors: [
        `CSV must include a "filename" column. Found columns: ${headerCells.join(', ')}`,
      ],
    }
  }

  const unrecognized = headerCells.filter((_, i) => columnMap[i] === null)
  if (unrecognized.length > 0) {
    errors.push(`Ignored unrecognized column(s): ${unrecognized.join(', ')}`)
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const filename = (cells[filenameIdx] ?? '').trim()
    if (!filename) {
      errors.push(`Row ${i + 1}: missing filename — row skipped.`)
      continue
    }

    const data: Partial<AppData> = {}
    columnMap.forEach((field, ci) => {
      if (field && field !== 'filename') {
        const val = (cells[ci] ?? '').trim()
        if (val) data[field] = val
      }
    })

    const key = filename.toLowerCase()
    if (rows.has(key)) {
      errors.push(`Row ${i + 1}: duplicate filename "${filename}" — later row wins.`)
    }
    rows.set(key, data)
  }

  return { rows, errors }
}

/** Minimal RFC-4180-ish line splitter: handles quoted fields with embedded commas and "" escapes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/** Merge per-row CSV data over batch defaults to produce the final AppData for one label. */
export function mergeAppData(defaults: AppData, override?: Partial<AppData>): AppData {
  if (!override) return defaults
  return {
    brand: override.brand ?? defaults.brand,
    classType: override.classType ?? defaults.classType,
    abv: override.abv ?? defaults.abv,
    net: override.net ?? defaults.net,
    producer: override.producer ?? defaults.producer,
    origin: override.origin ?? defaults.origin,
    type: override.type ?? defaults.type,
  }
}
