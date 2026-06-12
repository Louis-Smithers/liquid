import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { LoanSummaryDto } from '@/types/loans'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { LoanDrawer } from '@/components/loans/LoanDrawer'

const fmt = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function balanceColor(current: number, principal: number) {
  if (current > principal) return 'text-red-600'
  if (current > principal * 0.5) return 'text-orange-600'
  return 'text-green-700'
}

interface NewLoanForm {
  borrowerName: string
  lenderName: string
  guarantors: string
  address: string
  principal: string
  interestRate: string
  startDate: string
  notes: string
}

const emptyForm: NewLoanForm = {
  borrowerName: '',
  lenderName: 'Liquid Capital WGP Inc.',
  guarantors: '',
  address: '',
  principal: '',
  interestRate: '18',
  startDate: new Date().toISOString().slice(0, 10),
  notes: '',
}

export function LoansPage() {
  const [loans, setLoans] = useState<LoanSummaryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<NewLoanForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchLoans = async () => {
    try {
      const res = await api.get<LoanSummaryDto[]>('/api/loans')
      setLoans(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLoans() }, [])

  const totalLoaned = loans.reduce((s, l) => s + l.principal, 0)
  const totalOutstanding = loans.reduce((s, l) => s + l.currentBalance, 0)

  const handleCreate = async () => {
    if (!form.borrowerName || !form.principal || !form.interestRate || !form.startDate) return
    setSaving(true)
    try {
      await api.post('/api/loans', {
        borrowerName: form.borrowerName,
        lenderName: form.lenderName || 'Liquid Capital WGP Inc.',
        guarantors: form.guarantors || null,
        address: form.address || null,
        principal: parseFloat(form.principal),
        interestRate: parseFloat(form.interestRate) / 100,
        startDate: form.startDate,
        notes: form.notes || null,
      })
      setNewOpen(false)
      setForm(emptyForm)
      await fetchLoans()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const f = (key: keyof NewLoanForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="flex flex-col w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      {/* Header */}
      <div className="flex flex-row justify-between items-center pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.24px] text-[#191C1E]">
            Loans
          </h1>
          <p className="text-[13px] leading-[18px] text-[#464554]">
            Manage loan agreements and repayment tables.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary badges */}
          <div className="flex items-center gap-2 text-xs text-[#464554] bg-white border border-[#C7C4D7]/50 rounded px-3 py-1.5">
            <span className="font-medium">Total Loaned:</span>
            <span className="font-bold text-[#191C1E]">{fmt(totalLoaned)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#464554] bg-white border border-[#C7C4D7]/50 rounded px-3 py-1.5">
            <span className="font-medium">Outstanding:</span>
            <span className={`font-bold ${totalOutstanding > totalLoaned ? 'text-red-600' : 'text-[#191C1E]'}`}>
              {fmt(totalOutstanding)}
            </span>
          </div>
          <Button
            onClick={() => setNewOpen(true)}
            className="bg-[#4648D4] hover:bg-[#3537b3] h-9"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Loan
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col flex-1 bg-white border border-[rgba(199,196,215,0.5)] shadow-[0px_1px_3px_rgba(0,0,0,0.1)] rounded-lg overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-[#F7F9FB] sticky top-0 z-10">
              <TableRow className="border-b border-[rgba(199,196,215,0.5)] hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px]">Borrower</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px]">Lender</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right">Principal</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right">Current Balance</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-center">Rate</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px]">Start Date</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right w-[120px]">Payments</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right pr-4 w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-[#6B7280] text-sm">Loading loans...</TableCell>
                </TableRow>
              ) : loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-[#6B7280] text-sm">No loans found. Create one to get started.</TableCell>
                </TableRow>
              ) : (
                loans.map(loan => (
                  <TableRow
                    key={loan.id}
                    className="cursor-pointer hover:bg-[#F8FAFC] border-t border-[rgba(199,196,215,0.5)] transition-colors"
                    onClick={() => setSelectedId(loan.id)}
                  >
                    <TableCell className="pl-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#191C1E]">{loan.borrowerName}</span>
                        {loan.guarantors && (
                          <span className="text-[11px] text-[#6B7280] truncate max-w-[220px]" title={loan.guarantors}>
                            {loan.guarantors}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-[#464554]">{loan.lenderName}</TableCell>
                    <TableCell className="py-3 text-right font-semibold text-[13px] tabular-nums">{fmt(loan.principal)}</TableCell>
                    <TableCell className="py-3 text-right tabular-nums">
                      <span className={`text-[13px] font-bold ${balanceColor(loan.currentBalance, loan.principal)}`}>
                        {fmt(loan.currentBalance)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <Badge variant="outline" className="bg-[#EEF2FF] text-[#4648D4] border-[#C7D2FE] text-xs font-semibold">
                        {(loan.interestRate * 100).toFixed(2)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-[#464554]">
                      {new Date(loan.startDate).toLocaleDateString('en-CA')}
                    </TableCell>
                    <TableCell className="py-3 text-right text-[13px] text-[#464554]">{loan.paymentCount}</TableCell>
                    <TableCell className="py-3 text-right pr-4">
                      <button
                        className="text-xs font-semibold tracking-[0.6px] text-[#4648D4] hover:text-[#3537b3] transition-colors"
                        onClick={e => { e.stopPropagation(); setSelectedId(loan.id) }}
                      >
                        VIEW TABLE
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t-2 border-[#C7C4D7] bg-[#F7F9FB] px-4 py-3">
          <span className="text-xs font-semibold tracking-[0.6px] text-[#191C1E]">
            {loans.length} LOAN{loans.length !== 1 ? 'S' : ''}
          </span>
        </div>
      </div>

      {/* Drawer */}
      {selectedId && (
        <LoanDrawer
          loanId={selectedId}
          onClose={() => { setSelectedId(null); fetchLoans() }}
        />
      )}

      {/* New Loan Dialog */}
      <Dialog open={newOpen} onOpenChange={o => { if (!o) { setNewOpen(false); setForm(emptyForm) } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>New Loan</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Borrower Name <span className="text-red-500">*</span></Label>
              <Input value={form.borrowerName} onChange={f('borrowerName')} placeholder="9512-3220 Quebec Inc" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Lender Name</Label>
              <Input value={form.lenderName} onChange={f('lenderName')} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Guarantors</Label>
              <Input value={form.guarantors} onChange={f('guarantors')} placeholder="Jimmy Tassopoulos, George Provatopoulos..." />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={f('address')} placeholder="12062-12064 rue Daigle" />
            </div>
            <div className="space-y-1.5">
              <Label>Principal ($) <span className="text-red-500">*</span></Label>
              <Input type="number" value={form.principal} onChange={f('principal')} placeholder="620000" />
            </div>
            <div className="space-y-1.5">
              <Label>Annual Interest Rate (%) <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.01" value={form.interestRate} onChange={f('interestRate')} placeholder="18" />
            </div>
            <div className="space-y-1.5">
              <Label>Start Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={form.startDate} onChange={f('startDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={f('notes')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewOpen(false); setForm(emptyForm) }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.borrowerName || !form.principal || !form.startDate}
              className="bg-[#4648D4] hover:bg-[#3537b3]"
            >
              {saving ? 'Creating...' : 'Create Loan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
