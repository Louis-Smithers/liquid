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

export interface LoanDto {
  id: string
  lenderName: string
  borrowerName: string
  guarantors: string | null
  address: string | null
  principal: number
  interestRate: number      // e.g. 0.18 for 18%
  startDate: string         // "YYYY-MM-DD"
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
  currentBalance: number
  totalInterest: number
  paymentCount: number
}
