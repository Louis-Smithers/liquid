import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { InvoicePreviewModal } from "@/components/invoices/InvoicePreviewModal"
import { InvoiceNotesPopover } from "@/components/invoices/InvoiceNotesPopover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import type { Debtor } from "@/pages/DebtorsPage"
import { useNSQueue } from "@/context/NSQueueContext"

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

interface DebtorDrawerProps {
  debtor: Debtor | null
  onClose: () => void
}

export function DebtorDrawer({ debtor, onClose }: DebtorDrawerProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<{ id: string; originalInvoice: string } | null>(null)
  const { setActiveClient, addItem } = useNSQueue()

  const [unprocessedExpanded, setUnprocessedExpanded] = useState(false)
  const [unprocessedSelected, setUnprocessedSelected] = useState<string[]>([])
  const [addingToQueue, setAddingToQueue] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [bulkNoteDraft, setBulkNoteDraft] = useState('')
  const [postingBulkNote, setPostingBulkNote] = useState(false)

  const unprocessedInvoices = invoices.filter(inv => !inv.isProcessed)
  const processedInvoices = invoices.filter(inv => inv.isProcessed)

  const fetchInvoices = async () => {
    if (!debtor) return
    setLoading(true)
    try {
      const response = await api.get<Invoice[]>(`/api/invoices/debtor/${debtor.id}`)
      const data = response.data
      setInvoices(data)
      if (data.length > 0) {
        setActiveClient(data[0].liquidClient)
      }
    } catch (error) {
      console.error("Failed to fetch debtor invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!debtor) {
      setActiveClient(null)
      return
    }
    fetchInvoices()
  }, [debtor, setActiveClient])

  const toggleUnprocessedInvoice = (invoiceId: string) => {
    setUnprocessedSelected(prev =>
      prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId]
    )
  }

  const toggleProcessedInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId]
    )
  }

  const handleAddSelectedToQueue = async () => {
    if (unprocessedSelected.length === 0) return
    setAddingToQueue(true)
    try {
      for (const invoiceId of unprocessedSelected) {
        const inv = unprocessedInvoices.find(i => i.invoiceId === invoiceId)
        if (!inv) continue
        await addItem(inv.invoiceId, inv.amount, inv.liquidClient)
      }
      setUnprocessedSelected([])
      await fetchInvoices()
    } catch (err) {
      console.error('Failed to add invoices to NS queue', err)
    } finally {
      setAddingToQueue(false)
    }
  }

  const handlePostBulkNote = async () => {
    if (!bulkNoteDraft.trim() || selectedInvoices.length === 0) return
    setPostingBulkNote(true)
    try {
      await api.post('/api/invoices/notes/bulk', {
        invoiceIds: selectedInvoices,
        text: bulkNoteDraft.trim()
      })
      setBulkNoteDraft('')
      setSelectedInvoices([])
    } catch (err) {
      console.error('Failed to post bulk note', err)
    } finally {
      setPostingBulkNote(false)
    }
  }

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
              <div className="flex flex-row items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-[#DAE2FD] rounded-lg text-[#4648D4] font-semibold text-lg">
                  {debtor.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <SheetTitle className="text-2xl font-semibold text-[#191C1E] tracking-tight">{debtor.name}</SheetTitle>
                  <SheetDescription className="text-[13px] text-[#6B7280]">
                    Cadence Name: <span className="text-[#464554] font-medium">{debtor.cadenceName || '-'}</span>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="p-6 flex-1 flex flex-col">
              <Tabs defaultValue="invoices" className="flex-1 flex flex-col w-full">
                <TabsList className="grid w-[300px] grid-cols-2 mb-6 bg-[#E2E8F0] p-1 rounded-md shrink-0">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-[#191C1E] data-[state=active]:shadow-sm rounded-sm text-sm">Overview</TabsTrigger>
                  <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:text-[#191C1E] data-[state=active]:shadow-sm rounded-sm text-sm">Invoices</TabsTrigger>
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
                      <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider">Group</p>
                      <Badge variant="outline" className={`w-fit border-transparent font-medium ${
                        debtor.group === 'Active' ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF9C3] text-[#A16207]"
                      }`}>
                        {debtor.group}
                      </Badge>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="invoices" className="flex-1 mt-0 space-y-4 overflow-y-auto">
                  {/* Unprocessed (collapsed by default) */}
                  <div className="bg-white rounded-lg border border-[#C7C4D7]/50 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setUnprocessedExpanded(prev => !prev)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        {unprocessedExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm font-semibold text-[#191C1E]">Unprocessed</span>
                      </div>
                      <Badge variant="outline" className="bg-[#FEF9C3] text-[#A16207] border-transparent font-semibold">
                        {unprocessedInvoices.length}
                      </Badge>
                    </button>
                    {unprocessedExpanded && (
                      <div className="border-t border-[#C7C4D7]/50">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b gap-2">
                          <span className="text-xs text-muted-foreground">
                            {unprocessedSelected.length > 0 ? `${unprocessedSelected.length} selected` : 'Not yet added to a Notification Sheet'}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={unprocessedSelected.length === 0 || addingToQueue}
                              onClick={handleAddSelectedToQueue}
                            >
                              {addingToQueue ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add Selected to NS Queue'}
                            </Button>
                            <Link to="/ns-queue?view=builder">
                              <Button size="sm" className="h-7 text-xs bg-[#4648D4] hover:bg-[#3537b3]">
                                Go to NS Builder
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <div className="overflow-auto max-h-[280px]">
                          <Table>
                            <TableHeader className="bg-[#F8FAFC] sticky top-0 z-10 border-b border-[#C7C4D7]/50">
                              <TableRow>
                                <TableHead className="w-10 pl-4">
                                  <Checkbox
                                    checked={unprocessedSelected.length > 0 && unprocessedSelected.length === unprocessedInvoices.length}
                                    onCheckedChange={(checked) => setUnprocessedSelected(checked ? unprocessedInvoices.map(i => i.invoiceId) : [])}
                                  />
                                </TableHead>
                                <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Invoice #</TableHead>
                                <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Date</TableHead>
                                <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-right">Amount</TableHead>
                                <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Source</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {unprocessedInvoices.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#6B7280]">No unprocessed invoices.</TableCell></TableRow>
                              ) : (
                                unprocessedInvoices.map((inv) => (
                                  <TableRow key={inv.invoiceId} className="border-b border-[#C7C4D7]/30">
                                    <TableCell className="pl-4">
                                      <Checkbox checked={unprocessedSelected.includes(inv.invoiceId)} onCheckedChange={() => toggleUnprocessedInvoice(inv.invoiceId)} />
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
                                    <TableCell className="text-right font-medium text-[#191C1E]">
                                      ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-[#6B7280]">{inv.source}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Processed */}
                  <div className="bg-white rounded-lg border border-[#C7C4D7]/50 shadow-sm overflow-hidden flex flex-col">
                    {selectedInvoices.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-[#C7C4D7]/50">
                        <Input
                          placeholder={`Add note to ${selectedInvoices.length} selected...`}
                          className="h-8 text-xs bg-white max-w-md"
                          value={bulkNoteDraft}
                          onChange={e => setBulkNoteDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handlePostBulkNote() }}
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-[#4648D4] hover:bg-[#3537b3] shrink-0"
                          disabled={!bulkNoteDraft.trim() || postingBulkNote}
                          onClick={handlePostBulkNote}
                        >
                          {postingBulkNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add Note'}
                        </Button>
                      </div>
                    )}
                    <div className="overflow-auto max-h-[420px]">
                      <Table>
                        <TableHeader className="bg-[#F8FAFC] sticky top-0 z-10 border-b border-[#C7C4D7]/50">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10 pl-4">
                              <Checkbox
                                checked={selectedInvoices.length > 0 && selectedInvoices.length === processedInvoices.length}
                                onCheckedChange={(checked) => setSelectedInvoices(checked ? processedInvoices.map(i => i.invoiceId) : [])}
                              />
                            </TableHead>
                            <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Invoice #</TableHead>
                            <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Client</TableHead>
                            <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Date</TableHead>
                            <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-right">Amount</TableHead>
                            <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Status</TableHead>
                            <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-center">Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#6B7280]">Loading...</TableCell></TableRow>
                          ) : processedInvoices.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#6B7280]">No processed invoices.</TableCell></TableRow>
                          ) : (
                            processedInvoices.map((inv) => (
                              <TableRow key={inv.invoiceId} className="border-b border-[#C7C4D7]/30">
                                <TableCell className="pl-4">
                                  <Checkbox checked={selectedInvoices.includes(inv.invoiceId)} onCheckedChange={() => toggleProcessedInvoice(inv.invoiceId)} />
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
                                <TableCell className="text-[#191C1E]">{inv.liquidClient}</TableCell>
                                <TableCell className="text-[#6B7280]">{inv.date}</TableCell>
                                <TableCell className="text-right font-medium text-[#191C1E]">
                                  ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`border-transparent font-medium ${
                                      inv.status === 'Pre-Verified' ? 'bg-[#DCFCE7] text-[#15803D]' :
                                      inv.status === 'Unverified' ? 'bg-[#FEF9C3] text-[#A16207]' :
                                      inv.status === 'Paid' ? 'bg-slate-800 text-white' :
                                      inv.status === 'OA' ? 'bg-blue-100 text-blue-800' :
                                      'bg-[#FEE2E2] text-[#B91C1C]'
                                    }`}
                                  >
                                    {inv.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <InvoiceNotesPopover invoiceId={inv.invoiceId} originalInvoice={inv.originalInvoice} />
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  )
}
