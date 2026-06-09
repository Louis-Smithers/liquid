import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useState, useEffect } from 'react'

export function Omnibar() {
  const [open, setOpen] = useState(false)

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
              Search clients, debtors, or invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="Type to search..." autoFocus />
            {/* Search results will go here */}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
