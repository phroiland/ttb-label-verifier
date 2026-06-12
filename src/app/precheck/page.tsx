'use client'

import { useState, useCallback, useRef, ChangeEvent, DragEvent } from 'react'
import { AppData, VerificationResult, FieldCheck, DiffToken } from '@/types'
import { verifyLabelRequest, fileToDataUrl } from '@/lib/client'
import { GOVT_WARNING } from '@/lib/warning-check'
import styles from '../page.module.css'
import pre from './precheck.module.css'

const EMPTY: AppData = {
  brand: '', classType: '', abv: '', net: '', producer: '', origin: '', type: 'distilled spirits',
}

const VERDICT: Record<string, { title: string; tone: 'pass' | 'warn' | 'fail'; body: string }> = {
  pass: {
    title: 'No issues detected',
    tone: 'pass',
    body: 'This pre-check screens for common mechanical errors only. Passing does not guarantee TTB approval — final determination is made by a TTB agent during official review.',
  },
  warn: {
    title: 'Possible issues — review before submitting',
    tone: 'warn',
    body: 'Minor discrepancies were found between your label and your planned application data. They may be acceptable, but resolving them before submission reduces the chance of a rejection cycle.',
  },
  fail: {
    title: 'Likely issues found — fix before submitting',
    tone: 'fail',
    body: 'One or more checks found discrepancies that commonly cause rejections. Correcting them before you submit will likely save you a multi-week resubmission cycle.',
  },
  unreadable: {
    title: 'Image could not be read',
    tone: 'warn',
    body: 'The image is too blurry, dark, angled, or low-resolution to check reliably. Photograph the flat label straight-on under even lighting, avoid glare from bottle glass, and use the highest resolution available.',
  },
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'pass') return <span className={`${styles.checkIcon} ${styles.pass}`}>✓</span>
  if (status === 'warn') return <span className={`${styles.checkIcon} ${styles.warn}`}>⚠</span>
  if (status === 'missing') return <span className={`${styles.checkIcon} ${styles.fail}`}>—</span>
  return <span className={`${styles.checkIcon} ${styles.fail}`}>✗</span>
}

function WarningDiff({ diff }: { diff: DiffToken[] }) {
  const hasDeviations = diff.some((t) => t.type !== 'same')
  return (
    <div className={styles.diffBox}>
      <p className={styles.diffTitle}>
        Word-for-word comparison vs required text {hasDeviations ? '— deviations highlighted' : '— exact match'}
      </p>
      <p className={styles.diffText}>
        {diff.map((t, i) => (
          <span
            key={i}
            className={
              t.type === 'missing' ? styles.diffMissing
              : t.type === 'extra' ? styles.diffExtra
              : styles.diffSame
            }
          >
            {t.word}{' '}
          </span>
        ))}
      </p>
      {hasDeviations && (
        <p className={styles.diffLegend}>
          <span className={styles.diffMissing}>struck</span> = required word missing from your label &nbsp;·&nbsp; <span className={styles.diffExtra}>highlighted</span> = word on your label that isn&apos;t in the required text
        </p>
      )}
    </div>
  )
}

export default function PrecheckPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imgSrc, setImgSrc] = useState('')
  const [data, setData] = useState<AppData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setError('')
    setResult(null)
    setImgSrc(await fileToDataUrl(f))
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')))
  }, [handleFiles])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }, [handleFiles])

  const run = useCallback(async () => {
    if (!file) { setError('Please upload your label artwork first.'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { result, elapsedMs } = await verifyLabelRequest(file, data)
      setResult(result)
      setElapsed(elapsedMs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pre-check failed — please retry.')
    } finally {
      setLoading(false)
    }
  }, [file, data])

  const copyWarning = useCallback(async () => {
    await navigator.clipboard.writeText(GOVT_WARNING)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const f = (field: keyof AppData) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setData({ ...data, [field]: e.target.value })

  const verdict = result ? VERDICT[result.overallStatus] : null
  const warningCheck = result?.checks.find((c) => c.field.toLowerCase().includes('warning'))
  const warningFailed = warningCheck && (warningCheck.status === 'fail' || warningCheck.status === 'missing')

  return (
    <div className={styles.app}>
      <h1 className="sr-only">TTB Label Pre-Check for Applicants</h1>

      <header className={styles.header}>
        <h2 className={styles.headerTitle}>Pre-check your label before you apply</h2>
        <p className={styles.headerSub}>
          Catch common label errors before submitting your COLA application. Enter what you plan to
          submit, upload your label artwork, and get an instant screening.
        </p>
        <p className={pre.navLink}>
          <a href="/">Compliance agent view →</a>
        </p>
      </header>

      <div className={pre.disclaimer} role="note">
        <strong>This is an advisory screening tool, not a TTB determination.</strong> Passing this
        pre-check does not guarantee approval, and failing it does not constitute a rejection. Only
        TTB issues Certificates of Label Approval. See official requirements at{' '}
        <a href="https://www.ttb.gov/labeling" target="_blank" rel="noopener noreferrer">ttb.gov/labeling</a>.
      </div>

      <div className={styles.card} style={{ borderRadius: 'var(--radius-lg)' }}>
        <div
          className={`${styles.dropZone} ${dragging ? styles.dropZoneDrag : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          aria-label="Upload your label artwork"
        >
          <div className={styles.dropIcon} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <strong>Drop your label artwork here</strong>
          <p>or click to choose — JPG, PNG, WEBP, under 7 MB</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />

        {imgSrc && (
          <div className={styles.singlePreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt="Your label" className={styles.singlePreviewImg} />
            <span className={styles.singleFilename}>{file?.name}</span>
          </div>
        )}

        <div className={styles.formSection}>
          <p className={styles.formSectionTitle}>What you plan to submit in your application</p>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="p-brand">Brand name</label>
              <input id="p-brand" type="text" value={data.brand} onChange={f('brand')} placeholder="e.g. Old Tom Distillery" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="p-class">Class / type</label>
              <input id="p-class" type="text" value={data.classType} onChange={f('classType')} placeholder="e.g. Kentucky Straight Bourbon Whiskey" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="p-abv">Alcohol content</label>
              <input id="p-abv" type="text" value={data.abv} onChange={f('abv')} placeholder="e.g. 45% Alc./Vol. (90 Proof)" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="p-net">Net contents</label>
              <input id="p-net" type="text" value={data.net} onChange={f('net')} placeholder="e.g. 750 mL" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label htmlFor="p-producer">Producer / bottler name &amp; address</label>
              <input id="p-producer" type="text" value={data.producer} onChange={f('producer')} placeholder="e.g. Old Tom Distillery, Louisville, KY, USA" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="p-origin">Country of origin</label>
              <input id="p-origin" type="text" value={data.origin} onChange={f('origin')} placeholder="e.g. USA" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="p-type">Beverage type</label>
              <select id="p-type" value={data.type} onChange={f('type')}>
                <option value="distilled spirits">Distilled spirits</option>
                <option value="wine">Wine</option>
                <option value="beer">Beer / malt beverage</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.btnRow}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={run} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : '✓'} Run pre-check
          </button>
          {elapsed != null && !loading && (
            <span className={styles.timing}>checked in {(elapsed / 1000).toFixed(1)}s</span>
          )}
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}
      </div>

      {result && verdict && (
        <div className={`${pre.verdict} ${pre['verdict_' + verdict.tone]}`}>
          <p className={pre.verdictTitle}>{verdict.title}</p>
          <p className={pre.verdictBody}>{verdict.body}</p>
        </div>
      )}

      {result && result.overallStatus !== 'unreadable' && (
        <div className={styles.card} style={{ borderRadius: 'var(--radius-lg)', marginTop: '1rem' }}>
          <table className={styles.checkTable}>
            <thead>
              <tr><th></th><th>Field</th><th>Your application / your label</th></tr>
            </thead>
            <tbody>
              {result.checks.map((c: FieldCheck, i: number) => (
                <tr key={i}>
                  <td><CheckIcon status={c.status} /></td>
                  <td className={styles.fieldName}>{c.field}</td>
                  <td>
                    <span className={styles.appVal}>
                      {c.applicationValue && c.applicationValue !== '(not provided)'
                        ? c.applicationValue
                        : <em className={styles.notSpec}>Not entered</em>}
                    </span>
                    {c.labelValue && <span className={styles.labelVal}>On your label: {c.labelValue}</span>}
                    {c.note && <span className={styles.noteVal}>{c.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.warningDiff && result.warningDiff.length > 0 && (
            <WarningDiff diff={result.warningDiff} />
          )}

          {warningFailed && (
            <div className={pre.fixBox}>
              <p className={pre.fixTitle}>How to fix the government warning</p>
              <p className={pre.fixBody}>
                The warning must appear word-for-word as written in 27 CFR Part 16, with
                &ldquo;GOVERNMENT WARNING:&rdquo; in capital letters and bold type. Copy the exact
                required text below onto your label:
              </p>
              <div className={pre.requiredText}>{GOVT_WARNING}</div>
              <button className={styles.btn} onClick={copyWarning}>
                {copied ? '✓ Copied' : 'Copy required text'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
