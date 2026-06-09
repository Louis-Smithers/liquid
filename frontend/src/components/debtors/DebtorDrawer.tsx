import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Check } from "lucide-react"
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
}

interface DebtorDrawerProps {
  debtor: Debtor | null
  onClose: () => void
}

export function DebtorDrawer({ debtor, onClose }: DebtorDrawerProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const { activeQueue, setActiveClient, addItem } = useNSQueue()

  useEffect(() => {
    if (!debtor) {
      setActiveClient(null)
      return
    }

    const fetchInvoices = async () => {
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
    
    fetchInvoices()
  }, [debtor, setActiveClient])

  return (
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
                
                <TabsContent value="invoices" className="bg-white rounded-lg border border-[#C7C4D7]/50 shadow-sm overflow-hidden flex-1 mt-0 flex flex-col">
                  <div className="overflow-y-auto flex-1">
                    <Table>
                      <TableHeader className="bg-[#F8FAFC] sticky top-0 z-10 border-b border-[#C7C4D7]/50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Invoice #</TableHead>
                          <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Client</TableHead>
                          <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Date</TableHead>
                          <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-right">Amount</TableHead>
                          <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Status</TableHead>
                          <TableHead className="h-10 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-center">NS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-[#6B7280]">Loading...</TableCell></TableRow>
                        ) : invoices.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-[#6B7280]">No invoices found.</TableCell></TableRow>
                        ) : (
                          invoices.map((inv) => {
                            const isInQueue = activeQueue?.items.some(i => i.invoiceId === inv.invoiceId)
                            return (
                            <TableRow key={inv.invoiceId} className="border-b border-[#C7C4D7]/30">
                              <TableCell className="font-medium text-[#4648D4]">
                                <Link to={`/gate/${inv.invoiceId}`} className="hover:underline">{inv.originalInvoice}</Link>
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
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  disabled={isInQueue}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!isInQueue) {
                                      // Only add if we're dealing with the active client, else switch
                                      if (activeQueue?.clientShortcode !== inv.liquidClient) {
                                        setActiveClient(inv.liquidClient)
                                        // Wait a moment for state to settle, then add item using the correct client
                                        // But the context addItem uses state. Instead of refactoring context,
                                        // we can pass the client explicitly to addItem.
                                        // Let's refactor addItem to optionally take the client, or just use context.
                                        // Wait, the simplest fix is to call addItem with an extra param?
                                      }
                                      addItem(inv.invoiceId, inv.amount, inv.liquidClient)
                                    }
                                  }}
                                  title={isInQueue ? "In Queue" : "Add to NS Queue"}
                                >
                                  {isInQueue ? <Check className="h-4 w-4 text-muted-foreground" /> : <Plus className="h-4 w-4 text-blue-600" />}
                                </Button>
                              </TableCell>
                            </TableRow>
                          )})
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
