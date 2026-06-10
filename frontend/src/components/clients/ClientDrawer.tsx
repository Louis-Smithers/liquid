import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Search, Plus, Check, ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react"
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
}

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
  const [form, setForm] = useState({ name: '', cadenceName: '', group: 'Active', active: true })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/debtors', form)
      setForm({ name: '', cadenceName: '', group: 'Active', active: true })
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
              <Label htmlFor="nd-cadence" className="text-right">Cadence Name</Label>
              <Input id="nd-cadence" className="col-span-3" value={form.cadenceName}
                onChange={e => setForm({ ...form, cadenceName: e.target.value })} placeholder="Wayne Ent" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Group</Label>
              <div className="col-span-3">
                <Select value={form.group} onValueChange={v => setForm({ ...form, group: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
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
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const { activeQueue, setActiveClient, addItem } = useNSQueue()

  // Sorting
  const [debtorSortCol, setDebtorSortCol] = useState<string | null>(null)
  const [debtorSortDir, setDebtorSortDir] = useState<SortDirection>(null)
  const [invoiceSortCol, setInvoiceSortCol] = useState<string | null>(null)
  const [invoiceSortDir, setInvoiceSortDir] = useState<SortDirection>(null)

  // Expandable debtor rows
  const [expandedDebtor, setExpandedDebtor] = useState<string | null>(null)
  const [debtorInvoices, setDebtorInvoices] = useState<Record<string, Invoice[]>>({})
  const [debtorInvoicesLoading, setDebtorInvoicesLoading] = useState<Record<string, boolean>>({})

  // Details form
  const [detailsForm, setDetailsForm] = useState<Partial<Client>>({})
  const [savingDetails, setSavingDetails] = useState(false)

  // Dialog visibility
  const [newDebtorOpen, setNewDebtorOpen] = useState(false)
  const [assignmentLetterOpen, setAssignmentLetterOpen] = useState(false)

  // Invoice search filter
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
  }, [client])

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setDetailsForm(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : undefined) : value
    }))
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedInvoices(invoices.map(i => i.invoiceId))
    else setSelectedInvoices([])
  }

  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId]
    )
  }

  const formatCurrency = (val: number | undefined) => {
    if (val == null || val === 0) return '$0'
    return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const computeAge = (dateStr: string) => {
    const invoiceDate = new Date(dateStr)
    const today = new Date()
    return Math.max(0, Math.floor((today.getTime() - invoiceDate.getTime()) / 86400000))
  }

  const handleDebtorSort = (col: string, dir: SortDirection) => { setDebtorSortCol(col); setDebtorSortDir(dir) }
  const handleInvoiceSort = (col: string, dir: SortDirection) => { setInvoiceSortCol(col); setInvoiceSortDir(dir) }

  const toggleDebtorExpand = async (debtorId: string) => {
    if (expandedDebtor === debtorId) {
      setExpandedDebtor(null)
      return
    }
    setExpandedDebtor(debtorId)
    if (debtorInvoices[debtorId]) return
    setDebtorInvoicesLoading(prev => ({ ...prev, [debtorId]: true }))
    try {
      const res = await api.get<Invoice[]>(`/api/invoices/debtor/${debtorId}`)
      setDebtorInvoices(prev => ({ ...prev, [debtorId]: res.data }))
    } catch (err) {
      console.error('Failed to load debtor invoices', err)
    } finally {
      setDebtorInvoicesLoading(prev => ({ ...prev, [debtorId]: false }))
    }
  }

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

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.toLowerCase()
    return invoices.filter(inv =>
      !q ||
      inv.originalInvoice.toLowerCase().includes(q) ||
      (inv.debtorName || '').toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    )
  }, [invoices, invoiceSearch])

  const sortedInvoices = useMemo(() => {
    const sorted = [...filteredInvoices]
    if (!invoiceSortCol || !invoiceSortDir) return sorted
    sorted.sort((a, b) => {
      let aVal: any, bVal: any
      if (invoiceSortCol === '_age') { aVal = computeAge(a.date); bVal = computeAge(b.date) }
      else if (invoiceSortCol === 'flagged') { aVal = a.flagged ? 1 : 0; bVal = b.flagged ? 1 : 0 }
      else { aVal = a[invoiceSortCol as keyof Invoice]; bVal = b[invoiceSortCol as keyof Invoice] }
      if (aVal == null) aVal = ""; if (bVal == null) bVal = ""
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase() }
      if (aVal < bVal) return invoiceSortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return invoiceSortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredInvoices, invoiceSortCol, invoiceSortDir])

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

      <Sheet open={!!client} onOpenChange={(open) => !open && onClose()} modal={false}>
        <SheetContent className="w-full sm:max-w-[1000px] sm:w-[1000px] overflow-y-auto bg-[#F7F9FB] p-0 border-l border-[#C7C4D7]/50 shadow-xl">
          {client && (
            <div className="flex flex-col h-full">

              {/* Header */}
              <SheetHeader className="p-6 shrink-0 bg-white border-b border-[#C7C4D7]/50">
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-col">
                    <SheetTitle className="text-[22px] font-semibold text-[#191C1E] tracking-tight flex items-center gap-3">
                      {client.cadenceName}
                      <span className="text-sm font-normal text-[#6B7280] bg-slate-100 px-2 py-0.5 rounded">
                        {client.shortcode}
                      </span>
                    </SheetTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-[#464554]">
                      <span><strong className="text-[#191C1E]">@:</strong> {client.email || 'N/A'}</span>
                      <span><strong className="text-[#191C1E]">#:</strong> {client.phone || 'N/A'}</span>
                      <span><strong className="text-[#191C1E]">Lang:</strong> {client.language || 'EN'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="bg-[#EEF2FF] text-[#4648D4] border-[#C7D2FE] font-semibold text-xs">
                        Fee: {client.discountRate != null ? `${(client.discountRate * 100).toFixed(1)}%` : 'N/A'}
                      </Badge>
                      <Badge variant="outline" className="bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74] font-semibold text-xs">
                        Reserve: {client.reserveRate != null ? `${(client.reserveRate * 100).toFixed(1)}%` : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="h-8 text-xs font-semibold"
                      onClick={() => setNewDebtorOpen(true)}>
                      New Debtor
                    </Button>
                    <Button className="h-8 text-xs font-semibold bg-[#4648D4] hover:bg-[#3537b3]"
                      onClick={() => setAssignmentLetterOpen(true)}>
                      Assignment Letter
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-6 flex-1">
                <Tabs defaultValue="overview" className="w-full flex flex-col h-full">
                  <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="debtors">Debtors</TabsTrigger>
                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                    <TabsTrigger value="details">Client Details</TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-auto">
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

                        {/* ── Debtors ── */}
                        <TabsContent value="debtors" className="bg-white rounded-lg shadow-sm border border-slate-200">
                          <Table className="min-w-[800px]">
                            <TableHeader>
                              <TableRow className="hover:bg-transparent bg-slate-50 border-b">
                                {/* expand toggle col */}
                                <TableHead className="h-9 w-8" />
                                <SortableTableHead label="NAME" columnKey="name" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px]" />
                                <SortableTableHead label="# INV" columnKey="invoiceCount" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-right" />
                                <SortableTableHead label="$ TOTAL" columnKey="totalAmount" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-right" />
                                <SortableTableHead label="0–30d" columnKey="aging.d30" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-right" />
                                <SortableTableHead label="31–60d" columnKey="aging.d60" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-right" />
                                <SortableTableHead label="61–90d" columnKey="aging.d90" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-right" />
                                <SortableTableHead label="91–120d" columnKey="aging.d120" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-right" />
                                <SortableTableHead label="120+d" columnKey="aging.over120" currentSortColumn={debtorSortCol} currentSortDirection={debtorSortDir} onSort={handleDebtorSort} className="h-9 text-[11px] text-right text-red-700" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedDebtors.map(d => {
                                const isExpanded = expandedDebtor === d.id
                                const dInvs = debtorInvoices[d.id] || []
                                const dLoading = debtorInvoicesLoading[d.id]
                                return (
                                  <>
                                    <TableRow
                                      key={d.id}
                                      className="h-10 border-b cursor-pointer hover:bg-slate-50"
                                      onClick={() => toggleDebtorExpand(d.id)}
                                    >
                                      <TableCell className="pl-3 pr-0 py-1 w-8">
                                        {isExpanded
                                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                      </TableCell>
                                      <TableCell className="font-medium text-xs py-1">{d.name}</TableCell>
                                      <TableCell className="text-right text-xs py-1 tabular-nums">{d.invoiceCount}</TableCell>
                                      <TableCell className="text-right text-xs font-semibold py-1 tabular-nums">{formatCurrency(d.totalAmount)}</TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d30)}</TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d60)}</TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d90)}</TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground py-1 tabular-nums">{formatCurrency(d.aging.d120)}</TableCell>
                                      <TableCell className="text-right text-xs text-red-600 py-1 tabular-nums">{formatCurrency(d.aging.over120)}</TableCell>
                                    </TableRow>

                                    {/* Expanded invoice rows */}
                                    {isExpanded && (
                                      <TableRow key={`${d.id}-invoices`} className="bg-slate-50/80 border-b">
                                        <TableCell colSpan={9} className="p-0">
                                          {dLoading ? (
                                            <div className="flex items-center gap-2 px-10 py-3 text-xs text-muted-foreground">
                                              <Loader2 className="h-3 w-3 animate-spin" /> Loading invoices...
                                            </div>
                                          ) : dInvs.length === 0 ? (
                                            <p className="px-10 py-3 text-xs text-muted-foreground">No invoices found.</p>
                                          ) : (
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="border-b border-slate-200 text-[10px] font-semibold text-[#464554] uppercase tracking-[0.5px]">
                                                  <th className="text-left py-1.5 pl-10">Invoice</th>
                                                  <th className="text-left py-1.5">Date</th>
                                                  <th className="text-right py-1.5">Age</th>
                                                  <th className="text-right py-1.5 pr-4">Amount</th>
                                                  <th className="text-left py-1.5">Status</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {dInvs.map(inv => (
                                                  <tr key={inv.invoiceId} className="border-b border-slate-100 last:border-0 hover:bg-slate-100">
                                                    <td className="py-1.5 pl-10">
                                                      <Link to={`/gate/${inv.invoiceId}`} className="text-blue-600 hover:underline font-medium">
                                                        {inv.originalInvoice}
                                                      </Link>
                                                    </td>
                                                    <td className="py-1.5 text-muted-foreground">{inv.date}</td>
                                                    <td className="py-1.5 text-right text-muted-foreground tabular-nums">{computeAge(inv.date)}d</td>
                                                    <td className="py-1.5 text-right font-semibold pr-4 tabular-nums">${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="py-1.5">
                                                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-transparent font-semibold ${
                                                        inv.status === 'Pre-Verified' ? 'bg-[#DCFCE7] text-[#15803D]' :
                                                        inv.status === 'Unverified' ? 'bg-[#FEF9C3] text-[#A16207]' :
                                                        inv.status === 'Paid' ? 'bg-slate-800 text-white' :
                                                        inv.status === 'OA' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-[#FEE2E2] text-[#B91C1C]'
                                                      }`}>{inv.status}</Badge>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </TabsContent>

                        {/* ── Invoices ── */}
                        <TabsContent value="invoices" className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full">
                          <div className="flex flex-row justify-between items-center px-4 py-2 bg-slate-50 border-b">
                            <div className="relative w-48">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search..."
                                className="pl-7 h-8 text-xs bg-white"
                                value={invoiceSearch}
                                onChange={e => setInvoiceSearch(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="overflow-auto flex-1">
                            <Table>
                              <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b">
                                <TableRow>
                                  <TableHead className="w-10 pl-4">
                                    <Checkbox checked={selectedInvoices.length > 0 && selectedInvoices.length === invoices.length} onCheckedChange={handleSelectAll} />
                                  </TableHead>
                                  <SortableTableHead label="INVOICE" columnKey="originalInvoice" currentSortColumn={invoiceSortCol} currentSortDirection={invoiceSortDir} onSort={handleInvoiceSort} className="h-9 text-[11px]" />
                                  <SortableTableHead label="DATE" columnKey="date" currentSortColumn={invoiceSortCol} currentSortDirection={invoiceSortDir} onSort={handleInvoiceSort} className="h-9 text-[11px]" />
                                  <SortableTableHead label="AGE" columnKey="_age" currentSortColumn={invoiceSortCol} currentSortDirection={invoiceSortDir} onSort={handleInvoiceSort} className="h-9 text-[11px] text-right" />
                                  <SortableTableHead label="AMOUNT" columnKey="amount" currentSortColumn={invoiceSortCol} currentSortDirection={invoiceSortDir} onSort={handleInvoiceSort} className="h-9 text-[11px] text-right" />
                                  <SortableTableHead label="DEBTOR" columnKey="debtorName" currentSortColumn={invoiceSortCol} currentSortDirection={invoiceSortDir} onSort={handleInvoiceSort} className="h-9 text-[11px]" />
                                  <SortableTableHead label="STATUS" columnKey="status" currentSortColumn={invoiceSortCol} currentSortDirection={invoiceSortDir} onSort={handleInvoiceSort} className="h-9 text-[11px]" />
                                  <SortableTableHead label="FLAG" columnKey="flagged" currentSortColumn={invoiceSortCol} currentSortDirection={invoiceSortDir} onSort={handleInvoiceSort} className="h-9 text-[11px] text-center" />
                                  <TableHead className="h-9 text-[11px] w-12 text-center">NS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedInvoices.map((inv) => {
                                  const isInQueue = activeQueue?.items.some(i => i.invoiceId === inv.invoiceId)
                                  return (
                                    <TableRow key={inv.invoiceId} className="h-10 border-b">
                                      <TableCell className="pl-4 py-1">
                                        <Checkbox checked={selectedInvoices.includes(inv.invoiceId)} onCheckedChange={() => toggleInvoice(inv.invoiceId)} />
                                      </TableCell>
                                      <TableCell className="font-medium text-blue-600 py-1 text-xs">
                                        <Link to={`/gate/${inv.invoiceId}`} className="hover:underline">{inv.originalInvoice}</Link>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground py-1 text-xs">{inv.date}</TableCell>
                                      <TableCell className="text-right py-1 text-xs text-muted-foreground tabular-nums">{computeAge(inv.date)}d</TableCell>
                                      <TableCell className="text-right font-semibold py-1 text-xs tabular-nums">${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="py-1 text-xs">{inv.debtorName || '-'}</TableCell>
                                      <TableCell className="py-1">
                                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-transparent font-semibold ${
                                          inv.status === 'Pre-Verified' ? 'bg-[#DCFCE7] text-[#15803D]' :
                                          inv.status === 'Unverified' ? 'bg-[#FEF9C3] text-[#A16207]' :
                                          inv.status === 'Paid' ? 'bg-slate-800 text-white' :
                                          inv.status === 'OA' ? 'bg-blue-100 text-blue-800' :
                                          'bg-[#FEE2E2] text-[#B91C1C]'
                                        }`}>
                                          {inv.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center py-1">
                                        {inv.flagged && (
                                          <span className="inline-flex items-center justify-center w-5 h-5 bg-red-100 rounded-full text-red-700 text-[10px] font-bold" title={inv.flagReason}>!</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-1 text-center pr-4">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          disabled={isInQueue}
                                          onClick={(e) => { e.stopPropagation(); if (!isInQueue) addItem(inv.invoiceId, inv.amount) }}
                                          title={isInQueue ? "In Queue" : "Add to NS Queue"}
                                        >
                                          {isInQueue ? <Check className="h-4 w-4 text-muted-foreground" /> : <Plus className="h-4 w-4 text-blue-600" />}
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>

                        {/* ── Client Details ── */}
                        <TabsContent value="details">
                          <Card>
                            <CardHeader className="text-lg font-semibold">Client Details</CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
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
