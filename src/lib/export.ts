import { LabelResult, FieldCheck } from '@/types'

// ── CSV Export ────────────────────────────────────────────────────────────────

function csvEscape(val: string | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function exportCSV(results: LabelResult[]) {
  const FIELDS = [
    'Brand name',
    'Class/type',
    'Alcohol content',
    'Net contents',
    'Producer/bottler',
    'Country of origin',
    'Government warning statement',
  ]

  const header = [
    'Filename',
    'Overall status',
    'Summary',
    ...FIELDS.flatMap((f) => [`${f} — status`, `${f} — application value`, `${f} — label value`, `${f} — note`]),
    'Verified at',
  ]

  const rows = results.map((r) => {
    const base = [
      csvEscape(r.filename),
      csvEscape(r.result?.overallStatus ?? 'error'),
      csvEscape(r.result?.overallSummary ?? r.error ?? ''),
    ]

    const fieldCols = FIELDS.flatMap((fieldName) => {
      const check: FieldCheck | undefined = r.result?.checks.find(
        (c) => c.field.toLowerCase() === fieldName.toLowerCase(),
      )
      return [
        csvEscape(check?.status ?? ''),
        csvEscape(check?.applicationValue ?? ''),
        csvEscape(check?.labelValue ?? ''),
        csvEscape(check?.note ?? ''),
      ]
    })

    return [...base, ...fieldCols, csvEscape(new Date().toISOString())]
  })

  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `ttb-verification-${datestamp()}.csv`,
  )
}

// ── PDF Export ────────────────────────────────────────────────────────────────

// jsPDF is bundled via npm (no runtime CDN dependency — see Marcus's firewall
// concern: the only external domain this app contacts is api.anthropic.com).
// Dynamically imported so the ~300KB library loads only when an export is run.

interface jsPDFInstance {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } }
  setFont: (font: string, style?: string) => void
  setFontSize: (size: number) => void
  setTextColor: (r: number, g?: number, b?: number) => void
  setDrawColor: (r: number, g?: number, b?: number) => void
  setFillColor: (r: number, g?: number, b?: number) => void
  setLineWidth: (w: number) => void
  text: (text: string | string[], x: number, y: number, opts?: object) => void
  line: (x1: number, y1: number, x2: number, y2: number) => void
  rect: (x: number, y: number, w: number, h: number, style?: string) => void
  addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void
  addPage: () => void
  save: (filename: string) => void
  splitTextToSize: (text: string, maxWidth: number) => string[]
  getTextWidth: (text: string) => number
}

const COLORS = {
  pass: [59, 109, 17] as [number, number, number],
  warn: [133, 79, 11] as [number, number, number],
  fail: [163, 45, 45] as [number, number, number],
  missing: [163, 45, 45] as [number, number, number],
  text: [17, 17, 16] as [number, number, number],
  muted: [107, 107, 104] as [number, number, number],
  border: [226, 226, 223] as [number, number, number],
  bg: [247, 247, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  navy: [24, 95, 165] as [number, number, number],
}

const STATUS_ICONS: Record<string, string> = {
  pass: '✓', warn: '⚠', fail: '✗', missing: '—',
}
const STATUS_LABELS: Record<string, string> = {
  pass: 'APPROVED', warn: 'REVIEW NEEDED', fail: 'REJECTED', pending: 'PENDING', error: 'ERROR', unreadable: 'IMAGE UNREADABLE',
}

export async function exportPDF(results: LabelResult[]) {
  const mod = await import('jspdf')
  const jsPDF = mod.jsPDF as unknown as new (opts?: object) => jsPDFInstance
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pw = doc.internal.pageSize.getWidth()   // 210
  const ph = doc.internal.pageSize.getHeight()  // 297
  const ML = 14  // margin left
  const MR = 14  // margin right
  const CW = pw - ML - MR  // content width

  function setColor(color: [number, number, number]) {
    doc.setTextColor(color[0], color[1], color[2])
  }
  function setFill(color: [number, number, number]) {
    doc.setFillColor(color[0], color[1], color[2])
  }
  function setStroke(color: [number, number, number]) {
    doc.setDrawColor(color[0], color[1], color[2])
  }

  // ── Cover page ──────────────────────────────────────────────────────────────
  setFill(COLORS.navy)
  doc.rect(0, 0, pw, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text('TTB Label Verification Report', ML, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(180, 210, 240)
  doc.text(`Generated: ${new Date().toLocaleString()}`, ML, 31)
  doc.text(`${results.length} label${results.length !== 1 ? 's' : ''} reviewed`, ML, 38)

  // Summary stats
  const counts = { pass: 0, warn: 0, fail: 0 }
  results.forEach((r) => {
    if (r.result) counts[r.result.overallStatus as keyof typeof counts] = (counts[r.result.overallStatus as keyof typeof counts] ?? 0) + 1
  })

  let sx = ML
  const statW = (CW - 6) / 3
  ;[
    { label: 'Approved', value: counts.pass, color: COLORS.pass },
    { label: 'Review needed', value: counts.warn, color: COLORS.warn },
    { label: 'Rejected', value: counts.fail, color: COLORS.fail },
  ].forEach((s) => {
    setFill(COLORS.bg)
    setStroke(COLORS.border)
    doc.setLineWidth(0.3)
    doc.rect(sx, 54, statW, 22, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    setColor(s.color)
    doc.text(String(s.value), sx + statW / 2, 65, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setColor(COLORS.muted)
    doc.text(s.label, sx + statW / 2, 71, { align: 'center' })
    sx += statW + 3
  })

  // Results index table
  let iy = 86
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setColor(COLORS.text)
  doc.text('Results summary', ML, iy)
  iy += 6

  // Table header
  setFill(COLORS.bg)
  setStroke(COLORS.border)
  doc.setLineWidth(0.3)
  doc.rect(ML, iy, CW, 7, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setColor(COLORS.muted)
  doc.text('#', ML + 2, iy + 4.5)
  doc.text('Filename', ML + 10, iy + 4.5)
  doc.text('Status', ML + CW - 28, iy + 4.5)
  iy += 7

  results.forEach((r, idx) => {
    if (iy > ph - 20) { doc.addPage(); iy = 20 }
    const rowH = 7
    setFill(idx % 2 === 0 ? COLORS.white : COLORS.bg)
    setStroke(COLORS.border)
    doc.setLineWidth(0.2)
    doc.rect(ML, iy, CW, rowH, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setColor(COLORS.text)
    doc.text(String(idx + 1), ML + 2, iy + 4.5)

    const fname = r.filename.length > 55 ? r.filename.slice(0, 52) + '...' : r.filename
    doc.text(fname, ML + 10, iy + 4.5)

    const st = r.result?.overallStatus ?? 'error'
    setColor(COLORS[st as keyof typeof COLORS] ?? COLORS.muted)
    doc.setFont('helvetica', 'bold')
    doc.text(STATUS_LABELS[st] ?? st.toUpperCase(), ML + CW - 28, iy + 4.5)
    iy += rowH
  })

  // ── Per-label pages ─────────────────────────────────────────────────────────
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx]
    doc.addPage()
    let y = 16

    // Page header strip
    setFill(COLORS.navy)
    doc.rect(0, 0, pw, 12, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(`TTB Label Verification — Label ${idx + 1} of ${results.length}`, ML, 7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(new Date().toLocaleDateString(), pw - MR, 7.5, { align: 'right' })

    y = 20

    // Label image + meta side by side
    const imgW = 28
    const imgH = 36
    if (r.imgSrc && r.imgSrc.startsWith('data:image')) {
      try {
        const fmt = r.imgSrc.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(r.imgSrc, fmt, ML, y, imgW, imgH)
        setStroke(COLORS.border)
        doc.setLineWidth(0.3)
        doc.rect(ML, y, imgW, imgH)
      } catch {
        // image failed, skip
      }
    }

    // Filename + status badge
    const mx = ML + imgW + 6
    const mw = CW - imgW - 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    setColor(COLORS.text)
    const fnameLines = doc.splitTextToSize(r.filename, mw)
    doc.text(fnameLines.slice(0, 2), mx, y + 7)

    // Status badge
    const st = r.result?.overallStatus ?? 'error'
    const badgeColor = COLORS[st as keyof typeof COLORS] ?? COLORS.muted
    setFill(badgeColor)
    doc.setLineWidth(0)
    const badgeLabel = STATUS_LABELS[st] ?? st.toUpperCase()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const bw = doc.getTextWidth(badgeLabel) + 8
    doc.rect(mx, y + 11, bw, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(badgeLabel, mx + 4, y + 15.5)

    // Summary
    if (r.result?.overallSummary) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setColor(COLORS.muted)
      const summaryLines = doc.splitTextToSize(r.result.overallSummary, mw)
      doc.text(summaryLines, mx, y + 22)
    }

    y = Math.max(y + imgH + 6, y + 40)

    // Divider
    setStroke(COLORS.border)
    doc.setLineWidth(0.4)
    doc.line(ML, y, ML + CW, y)
    y += 6

    if (!r.result) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      setColor(COLORS.fail)
      doc.text(r.error ?? 'Verification failed', ML, y)
      continue
    }

    // Field checks table
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setColor(COLORS.muted)
    // Table header
    setFill(COLORS.bg)
    setStroke(COLORS.border)
    doc.setLineWidth(0.3)
    doc.rect(ML, y, CW, 6, 'FD')
    doc.text('Field', ML + 14, y + 4)
    doc.text('Application value', ML + 58, y + 4)
    doc.text('Found on label', ML + 110, y + 4)
    y += 6

    for (const check of r.result.checks) {
      // Estimate row height
      const appLines = doc.splitTextToSize(check.applicationValue || 'Not specified', 48)
      const labelLines = doc.splitTextToSize(check.labelValue || '—', 48)
      const noteLines = check.note ? doc.splitTextToSize(check.note, CW - 14) : []
      const contentH = Math.max(appLines.length, labelLines.length) * 4 + (noteLines.length > 0 ? noteLines.length * 3.5 + 2 : 0)
      const rowH = Math.max(10, contentH + 5)

      if (y + rowH > ph - 16) {
        doc.addPage()
        // Repeat page header
        setFill(COLORS.navy)
        doc.rect(0, 0, pw, 12, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(255, 255, 255)
        doc.text(`TTB Label Verification — Label ${idx + 1} of ${results.length} (continued)`, ML, 7.5)
        y = 20
      }

      // Row background
      setFill(COLORS.white)
      setStroke(COLORS.border)
      doc.setLineWidth(0.2)
      doc.rect(ML, y, CW, rowH, 'FD')

      // Status icon
      const iconColor = COLORS[check.status as keyof typeof COLORS] ?? COLORS.muted
      setColor(iconColor)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(STATUS_ICONS[check.status] ?? '?', ML + 4, y + 6)

      // Field name
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      setColor(COLORS.text)
      doc.text(check.field, ML + 14, y + 6)

      // Application value
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      setColor(check.applicationValue && check.applicationValue !== '(not provided)' ? COLORS.text : COLORS.muted)
      doc.text(
        check.applicationValue && check.applicationValue !== '(not provided)'
          ? doc.splitTextToSize(check.applicationValue, 48)
          : ['Not specified'],
        ML + 58,
        y + 6,
      )

      // Label value
      setColor(COLORS.muted)
      doc.setFont('helvetica', 'italic')
      doc.text(
        doc.splitTextToSize(check.labelValue || '—', 48),
        ML + 110,
        y + 6,
      )

      // Note
      if (check.note) {
        const noteY = y + Math.max(appLines.length, labelLines.length) * 4 + 6
        setColor(COLORS.muted)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.text(doc.splitTextToSize(`Note: ${check.note}`, CW - 14), ML + 14, noteY)
      }

      y += rowH
    }

    // Footer line
    y += 4
    setStroke(COLORS.border)
    doc.setLineWidth(0.3)
    doc.line(ML, ph - 10, ML + CW, ph - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setColor(COLORS.muted)
    doc.text('TTB Label Verifier — Prototype. Not a substitute for official TTB review.', ML, ph - 6)
    doc.text(`Page ${idx + 2}`, pw - MR, ph - 6, { align: 'right' })
  }

  doc.save(`ttb-verification-report-${datestamp()}.pdf`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function datestamp() {
  return new Date().toISOString().slice(0, 10)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
