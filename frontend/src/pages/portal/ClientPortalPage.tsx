import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AgingBucket {
  current: number
  days31To60: number
  days61To90: number
  days91To120: number
  over120: number
}

interface DebtorSummary {
  id: string
  name: string
  invoiceCount: number
  totalAmount: number
  aging: AgingBucket
}

interface ClientSummary {
  totalAmount: number
  openCount: number
  verifiedPercent: number
  verifiedAmount: number
  aging: AgingBucket
  debtors: DebtorSummary[]
}

export function ClientPortalPage() {
  const { session, clientShortcode } = useAuth()
  const [summary, setSummary] = useState<ClientSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientShortcode) return
    fetch(`/api/clients/${clientShortcode}/summary`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setSummary(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientShortcode, session])

  const fmt = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>
  if (!summary) return <div className="p-8 text-muted-foreground">No data found.</div>

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Portfolio Overview</h1>
        <p className="text-muted-foreground text-sm">Account: {clientShortcode}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Open Invoices</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.openCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(summary.totalAmount)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Verified Amount</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(summary.verifiedAmount)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Verified %</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{(summary.verifiedPercent * 100).toFixed(0)}%</p></CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <div className="bg-muted/40 px-4 py-3 border-b">
          <h2 className="font-semibold">Debtors</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Debtor</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">31–60</TableHead>
              <TableHead className="text-right">61–90</TableHead>
              <TableHead className="text-right">90+</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.debtors.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  <Link to={`/portal/debtors/${d.id}`} className="text-primary hover:underline">{d.name}</Link>
                </TableCell>
                <TableCell className="text-right">{d.invoiceCount}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(d.totalAmount)}</TableCell>
                <TableCell className="text-right">{fmt(d.aging.current)}</TableCell>
                <TableCell className="text-right">{fmt(d.aging.days31To60)}</TableCell>
                <TableCell className="text-right">{fmt(d.aging.days61To90)}</TableCell>
                <TableCell className="text-right">{fmt(d.aging.days91To120 + d.aging.over120)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
