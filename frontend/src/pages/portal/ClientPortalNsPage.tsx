import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, ClipboardList } from 'lucide-react'

interface Invoice {
  invoiceId: string
  originalInvoice: string
  date: string
  debtorName: string
  amount: number
  status: string
}

interface NsItem {
  id: string
  invoiceId: string
  invoiceNumber: string
  debtorName: string
  includedAmount: number
}

interface Draft {
  id: string
  status: string
  submittedForReviewByClient: boolean
  items: NsItem[]
  totalAmount: number
  itemCount: number
}

const fmt = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

export function ClientPortalNsPage() {
  const { session, clientShortcode } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [loadingDraft, setLoadingDraft] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const authHeaders = { Authorization: `Bearer ${session?.access_token}` }

  const inDraftIds = new Set(draft?.items.map(i => i.invoiceId) ?? [])

  useEffect(() => {
    if (!clientShortcode) return
    fetch(`/api/invoices/client/${clientShortcode}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : [])
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoadingInvoices(false))
  }, [clientShortcode, session])

  useEffect(() => {
    fetch('/api/notificationsheets/mine', { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setDraft(data)
        if (data?.submittedForReviewByClient) setSubmitted(true)
      })
      .catch(console.error)
      .finally(() => setLoadingDraft(false))
  }, [session])

  const toggleInvoice = async (inv: Invoice, checked: boolean) => {
    setActionInProgress(inv.invoiceId)
    try {
      if (checked) {
        const res = await fetch('/api/notificationsheets/mine/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ invoiceId: inv.invoiceId, includedAmount: inv.amount }),
        })
        if (res.ok) {
          const item: NsItem = await res.json()
          setDraft(prev => prev ? { ...prev, items: [...prev.items, item], itemCount: prev.itemCount + 1, totalAmount: prev.totalAmount + item.includedAmount } : prev)
        }
      } else {
        const item = draft?.items.find(i => i.invoiceId === inv.invoiceId)
        if (!item || !draft) return
        const res = await fetch(`/api/notificationsheets/mine/items/${item.id}?sheetId=${draft.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        })
        if (res.ok) {
          setDraft(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== item.id), itemCount: prev.itemCount - 1, totalAmount: prev.totalAmount - item.includedAmount } : prev)
        }
      }
    } finally {
      setActionInProgress(null)
    }
  }

  const handleSubmitForReview = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/notificationsheets/mine/submit-for-review', {
        method: 'POST',
        headers: authHeaders,
      })
      if (res.ok) {
        setSubmitted(true)
        setDraft(prev => prev ? { ...prev, submittedForReviewByClient: true } : prev)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NS Queue</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h2 className="text-xl font-semibold">Submitted for Review</h2>
          <p className="text-muted-foreground max-w-md">
            Your NS queue has been submitted to the Liquid team for review. They will apply fee calculations and finalize it.
          </p>
          <Badge variant="secondary">{draft?.itemCount ?? 0} invoices · {fmt(draft?.totalAmount ?? 0)}</Badge>
        </div>
      </div>
    )
  }

  const loading = loadingInvoices || loadingDraft

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NS Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Select invoices to include in your next notification sheet. Staff will apply fee calculations and submit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {draft && draft.itemCount > 0 && (
            <span className="text-sm text-muted-foreground">
              <strong>{draft.itemCount}</strong> selected · <strong>{fmt(draft.totalAmount)}</strong>
            </span>
          )}
          <Button
            onClick={handleSubmitForReview}
            disabled={submitting || !draft || draft.itemCount === 0}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Debtor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No invoices available.</TableCell></TableRow>
            ) : invoices.map(inv => {
              const isIn = inDraftIds.has(inv.invoiceId)
              const isPending = actionInProgress === inv.invoiceId
              return (
                <TableRow key={inv.invoiceId} className={isIn ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={isIn}
                      disabled={isPending}
                      onCheckedChange={(checked) => toggleInvoice(inv, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{inv.originalInvoice || inv.invoiceId}</TableCell>
                  <TableCell>{inv.date}</TableCell>
                  <TableCell>{inv.debtorName}</TableCell>
                  <TableCell className="text-right">{fmt(inv.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{inv.status}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
