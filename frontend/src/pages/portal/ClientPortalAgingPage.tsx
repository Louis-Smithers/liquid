import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AgingDebtorRow {
  debtorName: string
  current: number
  days31To60: number
  days61To90: number
  over90: number
  total: number
}

interface AgingClientReport {
  clientShortcode: string
  clientName: string
  debtors: AgingDebtorRow[]
}

export function ClientPortalAgingPage() {
  const { session } = useAuth()
  const [report, setReport] = useState<AgingClientReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/invoices/aging', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [session])

  const fmt = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Aging Report</h1>
        <p className="text-muted-foreground text-sm mt-1">30/60/90 day aging for your active invoices.</p>
      </div>

      {report.map(clientReport => (
        <div key={clientReport.clientShortcode} className="rounded-md border bg-white shadow-sm overflow-hidden">
          <div className="bg-muted/40 px-4 py-3 border-b">
            <h2 className="font-semibold">{clientReport.clientName} <span className="text-sm font-normal text-muted-foreground ml-1">({clientReport.clientShortcode})</span></h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debtor</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">31–60 Days</TableHead>
                <TableHead className="text-right">61–90 Days</TableHead>
                <TableHead className="text-right">90+ Days</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientReport.debtors.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.debtorName}</TableCell>
                  <TableCell className="text-right">{fmt(d.current)}</TableCell>
                  <TableCell className="text-right">{fmt(d.days31To60)}</TableCell>
                  <TableCell className="text-right">{fmt(d.days61To90)}</TableCell>
                  <TableCell className="text-right">{fmt(d.over90)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmt(d.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {report.length === 0 && (
        <p className="text-muted-foreground text-sm">No active invoices found.</p>
      )}
    </div>
  )
}
