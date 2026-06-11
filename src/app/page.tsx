'use client'

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import { AppData, LabelResult, FieldCheck, OverallStatus } from '@/types'
import styles from './page.module.css'

const EMPTY_APP_DATA: AppData = {
  brand: '', classType: '', abv: '', net: '', producer: '', origin: '', type: 'distilled spirits',
}

function newId() {
  return 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function verifyLabel(file: File, appData: AppData) {
  const imageBase64 = await fileToBase64(file)
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mediaType: file.type, appData }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Verification failed')
  return data.result
}

const STATUS_LABELS: Record<string, string> = {
  pass: 'Approved', warn: 'Review needed', fail: 'Rejected', pending: 'Pending', error: 'Error',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`${styles.pill} ${styles['pill_' + status]}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'pass') return <span className={`${styles.checkIcon} ${styles.pass}`}>✓</span>
  if (status === 'warn') return <span className={`${styles.checkIcon} ${styles.warn}`}>⚠</span>
  if (status === 'missing') return <span className={`${styles.checkIcon} ${styles.fail}`}>—</span>
  return <span className={`${styles.checkIcon} ${styles.fail}`}>✗</span>
}

function ResultCard({ item, defaultOpen }: { item: LabelResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const status = item.error ? 'error' : item.result ? item.result.overallStatus : 'pending'

  return (
    <div className={styles.resultCard}>
      <button className={styles.resultHeader} onClick={() => setOpen(!open)} aria-expanded={open}>
        {item.imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.thumb} src={item.imgSrc} alt="" />
        )}
        <div className={styles.resultMeta}>
          <strong className={styles.resultFilename}>{item.filename}</strong>
          <span className={styles.resultSummary}>
            {item.error
              ? `Error: ${item.error}`
              : item.result
              ? item.result.overallSummary
              : 'Processing…'}
          </span>
        </div>
        <StatusPill status={status} />
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden>▾</span>
      </button>

      {open && item.result && (
        <div className={styles.resultBody}>
          <table className={styles.checkTable}>
            <thead>
              <tr>
                <th></th>
                <th>Field</th>
                <th>Application / label</th>
              </tr>
            </thead>
            <tbody>
              {item.result.checks.map((c: FieldCheck, i: number) => (
                <tr key={i}>
                  <td><CheckIcon status={c.status} /></td>
                  <td className={styles.fieldName}>{c.field}</td>
                  <td>
                    <span className={styles.appVal}>
                      {c.applicationValue && c.applicationValue !== '(not provided)'
                        ? c.applicationValue
                        : <em className={styles.notSpec}>Not specified</em>}
                    </span>
                    {c.labelValue && (
                      <span className={styles.labelVal}>Found on label: {c.labelValue}</span>
                    )}
                    {c.note && <span className={styles.noteVal}>{c.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && item.error && (
        <div className={styles.resultBody}>
          <p className={styles.errorText}>{item.error}</p>
        </div>
      )}
    </div>
  )
}

function DropZone({
  id, onFiles, multiple, children,
}: {
  id: string; onFiles: (files: File[]) => void; multiple?: boolean; children: React.ReactNode
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (files.length) onFiles(files)
  }, [onFiles])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onFiles(files)
    e.target.value = ''
  }, [onFiles])

  return (
    <>
      <div
        className={`${styles.dropZone} ${dragging ? styles.dropZoneDrag : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload label images"
      >
        {children}
      </div>
      <input ref={inputRef} id={id} type="file" accept="image/*" multiple={multiple} style={{ display: 'none' }} onChange={handleChange} />
    </>
  )
}

function AppDataForm({ prefix, data, onChange }: {
  prefix: string; data: AppData; onChange: (d: AppData) => void
}) {
  const f = (field: keyof AppData) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [field]: e.target.value })

  return (
    <div className={styles.formSection}>
      <p className={styles.formSectionTitle}>Application data (from COLA system)</p>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label htmlFor={`${prefix}-brand`}>Brand name</label>
          <input id={`${prefix}-brand`} type="text" value={data.brand} onChange={f('brand')} placeholder="e.g. Old Tom Distillery" />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor={`${prefix}-class`}>Class / type</label>
          <input id={`${prefix}-class`} type="text" value={data.classType} onChange={f('classType')} placeholder="e.g. Kentucky Straight Bourbon Whiskey" />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor={`${prefix}-abv`}>Alcohol content</label>
          <input id={`${prefix}-abv`} type="text" value={data.abv} onChange={f('abv')} placeholder="e.g. 45% Alc./Vol. (90 Proof)" />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor={`${prefix}-net`}>Net contents</label>
          <input id={`${prefix}-net`} type="text" value={data.net} onChange={f('net')} placeholder="e.g. 750 mL" />
        </div>
        {prefix === 's' && (
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label htmlFor={`${prefix}-producer`}>Producer / bottler name &amp; address</label>
            <input id={`${prefix}-producer`} type="text" value={data.producer} onChange={f('producer')} placeholder="e.g. Old Tom Distillery, Louisville, KY, USA" />
          </div>
        )}
        <div className={styles.formGroup}>
          <label htmlFor={`${prefix}-origin`}>Country of origin</label>
          <input id={`${prefix}-origin`} type="text" value={data.origin} onChange={f('origin')} placeholder="e.g. USA" />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor={`${prefix}-type`}>Beverage type</label>
          <select id={`${prefix}-type`} value={data.type} onChange={f('type')}>
            <option value="distilled spirits">Distilled spirits</option>
            <option value="wine">Wine</option>
            <option value="beer">Beer / malt beverage</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [tab, setTab] = useState<'single' | 'batch' | 'results'>('single')

  // Single
  const [singleFile, setSingleFile] = useState<File | null>(null)
  const [singleImgSrc, setSingleImgSrc] = useState<string>('')
  const [singleData, setSingleData] = useState<AppData>(EMPTY_APP_DATA)
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleError, setSingleError] = useState('')

  // Batch
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchThumbs, setBatchThumbs] = useState<string[]>([])
  const [batchData, setBatchData] = useState<AppData>(EMPTY_APP_DATA)
  const [batchProgress, setBatchProgress] = useState<Record<number, 'pending'|'loading'|'done'|'error'>>({})
  const [batchRunning, setBatchRunning] = useState(false)

  // Results
  const [results, setResults] = useState<LabelResult[]>([])

  const pushResult = useCallback((r: LabelResult) => {
    setResults((prev) => [r, ...prev])
  }, [])

  // Single handlers
  const handleSingleFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    setSingleFile(file)
    setSingleError('')
    const src = await fileToDataUrl(file)
    setSingleImgSrc(src)
  }, [])

  const handleVerifySingle = useCallback(async () => {
    if (!singleFile) { setSingleError('Please upload a label image first.'); return }
    setSingleLoading(true)
    setSingleError('')
    try {
      const result = await verifyLabel(singleFile, singleData)
      const lr: LabelResult = { id: newId(), filename: singleFile.name, imgSrc: singleImgSrc, appData: singleData, result }
      pushResult(lr)
      setTab('results')
    } catch (e) {
      setSingleError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setSingleLoading(false)
    }
  }, [singleFile, singleData, singleImgSrc, pushResult])

  const handleClearSingle = useCallback(() => {
    setSingleFile(null); setSingleImgSrc(''); setSingleData(EMPTY_APP_DATA); setSingleError('')
  }, [])

  // Batch handlers
  const handleBatchFiles = useCallback(async (files: File[]) => {
    setBatchFiles(files)
    setBatchProgress({})
    const thumbs = await Promise.all(files.map(fileToDataUrl))
    setBatchThumbs(thumbs)
  }, [])

  const handleVerifyBatch = useCallback(async () => {
    if (!batchFiles.length) return
    setBatchRunning(true)
    const concurrency = 5
    const tasks = batchFiles.map((file, i) => async () => {
      setBatchProgress((p) => ({ ...p, [i]: 'loading' }))
      try {
        const result = await verifyLabel(file, batchData)
        const lr: LabelResult = { id: newId(), filename: file.name, imgSrc: batchThumbs[i] ?? '', appData: batchData, result }
        pushResult(lr)
        setBatchProgress((p) => ({ ...p, [i]: 'done' }))
      } catch {
        setBatchProgress((p) => ({ ...p, [i]: 'error' }))
      }
    })
    let idx = 0
    async function worker() {
      while (idx < tasks.length) { const t = tasks[idx++]; await t() }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
    setBatchRunning(false)
    setTab('results')
  }, [batchFiles, batchData, batchThumbs, pushResult])

  // Stats
  const counts = results.reduce(
    (acc, r) => {
      if (r.result) acc[r.result.overallStatus] = (acc[r.result.overallStatus] ?? 0) + 1
      return acc
    },
    {} as Record<OverallStatus, number>,
  )

  const batchDone = Object.values(batchProgress).filter((s) => s === 'done' || s === 'error').length

  return (
    <div className={styles.app}>
      <h1 className="sr-only">TTB Label Verifier</h1>

      <header className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>Label Verification</h2>
          <p className={styles.headerSub}>AI-powered TTB compliance checking</p>
        </div>
      </header>

      <nav className={styles.tabs} role="tablist">
        {(['single', 'batch', 'results'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'single' ? 'Single label' : t === 'batch' ? 'Batch upload' : 'Results'}
            {t === 'results' && results.length > 0 && (
              <span className={styles.tabBadge}>{results.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Single tab */}
      {tab === 'single' && (
        <section aria-label="Single label verification">
          <div className={styles.card}>
            <DropZone id="file-single" onFiles={handleSingleFiles}>
              <div className={styles.dropIcon}>🏷️</div>
              <strong>Drop label image here</strong>
              <p>or click to choose — JPG, PNG, WEBP</p>
            </DropZone>

            {singleImgSrc && (
              <div className={styles.singlePreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={singleImgSrc} alt="Label preview" className={styles.singlePreviewImg} />
                <span className={styles.singleFilename}>{singleFile?.name}</span>
              </div>
            )}

            <AppDataForm prefix="s" data={singleData} onChange={setSingleData} />

            <div className={styles.btnRow}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleVerifySingle}
                disabled={singleLoading}
              >
                {singleLoading ? <span className={styles.spinner} /> : '✓'} Verify label
              </button>
              <button className={styles.btn} onClick={handleClearSingle}>Clear</button>
            </div>

            {singleError && <p className={styles.errorMsg}>{singleError}</p>}
          </div>
        </section>
      )}

      {/* Batch tab */}
      {tab === 'batch' && (
        <section aria-label="Batch label verification">
          <div className={styles.card}>
            <DropZone id="file-batch" onFiles={handleBatchFiles} multiple>
              <div className={styles.dropIcon}>📦</div>
              <strong>Drop multiple label images here</strong>
              <p>or click to choose — up to 300 labels at once</p>
            </DropZone>

            {batchFiles.length > 0 && (
              <div className={styles.batchGrid}>
                {batchFiles.map((f, i) => {
                  const st = batchProgress[i]
                  return (
                    <div key={i} className={styles.batchThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {batchThumbs[i] && <img src={batchThumbs[i]} alt={f.name} />}
                      <span className={`${styles.batchBadge} ${st ? styles['batchBadge_' + st] : styles.batchBadge_pending}`}>
                        {!st ? 'Pending' : st === 'loading' ? '…' : st === 'done' ? '✓' : '✗'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {batchFiles.length > 0 && (
              <>
                <p className={styles.batchNote}>
                  Default application data — applied to all labels
                </p>
                <AppDataForm prefix="b" data={batchData} onChange={setBatchData} />
              </>
            )}

            <div className={styles.btnRow}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleVerifyBatch}
                disabled={!batchFiles.length || batchRunning}
              >
                {batchRunning ? <span className={styles.spinner} /> : '✓'} Verify all labels
              </button>
              {batchFiles.length > 0 && (
                <span className={styles.batchCount}>
                  {batchRunning
                    ? `${batchDone} / ${batchFiles.length} complete`
                    : `${batchFiles.length} label${batchFiles.length !== 1 ? 's' : ''} selected`}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Results tab */}
      {tab === 'results' && (
        <section aria-label="Verification results">
          {results.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <h3>No results yet</h3>
              <p>Verify a label from the single or batch tab</p>
            </div>
          ) : (
            <>
              <div className={styles.summaryBar}>
                {[
                  { label: 'Total', value: results.length, cls: '' },
                  { label: 'Approved', value: counts.pass ?? 0, cls: styles.numPass },
                  { label: 'Review needed', value: counts.warn ?? 0, cls: styles.numWarn },
                  { label: 'Rejected', value: counts.fail ?? 0, cls: styles.numFail },
                ].map((s) => (
                  <div key={s.label} className={styles.stat}>
                    <span className={`${styles.statNum} ${s.cls}`}>{s.value}</span>
                    <span className={styles.statLabel}>{s.label}</span>
                  </div>
                ))}
              </div>

              <div className={styles.resultsList}>
                {results.map((r, i) => (
                  <ResultCard key={r.id} item={r} defaultOpen={i === 0} />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
