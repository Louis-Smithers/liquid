import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface SearchHit {
  id: string
  title: string
  subtitle: string | null
  type: 'debtor' | 'client'
}

interface OmnibarSearchResult {
  debtors: SearchHit[]
  clients: SearchHit[]
}

export function Omnibar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OmnibarSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const navigate = useNavigate()

  const debouncedQuery = useDebounce(query, 250)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Reset search state whenever the dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(null)
      setLoading(false)
      setHighlightIndex(0)
    }
  }, [open])

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    api.get<OmnibarSearchResult>('/api/search', {
      params: { q: trimmed },
      signal: controller.signal,
    })
      .then((res) => {
        setResults(res.data)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error('Omnibar search failed:', err)
        setResults({ debtors: [], clients: [] })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [debouncedQuery])

  const flatResults = useMemo(() => {
    if (!results) return []
    return [...results.debtors, ...results.clients]
  }, [results])

  useEffect(() => {
    setHighlightIndex(0)
  }, [flatResults.length])

  const handleSelect = (hit: SearchHit) => {
    if (hit.type === 'debtor') {
      navigate(`/debtors?debtorId=${encodeURIComponent(hit.id)}`)
    } else {
      navigate(`/clients?clientShortcode=${encodeURIComponent(hit.id)}`)
    }
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => (i + 1) % flatResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => (i - 1 + flatResults.length) % flatResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = flatResults[highlightIndex]
      if (hit) handleSelect(hit)
    }
  }

  const showEmpty =
    !loading && results !== null && results.debtors.length === 0 && results.clients.length === 0
  const showPrompt = debouncedQuery.trim().length < 2

  return (
    <>
      <div className="relative w-64">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search... (Ctrl+K)"
          className="pl-8 bg-muted/50 cursor-pointer"
          onClick={() => setOpen(true)}
          readOnly
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Search clients and debtors by company name, contact, phone, or email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="relative">
              <Input
                placeholder="Type to search..."
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {loading && (
                <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {showPrompt && (
                <p className="text-sm text-muted-foreground px-1">
                  Keep typing to search (2+ characters)…
                </p>
              )}

              {!showPrompt && showEmpty && (
                <p className="text-sm text-muted-foreground px-1">No results</p>
              )}

              {!showPrompt && results && results.debtors.length > 0 && (
                <ResultGroup
                  label="Debtors"
                  hits={results.debtors}
                  flatResults={flatResults}
                  highlightIndex={highlightIndex}
                  onSelect={handleSelect}
                />
              )}

              {!showPrompt && results && results.clients.length > 0 && (
                <ResultGroup
                  label="Clients"
                  hits={results.clients}
                  flatResults={flatResults}
                  highlightIndex={highlightIndex}
                  onSelect={handleSelect}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ResultGroup({
  label,
  hits,
  flatResults,
  highlightIndex,
  onSelect,
}: {
  label: string
  hits: SearchHit[]
  flatResults: SearchHit[]
  highlightIndex: number
  onSelect: (hit: SearchHit) => void
}) {
  return (
    <div className="mb-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 py-1">
        {label}
      </p>
      <ul>
        {hits.map((hit) => {
          const isHighlighted = flatResults[highlightIndex] === hit
          return (
            <li key={`${hit.type}-${hit.id}`}>
              <button
                type="button"
                onClick={() => onSelect(hit)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors',
                  isHighlighted && 'bg-muted'
                )}
              >
                <div className="text-sm font-medium leading-tight">{hit.title}</div>
                {hit.subtitle && (
                  <div className="text-xs text-muted-foreground leading-tight">{hit.subtitle}</div>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
