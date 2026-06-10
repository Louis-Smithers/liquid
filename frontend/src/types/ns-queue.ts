export interface NotificationSheetItemDto {
  id: string
  notificationSheetId: string
  invoiceId: string
  invoiceNumber: string
  debtorName: string
  date: string
  includedAmount: number
  overrideInitialFee?: number
  overrideReserveFee?: number
  hasDocument: boolean
}

export interface NotificationSheetDto {
  id: string
  clientShortcode: string
  status: string
  isShared: boolean
  createdAt: string
  createdBy?: string
  displayName: string
  totalAmount: number
  itemCount: number
  initialFeePercent: number
  reserveFeePercent: number
  totalFee: number
  totalReserve: number
  otherFee: number
  cashReservesToRelease: number
  reservesToHoldBack: number
  otherAdjustments: number
  advanceAmount: number
  notes?: string
  intakeDocumentPath?: string
  intakeGeneratedAt?: string
  hasIntake: boolean
  items: NotificationSheetItemDto[]
}
