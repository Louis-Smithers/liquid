import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Invoice {
  invoiceId: string
  originalInvoice: string
  date: string
  debtorName: string
  amount: number
  status: string
  verified: boolean
}

const statusColor = (status: string) => {
  if (status === 'Pre-Verified') return 'bg-green-100 text-green-700'
  if (status === 'Unverified') return 'bg-yellow-100 text-yellow-700'
  if (status === 'OA' || status === 'ON') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

export function ClientPortalInvoicesPage() {
  const { session, clientShortcode } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientShortcode) return
    fetch(`/api/invoices/client/${clientShortcode}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientShortcode, session])

  const fmt = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>
        <p className="text-muted-foreground text-sm mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Debtor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No invoices found.</TableCell></TableRow>
            ) : invoices.map(inv => (
              <TableRow key={inv.invoiceId}>
                <TableCell className="font-medium">{inv.originalInvoice || inv.invoiceId}</TableCell>
                <TableCell>{inv.date}</TableCell>
                <TableCell>{inv.debtorName}</TableCell>
                <TableCell className="text-right">{fmt(inv.amount)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`border-transparent text-xs ${statusColor(inv.status)}`}>
                    {inv.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
