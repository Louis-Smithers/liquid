import { useParams, Link } from 'react-router-dom'
import { Search, CheckCircle2, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

// mock data for now, since API isn't fully wired to real data yet
const mockInvoices = [
  { id: 'ACME_INV-2023-001', number: 'INV-2023-001', vendor: 'Acme Corp', amount: 15420.50, status: 'Pre-Verified', date: '2023-10-15' },
  { id: 'GLOBEX_INV-402', number: 'INV-402', vendor: 'Globex Corp', amount: 8900.00, status: 'Unverified', date: '2023-10-16' },
  { id: 'ACME_INV-2023-005', number: 'INV-2023-005', vendor: 'Acme Corp', amount: 3250.00, status: 'Inactive', date: '2023-10-12' },
]

export function TheGatePage() {
  const { invoiceId } = useParams()
  
  // Find current
  const currentInvoice = mockInvoices.find(i => i.id === invoiceId) || mockInvoices[0]

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#F7F9FB] border-t">
      {/* Left Pane: Invoice List */}
      <div className="w-[453px] flex-shrink-0 bg-white border-r border-[#E0E3E5] flex flex-col">
        {/* Header / Search */}
        <div className="p-4 bg-[#F7F9FB] border-b border-[#E0E3E5] flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#767586]" />
            <Input 
              placeholder="Search..." 
              className="pl-9 bg-[#F7F9FB] border-[#C7C4D7] h-[34px] text-sm"
            />
          </div>
          <Button className="bg-[#4648D4] hover:bg-[#3b3db3] text-white h-[34px]">
            Filter
          </Button>
        </div>
        
        {/* List Header */}
        <div className="flex px-4 py-3 bg-[#F7F9FB] border-b border-[#E0E3E5] text-xs font-semibold text-[#464554] tracking-wider uppercase">
          <div className="w-1/4">Invoice</div>
          <div className="w-1/3">Vendor</div>
          <div className="w-[41%] text-right">Amount</div>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto">
          {mockInvoices.map((inv) => (
            <Link 
              key={inv.id}
              to={`/gate/${inv.id}`}
              className={`flex px-4 py-4 border-b border-[#E0E3E5] cursor-pointer hover:bg-slate-50 transition-colors ${inv.id === currentInvoice.id ? 'bg-[#F2F4F6] border-l-2 border-l-[#4648D4]' : ''}`}
            >
              <div className="w-1/4 text-[13px] font-medium text-[#4648D4]">{inv.number}</div>
              <div className="w-1/3 flex flex-col">
                <span className="text-[13px] font-medium text-[#191C1E] truncate pr-2">{inv.vendor}</span>
                <span className="text-[13px] text-[#464554]">{inv.date}</span>
              </div>
              <div className="w-[41%] flex flex-col items-end gap-1">
                <span className="text-[13px] font-medium text-[#191C1E]">
                  ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-2 py-0 border-transparent ${
                    inv.status === 'Pre-Verified' ? 'bg-[#DCFCE7] text-[#15803D]' : 
                    inv.status === 'Unverified' ? 'bg-[#FEF9C3] text-[#A16207]' : 
                    'bg-[#FEE2E2] text-[#B91C1C]'
                  }`}
                >
                  {inv.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Right Pane Container */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        
        {/* Document Viewer */}
        <div className="flex-1 bg-white border border-[#E0E3E5] shadow-sm rounded-xl flex flex-col overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="h-[50px] bg-[#F7F9FB] border-b border-[#E0E3E5] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-[#191C1E] uppercase tracking-wider">Document Viewer</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Button variant="ghost" size="icon" className="h-7 w-7"><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-xs font-medium">100%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7"><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Maximize className="h-4 w-4" /></Button>
            </div>
          </div>
          {/* PDF Canvas (Mocked) */}
          <div className="flex-1 bg-[#F2F4F6] p-4 overflow-auto flex justify-center items-start">
             <div className="w-full max-w-[514px] bg-white border border-[#E0E3E5] shadow-sm rounded-lg h-[800px] relative">
               {/* Mock Bounding Box */}
               <div className="absolute top-[10%] left-[10%] w-[40%] h-[5%] border-2 border-[#4648D4] bg-[#4648D4]/10 rounded cursor-pointer transition-colors hover:bg-[#4648D4]/20" title="invoice_number" />
               <div className="flex items-center justify-center h-full text-slate-400">PDF Document Renders Here</div>
             </div>
          </div>
        </div>

        {/* Data Extraction Form */}
        <div className="w-[320px] shrink-0 bg-white border border-[#E0E3E5] shadow-sm rounded-xl flex flex-col overflow-hidden">
          {/* Form Header */}
          <div className="h-[61px] bg-[#F7F9FB] border-b border-[#E0E3E5] flex items-center justify-between px-4 shrink-0">
            <h3 className="font-semibold text-[18px] text-[#191C1E]">Extracted Data</h3>
            <Badge variant="outline" className="bg-slate-100 text-slate-600 text-[10px] border-transparent font-semibold">
              Confidence: 95%
            </Badge>
          </div>
          
          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Invoice Number</Label>
              <Input defaultValue={currentInvoice.number} className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Vendor Name</Label>
              <Input defaultValue={currentInvoice.vendor} className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Date</Label>
              <Input type="date" defaultValue={currentInvoice.date} className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]" />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-[#464554] uppercase tracking-wider">Amount</Label>
              <Input type="number" defaultValue={currentInvoice.amount} className="bg-[#F7F9FB] border-[#C7C4D7] h-[38px] text-sm focus-visible:ring-[#4648D4]" />
            </div>

          </div>

          {/* Form Footer */}
          <div className="p-4 border-t border-[#E0E3E5] bg-[#F7F9FB]">
            <Button className="w-full bg-[#4648D4] hover:bg-[#3b3db3] text-white gap-2 h-10">
              <CheckCircle2 className="h-4 w-4" /> Verify & Save
            </Button>
          </div>

        </div>

      </div>
    </div>
  )
}
