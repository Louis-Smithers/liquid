import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { api } from "@/lib/api"

interface InvoicePreviewModalProps {
  invoiceId: string | null
  originalInvoice?: string
  onClose: () => void
}

export function InvoicePreviewModal({ invoiceId, originalInvoice, onClose }: InvoicePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!invoiceId) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setBlobUrl(null)

    api.get(`/api/invoices/${invoiceId}/file`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return
        const type = res.data.type || res.headers['content-type'] || 'application/octet-stream'
        setContentType(type)
        setBlobUrl(URL.createObjectURL(res.data))
      })
      .catch(() => {
        if (!cancelled) setError('No file is available for this invoice.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [invoiceId])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  const handleDownload = () => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = originalInvoice || invoiceId || 'invoice'
    a.click()
  }

  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-3xl"
        onEscapeKeyDown={(e) => e.stopPropagation()}
        onInteractOutside={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Invoice {originalInvoice || invoiceId}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center min-h-[60vh] max-h-[70vh] bg-muted/30 rounded-md overflow-auto">
          {loading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {!loading && error && (
            <p className="text-sm text-muted-foreground">{error}</p>
          )}
          {!loading && !error && blobUrl && contentType?.startsWith('image/') && (
            <img src={blobUrl} alt={`Invoice ${originalInvoice || invoiceId}`} className="max-w-full max-h-[70vh] object-contain" />
          )}
          {!loading && !error && blobUrl && contentType === 'application/pdf' && (
            <iframe src={blobUrl} title={`Invoice ${originalInvoice || invoiceId}`} className="w-full h-[70vh]" />
          )}
        </div>

        <div className="flex justify-end">
          <Button size="sm" className="gap-1" onClick={handleDownload} disabled={!blobUrl}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
