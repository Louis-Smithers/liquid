import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface BrokerSubmission {
  id: string
  submittedBySupabaseId: string
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

const ALL_STATUSES = ['Submitted', 'InReview', 'NeedsInfo', 'Approved', 'Rejected']

export function BrokerOversightPage() {
  const { session } = useAuth()
  const [submissions, setSubmissions] = useState<BrokerSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BrokerSubmission | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)

  const authHeaders = { Authorization: `Bearer ${session?.access_token}` }

  const load = () => {
    setLoading(true)
    fetch('/api/broker/submissions', { headers: authHeaders })
      .then(r => r.ok ? r.json() : [])
      .then(setSubmissions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [session])

  const openDetail = (s: BrokerSubmission) => {
    setSelected(s)
    setDetailOpen(true)
  }

  const openStatusDialog = (s: BrokerSubmission) => {
    setSelected(s)
    setNewStatus(s.status)
    setStaffNote(s.staffNote ?? '')
    setAlert(null)
    setStatusDialogOpen(true)
  }

  const saveStatus = async () => {
    if (!selected) return
    setSaving(true)
    setAlert(null)
    try {
      const res = await fetch(`/api/broker/submissions/${selected.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: newStatus, staffNote: staffNote || null }),
      })
      if (!res.ok) { setAlert('Failed to update status.'); return }
      setStatusDialogOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Broker Applications</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and manage broker portal applications.</p>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : submissions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No applications yet.</TableCell></TableRow>
            ) : submissions.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.companyName}</TableCell>
                <TableCell>{s.contactName || '—'}</TableCell>
                <TableCell>{s.email || '—'}</TableCell>
                <TableCell>{new Date(s.createdAt).toLocaleDateString('en-CA')}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[s.status] ?? 'outline'}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDetail(s)}>View</Button>
                    <Button size="sm" onClick={() => openStatusDialog(s)}>Update Status</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.companyName}</DialogTitle>
            <DialogDescription>
              Submitted {selected ? new Date(selected.createdAt).toLocaleDateString('en-CA') : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm py-2">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {selected.contactName && (
                  <><dt className="text-muted-foreground">Contact</dt><dd>{selected.contactName}</dd></>
                )}
                {selected.email && (
                  <><dt className="text-muted-foreground">Email</dt><dd>{selected.email}</dd></>
                )}
                {selected.phone && (
                  <><dt className="text-muted-foreground">Phone</dt><dd>{selected.phone}</dd></>
                )}
                {selected.businessNumber && (
                  <><dt className="text-muted-foreground">Business #</dt><dd>{selected.businessNumber}</dd></>
                )}
                {selected.address && (
                  <><dt className="text-muted-foreground col-span-2">Address</dt><dd className="col-span-2">{selected.address}</dd></>
                )}
              </dl>
              {selected.notes && (
                <div>
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="bg-muted/30 rounded p-2 whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={STATUS_VARIANTS[selected.status] ?? 'outline'}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </Badge>
              </div>
              {selected.staffNote && (
                <div>
                  <p className="text-muted-foreground mb-1">Staff Note</p>
                  <p className="bg-muted/30 rounded p-2 whitespace-pre-wrap text-sm">{selected.staffNote}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            <Button onClick={() => { setDetailOpen(false); if (selected) openStatusDialog(selected) }}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status update dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>{selected?.companyName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Staff Note <span className="text-muted-foreground text-xs">(optional — shown to broker)</span></Label>
              <Textarea
                value={staffNote}
                onChange={e => setStaffNote(e.target.value)}
                placeholder={newStatus === 'NeedsInfo' ? 'Explain what information is needed...' : 'Add a note for the broker (optional)'}
                rows={3}
              />
            </div>
            {alert && <p className="text-sm text-destructive">{alert}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveStatus} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
