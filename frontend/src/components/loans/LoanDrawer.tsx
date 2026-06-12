import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { LoanTableDto, LoanTableRowDto } from '@/types/loans'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Download, Check, X } from 'lucide-react'

interface LoanDrawerProps {
  loanId: string
  onClose: () => void
}

const fmt = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const pct = (v: number) => (v * 100).toFixed(2) + '%'

// Inline editable cell — click to edit, Enter/Escape to confirm/cancel
function EditableCell({
  value,
  onSave,
  type = 'number',
  className = '',
}: {
  value: string | number | null
  onSave: (val: string) => Promise<void>
  type?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setDraft(String(value ?? ''))
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 group inline-flex items-center gap-1 ${className}`}
        onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
      >
        {value ?? '—'}
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        className="h-7 w-28 text-xs px-1"
      />
      <button onClick={commit} disabled={saving} className="text-green-600 hover:text-green-700">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={cancel} className="text-muted-foreground hover:text-red-500">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

export function LoanDrawer({ loanId, onClose }: LoanDrawerProps) {
  const [data, setData] = useState<LoanTableDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', notes: '' })
  const [addingSaving, setAddingSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [deletingLoan, setDeletingLoan] = useState(false)

  // Details edit state
  const [detailsEditing, setDetailsEditing] = useState(false)
  const [detailsForm, setDetailsForm] = useState<{
    borrowerName: string; lenderName: string; guarantors: string
    address: string; principal: string; interestRate: string; startDate: string; notes: string
  } | null>(null)
  const [detailsSaving, setDetailsSaving] = useState(false)

  const load = async () => {
    try {
      const res = await api.get<LoanTableDto>(`/api/loans/${loanId}`)
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [loanId])

  const openDetailsEdit = () => {
    if (!data) return
    const l = data.loan
    setDetailsForm({
      borrowerName: l.borrowerName,
      lenderName: l.lenderName,
      guarantors: l.guarantors ?? '',
      address: l.address ?? '',
      principal: String(l.principal),
      interestRate: String(l.interestRate * 100),
      startDate: l.startDate,
      notes: l.notes ?? '',
    })
    setDetailsEditing(true)
  }

  const saveDetails = async () => {
    if (!detailsForm) return
    setDetailsSaving(true)
    try {
      await api.patch(`/api/loans/${loanId}`, {
        borrowerName: detailsForm.borrowerName,
        lenderName: detailsForm.lenderName,
        guarantors: detailsForm.guarantors || null,
        address: detailsForm.address || null,
        principal: parseFloat(detailsForm.principal),
        interestRate: parseFloat(detailsForm.interestRate) / 100,
        startDate: detailsForm.startDate,
        notes: detailsForm.notes || null,
      })
      setDetailsEditing(false)
      await load()
    } finally {
      setDetailsSaving(false)
    }
  }

  const addPayment = async () => {
    if (!paymentForm.amount) return
    setAddingSaving(true)
    try {
      await api.post(`/api/loans/${loanId}/payments`, {
        paymentDate: paymentForm.date,
        paymentAmount: parseFloat(paymentForm.amount),
        notes: paymentForm.notes || null,
      })
      setAddPaymentOpen(false)
      setPaymentForm({ date: new Date().toISOString().slice(0, 10), amount: '', notes: '' })
      await load()
    } finally {
      setAddingSaving(false)
    }
  }

  const deletePayment = async (paymentId: string) => {
    if (!confirm('Delete this payment? This will recalculate all subsequent rows.')) return
    await api.delete(`/api/loans/${loanId}/payments/${paymentId}`)
    await load()
  }

  // Patch a single field on a payment row
  const patchPayment = async (paymentId: string, patch: object) => {
    await api.patch(`/api/loans/${loanId}/payments/${paymentId}`, patch)
    await load()
  }

  const downloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const res = await api.get(`/api/loans/${loanId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `LoanTable_${data?.loan.borrowerName.replace(/\s+/g, '_')}_${loanId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const deleteLoan = async () => {
    if (!confirm('Permanently delete this loan and all its payments?')) return
    setDeletingLoan(true)
    try {
      await api.delete(`/api/loans/${loanId}`)
      onClose()
    } finally {
      setDeletingLoan(false)
    }
  }

  const loan = data?.loan
  const rows = data?.rows ?? []

  return (
    <>
      <Sheet open onOpenChange={open => !open && onClose()} modal={false}>
        <SheetContent className="w-full sm:max-w-[1100px] sm:w-[1100px] overflow-y-auto bg-[#F7F9FB] p-0 border-l border-[#C7C4D7]/50 shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
          ) : !data || !loan ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Loan not found.</div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <SheetHeader className="p-6 shrink-0 bg-white border-b border-[#C7C4D7]/50">
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <SheetTitle className="text-[22px] font-semibold text-[#191C1E] tracking-tight">
                      {loan.borrowerName}
                    </SheetTitle>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="bg-[#EEF2FF] text-[#4648D4] border-[#C7D2FE] font-semibold text-xs">
                        {pct(loan.interestRate)} / year
                      </Badge>
                      <span className="text-sm text-[#464554]">
                        Principal: <strong className="text-[#191C1E]">{fmt(loan.principal)}</strong>
                      </span>
                      <span className="text-sm text-[#464554]">
                        Balance: <strong className={`${data.currentBalance > loan.principal ? 'text-red-600' : 'text-green-700'}`}>
                          {fmt(data.currentBalance)}
                        </strong>
                      </span>
                      <span className="text-sm text-[#464554]">
                        Interest accrued: <strong className="text-orange-600">{fmt(data.totalInterestAccrued)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloadingPdf}>
                      <Download className="h-4 w-4 mr-1" />
                      {downloadingPdf ? 'Generating...' : 'PDF'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50"
                      onClick={deleteLoan}
                      disabled={deletingLoan}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-6 flex-1">
                <Tabs defaultValue="table" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="table">Loan Table</TabsTrigger>
                    <TabsTrigger value="details">Loan Details</TabsTrigger>
                  </TabsList>

                  {/* ── Loan Table Tab ────────────────────────────────── */}
                  <TabsContent value="table" className="mt-0">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs text-muted-foreground">
                        Interest = {pct(loan.interestRate)} ÷ 365 × days × opening balance. Click any amount to edit.
                      </p>
                      <Button size="sm" onClick={() => setAddPaymentOpen(true)} className="bg-[#4648D4] hover:bg-[#3537b3]">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Payment
                      </Button>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-[11px] font-semibold text-[#464554] uppercase tracking-wider h-9">Date</TableHead>
                            <TableHead className="text-[11px] font-semibold text-[#464554] uppercase tracking-wider h-9 text-right">Days</TableHead>
                            <TableHead className="text-[11px] font-semibold text-[#464554] uppercase tracking-wider h-9 text-right">
                              Opening Balance (A)
                            </TableHead>
                            <TableHead className="text-[11px] font-semibold text-[#464554] uppercase tracking-wider h-9 text-right">
                              Payment Received (B)
                            </TableHead>
                            <TableHead className="text-[11px] font-semibold text-[#464554] uppercase tracking-wider h-9 text-right text-orange-700">
                              Interest (E)
                            </TableHead>
                            <TableHead className="text-[11px] font-semibold text-[#464554] uppercase tracking-wider h-9 text-right">
                              Principal (C=B-E)
                            </TableHead>
                            <TableHead className="text-[11px] font-semibold text-[#464554] uppercase tracking-wider h-9 text-right">
                              Closing Balance (D)
                            </TableHead>
                            <TableHead className="h-9 w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row, i) => (
                            <LoanTableRow
                              key={row.paymentId ?? 'start'}
                              row={row}
                              isStart={i === 0}
                              onPatchPayment={row.paymentId ? (patch) => patchPayment(row.paymentId!, patch) : undefined}
                              onDeletePayment={row.paymentId ? () => deletePayment(row.paymentId!) : undefined}
                            />
                          ))}
                          {rows.length <= 1 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                                No payments recorded. Add the first payment above.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>

                      {/* Totals footer */}
                      {rows.length > 1 && (
                        <div className="border-t-2 border-slate-300 bg-slate-50 px-4 py-2 grid grid-cols-7 gap-2 text-xs font-semibold">
                          <span className="col-span-2 text-[#464554]">TOTALS</span>
                          <span />
                          <span className="text-right text-green-700">
                            {fmt(rows.reduce((s, r) => s + r.paymentReceived, 0))}
                          </span>
                          <span className="text-right text-orange-600">
                            ({fmt(data.totalInterestAccrued)})
                          </span>
                          <span className="text-right">
                            {fmt(rows.reduce((s, r) => s + r.principal, 0))}
                          </span>
                          <span className="text-right text-red-600">{fmt(data.currentBalance)}</span>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Details Tab ───────────────────────────────────── */}
                  <TabsContent value="details" className="mt-0">
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                      {!detailsEditing ? (
                        <>
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="font-semibold text-[#191C1E]">Loan Information</h3>
                            <Button size="sm" variant="outline" onClick={openDetailsEdit}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <DetailRow label="Borrower" value={loan.borrowerName} />
                            <DetailRow label="Lender" value={loan.lenderName} />
                            <DetailRow label="Guarantors" value={loan.guarantors} />
                            <DetailRow label="Address" value={loan.address} />
                            <DetailRow label="Principal" value={fmt(loan.principal)} />
                            <DetailRow label="Interest Rate" value={pct(loan.interestRate) + ' per year'} />
                            <DetailRow label="Start Date" value={loan.startDate} />
                            <DetailRow label="Notes" value={loan.notes} />
                          </div>
                        </>
                      ) : detailsForm ? (
                        <>
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="font-semibold text-[#191C1E]">Edit Loan Information</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label>Borrower Name</Label>
                              <Input value={detailsForm.borrowerName} onChange={e => setDetailsForm(f => f ? { ...f, borrowerName: e.target.value } : f)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Lender Name</Label>
                              <Input value={detailsForm.lenderName} onChange={e => setDetailsForm(f => f ? { ...f, lenderName: e.target.value } : f)} />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                              <Label>Guarantors</Label>
                              <Input value={detailsForm.guarantors} onChange={e => setDetailsForm(f => f ? { ...f, guarantors: e.target.value } : f)} />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                              <Label>Address</Label>
                              <Input value={detailsForm.address} onChange={e => setDetailsForm(f => f ? { ...f, address: e.target.value } : f)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Principal ($)</Label>
                              <Input type="number" value={detailsForm.principal} onChange={e => setDetailsForm(f => f ? { ...f, principal: e.target.value } : f)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Annual Interest Rate (%)</Label>
                              <Input type="number" step="0.01" value={detailsForm.interestRate} onChange={e => setDetailsForm(f => f ? { ...f, interestRate: e.target.value } : f)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Start Date</Label>
                              <Input type="date" value={detailsForm.startDate} onChange={e => setDetailsForm(f => f ? { ...f, startDate: e.target.value } : f)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Notes</Label>
                              <Input value={detailsForm.notes} onChange={e => setDetailsForm(f => f ? { ...f, notes: e.target.value } : f)} />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-6">
                            <Button onClick={saveDetails} disabled={detailsSaving} className="bg-[#4648D4] hover:bg-[#3537b3]">
                              {detailsSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button variant="outline" onClick={() => setDetailsEditing(false)}>Cancel</Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Payment Dialog */}
      <Dialog open={addPaymentOpen} onOpenChange={o => !o && setAddPaymentOpen(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Payment Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={paymentForm.date}
                onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Amount ($) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="9300.00"
              />
              <p className="text-xs text-muted-foreground">
                Interest will be auto-calculated based on days elapsed and current balance.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={paymentForm.notes}
                onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPaymentOpen(false)}>Cancel</Button>
            <Button
              onClick={addPayment}
              disabled={addingSaving || !paymentForm.amount || !paymentForm.date}
              className="bg-[#4648D4] hover:bg-[#3537b3]"
            >
              {addingSaving ? 'Adding...' : 'Add Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">{label}</span>
      <p className="text-[#191C1E] mt-0.5">{value || '—'}</p>
    </div>
  )
}

function LoanTableRow({
  row,
  isStart,
  onPatchPayment,
  onDeletePayment,
}: {
  row: LoanTableRowDto
  isStart: boolean
  onPatchPayment?: (patch: object) => Promise<void>
  onDeletePayment?: () => void
}) {
  return (
    <TableRow className={`h-10 border-b ${row.isOverride ? 'bg-amber-50/40' : ''}`}>
      {/* Date */}
      <TableCell className="text-xs py-1 pl-4 font-medium">
        {onPatchPayment ? (
          <EditableCell
            value={row.date}
            type="date"
            onSave={v => onPatchPayment({ paymentDate: v })}
          />
        ) : (
          <span>{row.date} <span className="text-muted-foreground text-[10px]">(Start)</span></span>
        )}
      </TableCell>

      {/* Days */}
      <TableCell className="text-xs py-1 text-right tabular-nums text-muted-foreground">
        {isStart ? '—' : row.days}
      </TableCell>

      {/* Opening Balance A */}
      <TableCell className="text-xs py-1 text-right tabular-nums font-medium">
        {fmt(row.openingBalance)}
      </TableCell>

      {/* Payment Received B */}
      <TableCell className="text-xs py-1 text-right tabular-nums">
        {isStart ? '—' : onPatchPayment ? (
          <EditableCell
            value={row.paymentReceived.toFixed(2)}
            onSave={v => onPatchPayment({ paymentAmount: parseFloat(v) })}
            className="text-green-700 font-semibold"
          />
        ) : (
          <span className="text-green-700 font-semibold">{fmt(row.paymentReceived)}</span>
        )}
      </TableCell>

      {/* Interest E */}
      <TableCell className="text-xs py-1 text-right tabular-nums">
        {isStart ? '—' : onPatchPayment ? (
          <EditableCell
            value={row.interest.toFixed(2)}
            onSave={v => onPatchPayment({ overrideInterest: parseFloat(v) })}
            className="text-orange-600"
          />
        ) : (
          <span className="text-orange-600">({fmt(row.interest)})</span>
        )}
      </TableCell>

      {/* Principal C */}
      <TableCell className="text-xs py-1 text-right tabular-nums">
        {isStart ? '—' : fmt(row.principal)}
      </TableCell>

      {/* Closing Balance D */}
      <TableCell className="text-xs py-1 text-right tabular-nums font-semibold">
        <span className={row.closingBalance > row.openingBalance && !isStart ? 'text-red-600' : ''}>
          {fmt(row.closingBalance)}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className="py-1 pr-2 text-center">
        {onDeletePayment && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={onDeletePayment}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
