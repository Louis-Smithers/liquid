import { useEffect, useMemo, useRef, useState, useCallback } from "react"
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
import { Input } from "@/components/ui/input"
import { ChevronDown } from "lucide-react"
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
  cadenceName: string | null
}

// Payload shape sent to /api/importqueue/resolve-group
interface DebtorMapping {
  rawDebtorName: string
  debtorId: string | null
  newDebtorName: string | null
}

const PAGE_SIZE = 25

// Sentinel values for the <select> dropdowns
const SKIP = ""
const CREATE_NEW = "__new__"

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

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
  clients: ClientOption[]
  debtors: DebtorOption[]
  onClose: () => void
  onResolved: (rawClientName: string, resolved: number, skipped: number) => void
}

function ResolveGroupModal({ rawClientName, items, clients, debtors, onClose, onResolved }: ResolveGroupModalProps) {
  // Client selection: '' = none, '__new__' = create, otherwise an existing shortcode
  const [selectedShortcode, setSelectedShortcode] = useState('')
  const [newClientShortcode, setNewClientShortcode] = useState('')
  const [newClientCadence, setNewClientCadence] = useState('')

  // Per raw-debtor-name selection: '' = skip, '__new__' = create, otherwise a debtor id
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [newDebtorNames, setNewDebtorNames] = useState<Record<string, string>>({})

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rawDebtorNames = useMemo(() => uniqueDebtorNames(items), [items])

  const fmt = (n: number | null) =>
    n == null ? '—' : n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  // Auto-match raw debtor names to existing debtors on open / when debtors load.
  useEffect(() => {
    if (debtors.length === 0) return
    const byName = new Map<string, string>()
    for (const d of debtors) {
      byName.set(normalize(d.name), d.id)
      if (d.cadenceName) byName.set(normalize(d.cadenceName), d.id)
    }
    setMappings(prev => {
      const next = { ...prev }
      let changed = false
      for (const raw of rawDebtorNames) {
        if (next[raw] !== undefined) continue // don't clobber a user choice
        const match = byName.get(normalize(raw))
        if (match) { next[raw] = match; changed = true }
      }
      return changed ? next : prev
    })
  }, [debtors, rawDebtorNames])

  function setMapping(rawName: string, value: string) {
    setMappings(prev => ({ ...prev, [rawName]: value }))
    if (value === CREATE_NEW) {
      // default the new debtor name to the raw name
      setNewDebtorNames(prev => prev[rawName] !== undefined ? prev : { ...prev, [rawName]: rawName })
    }
  }

  const creatingClient = selectedShortcode === CREATE_NEW

  // A raw name counts as "mapped" if it resolves to an existing debtor or a non-empty new name.
  const mappedCount = rawDebtorNames.filter(raw => {
    const v = mappings[raw]
    if (!v || v === SKIP) return false
    if (v === CREATE_NEW) return !!newDebtorNames[raw]?.trim()
    return true
  }).length

  const clientResolved = creatingClient
    ? !!newClientShortcode.trim()
    : !!selectedShortcode

  const canSubmit = clientResolved && mappedCount > 0

  async function handleSubmit() {
    if (!clientResolved) { setError('Select a client or create a new one.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const debtorMappings: DebtorMapping[] = []
      for (const raw of rawDebtorNames) {
        const v = mappings[raw]
        if (!v || v === SKIP) continue
        if (v === CREATE_NEW) {
          const name = newDebtorNames[raw]?.trim()
          if (!name) continue
          debtorMappings.push({ rawDebtorName: raw, debtorId: null, newDebtorName: name })
        } else {
          debtorMappings.push({ rawDebtorName: raw, debtorId: v, newDebtorName: null })
        }
      }

      const payload = creatingClient
        ? {
            clientName: rawClientName,
            shortcode: null,
            newClient: { shortcode: newClientShortcode.trim(), cadenceName: newClientCadence.trim() || null },
            debtorMappings,
          }
        : {
            clientName: rawClientName,
            shortcode: selectedShortcode,
            newClient: null,
            debtorMappings,
          }

      const res = await api.post<{ resolved: number; skipped: number }>(
        '/api/importqueue/resolve-group',
        payload
      )
      onResolved(rawClientName, res.data.resolved, res.data.skipped)
    } catch (e: any) {
      setError(e?.response?.data ?? 'Failed to resolve group.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve Group — {rawClientName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <p className="text-sm text-slate-500">
            {items.length} invoice{items.length !== 1 ? 's' : ''} with {rawDebtorNames.length} unique debtor name{rawDebtorNames.length !== 1 ? 's' : ''}.
            Map this raw client name to a client, then assign each raw debtor name to a debtor.
            Create a new client or debtor inline when no existing match fits.
          </p>

          {/* Full invoice detail list for the group */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Invoices in this group
            </Label>
            <div className="max-h-40 overflow-auto rounded-md border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="h-8">Raw Debtor Name</TableHead>
                    <TableHead className="h-8">Invoice #</TableHead>
                    <TableHead className="h-8">Date</TableHead>
                    <TableHead className="h-8 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-slate-800">{item.debtorName ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">{item.invoiceNumber ?? '—'}</TableCell>
                      <TableCell className="text-xs text-slate-600">{item.invoiceDate ?? '—'}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Client selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Map to Client
            </Label>
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4648D4]"
              value={selectedShortcode}
              onChange={e => setSelectedShortcode(e.target.value)}
            >
              <option value="">— Select client —</option>
              <option value={CREATE_NEW}>➕ Create new client…</option>
              {clients.map(c => (
                <option key={c.shortcode} value={c.shortcode}>
                  {c.shortcode}{c.cadenceName ? ` — ${c.cadenceName}` : ''}
                </option>
              ))}
            </select>

            {creatingClient && (
              <div className="mt-1 grid grid-cols-2 gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] font-medium text-slate-500">Shortcode *</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. 5626"
                    value={newClientShortcode}
                    onChange={e => setNewClientShortcode(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] font-medium text-slate-500">Client name</Label>
                  <Input
                    className="h-8"
                    placeholder="Cadence name"
                    value={newClientCadence}
                    onChange={e => setNewClientCadence(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Debtor mappings */}
          {rawDebtorNames.length > 0 && (
            <div className="flex flex-col gap-3">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Map Debtors
              </Label>
              <div className="flex flex-col gap-3 max-h-[40vh] overflow-auto pr-1">
                {rawDebtorNames.map(rawName => {
                  const v = mappings[rawName] ?? SKIP
                  const isExistingMatch = v !== SKIP && v !== CREATE_NEW
                  const isNew = v === CREATE_NEW
                  return (
                    <div key={rawName} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3">
                        <span className="w-1/2 text-sm font-mono text-slate-700 truncate" title={rawName}>
                          {rawName}
                        </span>
                        <select
                          className="flex-1 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4648D4]"
                          value={v}
                          onChange={e => setMapping(rawName, e.target.value)}
                        >
                          <option value={SKIP}>— Skip —</option>
                          <option value={CREATE_NEW}>➕ Create new debtor…</option>
                          {debtors.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      {isExistingMatch && (
                        <span className="ml-[calc(50%+0.75rem)] text-[11px] text-green-600">✓ matched to existing debtor</span>
                      )}
                      {isNew && (
                        <div className="ml-[calc(50%+0.75rem)] flex items-center gap-2">
                          <Input
                            className="h-8"
                            placeholder="New debtor name"
                            value={newDebtorNames[rawName] ?? ''}
                            onChange={e => setNewDebtorNames(prev => ({ ...prev, [rawName]: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  // Shared option lists for the resolve modal (loaded once)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [debtors, setDebtors] = useState<DebtorOption[]>([])

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

  // Load clients + all debtors once for the resolve modal.
  useEffect(() => {
    api.get<ClientOption[]>('/api/clients').then(r => setClients(r.data)).catch(() => {})
    api.get<DebtorOption[]>('/api/debtors').then(r => setDebtors(r.data)).catch(() => {})
  }, [])

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

  function toggleGroup(clientName: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(clientName)) next.delete(clientName)
      else next.add(clientName)
      return next
    })
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
    <div className="flex flex-col gap-6 w-full min-h-screen bg-[#F7F9FB] p-8 pt-6">
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

      {/* Grouped, collapsible view */}
      {Array.from(grouped.entries()).map(([clientName, groupItems]) => {
        const isOpen = openGroups.has(clientName)
        return (
          <div key={clientName} className="rounded-md border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
              <button
                type="button"
                className="flex items-center gap-3 flex-1 text-left"
                onClick={() => toggleGroup(clientName)}
                aria-expanded={isOpen}
              >
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                <span className="font-semibold text-slate-800">{clientName}</span>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-transparent text-xs">
                  {groupItems.length} pending
                </Badge>
              </button>
              <Button
                size="sm"
                className="h-8 bg-[#4648D4] hover:bg-[#3b3db3] text-white"
                onClick={() => setResolveGroup(clientName)}
              >
                Resolve Group
              </Button>
            </div>

            {isOpen && (
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
            )}
          </div>
        )
      })}

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
          clients={clients}
          debtors={debtors}
          onClose={() => setResolveGroup(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  )
}
