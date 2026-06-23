export interface LoanPaymentDto {
  id: string
  loanId: string
  paymentDate: string       // DateOnly serialises as "YYYY-MM-DD"
  paymentAmount: number
  overrideInterest: number | null
  overridePrincipal: number | null
  notes: string | null
  createdAt: string
}

// "Compounding interval" — how often interest is calculated and added to the balance.
// Not a payment schedule; payments can land on any date.
export type LoanFrequency = 'Weekly' | 'BiWeekly' | 'Monthly' | 'Quarterly' | 'Custom'

export interface LoanDto {
  id: string
  lenderName: string
  borrowerName: string
  guarantors: string | null
  address: string | null
  principal: number
  interestRate: number      // e.g. 0.18 for 18%
  startDate: string         // "YYYY-MM-DD"
  termMonths: number        // fixed at creation, read-only after
  endDate: string           // computed: startDate + termMonths, "YYYY-MM-DD"
  frequency: LoanFrequency  // compounding interval, fixed at creation, read-only after
  customIntervalDays: number | null  // set only when frequency === 'Custom'
  notes: string | null
  createdAt: string
  payments: LoanPaymentDto[]
}

export interface LoanTableRowDto {
  date: string              // "YYYY-MM-DD"
  days: number
  openingBalance: number    // A
  paymentReceived: number   // B
  interest: number          // E
  principal: number         // C = B - E
  closingBalance: number    // D = A + E - B
  paymentId: string | null
  isOverride: boolean
}

export interface LoanTableDto {
  loan: LoanDto
  rows: LoanTableRowDto[]
  totalInterestAccrued: number
  currentBalance: number
}

export interface LoanSummaryDto {
  id: string
  lenderName: string
  borrowerName: string
  guarantors: string | null
  principal: number
  interestRate: number
  startDate: string
  termMonths: number
  endDate: string           // computed: startDate + termMonths, "YYYY-MM-DD"
  frequency: LoanFrequency
  customIntervalDays: number | null
  currentBalance: number
  totalInterest: number
  paymentCount: number
}

export interface LoanPageDto {
  items: LoanSummaryDto[]
  nextCursorTime: string | null
  nextCursorId: string | null
  hasPrevious: boolean
}

// "Custom" alone isn't meaningful to a reader — show the actual day count instead.
export const describeFrequency = (frequency: string, customIntervalDays: number | null) =>
  frequency === 'Custom' ? `Custom — every ${customIntervalDays ?? '?'} days` : frequency
