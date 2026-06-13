import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search, SlidersHorizontal, Settings2, ChevronLeft, ChevronRight } from "lucide-react"
import { api } from "@/lib/api"
import { ClientDrawer } from "@/components/clients/ClientDrawer"
import { AddClientModal } from "@/components/clients/AddClientModal"
import { SortableTableHead } from "@/components/ui/SortableTableHead"

export interface Client {
  id: string
  shortcode: string
  cadenceName: string
  active: boolean
  dnc: boolean
  email?: string
  phone?: string
  notes?: string
  city?: string
  province?: string
  postalCode?: string
  language?: string
  reserveRate?: number
  discountRate?: number
  address?: string
  contact?: string
}

type SortDirection = "asc" | "desc" | null;

interface ClientStat {
  shortcode: string
  verifiedPercent: number
  debtorCount: number
  invoiceCount: number
  totalAmount: number
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientStats, setClientStats] = useState<Record<string, ClientStat>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active')

  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 10

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const [clientsRes, statsRes] = await Promise.all([
          api.get<Client[]>('/api/clients'),
          api.get<ClientStat[]>('/api/clients/stats')
        ])
        setClients(clientsRes.data)
        const statsMap: Record<string, ClientStat> = {}
        for (const s of statsRes.data) statsMap[s.shortcode] = s
        setClientStats(statsMap)
      } catch (error) {
        console.error("Failed to fetch clients:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchClients()
  }, [])

  const handleSort = (columnKey: string, direction: SortDirection) => {
    setSortColumn(columnKey)
    setSortDirection(direction)
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.shortcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.cadenceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || client.active
    return matchesSearch && matchesTab
  })

  // Reset to first page whenever filter/sort/tab changes
  useEffect(() => { setPage(0) }, [searchQuery, activeTab, sortColumn, sortDirection])

  const statColumns = new Set(['verifiedPercent', 'debtorCount', 'invoiceCount', 'totalAmount'])

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;

    let aVal: any
    let bVal: any

    if (statColumns.has(sortColumn)) {
      const aStat = clientStats[a.shortcode]
      const bStat = clientStats[b.shortcode]
      aVal = aStat ? aStat[sortColumn as keyof ClientStat] : -1
      bVal = bStat ? bStat[sortColumn as keyof ClientStat] : -1
    } else {
      aVal = a[sortColumn as keyof Client] ?? ""
      bVal = b[sortColumn as keyof Client] ?? ""
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal as string).toLowerCase() }
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedClients.length / PAGE_SIZE)
  const pagedClients = sortedClients.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)


  const activeCount = clients.filter(c => c.active).length
  const totalCount = clients.length

  return (
    <div className="flex flex-col w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      {/* ── Header Section ── */}
      <div className="flex flex-row justify-between items-center pb-6">
        {/* Left: Title + subtitle */}
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.24px] text-[#191C1E]">
            Clients
          </h1>
          <p className="text-[13px] leading-[18px] text-[#464554]">
            Manage Liquid Capital clients, debtors, and invoices.
          </p>
        </div>

        {/* Right: Tab toggle + Add Client */}
        <div className="flex flex-row items-center gap-3">
          {/* Active / All toggle */}
          <div className="flex flex-row items-center p-1 bg-[#F7F9FB] border border-[#C7C4D7] rounded-[2px]">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center justify-center px-3 py-1 text-xs font-semibold tracking-[0.6px] rounded-[2px] transition-colors ${
                activeTab === 'active'
                  ? 'bg-[#E6E8EA] text-[#191C1E] shadow-sm'
                  : 'text-[#464554] hover:bg-[#E6E8EA]/50'
              }`}
            >
              ACTIVE
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center justify-center px-3 py-1 text-xs font-semibold tracking-[0.6px] rounded-[2px] transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#E6E8EA] text-[#191C1E] shadow-sm'
                  : 'text-[#464554] hover:bg-[#E6E8EA]/50'
              }`}
            >
              ALL
            </button>
          </div>

          {/* Add Client Button */}
          <AddClientModal onClientAdded={(client) => setClients([...clients, client])} />
        </div>
      </div>

      {/* ── Data Table Surface ── */}
      <div className="flex flex-col flex-1 bg-white border border-[rgba(199,196,215,0.5)] shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] rounded-lg overflow-hidden">
        {/* Table Controls */}
        <div className="flex flex-row justify-between items-center px-4 py-3 bg-[#F7F9FB] border-b border-[rgba(199,196,215,0.5)]">
          {/* Search Input */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[13.5px] w-[13.5px] text-[#464554]" />
            <Input
              placeholder="Filter clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 bg-[#F7F9FB] border-[#C7C4D7] text-[13px] text-[#191C1E] placeholder:text-[#6B7280]"
            />
          </div>

          {/* Right Controls */}
          <div className="flex flex-row items-center gap-2">
            <button className="flex items-center justify-center p-1.5 hover:bg-[#E6E8EA] rounded transition-colors">
              <SlidersHorizontal className="h-[15px] w-[15px] text-[#464554]" />
            </button>
            <button className="flex items-center justify-center p-1.5 hover:bg-[#E6E8EA] rounded transition-colors">
              <Settings2 className="h-[13.3px] w-[13.3px] text-[#464554]" />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-[#F7F9FB] sticky top-0 z-10">
              <TableRow className="border-b border-[rgba(199,196,215,0.5)] hover:bg-transparent">
                <SortableTableHead
                  label="CLIENT NAME"
                  columnKey="cadenceName"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="h-10 pl-4 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px]"
                />
                <SortableTableHead
                  label="VERIFIED %"
                  columnKey="verifiedPercent"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-center w-[140px]"
                />
                <SortableTableHead
                  label="DEBTORS"
                  columnKey="debtorCount"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right w-[110px]"
                />
                <SortableTableHead
                  label="INVOICES"
                  columnKey="invoiceCount"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right w-[110px]"
                />
                <SortableTableHead
                  label="TOTAL AMOUNT"
                  columnKey="totalAmount"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right w-[160px]"
                />
                <TableHead className="h-10 text-xs font-semibold text-[#464554] uppercase tracking-[0.6px] text-right pr-4 w-[140px]">
                  ACTIONS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-[#6B7280] text-sm">
                    Loading clients...
                  </TableCell>
                </TableRow>
              ) : sortedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-[#6B7280] text-sm">
                    No clients found
                  </TableCell>
                </TableRow>
              ) : (
                pagedClients.map((client) => (
                  <TableRow
                    key={client.shortcode}
                    className="cursor-pointer hover:bg-[#F8FAFC] border-t border-[rgba(199,196,215,0.5)] transition-colors"
                    onClick={() => setSelectedClient(client)}
                  >
                    {/* Col 1: Avatar + Name */}
                    <TableCell className="pl-4 py-3">
                      <div className="flex flex-row items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-[#DAE2FD] rounded text-[#4648D4] font-bold text-[14px] leading-5 shrink-0">
                          {client.shortcode.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="text-[13px] font-medium leading-[18px] text-[#191C1E]">
                          {client.cadenceName}
                        </span>
                      </div>
                    </TableCell>

                    {/* Col 2: Verified % */}
                    <TableCell className="text-center py-3">
                      {(() => {
                        const stat = clientStats[client.shortcode]
                        if (stat == null) return <span className="text-xs text-muted-foreground">—</span>
                        const pct = stat.verifiedPercent
                        const pctDisplay = (pct * 100).toFixed(1) + '%'
                        const color = pct >= 0.8 ? '#15803D' : pct >= 0.5 ? '#A16207' : '#B91C1C'
                        const bg = pct >= 0.8 ? '#DCFCE7' : pct >= 0.5 ? '#FEF9C3' : '#FEE2E2'
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
                            style={{ color, backgroundColor: bg }}>
                            {pctDisplay}
                          </span>
                        )
                      })()}
                    </TableCell>

                    {/* Col 3: Debtors */}
                    <TableCell className="text-right py-3">
                      <span className="text-[13px] font-medium leading-5 text-[#191C1E]">
                        {clientStats[client.shortcode]?.debtorCount ?? '—'}
                      </span>
                    </TableCell>

                    {/* Col 4: Invoices */}
                    <TableCell className="text-right py-3">
                      <span className="text-[13px] font-medium leading-5 text-[#191C1E]">
                        {clientStats[client.shortcode]?.invoiceCount ?? '—'}
                      </span>
                    </TableCell>

                    {/* Col 5: Total Amount */}
                    <TableCell className="text-right py-3">
                      <span className="text-[13px] font-medium leading-5 text-[#191C1E]">
                        {clientStats[client.shortcode] != null
                          ? '$' + clientStats[client.shortcode].totalAmount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'}
                      </span>
                    </TableCell>

                    {/* Col 6: View Details */}
                    <TableCell className="text-right pr-4 py-3">
                      <button
                        className="text-xs font-semibold tracking-[0.6px] text-[#4648D4] hover:text-[#3537b3] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedClient(client)
                        }}
                      >
                        VIEW DETAILS
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Table Footer / Pagination ── */}
        <div className="border-t-2 border-[#C7C4D7] bg-[#F7F9FB]">
          <div className="flex flex-row items-center justify-between px-4 py-3.5">
            <span className="text-xs font-semibold tracking-[0.6px] text-[#191C1E]">
              {filteredClients.length} CLIENTS
            </span>
            <div className="flex flex-row items-center gap-3">
              <span className="text-xs text-[#464554]">
                Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="flex items-center justify-center w-7 h-7 rounded border border-[#C7C4D7] bg-white disabled:opacity-40 hover:bg-[#E6E8EA] transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-[#464554]" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center justify-center w-7 h-7 rounded border border-[#C7C4D7] bg-white disabled:opacity-40 hover:bg-[#E6E8EA] transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-[#464554]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer Bar ── */}
      <div className="pt-4">
        <div className="flex flex-row justify-between items-center px-4 py-2 bg-[#F7F9FB] border border-[rgba(199,196,215,0.5)] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-sm">
          <div className="flex flex-row items-center gap-4">
            {/* Active count */}
            <div className="flex flex-row items-center gap-2">
              <div className="w-[13.3px] h-[13.3px] rounded-sm bg-[#16A34A]" />
              <span className="text-xs font-semibold tracking-[0.6px] text-[#464554]">
                {activeCount} Active
              </span>
            </div>

            <div className="w-px h-4 bg-[#C7C4D7]" />

            <span className="text-[13px] leading-[18px] text-[#464554]">
              Showing {filteredClients.length} of {totalCount} total clients
            </span>
          </div>
        </div>
      </div>

      <ClientDrawer
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
      />
    </div>
  )
}
