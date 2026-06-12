import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

interface ImportQueueItem {
  id: number
  runId: string | null
  clientName: string | null
  debtorName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  amount: number | null
  allDebtors: string | null
  totalInvoices: number | null
  totalAmount: number | null
  reviewStatus: string
  notes: string | null
  resolvedAt: string | null
  createdAt: string | null
}

export function ImportQueuePage() {
  const [items, setItems] = useState<ImportQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  useEffect(() => {
    fetchQueue()
  }, [])

  async function fetchQueue() {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get<ImportQueueItem[]>('/api/importqueue/pending')
      setItems(res.data)
    } catch {
      setError('Failed to load review queue.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDismiss(id: number) {
    setActionLoading(id)
    try {
      await api.post(`/api/importqueue/${id}/dismiss`, { notes: null })
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {
      setError('Failed to dismiss item.')
    } finally {
      setActionLoading(null)
    }
  }

  const fmt = (n: number | null) =>
    n == null ? '—' : n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Import Review Queue</h1>
        <p className="text-muted-foreground">Resolve unmatched invoices from the n8n import.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Raw Client Name</TableHead>
              <TableHead>Raw Debtor Name</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                  No items in the review queue.
                </TableCell>
              </TableRow>
            )}
            {!loading && items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-slate-800">{item.clientName ?? '—'}</TableCell>
                <TableCell className="text-slate-800">{item.debtorName ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm text-slate-600">{item.invoiceNumber ?? '—'}</TableCell>
                <TableCell className="text-sm text-slate-600">{item.invoiceDate ?? '—'}</TableCell>
                <TableCell className="text-right font-medium">{fmt(item.amount)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-transparent font-medium">
                    {item.reviewStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={actionLoading === item.id}
                    onClick={() => handleDismiss(item.id)}
                  >
                    Dismiss
                  </Button>
                  <Button size="sm" className="h-8 bg-[#4648D4] hover:bg-[#3b3db3] text-white" disabled>
                    Resolve
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
