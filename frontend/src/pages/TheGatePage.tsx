import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Search, CheckCircle2, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'

interface Invoice {
  invoiceId: string
  originalInvoice: string
  date: string
  liquidClient: string
  debtorId: string
  debtorName: string
  amount: number
  status: string
  archived: boolean
  documentPath: string | null
  createdTime: string
}

interface PageResponse {
  items: Invoice[]
  nextCursorTime: string | null
  nextCursorId: string | null
}

const PAGE_SIZE = 25

const statusStyle: Record<string, string> = {
  'Pre-Verified': 'bg-[#DCFCE7] text-[#15803D]',
  'Unverified':   'bg-[#FEF9C3] text-[#A16207]',
  'Inactive':     'bg-[#FEE2E2] text-[#B91C1C]',
  'OA':           'bg-[#DBEAFE] text-[#1D4ED8]',
  'Paid':         'bg-[#F0FDF4] text-[#166534]',
  'Flushed':      'bg-slate-100 text-slate-500',
}

export function TheGatePage() {
  const { invoiceId } = useParams()
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [nextCursorTime, setNextCursorTime] = useState<string | null | undefined>(undefined)
  const [nextCursorId, setNextCursorId] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isFirstLoad = useRef(true)

  const currentInvoice = invoices.find(i => i.invoiceId === invoiceId) ?? invoices[0] ?? null

  const fetchPage = useCallback(async (
    cursorTime: string | null | undefined,
    cursorId: string | null | undefined,
    reset: boolean
  ) => {
    if (cursorTime === null || loading) return
    setLoading(true)
    try {
      const params: Record<string, string> = { pageSize: String(PAGE_SIZE) }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusFilter) params.status = statusFilter
      if (cursorTime != null && cursorId != null) {
        params.cursorTime = cursorTime
        params.cursorId = cursorId
      }
      const res = await api.get<PageResponse>('/api/invoices', { params })
      setInvoices(prev => reset ? res.data.items : [...prev, ...res.data.items])
      setNextCursorTime(res.data.nextCursorTime)
      setNextCursorId(res.data.nextCursorId)
      // Navigate to first invoice on initial load if none selected
      if (reset && !invoiceId && res.data.items.length > 0) {
        navigate(`/gate/${res.data.items[0].invoiceId}`, { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, loading, invoiceId, navigate])

  // Reset and reload when search/filter changes
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false }
    setNextCursorTime(undefined)
    setNextCursorId(undefined)
    fetchPage(undefined, undefined, true)
  }, [debouncedSearch, statusFilter])

  // Infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchPage(nextCursorTime, nextCursorId, false) },
      { rootMargin: '150px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursorTime, nextCursorId, fetchPage])

  const fmt = (n: number) =>
    n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#F7F9FB] border-t">

      {/* Left Pane: Invoice List */}
      <div className="w-[453px] flex-shrink-0 bg-white border-r border-[#E0E3E5] flex flex-col">

        {/* Search + Filter */}
        <div className="p-4 bg-[#F7F9FB] border-b border-[#E0E3E5] flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#767586]" />
            <Input
              placeholder="Search invoice, debtor, client..."
              className="pl-9 bg-[#F7F9FB] border-[#C7C4D7] h-[34px] text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-[34px] rounded-md border border-[#C7C4D7] bg-[#F7F9FB] px-2 text-sm text-[#464554] focus:outline-none focus:ring-1 focus:ring-[#4648D4]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="Pre-Verified">Pre-Verified</option>
            <option value="Unverified">Unverified</option>
            <option value="Inactive">Inactive</option>
            <option value="OA">OA</option>
            <option value="Paid">Paid</option>
            <option value="Flushed">Flushed</option>
          </select>
        </div>

        {/* Column Headers */}
        <div className="flex px-4 py-3 bg-[#F7F9FB] border-b border-[#E0E3E5] text-xs font-semibold text-[#464554] tracking-wider uppercase">
          <div className="w-1/4">Invoice</div>
          <div className="w-1/3">Debtor</div>
          <div className="w-[41%] text-right">Amount</div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {invoices.map((inv) => (
            <Link
              key={inv.invoiceId}
              to={`/gate/${inv.invoiceId}`}
              className={`flex px-4 py-4 border-b border-[#E0E3E5] cursor-pointer hover:bg-slate-50 transition-colors ${
                inv.invoiceId === currentInvoice?.invoiceId
                  ? 'bg-[#F2F4F6] border-l-2 border-l-[#4648D4]'
                  : ''
              }`}
            >
              <div className="w-1/4 text-[13px] font-medium text-[#4648D4] truncate pr-1">{inv.originalInvoice}</div>
              <div className="w-1/3 flex flex-col">
                <span className="text-[13px] font-medium text-[#191C1E] truncate pr-2">{inv.debtorName}</span>
                <span className="text-[13px] text-[#464554]">{inv.date}</span>
              </div>
              <div className="w-[41%] flex flex-col items-end gap-1">
                <span className="text-[13px] font-medium text-[#191C1E]">{fmt(inv.amount)}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0 border-transparent ${statusStyle[inv.status] ?? 'bg-slate-100 text-slate-500'}`}
                >
                  {inv.status}
                </Badge>
              </div>
            </Link>
          ))}

          {/* Sentinel */}
          <div ref={sentinelRef} className="py-3 text-center text-xs text-slate-400">
            {loading && 'Loading...'}
            {!loading && nextCursorTime === null && invoices.length > 0 && 'All invoices loaded.'}
            {!loading && invoices.length === 0 && 'No invoices found.'}
          </div>
        </div>
      </div>

      {/* Right Pane */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">

        {/* Document Viewer */}
        <div className="flex-1 bg-white border border-[#E0E3E5] shadow-sm rounded-xl flex flex-col overflow-hidden">
          <div className="h-[50px] bg-[#F7F9FB] border-b border-[#E0E3E5] flex items-center justify-between px-4 shrink-0">
            <span className="font-semibold text-xs text-[#191C1E] uppercase tracking-wider">Document Viewer</span>
            <div className="flex items-center gap-2 text-slate-500">
              <Button variant="ghost" size="icon" className="h-7 w-7"><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-xs font-medium">100%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7"><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Maximize className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex-1 bg-[#F2F4F6] p-4 overflow-auto flex justify-center items-start">
            <div className="w-full max-w-[514px] bg-white border border-[#E0E3E5] shadow-sm rounded-lg h-[800px] relative">
              <div className="absolute top-[10%] left-[10%] w-[40%] h-[5%] border-2 border-[#4648D4] bg-[#4648D4]/10 rounded cursor-pointer transition-colors hover:bg-[#4648D4]/20" title="invoice_number" />
              <div className="flex items-center justify-center h-full text-slate-400">PDF Document Renders Here</div>
            </div>
          </div>
        </div>

        {/* Data Extraction Form */}
        <div className="w-[320px] shrink-0 bg-white border border-[#E0E3E5] shadow-sm rounded-xl flex flex-col overflow-hidden">
          <div className="h-[61px] bg-[#F7F9FB] border-b border-[#E0E3E5] flex items-center justify-between px-4 shrink-0">
            <h3 className="font-semibold text-[18px] text-[#191C1E]">Extracted Data</h3>
            <Badge variant="outline" className="bg-slate-100 text-slate-600 text-[10px] border-transparent font-semibold">
              Confidence: 95%
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Invoice Number</Label>
              <Input
                key={currentInvoice?.invoiceId}
                defaultValue={currentInvoice?.originalInvoice ?? ''}
                className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Debtor</Label>
              <Input
                key={currentInvoice?.invoiceId + '-debtor'}
                defaultValue={currentInvoice?.debtorName ?? ''}
                className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Date</Label>
              <Input
                key={currentInvoice?.invoiceId + '-date'}
                type="date"
                defaultValue={currentInvoice?.date ?? ''}
                className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Amount</Label>
              <Input
                key={currentInvoice?.invoiceId + '-amount'}
                type="number"
                defaultValue={currentInvoice?.amount ?? ''}
                className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]"
              />
            </div>
          </div>
          <div className="p-4 border-t border-[#E0E3E5] bg-[#F7F9FB]">
            <Button className="w-full bg-[#4648D4] hover:bg-[#3b3db3] text-white gap-2 h-10" disabled={!currentInvoice}>
              <CheckCircle2 className="h-4 w-4" /> Verify & Save
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
