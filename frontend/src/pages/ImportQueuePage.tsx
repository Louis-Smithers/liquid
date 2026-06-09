import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const mockQueue = [
  { id: '1', clientName: 'ACME Corp', debtorName: 'Unknown LLC', invoiceNumber: 'INV-001', amount: 5000, reviewStatus: 'Pending' },
  { id: '2', clientName: 'Globex', debtorName: 'Wayne Ent', invoiceNumber: 'GLB-992', amount: 1200.50, reviewStatus: 'Pending' },
]

export function ImportQueuePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Import Review Queue</h1>
        <p className="text-muted-foreground">Resolve unmatched invoices from the n8n import.</p>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Raw Client Name</TableHead>
              <TableHead>Raw Debtor Name</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockQueue.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-slate-800">{item.clientName}</TableCell>
                <TableCell className="text-slate-800">{item.debtorName}</TableCell>
                <TableCell className="font-mono text-sm text-slate-600">{item.invoiceNumber}</TableCell>
                <TableCell className="text-right font-medium">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-transparent font-medium">
                    {item.reviewStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" className="h-8">Dismiss</Button>
                  <Button size="sm" className="h-8 bg-[#4648D4] hover:bg-[#3b3db3] text-white">Resolve</Button>
                </TableCell>
              </TableRow>
            ))}
            {mockQueue.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                  No items in the review queue.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
