import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { AlertTriangle, ChevronsUpDown, GitMerge, Search } from "lucide-react"
import { api } from "@/lib/api"
import type { Debtor } from "@/pages/DebtorsPage"

const MAX_RESULTS = 50

/** Type-to-filter debtor picker. Client-side (the full debtor list is small — hundreds of
 * rows, already loaded) but caps rendered results so the dropdown itself never gets long. */
function DebtorCombobox({
  debtors,
  value,
  onChange,
  placeholder,
  disabledId,
}: {
  debtors: Debtor[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  /** A debtor id to exclude from the candidate list (e.g. the other picker's current selection). */
  disabledId?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const candidates = useMemo(
    () => debtors.filter(d => d.id !== disabledId).sort((a, b) => a.name.localeCompare(b.name)),
    [debtors, disabledId]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q ? candidates.filter(d => d.name.toLowerCase().includes(q)) : candidates
    return matches.slice(0, MAX_RESULTS)
  }, [candidates, query])

  const selected = debtors.find(d => d.id === value)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery('') }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden"
      >
        <span className={selected ? "text-foreground truncate flex-1 text-left min-w-0 mr-2" : "text-muted-foreground truncate flex-1 text-left min-w-0 mr-2"}>
          {selected ? `${selected.name}${selected.redirectId ? ' (already merged)' : ''}` : placeholder}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover text-popover-foreground shadow-md">
          <div className="relative p-1.5 border-b">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Type to search debtors..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">No debtors match.</p>
            ) : (
              filtered.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { onChange(d.id); setOpen(false); setQuery('') }}
                  className={`flex w-full items-center px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground overflow-hidden ${
                    d.id === value ? 'bg-accent/50 font-medium' : ''
                  }`}
                >
                  <span className="truncate flex-1 min-w-0">{d.name}</span>
                  {d.redirectId && <span className="ml-1.5 text-xs text-muted-foreground shrink-0">(already merged)</span>}
                </button>
              ))
            )}
            {candidates.length > MAX_RESULTS && filtered.length === MAX_RESULTS && (
              <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-t mt-1">
                Showing first {MAX_RESULTS} of {candidates.length} matches — refine your search to narrow further.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface MergeDebtorsModalProps {
  open: boolean
  onClose: () => void
  debtors: Debtor[]
  onMerged: () => void | Promise<void>
  /** Pre-select the duplicate (alias) debtor, e.g. when launched from a debtor's drawer. */
  initialDuplicateId?: string
}

export function MergeDebtorsModal({ open, onClose, debtors, onMerged, initialDuplicateId }: MergeDebtorsModalProps) {
  const [duplicateId, setDuplicateId] = useState<string>('')
  const [canonicalId, setCanonicalId] = useState<string>('')
  const [confirming, setConfirming] = useState(false)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDuplicateId(initialDuplicateId || '')
      setCanonicalId('')
      setConfirming(false)
      setError(null)
    }
  }, [open, initialDuplicateId])

  const duplicate = debtors.find(d => d.id === duplicateId)
  const canonical = debtors.find(d => d.id === canonicalId)

  const handleContinue = () => {
    setError(null)
    if (!duplicateId || !canonicalId) {
      setError('Select both a duplicate debtor and the canonical debtor to merge into.')
      return
    }
    if (duplicateId === canonicalId) {
      setError('A debtor cannot be merged into itself.')
      return
    }
    setConfirming(true)
  }

  const handleConfirmMerge = async () => {
    setMerging(true)
    setError(null)
    try {
      await api.post(`/api/debtors/${duplicateId}/merge`, { canonicalId })
      await onMerged()
      onClose()
    } catch (err: any) {
      setError(err.response?.data || 'Failed to merge debtors.')
      setConfirming(false)
    } finally {
      setMerging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {!confirming ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitMerge className="h-4 w-4" />
                Merge Debtors
              </DialogTitle>
              <DialogDescription>
                Pick the duplicate debtor and the canonical debtor it should be merged into.
                The duplicate's invoices will be re-pointed to the canonical debtor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Duplicate (will be merged away)</Label>
                <DebtorCombobox
                  debtors={debtors}
                  value={duplicateId}
                  onChange={setDuplicateId}
                  placeholder="Select duplicate debtor..."
                  disabledId={canonicalId || undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>Canonical (survives, receives the invoices)</Label>
                <DebtorCombobox
                  debtors={debtors}
                  value={canonicalId}
                  onChange={setCanonicalId}
                  placeholder="Select canonical debtor..."
                  disabledId={duplicateId || undefined}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                type="button"
                onClick={handleContinue}
                disabled={!duplicateId || !canonicalId}
                className="bg-[#4648D4] hover:bg-[#3537b3] text-white"
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Confirm merge
              </DialogTitle>
              <DialogDescription>This cannot be undone from the UI.</DialogDescription>
            </DialogHeader>
            <div className="py-4 text-sm space-y-3">
              <p>
                All invoices currently on <span className="font-semibold">{duplicate?.name}</span> will be
                re-pointed to <span className="font-semibold">{canonical?.name}</span>.
              </p>
              <p>
                <span className="font-semibold">{duplicate?.name}</span> will be marked as merged
                ("Merged → {canonical?.name}") and hidden from the main debtor list by default.
              </p>
              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={merging}>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirmMerge}
                disabled={merging}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {merging ? 'Merging...' : 'Confirm Merge'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
