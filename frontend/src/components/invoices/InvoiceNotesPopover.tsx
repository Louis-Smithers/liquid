import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Loader2 } from "lucide-react"
import { api } from "@/lib/api"

interface InvoiceNote {
  id: string
  invoiceId: string
  text: string
  createdBy: string | null
  createdAt: string
}

interface InvoiceNotesPopoverProps {
  invoiceId: string
  originalInvoice: string
  noteCount?: number
  onNoteAdded?: () => void
}

export function InvoiceNotesPopover({ invoiceId, originalInvoice, noteCount, onNoteAdded }: InvoiceNotesPopoverProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<InvoiceNote[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.get<InvoiceNote[]>(`/api/invoices/${invoiceId}/notes`)
      .then(r => setNotes(r.data))
      .catch(err => console.error('Failed to load notes', err))
      .finally(() => setLoading(false))
  }, [open, invoiceId])

  const handleAdd = async () => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      const res = await api.post<InvoiceNote>(`/api/invoices/${invoiceId}/notes`, { text: draft.trim() })
      setNotes(prev => [res.data, ...prev])
      setDraft('')
      onNoteAdded?.()
    } catch (err) {
      console.error('Failed to add note', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-[#191C1E]"
        title="Notes"
      >
        <MessageSquare className="h-4 w-4" />
        {!!noteCount && <span className="text-[10px] font-semibold">{noteCount}</span>}
      </button>
      <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Notes — Invoice {originalInvoice}</DialogTitle>
          <DialogDescription>Timestamped notes for this invoice.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Add a note..."
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <Button onClick={handleAdd} disabled={saving || !draft.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
          </Button>
        </div>
        <div className="max-h-[320px] overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notes yet.</p>
          ) : (
            notes.map(n => (
              <div key={n.id} className="rounded border border-slate-200 p-2 text-sm">
                <div className="text-[11px] text-muted-foreground mb-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
                <div className="text-[#191C1E]">{n.text}</div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
