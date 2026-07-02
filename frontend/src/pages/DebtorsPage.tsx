import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Filter, Search, ShoppingCart, GitMerge, ChevronDown, ChevronRight } from "lucide-react"
import { api } from "@/lib/api"
import { DebtorDrawer } from "@/components/debtors/DebtorDrawer"
import { AddDebtorModal } from "@/components/debtors/AddDebtorModal"
import { MergeDebtorsModal } from "@/components/debtors/MergeDebtorsModal"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import { useNSQueue } from "@/context/NSQueueContext"
import { Button } from "@/components/ui/button"
import { PaginationBar } from "@/components/ui/PaginationBar"
import { usePagination } from "@/hooks/usePagination"

export interface Debtor {
  id: string
  name: string
  cadenceName?: string
  group: string
  active: boolean
  redirectId?: string | null
  redirectName?: string | null
}

type SortDirection = "asc" | "desc" | null;

const PAGE_SIZE = 25

export function DebtorsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null)

  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [showMerged, setShowMerged] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)

  const fetchDebtors = async () => {
    try {
      const response = await api.get<Debtor[]>('/api/debtors')
      setDebtors(response.data)
    } catch (error) {
      console.error("Failed to fetch debtors:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDebtors()
  }, [])

  useEffect(() => {
    const debtorId = searchParams.get('debtorId')
    if (!debtorId || debtors.length === 0) return
    const match = debtors.find(d => d.id === debtorId)
    if (match) setSelectedDebtor(match)
  }, [debtors, searchParams])

  // Keep the open drawer's debtor object fresh (e.g. after a merge changes its redirectId).
  useEffect(() => {
    if (!selectedDebtor) return
    const fresh = debtors.find(d => d.id === selectedDebtor.id)
    if (fresh && fresh !== selectedDebtor) setSelectedDebtor(fresh)
  }, [debtors, selectedDebtor])

  const handleSort = (columnKey: string, direction: SortDirection) => {
    setSortColumn(columnKey)
    setSortDirection(direction)
  }

  // Aliases merged into a canonical debtor, keyed by canonical id (for "Merged in" listing elsewhere).
  const aliasesByCanonical = useMemo(() => {
    const map: Record<string, Debtor[]> = {}
    for (const d of debtors) {
      if (!d.redirectId) continue
      if (!map[d.redirectId]) map[d.redirectId] = []
      map[d.redirectId].push(d)
    }
    return map
  }, [debtors])

  const filteredDebtors = debtors.filter(debtor =>
    debtor.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (showMerged || !debtor.redirectId)
  )

  const sortedDebtors = [...filteredDebtors].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;
    
    let aVal: any = a[sortColumn as keyof Debtor];
    let bVal: any = b[sortColumn as keyof Debtor];

    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    if (sortColumn === 'active') {
       aVal = a.active ? 1 : 0;
       bVal = b.active ? 1 : 0;
    } else if (typeof aVal === 'string') {
       aVal = aVal.toLowerCase();
       bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate the filtered/sorted (visible) set so paging composes correctly with the
  // search box, sort, and the "Show/Hide merged aliases" collapse toggle.
  const { page, totalPages, pageItems: pagedDebtors, goPrev, goNext, setPage } = usePagination(sortedDebtors, PAGE_SIZE)

  // Reset to first page whenever search/sort/alias-toggle changes.
  useEffect(() => { setPage(0) }, [searchQuery, sortColumn, sortDirection, showMerged]) // eslint-disable-line react-hooks/exhaustive-deps

  const { draftCount, togglePanel } = useNSQueue()

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div className="flex flex-row justify-between items-center pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#191C1E]">Debtors</h1>
          <p className="text-[13px] text-[#464554]">Manage debtors mapped across clients.</p>
        </div>
        <div className="flex flex-row items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setMergeModalOpen(true)} className="h-8">
            <GitMerge className="h-4 w-4 mr-2" />
            Merge Debtors
          </Button>
          <Button variant="outline" size="sm" onClick={togglePanel} className="h-8">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Queue
            {draftCount > 0 && <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">{draftCount}</Badge>}
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 bg-white border border-[#C7C4D7]/50 shadow-sm rounded-lg overflow-hidden">
        {/* Table Controls */}
        <div className="flex flex-row justify-between items-center p-3 px-4 bg-[#F7F9FB] border-b border-[#C7C4D7]/50">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
            <Input
              placeholder="Filter debtors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 bg-[#F7F9FB] border-[#C7C4D7]"
            />
          </div>
          <div className="flex flex-row items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#464554] gap-1"
              onClick={() => setShowMerged(prev => !prev)}
            >
              {showMerged ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {showMerged ? 'Hide merged aliases' : 'Show merged aliases'}
            </Button>
            <button className="flex items-center justify-center p-1.5 hover:bg-slate-200 rounded">
              <Filter className="h-4 w-4 text-[#464554]" />
            </button>
            <AddDebtorModal onDebtorAdded={(debtor) => setDebtors([...debtors, debtor])} />
          </div>
        </div>

        {/* Table Container — fixed min-height avoids layout jump between pages */}
        <div className="flex-1 overflow-auto" style={{ minHeight: 41 + PAGE_SIZE * 56 }}>
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0">
              <TableRow className="border-[#C7C4D7]/50">
                <SortableTableHead
                  label="Name"
                  columnKey="name"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider h-10"
                />
                <SortableTableHead
                  label="Under Review / Approved"
                  columnKey="group"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider h-10"
                  title="Debtors added by an n8n import start as Under Review until vetted."
                />
                <SortableTableHead
                  label="Active"
                  columnKey="active"
                  currentSortColumn={sortColumn}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider h-10"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-[#6B7280]">Loading debtors...</TableCell>
                </TableRow>
              ) : sortedDebtors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-[#6B7280]">No debtors found</TableCell>
                </TableRow>
              ) : (
                pagedDebtors.map((debtor) => (
                  <TableRow 
                    key={debtor.id} 
                    className="cursor-pointer hover:bg-slate-50 border-[#C7C4D7]/30 h-14"
                    onClick={() => setSelectedDebtor(debtor)}
                  >
                    <TableCell className="font-medium text-[#191C1E]">
                      <div className="flex items-center gap-2">
                        {debtor.name}
                        {debtor.redirectId && (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-transparent font-medium text-[10px] gap-1">
                            <GitMerge className="h-3 w-3" />
                            Merged &rarr; {debtor.redirectName || 'unknown'}
                          </Badge>
                        )}
                        {!debtor.redirectId && aliasesByCanonical[debtor.id]?.length > 0 && (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-transparent font-medium text-[10px]"
                            title={aliasesByCanonical[debtor.id].map(a => a.name).join(', ')}
                          >
                            {aliasesByCanonical[debtor.id].length} merged in
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`border-transparent font-medium ${
                          debtor.group === 'Active' ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF9C3] text-[#A16207]"
                        }`}
                        title="Debtors added by an n8n import start as Under Review until vetted."
                      >
                        {debtor.group === 'Active' ? 'Approved' : 'Under Review'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {debtor.active ? (
                        <Badge variant="outline" className="bg-[#DCFCE7] text-[#15803D] border-transparent font-medium">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-[#F1F5F9] text-[#475569] border-transparent font-medium">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Table Footer / Pagination ── */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalCount={sortedDebtors.length}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>

      <DebtorDrawer
        debtor={selectedDebtor}
        allDebtors={debtors}
        onDebtorsChanged={fetchDebtors}
        onClose={() => {
          setSelectedDebtor(null)
          if (searchParams.has('debtorId')) setSearchParams({})
        }}
      />

      <MergeDebtorsModal
        open={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        debtors={debtors}
        onMerged={async () => { await fetchDebtors() }}
      />
    </div>
  )
}
