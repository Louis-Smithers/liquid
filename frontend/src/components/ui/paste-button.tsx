import { ClipboardPaste } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PasteButtonProps {
  onPaste: (text: string) => void
  className?: string
}

export function PasteButton({ onPaste, className }: PasteButtonProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) onPaste(text)
    } catch {
      // Clipboard read can fail outside a secure context or without permission; no-op.
    }
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn('h-6 w-6 shrink-0', className)}
      onClick={handlePaste}
      title="Paste from clipboard"
    >
      <ClipboardPaste className="h-3.5 w-3.5" />
    </Button>
  )
}
