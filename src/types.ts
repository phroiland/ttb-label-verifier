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
export type OverallStatus = 'pass' | 'warn' | 'fail'

export interface FieldCheck {
  field: string
  status: CheckStatus
  applicationValue: string
  labelValue: string | null
  note?: string
}

export interface VerificationResult {
  overallStatus: OverallStatus
  overallSummary: string
  checks: FieldCheck[]
}

export interface LabelResult {
  id: string
  filename: string
  imgSrc: string
  appData: AppData
  result: VerificationResult | null
  error?: string
}
