import { useState, useEffect, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { InvoicePreviewModal } from "@/components/invoices/InvoicePreviewModal"
import { InvoiceNotesPopover } from "@/components/invoices/InvoiceNotesPopover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, ChevronDown, ChevronRight, FileText, Loader2, ShoppingCart, ExternalLink } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { api } from "@/lib/api"
import type { Client } from "@/pages/ClientsPage"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import { useNSQueue } from "@/context/NSQueueContext"

interface ClientSummaryAging {
  d30: number
  d60: number
  d90: number
  d120: number
  over120: number
}

interface ClientSummaryDebtor {
  id: string
  name: string
  invoiceCount: number
  totalAmount: number
  aging: ClientSummaryAging
}

interface ClientSummary {
  totalAmount: number
  openCount: number
  verifiedPercent: number
  verifiedAmount: number
  aging: ClientSummaryAging
  debtors: ClientSummaryDebtor[]
}

interface Invoice {
  invoiceId: string
  originalInvoice: string
  date: string
  amount: number
  status: string
  debtorName?: string
  notes?: string
  flagged?: boolean
  flagReason?: string
  source: string
  isProcessed: boolean
}

interface InvoicePage {
  items: Invoice[]
  nextCursorTime: string | null
  nextCursorId: string | null
}

// (client x debtor) invoice sets are small, so we load them fully on first expand rather than
// cursor-paging — mirrors DebtorDrawer.tsx's per-group loading.
const GROUP_PAGE_SIZE = 100
const GROUP_LOAD_GUARD = 50

// Per-debtor-group UI + data state. Kept in a map keyed by debtor id so selection, search-driven
// expansion, and NS actions are strictly scoped to one debtor group at a time.
interface DebtorGroupState {
  expanded: boolean
  loaded: boolean
  loading: boolean
  invoices: Invoice[]
  unprocessedSelected: string[]
  processedSelected: string[]
  addingToQueue: boolean
  bulkNoteDraft: string
  postingBulkNote: boolean
  unprocessedExpanded: boolean
  processedExpanded: boolean
}

const makeInitialGroupState = (): DebtorGroupState => ({
  expanded: false,
  loaded: false,
  loading: false,
  invoices: [],
  unprocessedSelected: [],
  processedSelected: [],
  addingToQueue: false,
  bulkNoteDraft: '',
  postingBulkNote: false,
  unprocessedExpanded: true,
  processedExpanded: true,
})

interface NotificationSheet {
  id: string
  clientShortcode: string
  status: string
  createdAt: string
  totalAmount?: number
}

interface ClientDrawerProps {
  client: Client | null
  onClose: () => void
}

type SortDirection = "asc" | "desc" | null;

// ── Inline aging bar chart ─────────────────────────────────────────────────
function AgingBarChart({ aging }: { aging: ClientSummaryAging }) {
  const buckets = [
    { label: '0–30d', value: aging.d30, color: '#22c55e' },
    { label: '31–60d', value: aging.d60, color: '#84cc16' },
    { label: '61–90d', value: aging.d90, color: '#eab308' },
    { label: '91–120d', value: aging.d120, color: '#f97316' },
    { label: '120+d', value: aging.over120, color: '#ef4444' },
  ]
  const total = buckets.reduce((s, b) => s + b.value, 0)
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-4">No aging data</p>

  const fmt = (v: number) =>
    '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="w-full space-y-2">
      {/* stacked bar */}
      <div className="flex w-full h-6 rounded overflow-hidden gap-px">
        {buckets.map(b => {
          const pct = (b.value / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={b.label}
              style={{ width: `${pct}%`, backgroundColor: b.color }}
              title={`${b.label}: ${fmt(b.value)} (${pct.toFixed(1)}%)`}
            />
          )
        })}
      </div>
      {/* legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
        {buckets.map(b => (
          <div key={b.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
            <span className="font-medium text-[#191C1E]">{b.label}</span>
            <span>{fmt(b.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── New Debtor dialog ──────────────────────────────────────────────────────
function NewDebtorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', group: 'Active', active: true })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/debtors', form)
      setForm({ name: '', group: 'Active', active: true })
      onClose()
    } catch (err) {
      console.error('Failed to create debtor', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Debtor</DialogTitle>
            <DialogDescription>Create a new debtor in the system.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nd-name" className="text-right">Name</Label>
              <Input id="nd-name" required className="col-span-3" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Wayne Enterprises LLC" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="nd-group"
                className="text-right cursor-help"
                title="Debtors added by an n8n import start as Under Review until vetted."
              >
                Under Review / Approved
              </Label>
              <div className="col-span-3">
                <Select value={form.group} onValueChange={v => setForm({ ...form, group: v })}>
                  <SelectTrigger id="nd-group"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Approved</SelectItem>
                    <SelectItem value="Review">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#4648D4] hover:bg-[#3537b3] text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Debtor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Assignment Letter dialog ───────────────────────────────────────────────
function AssignmentLetterDialog({ open, onClose, shortcode }: { open: boolean; onClose: () => void; shortcode: string }) {
  const [sheets, setSheets] = useState<NotificationSheet[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.get<NotificationSheet[]>(`/api/notificationsheets/client/${shortcode}`)
      .then(r => setSheets(r.data))
      .catch(err => console.error('Failed to load sheets', err))
      .finally(() => setLoading(false))
  }, [open, shortcode])

  const fmt = (v: number | undefined) =>
    v != null ? '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'

  const handleDownload = async (id: string) => {
    try {
      const res = await api.get(`/api/notificationsheets/${id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `AssignmentLetter_${shortcode}_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download PDF', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Assignment Letters — {shortcode}</DialogTitle>
          <DialogDescription>Download assignment letters for submitted notification sheets.</DialogDescription>
        </DialogHeader>
        <div className="py-2 max-h-[380px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notification sheets found for this client.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold text-[#464554] uppercase tracking-[0.6px]">
                  <th className="text-left pb-2 pl-2">Date</th>
                  <th className="text-left pb-2">Status</th>
                  <th className="text-right pb-2 pr-2">Total</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {sheets.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pl-2 text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-transparent font-semibold ${
                        s.status === 'Submitted' ? 'bg-[#DCFCE7] text-[#15803D]' :
                        s.status === 'Draft' ? 'bg-[#FEF9C3] text-[#A16207]' :
                        'bg-slate-100 text-slate-700'
                      }`}>{s.status}</Badge>
                    </td>
                    <td className="py-2 pr-2 text-right text-xs font-semibold">{fmt(s.totalAmount)}</td>
                    <td className="py-2 pr-2 text-right">
                      {s.status === 'Submitted' ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => handleDownload(s.id)}>
                          <FileText className="h-3 w-3" /> Download
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main drawer ────────────────────────────────────────────────────────────
export function ClientDrawer({ client, onClose }: ClientDrawerProps) {
  const [summary, setSummary] = useState<ClientSummary | null>(null)
  // Flat, unpaged invoice list — kept ONLY to power the Overview tab's "Flagged Invoices" count.
  // The merged Debtor & Invoices tab loads its own per-debtor-group data (see `groups` below).
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const { activeQueue, setActiveClient, addItem, togglePanel } = useNSQueue()

  // Sorting
  const [debtorSortCol, setDebtorSortCol] = useState<string | null>(null)
  const [debtorSortDir, setDebtorSortDir] = useState<SortDirection>(null)

  // Per-debtor-group state for the merged "Debtor & Invoices" tab (mirrors DebtorDrawer.tsx).
  const [groups, setGroups] = useState<Record<string, DebtorGroupState>>({})

  // Details form
  const [detailsForm, setDetailsForm] = useState<Partial<Client>>({})
  const [savingDetails, setSavingDetails] = useState(false)

  // Dialog visibility
  const [newDebtorOpen, setNewDebtorOpen] = useState(false)
  const [assignmentLetterOpen, setAssignmentLetterOpen] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<{ id: string; originalInvoice: string } | null>(null)

  // Invoice search filter (mirrors DebtorDrawer.tsx: filters across groups, auto-expands matches)
  const [invoiceSearch, setInvoiceSearch] = useState('')

  useEffect(() => {
    if (client) {
      setActiveClient(client.shortcode)
      setDetailsForm(client)
    } else {
      setActiveClient(null)
    }
  }, [client, setActiveClient])

  useEffect(() => {
    if (!client) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const [summaryRes, invoicesRes] = await Promise.all([
          api.get<ClientSummary>(`/api/clients/${client.shortcode}/summary`),
          api.get<Invoice[]>(`/api/invoices/client/${client.shortcode}`)
        ])
        setSummary(summaryRes.data)
        setInvoices(invoicesRes.data)
      } catch (error) {
        console.error("Failed to fetch client details:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    setGroups({})
    setInvoiceSearch('')
  }, [client])

  // Auto-expand the single debtor group when there's only one — the common case.
  useEffect(() => {
    if (summary?.debtors && summary.debtors.length === 1) {
      const id = summary.debtors[0].id
      setGroups(prev => ({
        ...prev,
        [id]: { ...(prev[id] ?? makeInitialGroupState()), expanded: true }
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.debtors])

  const updateGroup = (debtorId: string, patch: Partial<DebtorGroupState> | ((prev: DebtorGroupState) => Partial<DebtorGroupState>)) => {
    setGroups(prev => {
      const current = prev[debtorId] ?? makeInitialGroupState()
      const delta = typeof patch === 'function' ? patch(current) : patch
      return { ...prev, [debtorId]: { ...current, ...delta } }
    })
  }

  // Loads the full (client x debtor) invoice set for one debtor group, looping the cursor until
  // exhausted. This set is small in practice, so "fully loaded then split client-side by
  // isProcessed" replaces the old read-only aging drill-down and the fragile whole-client
  // interleaved processed paging.
  const loadGroupInvoices = async (debtorId: string) => {
    if (!client) return
    updateGroup(debtorId, { loading: true })
    try {
      let cursor: { time: string; id: string } | null = null
      let gathered: Invoice[] = []
      let hasMore = true
      let guard = 0
      while (hasMore && guard < GROUP_LOAD_GUARD) {
        guard++
        const query = new URLSearchParams()
        query.set('pageSize', String(GROUP_PAGE_SIZE))
        query.set('debtorId', debtorId)
        if (cursor) {
          query.set('cursorTime', cursor.time)
          query.set('cursorId', cursor.id)
        }
        const res = await api.get<InvoicePage>(`/api/invoices/client/${client.shortcode}/page?${query.toString()}`)
        gathered = gathered.concat(res.data.items)
        if (res.data.nextCursorTime && res.data.nextCursorId) {
          cursor = { time: res.data.nextCursorTime, id: res.data.nextCursorId }
        } else {
          hasMore = false
        }
      }
      updateGroup(debtorId, { invoices: gathered, loaded: true })
    } catch (error) {
      console.error(`Failed to load invoices for debtor ${debtorId}:`, error)
    } finally {
      updateGroup(debtorId, { loading: false })
    }
  }

  const toggleDebtorExpand = (debtorId: string) => {
    const current = groups[debtorId] ?? makeInitialGroupState()
    const nextExpanded = !current.expanded
    updateGroup(debtorId, { expanded: nextExpanded })
    if (nextExpanded && !current.loaded && !current.loading) {
      loadGroupInvoices(debtorId)
    }
  }

  const matchesGroupSearch = (inv: Invoice, q: string) =>
    !q ||
    inv.originalInvoice.toLowerCase().includes(q) ||
    inv.status.toLowerCase().includes(q)

  // Auto-expand groups with search matches so results surface without manual clicking, and
  // lazy-load them the same way a manual expand would.
  useEffect(() => {
    if (!invoiceSearch.trim()) return
    const q = invoiceSearch.toLowerCase()
    ;(summary?.debtors ?? []).forEach(d => {
      const current = groups[d.id]
      const debtorMatches = d.name.toLowerCase().includes(q)
      const hasLoadedMatch = current?.invoices.some(inv => matchesGroupSearch(inv, q))
      if ((debtorMatches || hasLoadedMatch) && !current?.expanded) {
        toggleDebtorExpand(d.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceSearch, summary?.debtors])

  const toggleUnprocessedInvoice = (debtorId: string, invoiceId: string) => {
    updateGroup(debtorId, prev => ({
      unprocessedSelected: prev.unprocessedSelected.includes(invoiceId)
        ? prev.unprocessedSelected.filter(id => id !== invoiceId)
        : [...prev.unprocessedSelected, invoiceId]
    }))
  }

  const toggleProcessedInvoice = (debtorId: string, invoiceId: string) => {
    updateGroup(debtorId, prev => ({
      processedSelected: prev.processedSelected.includes(invoiceId)
        ? prev.processedSelected.filter(id => id !== invoiceId)
        : [...prev.processedSelected, invoiceId]
    }))
  }

  const handleAddSelectedToQueue = async (debtorId: string) => {
    const group = groups[debtorId]
    if (!group || group.unprocessedSelected.length === 0 || !client) return
    updateGroup(debtorId, { addingToQueue: true })
    try {
      for (const invoiceId of group.unprocessedSelected) {
        const inv = group.invoices.find(i => i.invoiceId === invoiceId)
        if (!inv) continue
        await addItem(inv.invoiceId, inv.amount, client.shortcode)
      }
      updateGroup(debtorId, { unprocessedSelected: [] })
      await loadGroupInvoices(debtorId)
    } catch (err) {
      console.error('Failed to add invoices to NS queue', err)
    } finally {
      updateGroup(debtorId, { addingToQueue: false })
    }
  }

  const handlePostBulkNote = async (debtorId: string) => {
    const group = groups[debtorId]
    if (!group || !group.bulkNoteDraft.trim() || group.processedSelected.length === 0) return
    updateGroup(debtorId, { postingBulkNote: true })
    try {
      await api.post('/api/invoices/notes/bulk', {
        invoiceIds: group.processedSelected,
        text: group.bulkNoteDraft.trim()
      })
      updateGroup(debtorId, { bulkNoteDraft: '', processedSelected: [] })
    } catch (err) {
      console.error('Failed to post bulk note', err)
    } finally {
      updateGroup(debtorId, { postingBulkNote: false })
    }
  }

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setDetailsForm(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : undefined) : value
    }))
  }

  const handleDetailsCheckboxChange = (name: keyof Client, checked: boolean) => {
    setDetailsForm(prev => ({ ...prev, [name]: checked }))
  }

  const saveDetails = async () => {
    if (!client) return
    setSavingDetails(true)
    try {
      await api.put(`/api/clients/${client.shortcode}`, detailsForm)
    } catch (err) {
      console.error("Failed to update client", err)
    } finally {
      setSavingDetails(false)
    }
  }

  const formatCurrency = (val: number | undefined) => {
    if (val == null || val === 0) return '$0'
    return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const handleDebtorSort = (col: string, dir: SortDirection) => { setDebtorSortCol(col); setDebtorSortDir(dir) }

  const sortedDebtors = useMemo(() => {
    if (!summary?.debtors) return []
    const sorted = [...summary.debtors]
    if (!debtorSortCol || !debtorSortDir) return sorted
    sorted.sort((a, b) => {
      let aVal: any = a[debtorSortCol as keyof ClientSummaryDebtor]
      let bVal: any = b[debtorSortCol as keyof ClientSummaryDebtor]
      if (debtorSortCol.startsWith('aging.')) {
        const field = debtorSortCol.split('.')[1] as keyof ClientSummaryAging
        aVal = a.aging[field]; bVal = b.aging[field]
      }
      if (aVal < bVal) return debtorSortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return debtorSortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [summary?.debtors, debtorSortCol, debtorSortDir])

  const statusBadgeClass = (status: string) =>
    `border-transparent font-medium ${
      status === 'Pre-Verified' ? 'bg-[#DCFCE7] text-[#15803D]' :
      status === 'Unverified' ? 'bg-[#FEF9C3] text-[#A16207]' :
      status === 'Paid' ? 'bg-slate-800 text-white' :
      status === 'OA' ? 'bg-blue-100 text-blue-800' :
      'bg-[#FEE2E2] text-[#B91C1C]'
    }`

  const renderInvoiceRows = (
    rows: Invoice[],
    selected: string[],
    onToggle: (invoiceId: string) => void,
    emptyMessage: string
  ) => (
    rows.length === 0 ? (
      <TableRow><TableCell colSpan={6} className="text-center py-8 text-[#6B7280]">{emptyMessage}</TableCell></TableRow>
    ) : (
      rows.map((inv) => (
        <TableRow key={inv.invoiceId} className="border-b border-[#C7C4D7]/30">
          <TableCell className="pl-4">
            <Checkbox checked={selected.includes(inv.invoiceId)} onCheckedChange={() => onToggle(inv.invoiceId)} />
          </TableCell>
          <TableCell className="font-medium text-[#4648D4]">
            <button
              type="button"
              onClick={() => setPreviewInvoice({ id: inv.invoiceId, originalInvoice: inv.originalInvoice })}
              className="hover:underline"
            >
              {inv.originalInvoice}
            </button>
          </TableCell>
          <TableCell className="text-[#6B7280]">{inv.date}</TableCell>
          <TableCell className="font-medium text-[#191C1E]">
            ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </TableCell>
          <TableCell>
            <Badge variant="outline" className={statusBadgeClass(inv.status)}>
              {inv.status}
            </Badge>
          </TableCell>
          <TableCell className="text-center">
            <InvoiceNotesPopover invoiceId={inv.invoiceId} originalInvoice={inv.originalInvoice} />
          </TableCell>
        </TableRow>
      ))
    )
  )

  return (
    <>
      <NewDebtorDialog open={newDebtorOpen} onClose={() => setNewDebtorOpen(false)} />
      {client && (
        <AssignmentLetterDialog
          open={assignmentLetterOpen}
          onClose={() => setAssignmentLetterOpen(false)}
          shortcode={client.shortcode}
        />
      )}
      <InvoicePreviewModal
        invoiceId={previewInvoice?.id ?? null}
        originalInvoice={previewInvoice?.originalInvoice}
        onClose={() => setPreviewInvoice(null)}
      />

      <Sheet open={!!client} onOpenChange={(open) => !open && onClose()} modal={false}>
        <SheetContent className="w-full sm:max-w-[1000px] sm:w-[1000px] overflow-y-auto bg-[#F7F9FB] p-0 border-l border-[#C7C4D7]/50 shadow-xl">
          {client && (
            <div className="flex flex-col h-full">

              {/* Header */}
              <SheetHeader className="p-6 pr-10 shrink-0 bg-white border-b border-[#C7C4D7]/50">
                <div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <SheetTitle className="text-[22px] font-semibold text-[#191C1E] tracking-tight">
                    {client.cadenceName}
                  </SheetTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" className="h-8 text-xs font-semibold"
                      onClick={() => setNewDebtorOpen(true)}>
                      New Debtor
                    </Button>
                    <Button variant="outline" className="h-8 text-xs font-semibold gap-1.5"
                      onClick={togglePanel}>
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Queue
                      {activeQueue && activeQueue.items.length > 0 && (
                        <span className="ml-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-[#4648D4] text-white text-[10px] font-bold">
                          {activeQueue.items.length}
                        </span>
                      )}
                    </Button>
                    <Button className="h-8 text-xs font-semibold bg-[#4648D4] hover:bg-[#3537b3]"
                      onClick={() => setAssignmentLetterOpen(true)}>
                      Assignment Letter
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-6 flex-1">
                <Tabs defaultValue="overview" className="w-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="debtor-invoices">Debtor &amp; Invoices</TabsTrigger>
                    <TabsTrigger value="details">Client Details</TabsTrigger>
                  </TabsList>

                  <div>
                    {loading && <div className="text-center p-8 text-muted-foreground">Loading data...</div>}

                    {!loading && (
                      <>
                        {/* ── Overview ── */}
                        <TabsContent value="overview" className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <Card>
                              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Total Open Invoices</CardHeader>
                              <CardContent className="text-2xl font-bold">{summary?.openCount || 0}</CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Total Amount</CardHeader>
                              <CardContent className="text-2xl font-bold">{formatCurrency(summary?.totalAmount)}</CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Verified %</CardHeader>
                              <CardContent className="text-2xl font-bold">{(summary?.verifiedPercent || 0).toFixed(1)}%</CardContent>
                            </Card>
                          </div>

                          {/* Aging bar chart */}
                          {summary?.aging && (
                            <Card>
                              <CardHeader className="pb-3 text-sm font-semibold text-[#191C1E]">Invoice Age Distribution</CardHeader>
                              <CardContent>
                                <AgingBarChart aging={summary.aging} />
                              </CardContent>
                            </Card>
                          )}

                          <div className="grid grid-cols-5 gap-3">
                            <Card>
                              <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">0–30 Days</CardHeader>
                              <CardContent className="text-base font-bold">{formatCurrency(summary?.aging?.d30)}</CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">31–60 Days</CardHeader>
                              <CardContent className="text-base font-bold">{formatCurrency(summary?.aging?.d60)}</CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">61–90 Days</CardHeader>
                              <CardContent className="text-base font-bold">{formatCurrency(summary?.aging?.d90)}</CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">91–120 Days</CardHeader>
                              <CardContent className="text-base font-bold">{formatCurrency(summary?.aging?.d120)}</CardContent>
                            </Card>
                            <Card className="border-red-200 bg-red-50/50">
                              <CardHeader className="pb-2 text-xs font-medium text-red-700">120+ Days</CardHeader>
                              <CardContent className="text-base font-bold text-red-700">{formatCurrency(summary?.aging?.over120)}</CardContent>
                            </Card>
                          </div>

                          <div className="flex gap-4">
                            <Card className="flex-1">
                              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Flagged Invoices</CardHeader>
                              <CardContent className="text-xl font-bold text-red-600">
                                {invoices.filter(i => i.flagged).length}
                              </CardContent>
                            </Card>
                            <Card className="flex-1">
                              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Verified Amount</CardHeader>
                              <CardContent className="text-xl font-bold text-[#4648D4]">
                                {formatCurrency(summary?.verifiedAmount)}
                              </CardContent>
                            </Card>
                          </div>
                        </TabsContent>

                        {/* ── Debtor & Invoices (merged accordion) ── */}
                        <TabsContent value="debtor-invoices" className="flex-1 mt-0 flex flex-col overflow-hidden">
                          <div className="relative w-64 mb-4 shrink-0">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search invoices or debtors..."
                              className="pl-7 h-8 text-xs bg-white"
                              value={invoiceSearch}
                              onChange={e => setInvoiceSearch(e.target.value)}
                            />
                          </div>

                          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full caption-bottom text-sm min-w-[800px] table-fixed">
                              <colgroup>
                                <col className="w-8" />
                                <col />
                                <col className="w-16" />
                                <col className="w-24" />
                                <col className="w-20" />
                                <col className="w-20" />
                                <col className="w-20" />
                                <col className="w-20" />
                                <col className="w-20" />
                                <col className="w-16" />
                              </colgroup>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent bg-slate-50 border-b sticky top-0 z-20">
                                  {/* expand toggle col */}
                                  <TableHead className="h-9 w-8" />
                                  <SortableTableHead label="NAME" columnKey="name" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px]" />
                                  <SortableTableHead label="# INV" columnKey="invoiceCount" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-center" />
                                  <SortableTableHead label="$ TOTAL" columnKey="totalAmount" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-center" />
                                  <SortableTableHead label="0–30d" columnKey="aging.d30" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-center" />
                                  <SortableTableHead label="31–60d" columnKey="aging.d60" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-center" />
                                  <SortableTableHead label="61–90d" columnKey="aging.d90" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-center" />
                                  <SortableTableHead label="91–120d" columnKey="aging.d120" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-center" />
                                  <SortableTableHead label="120+d" columnKey="aging.over120" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-center text-red-700" />
                                  <TableHead className="h-9 text-[11px] text-center">ACTIONS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedDebtors.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={10} className="text-center py-10 text-sm text-muted-foreground">
                                      No debtors found for this client.
                                    </TableCell>
                                  </TableRow>
                                )}
                                {sortedDebtors.map(d => {
                                  const group = groups[d.id] ?? makeInitialGroupState()
                                  const q = invoiceSearch.toLowerCase()
                                  const unprocessedInvoices = group.invoices.filter(inv => !inv.isProcessed && matchesGroupSearch(inv, q))
                                  const processedInvoices = group.invoices.filter(inv => inv.isProcessed && matchesGroupSearch(inv, q))

                                  return (
                                    <Fragment key={d.id}>
                                      <TableRow
                                        className={`h-10 border-b cursor-pointer hover:bg-slate-50 ${group.expanded ? 'bg-white' : ''}`}
                                        onClick={() => toggleDebtorExpand(d.id)}
                                      >
                                        <TableCell className="pl-3 pr-0 py-1 w-8">
                                          {group.expanded
                                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        </TableCell>
                                        <TableCell className="font-medium text-xs py-1">{d.name}</TableCell>
                                        <TableCell className="text-center text-xs py-1 tabular-nums">{d.invoiceCount}</TableCell>
                                        <TableCell className="text-center text-xs font-semibold py-1 tabular-nums">{formatCurrency(d.totalAmount)}</TableCell>
                                        <TableCell className="text-center text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d30)}</TableCell>
                                        <TableCell className="text-center text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d60)}</TableCell>
                                        <TableCell className="text-center text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d90)}</TableCell>
                                        <TableCell className="text-center text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d120)}</TableCell>
                                        <TableCell className="text-center text-xs text-red-600 py-1 tabular-nums">{formatCurrency(d.aging.over120)}</TableCell>
                                        <TableCell className="text-center py-1">
                                          <Link
                                            to={`/debtors?debtorId=${d.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-slate-200 text-muted-foreground hover:text-[#191C1E]"
                                            title="Open in Debtors"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </Link>
                                        </TableCell>
                                      </TableRow>

                                      {group.expanded && (
                                        <TableRow key={`${d.id}-expanded`} className="bg-slate-50/80 border-b hover:bg-slate-50/80">
                                          <TableCell colSpan={10} className="p-0">
                                            <div className="space-y-3 p-3">
                                              {group.loading && !group.loaded ? (
                                                <div className="flex items-center gap-2 py-8 justify-center text-xs text-muted-foreground">
                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading invoices...
                                                </div>
                                              ) : (
                                                <>
                                                  {/* Unprocessed */}
                                                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                                    <button
                                                      type="button"
                                                      onClick={() => updateGroup(d.id, prev => ({ unprocessedExpanded: !prev.unprocessedExpanded }))}
                                                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50"
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        {group.unprocessedExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                        <span className="text-sm font-semibold text-[#191C1E]">Unprocessed</span>
                                                      </div>
                                                      <Badge variant="outline" className="bg-[#FEF9C3] text-[#A16207] border-transparent font-semibold">
                                                        {unprocessedInvoices.length}
                                                      </Badge>
                                                    </button>
                                                    {group.unprocessedExpanded && (
                                                      <div className="border-t border-slate-200">
                                                        <div className="flex flex-row justify-end items-center px-4 py-2 bg-slate-50 border-b gap-2">
                                                          {group.unprocessedSelected.length > 0 && (
                                                            <span className="text-xs text-muted-foreground">{group.unprocessedSelected.length} selected</span>
                                                          )}
                                                          <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs"
                                                            disabled={group.unprocessedSelected.length === 0 || group.addingToQueue}
                                                            onClick={() => handleAddSelectedToQueue(d.id)}
                                                          >
                                                            {group.addingToQueue ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add Selected to NS Queue'}
                                                          </Button>
                                                          <Link to={`/ns-queue?view=builder&client=${client.shortcode}`}>
                                                            <Button size="sm" className="h-7 text-xs bg-[#4648D4] hover:bg-[#3537b3]">
                                                              Go to NS Builder
                                                            </Button>
                                                          </Link>
                                                        </div>
                                                        <div className="overflow-auto max-h-[360px]">
                                                          <Table>
                                                            <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b">
                                                              <TableRow className="hover:bg-transparent">
                                                                <TableHead className="w-10 pl-4">
                                                                  <Checkbox
                                                                    checked={group.unprocessedSelected.length > 0 && group.unprocessedSelected.length === unprocessedInvoices.length}
                                                                    onCheckedChange={(checked) => updateGroup(d.id, { unprocessedSelected: checked ? unprocessedInvoices.map(i => i.invoiceId) : [] })}
                                                                  />
                                                                </TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Invoice #</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Notes</TableHead>
                                                              </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                              {renderInvoiceRows(
                                                                unprocessedInvoices,
                                                                group.unprocessedSelected,
                                                                (invoiceId) => toggleUnprocessedInvoice(d.id, invoiceId),
                                                                invoiceSearch ? 'No invoices match your search.' : 'No unprocessed invoices.'
                                                              )}
                                                            </TableBody>
                                                          </Table>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>

                                                  {/* Processed */}
                                                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                                    <button
                                                      type="button"
                                                      onClick={() => updateGroup(d.id, prev => ({ processedExpanded: !prev.processedExpanded }))}
                                                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50"
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        {group.processedExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                        <span className="text-sm font-semibold text-[#191C1E]">Processed</span>
                                                      </div>
                                                      <Badge variant="outline" className="bg-[#DCFCE7] text-[#15803D] border-transparent font-semibold">
                                                        {processedInvoices.length}
                                                      </Badge>
                                                    </button>
                                                    {group.processedExpanded && (
                                                      <div className="border-t border-slate-200 flex flex-col">
                                                        {group.processedSelected.length > 0 && (
                                                          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b">
                                                            <Input
                                                              placeholder={`Add note to ${group.processedSelected.length} selected...`}
                                                              className="h-8 text-xs bg-white max-w-md"
                                                              value={group.bulkNoteDraft}
                                                              onChange={e => updateGroup(d.id, { bulkNoteDraft: e.target.value })}
                                                              onKeyDown={e => { if (e.key === 'Enter') handlePostBulkNote(d.id) }}
                                                            />
                                                            <Button
                                                              size="sm"
                                                              className="h-8 text-xs bg-[#4648D4] hover:bg-[#3537b3] shrink-0"
                                                              disabled={!group.bulkNoteDraft.trim() || group.postingBulkNote}
                                                              onClick={() => handlePostBulkNote(d.id)}
                                                            >
                                                              {group.postingBulkNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add Note'}
                                                            </Button>
                                                          </div>
                                                        )}
                                                        <div className="overflow-auto max-h-[360px]">
                                                          <Table>
                                                            <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b">
                                                              <TableRow className="hover:bg-transparent">
                                                                <TableHead className="w-10 pl-4">
                                                                  <Checkbox
                                                                    checked={group.processedSelected.length > 0 && group.processedSelected.length === processedInvoices.length}
                                                                    onCheckedChange={(checked) => updateGroup(d.id, { processedSelected: checked ? processedInvoices.map(i => i.invoiceId) : [] })}
                                                                  />
                                                                </TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Invoice #</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                                                                <TableHead className="h-9 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Notes</TableHead>
                                                              </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                              {renderInvoiceRows(
                                                                processedInvoices,
                                                                group.processedSelected,
                                                                (invoiceId) => toggleProcessedInvoice(d.id, invoiceId),
                                                                invoiceSearch ? 'No invoices match your search.' : 'No processed invoices.'
                                                              )}
                                                            </TableBody>
                                                          </Table>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </Fragment>
                                  )
                                })}
                              </TableBody>
                            </table>
                          </div>
                        </TabsContent>

                        {/* ── Client Details ── */}
                        <TabsContent value="details" className="mt-0">
                          <Card>
                            <CardHeader className="text-lg font-semibold">Client Details</CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex items-center gap-6 p-3 rounded-md border border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id="cd-active"
                                    checked={!!detailsForm.active}
                                    onCheckedChange={(checked) => handleDetailsCheckboxChange('active', checked)}
                                  />
                                  <Label htmlFor="cd-active" className="cursor-pointer">Active</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id="cd-dnc"
                                    checked={!!detailsForm.dnc}
                                    onCheckedChange={(checked) => handleDetailsCheckboxChange('dnc', checked)}
                                  />
                                  <Label htmlFor="cd-dnc" className="cursor-pointer">Do Not Call (DNC)</Label>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Alpha Code</Label>
                                  <Input name="code" value={detailsForm.code || ''} onChange={handleDetailsChange} placeholder="e.g. SAF" />
                                </div>
                                <div className="space-y-2">
                                  <Label>Email</Label>
                                  <Input name="email" value={detailsForm.email || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Phone</Label>
                                  <Input name="phone" value={detailsForm.phone || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Address</Label>
                                  <Input name="address" value={detailsForm.address || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>City</Label>
                                  <Input name="city" value={detailsForm.city || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Province</Label>
                                  <Input name="province" value={detailsForm.province || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Postal Code</Label>
                                  <Input name="postalCode" value={detailsForm.postalCode || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Language</Label>
                                  <Input name="language" value={detailsForm.language || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Contact</Label>
                                  <Input name="contact" value={detailsForm.contact || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Discount Rate (decimal)</Label>
                                  <Input name="discountRate" type="number" step="0.001" value={detailsForm.discountRate || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Reserve Rate (decimal)</Label>
                                  <Input name="reserveRate" type="number" step="0.001" value={detailsForm.reserveRate || ''} onChange={handleDetailsChange} />
                                </div>
                                <div className="space-y-2 col-span-2">
                                  <Label>Notes</Label>
                                  <Input name="notes" value={detailsForm.notes || ''} onChange={handleDetailsChange} />
                                </div>
                              </div>
                              <Button className="mt-4" onClick={saveDetails} disabled={savingDetails}>
                                {savingDetails ? "Saving..." : "Save Details"}
                              </Button>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </>
                    )}
                  </div>
                </Tabs>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
