import React, { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { NotificationSheetDto } from '@/types/ns-queue'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Unlock, Trash2, ArrowLeft, Plus, Save, ChevronDown, ChevronRight, FileText, FileX } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useNSQueue } from '@/context/NSQueueContext'
import type { Client } from '@/pages/ClientsPage'

interface Invoice {
  invoiceId: string
  originalInvoice: string
  date: string
  amount: number
  status: string
  debtorName?: string
}

export function NSQueuePage() {
  const [view, setView] = useState<'list' | 'builder' | 'detail'>('list')
  const [queues, setQueues] = useState<NotificationSheetDto[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'Draft' | 'Submitted' | 'All'>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  const [detailSheetId, setDetailSheetId] = useState<string | null>(null)
  const [detailSheet, setDetailSheet] = useState<NotificationSheetDto | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [builderClient, setBuilderClient] = useState<string>('')
  const [builderInvoices, setBuilderInvoices] = useState<Invoice[]>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  
  const [isShared, setIsShared] = useState(true)
  const [initialFeePercent, setInitialFeePercent] = useState<number>(0)
  const [reserveFeePercent, setReserveFeePercent] = useState<number>(0)
  const [otherFee, setOtherFee] = useState<number>(0)
  const [cashReservesToRelease, setCashReservesToRelease] = useState<number>(0)
  const [reservesToHoldBack, setReservesToHoldBack] = useState<number>(0)
  const [otherAdjustments, setOtherAdjustments] = useState<number>(0)
  const [notes, setNotes] = useState<string>('')

  const { refresh } = useNSQueue()

  const fetchQueues = async () => {
    setLoading(true)
    try {
      const res = await api.get<NotificationSheetDto[]>('/api/notificationsheets')
      setQueues(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await api.get<Client[]>('/api/clients')
      setClients(res.data.filter(c => c.active))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (view === 'list') {
      fetchQueues()
    } else if (view === 'builder') {
      fetchClients()
    } else if (view === 'detail' && detailSheetId) {
      const fetchDetail = async () => {
        try {
          const res = await api.get<NotificationSheetDto>(`/api/notificationsheets/${detailSheetId}`)
          setDetailSheet(res.data)
        } catch (err) {
          console.error(err)
        }
      }
      fetchDetail()
    }
  }, [view, detailSheetId])

  useEffect(() => {
    if (builderClient) {
      const client = clients.find(c => c.shortcode === builderClient)
      if (client) {
        setInitialFeePercent((client.discountRate || 0) * 100)
        setReserveFeePercent((client.reserveRate || 0) * 100)
      }
      
      const fetchClientInvoices = async () => {
        try {
          const res = await api.get<Invoice[]>(`/api/invoices/client/${builderClient}`)
          // Filter to eligible statuses
          const eligible = res.data.filter(i => 
            ['Pre-Verified', 'Unverified', 'OA'].includes(i.status)
          )
          setBuilderInvoices(eligible)
          setSelectedInvoiceIds([]) // reset selections
        } catch (err) {
          console.error(err)
        }
      }
      fetchClientInvoices()
    } else {
      setBuilderInvoices([])
    }
  }, [builderClient, clients])

  const deleteQueue = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Draft?')) return
    try {
      await api.delete(`/api/notificationsheets/${id}`)
      await fetchQueues()
      await refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to delete. Ensure it's a Draft and you are the creator.")
    }
  }

  const submitQueue = async (id: string) => {
    if (!confirm('Submit this draft?')) return
    try {
      const res = await api.post(`/api/notificationsheets/${id}/submit`)
      const data = res.data // SubmitNsResultDto
      let msg = `Submitted. Merged ${data.mergedInvoiceCount} invoice document(s).`
      if (data.missingDocumentInvoiceNumbers && data.missingDocumentInvoiceNumbers.length > 0) {
        msg += `\nNo document for: ${data.missingDocumentInvoiceNumbers.join(', ')}`
      }
      alert(msg)
      if (view === 'detail' && detailSheetId === id) {
        const detailRes = await api.get<NotificationSheetDto>(`/api/notificationsheets/${id}`)
        setDetailSheet(detailRes.data)
      } else {
        await fetchQueues()
      }
      await refresh()
    } catch (err: any) {
      alert(err.response?.data || "Failed to submit.")
    }
  }

  const downloadPdf = async (id: string, shortcode: string) => {
    try {
      const res = await api.get(`/api/notificationsheets/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ScheduleOfAccounts_${shortcode}_${id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
    } catch (err) {
      alert("Failed to generate PDF.")
    }
  }

  const downloadIntake = async (id: string, shortcode: string) => {
    try {
      const res = await api.get(`/api/notificationsheets/${id}/intake`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `InvoiceIntake_${shortcode}_${id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
    } catch (err) {
      alert("Failed to download intake document.")
    }
  }

  const filteredQueues = queues.filter(q => filter === 'All' || q.status === filter)

  const handleSaveDraft = async () => {
    if (!builderClient || selectedInvoiceIds.length === 0) return
    setIsSaving(true)
    try {
      // 1. Create NS
      const nsRes = await api.post<NotificationSheetDto>('/api/notificationsheets', {
        clientShortcode: builderClient,
        isShared
      })
      const nsId = nsRes.data.id

      // 2. Update NS with fee params
      await api.patch(`/api/notificationsheets/${nsId}`, {
        initialFeePercent: initialFeePercent / 100,
        reserveFeePercent: reserveFeePercent / 100,
        otherFee,
        cashReservesToRelease,
        reservesToHoldBack,
        otherAdjustments,
        notes
      })

      // 3. Add items
      const itemsToAdd = selectedInvoiceIds.map(invId => {
        const inv = builderInvoices.find(i => i.invoiceId === invId)
        return { invoiceId: invId, includedAmount: inv?.amount || 0 }
      })

      await Promise.all(itemsToAdd.map(item => 
        api.post(`/api/notificationsheets/${nsId}/items`, item)
      ))

      await refresh()
      setView('list')
    } catch (err) {
      console.error(err)
      alert("Failed to save draft.")
    } finally {
      setIsSaving(false)
    }
  }

  const toggleInvoice = (id: string) => {
    setSelectedInvoiceIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const selectedInvoicesData = builderInvoices.filter(i => selectedInvoiceIds.includes(i.invoiceId))
  const totalInvoiceAmount = selectedInvoicesData.reduce((acc, i) => acc + i.amount, 0)
  
  const initialFeeAmt = totalInvoiceAmount * (initialFeePercent / 100)
  const reserveFeeAmt = totalInvoiceAmount * (reserveFeePercent / 100)
  const totalFee = initialFeeAmt + reserveFeeAmt + otherFee
  const advanceAmount = totalInvoiceAmount - totalFee - reservesToHoldBack + cashReservesToRelease + otherAdjustments

  if (view === 'builder') {
    return (
      <div className="flex flex-col h-full bg-[#F7F9FB] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b bg-white shrink-0">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => setView('list')}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">New Notification Sheet</h1>
              <p className="text-sm text-muted-foreground">Select client and invoices to build a new draft.</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => setIsShared(!isShared)}>
              {isShared ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              {isShared ? 'Shared' : 'Private'}
            </Button>
            <Button onClick={handleSaveDraft} disabled={isSaving || !builderClient || selectedInvoiceIds.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content: Client + Invoices */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <div className="bg-white p-4 rounded-lg border shadow-sm mb-6 max-w-sm">
              <Label className="mb-2 block text-muted-foreground font-semibold">Select Client</Label>
              <Select value={builderClient} onValueChange={setBuilderClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.shortcode} value={c.shortcode}>{c.cadenceName} ({c.shortcode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {builderClient && (
              <div className="bg-white rounded-lg border shadow-sm flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Eligible Invoices</h3>
                  <span className="text-sm text-muted-foreground">{selectedInvoiceIds.length} selected (${totalInvoiceAmount.toLocaleString()})</span>
                </div>
                <div className="overflow-auto flex-1">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b">
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <Checkbox 
                            checked={builderInvoices.length > 0 && selectedInvoiceIds.length === builderInvoices.length}
                            onCheckedChange={(c) => setSelectedInvoiceIds(c ? builderInvoices.map(i => i.invoiceId) : [])}
                          />
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">INVOICE</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">DEBTOR</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">DATE</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-right">AMOUNT</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">STATUS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {builderInvoices.map(inv => (
                        <TableRow key={inv.invoiceId}>
                          <TableCell className="text-center">
                            <Checkbox checked={selectedInvoiceIds.includes(inv.invoiceId)} onCheckedChange={() => toggleInvoice(inv.invoiceId)} />
                          </TableCell>
                          <TableCell className="font-medium text-blue-600">{inv.originalInvoice}</TableCell>
                          <TableCell>{inv.debtorName || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{inv.date}</TableCell>
                          <TableCell className="text-right font-semibold">${inv.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-transparent ${
                              inv.status === 'Pre-Verified' ? 'bg-[#DCFCE7] text-[#15803D]' : 
                              inv.status === 'Unverified' ? 'bg-[#FEF9C3] text-[#A16207]' : 
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {builderInvoices.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No eligible invoices found for this client.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          {/* Calculator Sidebar */}
          <div className="w-80 bg-white border-l shadow-sm flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Financials</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold">Total Amount</span>
                <span className="font-bold text-lg">${totalInvoiceAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="initial-fee" className="text-xs w-32">Initial Fee %</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="initial-fee" type="number" className="h-8 w-20 text-right" value={initialFeePercent} onChange={e => setInitialFeePercent(parseFloat(e.target.value) || 0)} />
                    <span className="text-sm font-medium w-16 text-right">${initialFeeAmt.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="reserve-fee" className="text-xs w-32">Reserve Fee %</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="reserve-fee" type="number" className="h-8 w-20 text-right" value={reserveFeePercent} onChange={e => setReserveFeePercent(parseFloat(e.target.value) || 0)} />
                    <span className="text-sm font-medium w-16 text-right">${reserveFeeAmt.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="other-fee" className="text-xs w-32">Other Fee ($)</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="other-fee" type="number" className="h-8 w-20 text-right" value={otherFee} onChange={e => setOtherFee(parseFloat(e.target.value) || 0)} />
                    <span className="text-sm font-medium w-16 text-right">${otherFee.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <span className="font-bold">Total Fee</span>
                <span className="font-bold text-red-600">-${totalFee.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-xs">Reserves to Hold Back ($)</Label>
                  <Input type="number" className="h-8 text-right" value={reservesToHoldBack} onChange={e => setReservesToHoldBack(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cash Reserves to Release ($)</Label>
                  <Input type="number" className="h-8 text-right" value={cashReservesToRelease} onChange={e => setCashReservesToRelease(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Other Adjustments ($)</Label>
                  <Input type="number" className="h-8 text-right" value={otherAdjustments} onChange={e => setOtherAdjustments(parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="p-4 bg-[#EEF2FF] rounded-lg border border-[#C7D2FE]">
                  <div className="text-xs font-semibold text-[#4648D4] uppercase tracking-wider mb-1">Advance Amount</div>
                  <div className="text-2xl font-bold text-[#191C1E]">${advanceAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Label className="text-xs">Notes</Label>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Internal notes..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'detail' && detailSheet) {
    return (
      <div className="flex flex-col h-full bg-[#F7F9FB] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b bg-white shrink-0">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => setView('list')}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{detailSheet.displayName}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary">{detailSheet.clientShortcode}</Badge>
                <Badge variant="outline" className={detailSheet.status === 'Draft' ? 'bg-[#FEF9C3] text-[#A16207]' : 'bg-[#DCFCE7] text-[#15803D]'}>
                  {detailSheet.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {detailSheet.status === 'Draft' && (
              <Button onClick={() => submitQueue(detailSheet.id)} className="bg-green-600 hover:bg-green-700">
                <Save className="h-4 w-4 mr-2" />
                Submit
              </Button>
            )}
            {(detailSheet.status === 'Submitted' || detailSheet.hasGcsFiles) && (
              <Button variant="outline" onClick={() => downloadIntake(detailSheet.id, detailSheet.clientShortcode)}>
                Download Intake
              </Button>
            )}
            {detailSheet.status === 'Submitted' && (
              <Button variant="outline" onClick={() => downloadPdf(detailSheet.id, detailSheet.clientShortcode)}>
                Download PDF
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <div className="bg-white rounded-lg border shadow-sm flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b bg-slate-50">
                <h3 className="font-semibold text-sm">Invoices</h3>
              </div>
              <div className="p-4 space-y-6 overflow-y-auto">
                {Array.from(new Set(detailSheet.items.map(i => i.debtorName))).map(debtor => (
                  <div key={debtor}>
                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground">{debtor}</h4>
                    <Table>
                      <TableBody>
                        {detailSheet.items.filter(i => i.debtorName === debtor).map(i => (
                          <TableRow key={i.id}>
                            <TableCell className="w-10">
                              {i.hasDocument ? <span title="Has document"><FileText className="h-4 w-4 text-green-600" /></span> : <span title="No document"><FileX className="h-4 w-4 text-red-400" /></span>}
                            </TableCell>
                            <TableCell className="font-medium text-blue-600">{i.invoiceNumber}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{new Date(i.date).toISOString().split('T')[0]}</TableCell>
                            <TableCell className="text-right font-semibold">${i.includedAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="w-80 bg-white border-l shadow-sm flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Financials</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="flex justify-between font-semibold">
                <span>Total Amount</span>
                <span>${detailSheet.totalAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Fee</span>
                <span>-${detailSheet.totalFee.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Reserves Held</span>
                <span>-${detailSheet.reservesToHoldBack.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Reserves Released</span>
                <span>+${detailSheet.cashReservesToRelease.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Other Adjustments</span>
                <span>{detailSheet.otherAdjustments >= 0 ? '+' : ''}${detailSheet.otherAdjustments.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div className="pt-4 border-t">
                <div className="p-4 bg-[#EEF2FF] rounded-lg border border-[#C7D2FE]">
                  <div className="text-xs font-semibold text-[#4648D4] uppercase tracking-wider mb-1">Advance Amount</div>
                  <div className="text-2xl font-bold text-[#191C1E]">${detailSheet.advanceAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // LIST VIEW
  return (
    <div className="flex flex-col w-full h-full min-h-[960px] bg-[#F7F9FB] p-8">
      <div className="flex flex-row justify-between items-center pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.24px] text-[#191C1E]">
            Notification Sheets Queue
          </h1>
          <p className="text-[13px] leading-[18px] text-[#464554]">
            Manage draft and submitted notification sheets.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-row items-center p-1 bg-[#F7F9FB] border border-[#C7C4D7] rounded-[2px]">
            {['Draft', 'Submitted', 'All'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`flex items-center justify-center px-3 py-1 text-xs font-semibold tracking-[0.6px] rounded-[2px] transition-colors ${
                  filter === f
                    ? 'bg-[#E6E8EA] text-[#191C1E] shadow-sm'
                    : 'text-[#464554] hover:bg-[#E6E8EA]/50'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/ns-queue/upload'}>
            Upload New Invoices
          </Button>
          <Button onClick={() => setView('builder')} className="bg-[#4648D4] hover:bg-[#3537b3]">
            <Plus className="h-4 w-4 mr-2" />
            New NS
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 bg-white border border-[#C7C4D7]/50 shadow-sm rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Items</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Total Amount</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Privacy</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filteredQueues.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No queues found.</TableCell></TableRow>
            ) : (
              filteredQueues.map(q => (
                <React.Fragment key={q.id}>
                <TableRow className="h-14">
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                      {expandedId === q.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-semibold text-[#191C1E]">{q.displayName}</TableCell>
                  <TableCell><Badge variant="secondary">{q.clientShortcode}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{q.itemCount}</TableCell>
                  <TableCell className="text-right font-semibold">${q.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={q.status === 'Draft' ? 'bg-[#FEF9C3] text-[#A16207]' : 'bg-[#DCFCE7] text-[#15803D]'}>
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {q.isShared ? <span title="Shared"><Unlock className="h-4 w-4 mx-auto text-muted-foreground" /></span> : <span title="Private"><Lock className="h-4 w-4 mx-auto text-muted-foreground" /></span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setDetailSheetId(q.id); setView('detail'); }}>Open</Button>
                      {q.status === 'Draft' && (
                        <>
                          <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => submitQueue(q.id)}>
                            Submit
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete Queue" className="text-red-500 hover:bg-red-50" onClick={() => deleteQueue(q.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(q.status === 'Submitted' || q.hasGcsFiles) && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => downloadIntake(q.id, q.clientShortcode)}>
                            Intake
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => downloadPdf(q.id, q.clientShortcode)}>
                            PDF
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === q.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-slate-50 p-4">
                      <div className="space-y-4">
                        {Array.from(new Set(q.items.map(i => i.debtorName))).map(debtor => (
                          <div key={debtor}>
                            <h4 className="font-semibold text-sm mb-2">{debtor}</h4>
                            <Table>
                              <TableBody>
                                {q.items.filter(i => i.debtorName === debtor).map(i => (
                                  <TableRow key={i.id}>
                                    <TableCell className="w-10">
                                      {i.hasDocument ? <span title="Has document"><FileText className="h-4 w-4 text-green-600" /></span> : <span title="No document"><FileX className="h-4 w-4 text-red-400" /></span>}
                                    </TableCell>
                                    <TableCell className="font-medium text-blue-600">{i.invoiceNumber}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{new Date(i.date).toISOString().split('T')[0]}</TableCell>
                                    <TableCell className="text-right font-semibold">${i.includedAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
