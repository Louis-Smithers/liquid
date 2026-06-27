import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, ChevronRight } from 'lucide-react'

interface BrokerSubmission {
  id: string
  companyName: string
  contactName?: string
  email?: string
  phone?: string
  businessNumber?: string
  address?: string
  notes?: string
  status: string
  staffNote?: string
  createdAt: string
  updatedAt: string
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Submitted: 'secondary',
  InReview: 'default',
  NeedsInfo: 'destructive',
  Approved: 'default',
  Rejected: 'destructive',
}

const STATUS_LABELS: Record<string, string> = {
  Submitted: 'Submitted',
  InReview: 'In Review',
  NeedsInfo: 'Needs Info',
  Approved: 'Approved',
  Rejected: 'Rejected',
}

const emptyForm = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  businessNumber: '',
  address: '',
  notes: '',
}

export function BrokerPortalPage() {
  const { session } = useAuth()
  const [submissions, setSubmissions] = useState<BrokerSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeaders = { Authorization: `Bearer ${session?.access_token}` }

  const load = () => {
    setLoading(true)
    fetch('/api/broker/submissions/mine', { headers: authHeaders })
      .then(r => r.ok ? r.json() : [])
      .then(setSubmissions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [session])

  const openNew = () => {
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.companyName.trim()) { setError('Company name is required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/broker/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setError('Failed to submit. Please try again.'); return }
      setDialogOpen(false)
      load()
    } finally {
      setSubmitting(false)
    }
  }

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">Submit your company information and track your application status.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Application
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No applications yet. Submit your first application to get started.
                </TableCell>
              </TableRow>
            ) : submissions.map(s => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30">
                <TableCell className="font-medium">
                  <Link to={`/broker/${s.id}`} className="hover:underline text-primary">{s.companyName}</Link>
                </TableCell>
                <TableCell>{s.contactName || '—'}</TableCell>
                <TableCell>{new Date(s.createdAt).toLocaleDateString('en-CA')}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[s.status] ?? 'outline'}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link to={`/broker/${s.id}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={form.companyName} onChange={set('companyName')} placeholder="Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Name</Label>
                <Input value={form.contactName} onChange={set('contactName')} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={set('email')} placeholder="jane@acme.com" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
              </div>
              <div className="space-y-1">
                <Label>Business Number</Label>
                <Input value={form.businessNumber} onChange={set('businessNumber')} placeholder="123456789" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={set('address')} placeholder="123 Main St, City, Province" />
            </div>
            <div className="space-y-1">
              <Label>Notes / Description</Label>
              <Textarea value={form.notes} onChange={set('notes')} placeholder="Tell us about your business and why you're applying..." rows={4} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
