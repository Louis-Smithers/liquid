import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { InvoicePreviewModal } from "@/components/invoices/InvoicePreviewModal"
import { InvoiceNotesPopover } from "@/components/invoices/InvoiceNotesPopover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight, ExternalLink, GitMerge, Loader2, Search } from "lucide-react"
import { api } from "@/lib/api"
import type { Debtor } from "@/pages/DebtorsPage"
import { useNSQueue } from "@/context/NSQueueContext"
import { MergeDebtorsModal } from "@/components/debtors/MergeDebtorsModal"

interface Invoice {
  invoiceId: string
  originalInvoice: string
  date: string
  amount: number
  status: string
  liquidClient: string
  source: string
  isProcessed: boolean
}

interface InvoicePage {
  items: Invoice[]
  nextCursorTime: string | null
  nextCursorId: string | null
}

// (debtor x client) invoice sets are small, so we load them fully on first expand rather than
// cursor-paging — see plan doc for why (fixes the whole-debtor interleaved-stream 5-vs-0 bug).
const GROUP_PAGE_SIZE = 100
const GROUP_LOAD_GUARD = 50

interface DebtorClient {
  shortcode: string
  cadenceName: string | null
  invoiceCount: number
  totalAmount: number
}

interface DebtorMergeAudit {
  id: string
  aliasId: string
  aliasName: string
  requestedCanonicalId: string
  canonicalId: string
  canonicalName: string
  invoicesRepointed: number
  aliasesRepointed: number
  performedBy: string
  performedAt: string
}

// Per-client-group UI + data state. Kept in a map keyed by shortcode so selection, search-driven
// expansion, and NS actions are strictly scoped to one client at a time (an NS is single-client).
interface ClientGroupState {
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

const makeInitialGroupState = (): ClientGroupState => ({
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

interface DebtorDrawerProps {
  debtor: Debtor | null
  onClose: () => void
  /** Full debtor list, used to show aliases merged into this debtor and to power the merge modal. */
  allDebtors?: Debtor[]
  onDebtorsChanged?: () => void | Promise<void>
}

export function DebtorDrawer({ debtor, onClose, allDebtors = [], onDebtorsChanged }: DebtorDrawerProps) {
  const [previewInvoice, setPreviewInvoice] = useState<{ id: string; originalInvoice: string } | null>(null)
  const { setActiveClient, addItem } = useNSQueue()

  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [debtorClients, setDebtorClients] = useState<DebtorClient[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeHistory, setMergeHistory] = useState<DebtorMergeAudit[]>([])
  const [mergeHistoryLoading, setMergeHistoryLoading] = useState(false)

  const [groups, setGroups] = useState<Record<string, ClientGroupState>>({})

  const mergedInAliases = debtor ? allDebtors.filter(d => d.redirectId === debtor.id) : []

  const matchesSearch = (inv: Invoice, q: string) =>
    !q ||
    inv.originalInvoice.toLowerCase().includes(q) ||
    inv.status.toLowerCase().includes(q)

  const updateGroup = (shortcode: string, patch: Partial<ClientGroupState> | ((prev: ClientGroupState) => Partial<ClientGroupState>)) => {
    setGroups(prev => {
      const current = prev[shortcode] ?? makeInitialGroupState()
      const delta = typeof patch === 'function' ? patch(current) : patch
      return { ...prev, [shortcode]: { ...current, ...delta } }
    })
  }

  const fetchDebtorClients = useCallback(async () => {
    if (!debtor) return
    setClientsLoading(true)
    try {
      const response = await api.get<DebtorClient[]>(`/api/debtors/${debtor.id}/clients`)
      setDebtorClients(response.data)
      if (response.data.length > 0) {
        setActiveClient(response.data[0].shortcode)
      }
      // Auto-expand the single client group when there's only one — the common case.
      if (response.data.length === 1) {
        const shortcode = response.data[0].shortcode
        setGroups(prev => ({
          ...prev,
          [shortcode]: { ...(prev[shortcode] ?? makeInitialGroupState()), expanded: true }
        }))
      }
    } catch (error) {
      console.error("Failed to fetch debtor's clients:", error)
    } finally {
      setClientsLoading(false)
    }
  }, [debtor, setActiveClient])

  const fetchMergeHistory = async () => {
    if (!debtor) return
    setMergeHistoryLoading(true)
    try {
      const response = await api.get<DebtorMergeAudit[]>(`/api/debtors/${debtor.id}/merge-history`)
      setMergeHistory(response.data)
    } catch (error) {
      console.error("Failed to fetch debtor's merge history:", error)
    } finally {
      setMergeHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (!debtor) {
      setActiveClient(null)
      return
    }
    setGroups({})
    setInvoiceSearch('')
    fetchDebtorClients()
    fetchMergeHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtor])

  // Loads the full (debtor x client) invoice set for one client group, looping the cursor until
  // exhausted. This set is small in practice, so "fully loaded then split client-side by
  // isProcessed" replaces the old fragile whole-debtor interleaved-stream paging.
  const loadGroupInvoices = async (shortcode: string) => {
    if (!debtor) return
    updateGroup(shortcode, { loading: true })
    try {
      let cursor: { time: string; id: string } | null = null
      let gathered: Invoice[] = []
      let hasMore = true
      let guard = 0
      while (hasMore && guard < GROUP_LOAD_GUARD) {
        guard++
        const query = new URLSearchParams()
        query.set('pageSize', String(GROUP_PAGE_SIZE))
        query.set('debtorId', debtor.id)
        if (cursor) {
          query.set('cursorTime', cursor.time)
          query.set('cursorId', cursor.id)
        }
        const res = await api.get<InvoicePage>(`/api/invoices/client/${shortcode}/page?${query.toString()}`)
        gathered = gathered.concat(res.data.items)
        if (res.data.nextCursorTime && res.data.nextCursorId) {
          cursor = { time: res.data.nextCursorTime, id: res.data.nextCursorId }
        } else {
          hasMore = false
        }
      }
      updateGroup(shortcode, { invoices: gathered, loaded: true })
    } catch (error) {
      console.error(`Failed to load invoices for client ${shortcode}:`, error)
    } finally {
      updateGroup(shortcode, { loading: false })
    }
  }

  const toggleGroupExpanded = (shortcode: string) => {
    const current = groups[shortcode] ?? makeInitialGroupState()
    const nextExpanded = !current.expanded
    updateGroup(shortcode, { expanded: nextExpanded })
    if (nextExpanded && !current.loaded && !current.loading) {
      loadGroupInvoices(shortcode)
    }
  }

  // Auto-expand groups with search matches so results surface without manual clicking, and
  // lazy-load them the same way a manual expand would.
  useEffect(() => {
    if (!invoiceSearch.trim()) return
    const q = invoiceSearch.toLowerCase()
    debtorClients.forEach(c => {
      const current = groups[c.shortcode]
      const clientMatches = c.shortcode.toLowerCase().includes(q) || (c.cadenceName ?? '').toLowerCase().includes(q)
      const hasLoadedMatch = current?.invoices.some(inv => matchesSearch(inv, q))
      if ((clientMatches || hasLoadedMatch) && !current?.expanded) {
        toggleGroupExpanded(c.shortcode)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceSearch, debtorClients])

  const toggleUnprocessedInvoice = (shortcode: string, invoiceId: string) => {
    updateGroup(shortcode, prev => ({
      unprocessedSelected: prev.unprocessedSelected.includes(invoiceId)
        ? prev.unprocessedSelected.filter(id => id !== invoiceId)
        : [...prev.unprocessedSelected, invoiceId]
    }))
  }

  const toggleProcessedInvoice = (shortcode: string, invoiceId: string) => {
    updateGroup(shortcode, prev => ({
      processedSelected: prev.processedSelected.includes(invoiceId)
        ? prev.processedSelected.filter(id => id !== invoiceId)
        : [...prev.processedSelected, invoiceId]
    }))
  }

  const handleAddSelectedToQueue = async (shortcode: string) => {
    const group = groups[shortcode]
    if (!group || group.unprocessedSelected.length === 0) return
    updateGroup(shortcode, { addingToQueue: true })
    try {
      for (const invoiceId of group.unprocessedSelected) {
        const inv = group.invoices.find(i => i.invoiceId === invoiceId)
        if (!inv) continue
        await addItem(inv.invoiceId, inv.amount, shortcode)
      }
      updateGroup(shortcode, { unprocessedSelected: [] })
      await loadGroupInvoices(shortcode)
    } catch (err) {
      console.error('Failed to add invoices to NS queue', err)
    } finally {
      updateGroup(shortcode, { addingToQueue: false })
    }
  }

  const handlePostBulkNote = async (shortcode: string) => {
    const group = groups[shortcode]
    if (!group || !group.bulkNoteDraft.trim() || group.processedSelected.length === 0) return
    updateGroup(shortcode, { postingBulkNote: true })
    try {
      await api.post('/api/invoices/notes/bulk', {
        invoiceIds: group.processedSelected,
        text: group.bulkNoteDraft.trim()
      })
      updateGroup(shortcode, { bulkNoteDraft: '', processedSelected: [] })
    } catch (err) {
      console.error('Failed to post bulk note', err)
    } finally {
      updateGroup(shortcode, { postingBulkNote: false })
    }
  }

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
    <InvoicePreviewModal
      invoiceId={previewInvoice?.id ?? null}
      originalInvoice={previewInvoice?.originalInvoice}
      onClose={() => setPreviewInvoice(null)}
    />
    <Sheet open={!!debtor} onOpenChange={(open) => !open && onClose()} modal={false}>
      <SheetContent className="w-full sm:max-w-[800px] sm:w-[800px] overflow-y-auto bg-[#F7F9FB] p-0 border-l border-[#C7C4D7]/50 shadow-xl">
        {debtor && (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 shrink-0 bg-white border-b border-[#C7C4D7]/50">
              <div className="flex flex-row items-center justify-between gap-4">
                <div className="flex flex-row items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-[#DAE2FD] rounded-lg text-[#4648D4] font-semibold text-lg">
                    {debtor.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col gap-1">
                    <SheetTitle className="text-2xl font-semibold text-[#191C1E] tracking-tight">{debtor.name}</SheetTitle>
                    {debtor.redirectId && (
                      <Badge variant="outline" className="w-fit bg-slate-100 text-slate-600 border-transparent font-medium text-[11px] gap-1">
                        <GitMerge className="h-3 w-3" />
                        Merged &rarr; {debtor.redirectName || 'unknown'}
                      </Badge>
                    )}
                  </div>
                </div>
                {!debtor.redirectId && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0 mr-8" onClick={() => setMergeModalOpen(true)}>
                    <GitMerge className="h-3.5 w-3.5" />
                    Merge
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="p-6 flex-1 flex flex-col">
              <Tabs defaultValue="invoices" className="flex-1 flex flex-col w-full">
                <TabsList className="grid w-[280px] grid-cols-2 mb-6 bg-[#E2E8F0] p-1 rounded-md shrink-0">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-[#191C1E] data-[state=active]:shadow-sm rounded-sm text-sm">Overview</TabsTrigger>
                  <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:text-[#191C1E] data-[state=active]:shadow-sm rounded-sm text-sm">Client & Invoices</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="bg-white p-6 rounded-lg border border-[#C7C4D7]/50 shadow-sm flex-1 mt-0">
                  <h3 className="text-[15px] font-semibold text-[#191C1E] mb-6">Debtor Details</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider">Status</p>
                      {debtor.active ? (
                        <Badge variant="outline" className="w-fit bg-[#DCFCE7] text-[#15803D] border-transparent font-medium">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit bg-[#F1F5F9] text-[#475569] border-transparent font-medium">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <p
                        className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider w-fit cursor-help"
                        title="Debtors added by an n8n import start as Under Review until vetted."
                      >
                        Status: Under Review / Approved
                      </p>
                      <Badge
                        variant="outline"
                        className={`w-fit border-transparent font-medium ${
                          debtor.group === 'Active' ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF9C3] text-[#A16207]"
                        }`}
                        title="Debtors added by an n8n import start as Under Review until vetted."
                      >
                        {debtor.group === 'Active' ? 'Approved' : 'Under Review'}
                      </Badge>
                    </div>
                  </div>

                  {mergedInAliases.length > 0 && (
                    <div className="mt-8">
                      <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-3">
                        Merged into this debtor ({mergedInAliases.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {mergedInAliases.map(a => (
                          <Badge key={a.id} variant="outline" className="bg-slate-100 text-slate-700 border-transparent font-medium">
                            {a.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(mergeHistoryLoading || mergeHistory.length > 0) && (
                    <div className="mt-8">
                      <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-3">
                        Merge history {mergeHistory.length > 0 && `(${mergeHistory.length})`}
                      </p>
                      {mergeHistoryLoading ? (
                        <p className="text-sm text-[#6B7280]">Loading...</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {mergeHistory.map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-4 rounded-md border border-[#C7C4D7]/50 bg-slate-50 px-3 py-2 text-sm">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <GitMerge className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                <span className="truncate text-[#191C1E]">
                                  <span className="font-medium">{m.aliasName}</span>
                                  {' → '}
                                  <span className="font-medium">{m.canonicalName}</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#6B7280] shrink-0">
                                <span title="Invoices re-pointed">{m.invoicesRepointed} invoice{m.invoicesRepointed === 1 ? '' : 's'}</span>
                                <span>{new Date(m.performedAt).toLocaleDateString()}</span>
                                <span className="font-mono truncate max-w-[100px]" title={m.performedBy}>{m.performedBy}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="invoices" className="flex-1 mt-0 flex flex-col overflow-hidden">
                  <div className="relative w-64 mb-4 shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices or clients..."
                      className="pl-7 h-8 text-xs bg-white"
                      value={invoiceSearch}
                      onChange={e => setInvoiceSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    {clientsLoading ? (
                      <div className="text-center py-8 text-[#6B7280] bg-white rounded-lg border border-[#C7C4D7]/50">Loading clients...</div>
                    ) : debtorClients.length === 0 ? (
                      <div className="text-center py-8 text-[#6B7280] bg-white rounded-lg border border-[#C7C4D7]/50">No clients found for this debtor.</div>
                    ) : (
                      debtorClients.map(c => {
                        const group = groups[c.shortcode] ?? makeInitialGroupState()
                        const q = invoiceSearch.toLowerCase()
                        const unprocessedInvoices = group.invoices.filter(inv => !inv.isProcessed && matchesSearch(inv, q))
                        const processedInvoices = group.invoices.filter(inv => inv.isProcessed && matchesSearch(inv, q))

                        return (
                          <div key={c.shortcode} className="bg-white rounded-lg border border-[#C7C4D7]/50 shadow-sm overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleGroupExpanded(c.shortcode)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {group.expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                                <span className="text-sm font-semibold text-[#191C1E] truncate">{c.cadenceName || c.shortcode}</span>
                                <span className="text-xs text-[#6B7280] shrink-0">({c.shortcode})</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-[#6B7280] tabular-nums">{c.invoiceCount} invoice{c.invoiceCount === 1 ? '' : 's'}</span>
                                <span className="text-xs font-semibold text-[#191C1E] tabular-nums">
                                  ${c.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <Link
                                  to={`/clients?clientShortcode=${c.shortcode}`}
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-slate-200 text-muted-foreground hover:text-[#191C1E]"
                                  title="Open in Clients"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                              </div>
                            </button>

                            {group.expanded && (
                              <div className="border-t border-[#C7C4D7]/50 space-y-3 p-3 bg-slate-50/50">
                                {group.loading && !group.loaded ? (
                                  <div className="text-center py-8 text-[#6B7280]">Loading invoices...</div>
                                ) : (
                                  <>
                                    {/* Unprocessed */}
                                    <div className="bg-white rounded-lg border border-[#C7C4D7]/50 shadow-sm overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => updateGroup(c.shortcode, prev => ({ unprocessedExpanded: !prev.unprocessedExpanded }))}
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
                                        <div className="border-t border-[#C7C4D7]/50">
                                          <div className="flex flex-row justify-end items-center px-4 py-2 bg-slate-50 border-b border-[#C7C4D7]/50 gap-2">
                                            {group.unprocessedSelected.length > 0 && (
                                              <span className="text-xs text-muted-foreground">{group.unprocessedSelected.length} selected</span>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              disabled={group.unprocessedSelected.length === 0 || group.addingToQueue}
                                              onClick={() => handleAddSelectedToQueue(c.shortcode)}
                                            >
                                              {group.addingToQueue ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add Selected to NS Queue'}
                                            </Button>
                                            <Link to="/ns-queue?view=builder">
                                              <Button size="sm" className="h-7 text-xs bg-[#4648D4] hover:bg-[#3537b3]">
                                                Go to NS Builder
                                              </Button>
                                            </Link>
                                          </div>
                                          <div className="overflow-auto max-h-[360px]">
                                            <Table>
                                              <TableHeader className="bg-[#F8FAFC] sticky top-0 z-10 border-b border-[#C7C4D7]/50">
                                                <TableRow className="hover:bg-transparent">
                                                  <TableHead className="w-10 pl-4">
                                                    <Checkbox
                                                      checked={group.unprocessedSelected.length > 0 && group.unprocessedSelected.length === unprocessedInvoices.length}
                                                      onCheckedChange={(checked) => updateGroup(c.shortcode, { unprocessedSelected: checked ? unprocessedInvoices.map(i => i.invoiceId) : [] })}
                                                    />
                                                  </TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Invoice #</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Date</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Amount</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Status</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-center">Notes</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {renderInvoiceRows(
                                                  unprocessedInvoices,
                                                  group.unprocessedSelected,
                                                  (invoiceId) => toggleUnprocessedInvoice(c.shortcode, invoiceId),
                                                  invoiceSearch ? 'No invoices match your search.' : 'No unprocessed invoices.'
                                                )}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Processed */}
                                    <div className="bg-white rounded-lg border border-[#C7C4D7]/50 shadow-sm overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => updateGroup(c.shortcode, prev => ({ processedExpanded: !prev.processedExpanded }))}
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
                                        <div className="border-t border-[#C7C4D7]/50 flex flex-col">
                                          {group.processedSelected.length > 0 && (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-[#C7C4D7]/50">
                                              <Input
                                                placeholder={`Add note to ${group.processedSelected.length} selected...`}
                                                className="h-8 text-xs bg-white max-w-md"
                                                value={group.bulkNoteDraft}
                                                onChange={e => updateGroup(c.shortcode, { bulkNoteDraft: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') handlePostBulkNote(c.shortcode) }}
                                              />
                                              <Button
                                                size="sm"
                                                className="h-8 text-xs bg-[#4648D4] hover:bg-[#3537b3] shrink-0"
                                                disabled={!group.bulkNoteDraft.trim() || group.postingBulkNote}
                                                onClick={() => handlePostBulkNote(c.shortcode)}
                                              >
                                                {group.postingBulkNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add Note'}
                                              </Button>
                                            </div>
                                          )}
                                          <div className="overflow-auto max-h-[360px]">
                                            <Table>
                                              <TableHeader className="bg-[#F8FAFC] sticky top-0 z-10 border-b border-[#C7C4D7]/50">
                                                <TableRow className="hover:bg-transparent">
                                                  <TableHead className="w-10 pl-4">
                                                    <Checkbox
                                                      checked={group.processedSelected.length > 0 && group.processedSelected.length === processedInvoices.length}
                                                      onCheckedChange={(checked) => updateGroup(c.shortcode, { processedSelected: checked ? processedInvoices.map(i => i.invoiceId) : [] })}
                                                    />
                                                  </TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Invoice #</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Date</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Amount</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Status</TableHead>
                                                  <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-center">Notes</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {renderInvoiceRows(
                                                  processedInvoices,
                                                  group.processedSelected,
                                                  (invoiceId) => toggleProcessedInvoice(c.shortcode, invoiceId),
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
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
    <MergeDebtorsModal
      open={mergeModalOpen}
      onClose={() => setMergeModalOpen(false)}
      debtors={allDebtors}
      initialDuplicateId={debtor?.id}
      onMerged={async () => { if (onDebtorsChanged) await onDebtorsChanged() }}
    />
    </>
  )
}
