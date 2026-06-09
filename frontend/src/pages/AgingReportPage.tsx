import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const mockAging = [
  { 
    client: { shortcode: 'ACME', cadenceName: 'ACME Corp' },
    debtors: [
      { debtorName: 'Wayne Enterprises', current: 15420.50, days31To60: 0, days61To90: 3250.00, over90: 0, total: 18670.50 },
      { debtorName: 'Stark Industries', current: 0, days31To60: 8900.00, days61To90: 0, over90: 0, total: 8900.00 }
    ]
  }
]

export function AgingReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Aging Report</h1>
        <p className="text-muted-foreground">30/60/90 day aging summary for all active invoices.</p>
      </div>

      {mockAging.map((report) => (
        <div key={report.client.shortcode} className="rounded-md border bg-white shadow-sm overflow-hidden mb-6">
          <div className="bg-[#F7F9FB] px-4 py-3 border-b">
            <h2 className="font-semibold text-lg text-[#191C1E]">{report.client.cadenceName} <span className="text-sm font-normal text-slate-500 ml-2">({report.client.shortcode})</span></h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debtor</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">31-60 Days</TableHead>
                <TableHead className="text-right">61-90 Days</TableHead>
                <TableHead className="text-right">90+ Days</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.debtors.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-slate-800">{d.debtorName}</TableCell>
                  <TableCell className="text-right">${d.current.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">${d.days31To60.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">${d.days61To90.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">${d.over90.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-bold text-[#4648D4]">${d.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}
