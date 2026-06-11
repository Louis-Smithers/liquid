import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { MessageSquarePlus } from 'lucide-react'

type Category = 'Feedback' | 'Bug' | 'Feature'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<Category>('Feedback')
  const [message, setMessage] = useState('')

  const reset = () => {
    setCategory('Feedback')
    setMessage('')
    setError(null)
    setSent(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setTimeout(reset, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/feedback', {
        message: message.trim(),
        category,
        pageUrl: window.location.href,
      })
      setSent(true)
      setTimeout(() => handleOpenChange(false), 1200)
    } catch (err) {
      console.error('Failed to send feedback:', err)
      setError('Could not send feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-foreground/60 hover:text-foreground">
          <MessageSquarePlus className="w-4 h-4 mr-2" /> Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Found a bug or have an idea? Let me know — it goes straight to me.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              ✅ Thanks! Your feedback was sent.
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="feedback-category">Type</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger id="feedback-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Feedback">💬 General feedback</SelectItem>
                    <SelectItem value="Bug">🐞 Bug report</SelectItem>
                    <SelectItem value="Feature">✨ Feature request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="feedback-message">Message</Label>
                <textarea
                  id="feedback-message"
                  required
                  autoFocus
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={
                    category === 'Bug'
                      ? 'What happened? What did you expect to happen?'
                      : 'Tell me what you think...'
                  }
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}

          {!sent && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !message.trim()}
                className="bg-[#4648D4] hover:bg-[#3537b3] text-white"
              >
                {loading ? 'Sending...' : 'Send'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
