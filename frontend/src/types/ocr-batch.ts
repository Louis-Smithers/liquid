export interface ParsedField {
  fieldName: string
  value: string | null
  confidence: number
  page: number
  bboxX?: number | null
  bboxY?: number | null
  bboxWidth?: number | null
  bboxHeight?: number | null
}

export interface ClientMatch {
  id: string
  shortcode: string
  name: string
  score: number
}

export interface DebtorMatch {
  id: string
  name: string
  score: number
}

export interface MatchCandidates {
  clients: ClientMatch[]
  debtors: DebtorMatch[]
}

export interface StagedDoc {
  id: string
  fileName: string
  storagePath: string
  ocrStatus: 'Pending' | 'Processing' | 'Ready' | 'Failed'
  fields: ParsedField[]
  match: MatchCandidates
  error: string | null
}

export interface UploadBatch {
  id: string
  status: string
  expiresAt: string
  documents: StagedDoc[]
}

export interface ConfirmDocPayload {
  invoiceNumber: string
  invoiceDate: string
  amount: number
  clientShortcode: string
  createClient: boolean
  debtorId: string | null
  newDebtorName: string | null
  poRef: string | null
  notes: string | null
}
