import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'

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

const STATUS_ORDER = ['Submitted', 'InReview', 'NeedsInfo', 'Approved', 'Rejected']

export function BrokerSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState<BrokerSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    businessNumber: '',
    address: '',
    notes: '',
  })
  const [resubmitting, setResubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const authHeaders = { Authorization: `Bearer ${session?.access_token}` }

  useEffect(() => {
    if (!id) return
    fetch(`/api/broker/submissions/${id}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setSubmission(data)
        if (data) {
          setForm({
            companyName: data.companyName ?? '',
            contactName: data.contactName ?? '',
            email: data.email ?? '',
            phone: data.phone ?? '',
            businessNumber: data.businessNumber ?? '',
            address: data.address ?? '',
            notes: data.notes ?? '',
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, session])

  const handleResubmit = async () => {
    if (!form.companyName.trim()) { setError('Company name is required.'); return }
    setResubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/broker/submissions/${id}/resubmit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setError('Failed to resubmit. Please try again.'); return }
      setSuccess(true)
      setEditing(false)
      setSubmission(prev => prev ? { ...prev, ...form, status: 'Submitted' } : prev)
    } finally {
      setResubmitting(false)
    }
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>
  if (!submission) return <div className="p-8 text-muted-foreground">Application not found.</div>

  const isNeedsInfo = submission.status === 'NeedsInfo'
  const isApproved = submission.status === 'Approved'
  const isRejected = submission.status === 'Rejected'

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/broker')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{submission.companyName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submitted {new Date(submission.createdAt).toLocaleDateString('en-CA')}
            {submission.updatedAt !== submission.createdAt && (
              <> · Updated {new Date(submission.updatedAt).toLocaleDateString('en-CA')}</>
            )}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[submission.status] ?? 'outline'} className="text-sm px-3 py-1">
          {STATUS_LABELS[submission.status] ?? submission.status}
        </Badge>
      </div>

      {/* Status notification banners */}
      {isNeedsInfo && !success && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-destructive">Additional information required</p>
            {submission.staffNote && (
              <p className="text-sm mt-1 text-muted-foreground">{submission.staffNote}</p>
            )}
            <Button size="sm" className="mt-3" onClick={() => setEditing(true)}>
              Update & Resubmit
            </Button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-green-800 font-medium">Resubmitted successfully. Our team will review your updated application.</p>
        </div>
      )}

      {isApproved && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-green-800 font-semibold">Application Approved</p>
            {submission.staffNote && <p className="text-green-700 text-sm mt-0.5">{submission.staffNote}</p>}
          </div>
        </div>
      )}

      {isRejected && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-destructive">Application Not Approved</p>
            {submission.staffNote && <p className="text-sm mt-1 text-muted-foreground">{submission.staffNote}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Application details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Application Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input value={form.companyName} onChange={set('companyName')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Contact Name</Label>
                    <Input value={form.contactName} onChange={set('contactName')} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={form.email} onChange={set('email')} type="email" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={set('phone')} />
                  </div>
                  <div className="space-y-1">
                    <Label>Business Number</Label>
                    <Input value={form.businessNumber} onChange={set('businessNumber')} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={set('address')} />
                </div>
                <div className="space-y-1">
                  <Label>Notes / Description</Label>
                  <Textarea value={form.notes} onChange={set('notes')} rows={4} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleResubmit} disabled={resubmitting}>
                    {resubmitting ? 'Resubmitting...' : 'Resubmit'}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditing(false); setError(null) }} disabled={resubmitting}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <dt className="text-muted-foreground">Company</dt>
                  <dd className="font-medium">{submission.companyName}</dd>
                </div>
                {submission.contactName && (
                  <div className="grid grid-cols-2 gap-1">
                    <dt className="text-muted-foreground">Contact</dt>
                    <dd>{submission.contactName}</dd>
                  </div>
                )}
                {submission.email && (
                  <div className="grid grid-cols-2 gap-1">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{submission.email}</dd>
                  </div>
                )}
                {submission.phone && (
                  <div className="grid grid-cols-2 gap-1">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{submission.phone}</dd>
                  </div>
                )}
                {submission.businessNumber && (
                  <div className="grid grid-cols-2 gap-1">
                    <dt className="text-muted-foreground">Business #</dt>
                    <dd>{submission.businessNumber}</dd>
                  </div>
                )}
                {submission.address && (
                  <div className="grid grid-cols-2 gap-1">
                    <dt className="text-muted-foreground">Address</dt>
                    <dd>{submission.address}</dd>
                  </div>
                )}
                {submission.notes && (
                  <div>
                    <dt className="text-muted-foreground mb-1">Notes</dt>
                    <dd className="text-sm bg-muted/30 rounded p-2 whitespace-pre-wrap">{submission.notes}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Status timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-border ml-2 space-y-4">
              {STATUS_ORDER.filter(s => s !== 'NeedsInfo' || submission.status === 'NeedsInfo').map(s => {
                const isCurrent = submission.status === s
                const isPast = STATUS_ORDER.indexOf(s) < STATUS_ORDER.indexOf(submission.status) && submission.status !== 'NeedsInfo'
                return (
                  <li key={s} className="ml-4">
                    <span className={`absolute -left-1.5 flex h-3 w-3 rounded-full border ${
                      isCurrent ? 'bg-primary border-primary' : isPast ? 'bg-muted-foreground border-muted-foreground' : 'bg-background border-border'
                    }`} />
                    <p className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {STATUS_LABELS[s]}
                    </p>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
