export interface AppData {
  brand: string
  classType: string
  abv: string
  net: string
  producer: string
  origin: string
  type: string
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'missing'
export type OverallStatus = 'pass' | 'warn' | 'fail' | 'unreadable'

export interface FieldCheck {
  field: string
  status: CheckStatus
  applicationValue: string
  labelValue: string | null
  note?: string
}

export interface DiffToken {
  word: string
  type: 'same' | 'missing' | 'extra'
}

export interface VerificationResult {
  overallStatus: OverallStatus
  overallSummary: string
  checks: FieldCheck[]
  /** Word-level diff of the government warning vs the statutory text (computed deterministically server-side) */
  warningDiff?: DiffToken[]
  /** Server-side processing time in ms */
  processingMs?: number
}

export interface LabelResult {
  id: string
  filename: string
  imgSrc: string
  appData: AppData
  result: VerificationResult | null
  error?: string
  /** Total client-observed verification time in ms */
  elapsedMs?: number
}
