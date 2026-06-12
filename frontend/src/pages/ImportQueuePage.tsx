import { useEffect, useRef, useState, useCallback } from "react"
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
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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

interface PageResponse {
  items: ImportQueueItem[]
  nextCursor: number | null
}

interface ClientOption {
  shortcode: string
  cadenceName: string | null
}

interface DebtorOption {
  id: string
  name: string
}

interface DebtorMapping {
  rawDebtorName: string
  debtorId: string
}

const PAGE_SIZE = 25

function groupByClient(items: ImportQueueItem[]): Map<string, ImportQueueItem[]> {
  const map = new Map<string, ImportQueueItem[]>()
  for (const item of items) {
    const key = item.clientName ?? '(unknown)'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

function uniqueDebtorNames(items: ImportQueueItem[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const name = item.debtorName ?? ''
    if (name && !seen.has(name)) { seen.add(name); result.push(name) }
  }
  return result
}

interface ResolveGroupModalProps {
  rawClientName: string
  items: ImportQueueItem[]
  onClose: () => void
  onResolved: (rawClientName: string, resolved: number, skipped: number) => void
}

function ResolveGroupModal({ rawClientName, items, onClose, onResolved }: ResolveGroupModalProps) {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [debtors, setDebtors] = useState<DebtorOption[]>([])
  const [selectedShortcode, setSelectedShortcode] = useState('')
  const [mappings, setMappings] = useState<Record<string, string>>({}) // rawName → debtorId
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rawDebtorNames = uniqueDebtorNames(items)

  useEffect(() => {
    api.get<ClientOption[]>('/api/clients').then(r => setClients(r.data))
  }, [])

  useEffect(() => {
    if (!selectedShortcode) { setDebtors([]); return }
    api.get<DebtorOption[]>(`/api/debtors/by-client/${selectedShortcode}`)
      .then(r => setDebtors(r.data))
  }, [selectedShortcode])

  function setMapping(rawName: string, debtorId: string) {
    setMappings(prev => ({ ...prev, [rawName]: debtorId }))
  }

  async function handleSubmit() {
    if (!selectedShortcode) { setError('Select a client.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const debtorMappings: DebtorMapping[] = Object.entries(mappings)
        .filter(([, did]) => !!did)
        .map(([rawDebtorName, debtorId]) => ({ rawDebtorName, debtorId }))

      const res = await api.post<{ resolved: number; skipped: number }>(
        '/api/importqueue/resolve-group',
        { clientName: rawClientName, shortcode: selectedShortcode, debtorMappings }
      )
      onResolved(rawClientName, res.data.resolved, res.data.skipped)
    } catch (e: any) {
      setError(e?.response?.data ?? 'Failed to resolve group.')
    } finally {
      setSubmitting(false)
    }
  }

  const mappedCount = Object.values(mappings).filter(Boolean).length
  const canSubmit = !!selectedShortcode && mappedCount > 0

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Group — {rawClientName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <p className="text-sm text-slate-500">
            {items.length} invoice{items.length !== 1 ? 's' : ''} with {rawDebtorNames.length} unique debtor name{rawDebtorNames.length !== 1 ? 's' : ''}.
            Map this raw client name to an existing client, then assign each raw debtor name to an existing debtor.
          </p>

          {/* Client selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Map to Client
            </Label>
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4648D4]"
              value={selectedShortcode}
              onChange={e => { setSelectedShortcode(e.target.value); setMappings({}) }}
            >
              <option value="">— Select client —</option>
              {clients.map(c => (
                <option key={c.shortcode} value={c.shortcode}>
                  {c.shortcode}{c.cadenceName ? ` — ${c.cadenceName}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Debtor mappings */}
          {rawDebtorNames.length > 0 && (
            <div className="flex flex-col gap-3">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Map Debtors
              </Label>
              {rawDebtorNames.map(rawName => (
                <div key={rawName} className="flex items-center gap-3">
                  <span className="w-1/2 text-sm font-mono text-slate-700 truncate" title={rawName}>
                    {rawName}
                  </span>
                  <select
                    className="flex-1 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4648D4] disabled:opacity-50"
                    value={mappings[rawName] ?? ''}
                    onChange={e => setMapping(rawName, e.target.value)}
                    disabled={!selectedShortcode || debtors.length === 0}
                  >
                    <option value="">— Skip —</option>
                    {debtors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              {selectedShortcode && debtors.length === 0 && (
                <p className="text-xs text-slate-400">No debtors found for this client.</p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            className="bg-[#4648D4] hover:bg-[#3b3db3] text-white"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Resolving…' : `Resolve (${mappedCount} / ${rawDebtorNames.length} mapped)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ImportQueuePage() {
  const [items, setItems] = useState<ImportQueueItem[]>([])
  const [nextCursor, setNextCursor] = useState<number | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [resolveGroup, setResolveGroup] = useState<string | null>(null) // raw client name
  const [toast, setToast] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (cursor: number | null | undefined) => {
    if (cursor === null || loading) return
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { pageSize: String(PAGE_SIZE) }
      if (cursor !== undefined) params.cursor = String(cursor)
      const res = await api.get<PageResponse>('/api/importqueue/pending', { params })
      setItems(prev => cursor === undefined ? res.data.items : [...prev, ...res.data.items])
      setNextCursor(res.data.nextCursor)
    } catch {
      setError('Failed to load review queue.')
    } finally {
      setLoading(false)
    }
  }, [loading])

  useEffect(() => { fetchPage(undefined) }, [])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchPage(nextCursor) },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, fetchPage])

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

  function handleResolved(rawClientName: string, resolved: number, skipped: number) {
    setResolveGroup(null)
    setItems(prev => prev.filter(i => i.clientName !== rawClientName || i.reviewStatus !== 'Pending'))
    const msg = `Resolved ${resolved} invoice${resolved !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped (unmapped debtors)` : ''}.`
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  const fmt = (n: number | null) =>
    n == null ? '—' : n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  const grouped = groupByClient(items)
  const resolveGroupItems = resolveGroup ? (grouped.get(resolveGroup) ?? []) : []

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

      {toast && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}

      {/* Grouped view */}
      {Array.from(grouped.entries()).map(([clientName, groupItems]) => (
        <div key={clientName} className="rounded-md border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-800">{clientName}</span>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-transparent text-xs">
                {groupItems.length} pending
              </Badge>
            </div>
            <Button
              size="sm"
              className="h-8 bg-[#4648D4] hover:bg-[#3b3db3] text-white"
              onClick={() => setResolveGroup(clientName)}
            >
              Resolve Group
            </Button>
          </div>
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead>Raw Debtor Name</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-slate-800">{item.debtorName ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm text-slate-600">{item.invoiceNumber ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-600">{item.invoiceDate ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(item.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={actionLoading === item.id}
                      onClick={() => handleDismiss(item.id)}
                    >
                      Dismiss
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {/* Sentinel */}
      <div ref={sentinelRef} className="py-4 text-center text-sm text-slate-400">
        {loading && 'Loading...'}
        {!loading && nextCursor === null && items.length > 0 && 'All items loaded.'}
        {!loading && items.length === 0 && 'No items in the review queue.'}
      </div>

      {/* Resolve Group Modal */}
      {resolveGroup && (
        <ResolveGroupModal
          rawClientName={resolveGroup}
          items={resolveGroupItems}
          onClose={() => setResolveGroup(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  )
}
