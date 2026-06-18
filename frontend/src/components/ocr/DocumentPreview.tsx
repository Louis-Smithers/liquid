import { useEffect, useState } from 'react'
import { Loader2, FileText } from 'lucide-react'
import { api } from '@/lib/api'

export interface PreviewField {
  fieldName: string
  bboxX?: number | null
  bboxY?: number | null
  bboxWidth?: number | null
  bboxHeight?: number | null
}

interface DocumentPreviewProps {
  /** API path to fetch the file from (e.g. /api/ocr/scan/file?path=...). */
  fileUrl: string
  fields: PreviewField[]
  activeField: string | null
  onFieldClick: (fieldName: string) => void
}

export function DocumentPreview({ fileUrl, fields, activeField, onFieldClick }: DocumentPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null

    setLoading(true)
    setError(false)
    setObjectUrl(null)

    api.get(fileUrl, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return
        const type = res.data.type || res.headers['content-type'] || ''
        createdUrl = URL.createObjectURL(res.data)
        setContentType(type)
        setObjectUrl(createdUrl)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [fileUrl])

  const isPdf = contentType?.includes('pdf')
  const highlightable = fields.filter(f =>
    f.bboxX != null && f.bboxY != null && f.bboxWidth != null && f.bboxHeight != null
  )

  return (
    <div className="relative w-full h-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
      {loading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
      {!loading && error && (
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 opacity-40" />
          <span>Preview unavailable</span>
        </div>
      )}
      {!loading && !error && objectUrl && (
        <div className="relative w-full h-full">
          {isPdf ? (
            <iframe src={objectUrl} title="Document preview" className="w-full h-full border-0" />
          ) : (
            <img src={objectUrl} alt="Document preview" className="w-full h-full object-contain" />
          )}
          {/* Bbox overlays are exact for images; approximate for PDFs rendered in an iframe. */}
          {!isPdf && highlightable.map(f => (
            <button
              key={f.fieldName}
              type="button"
              onClick={() => onFieldClick(f.fieldName)}
              className={`absolute border-2 rounded-sm transition-colors ${
                activeField === f.fieldName
                  ? 'border-[#4648D4] bg-[#4648D4]/20 z-10'
                  : 'border-amber-400/70 bg-amber-300/10 hover:bg-amber-300/25'
              }`}
              style={{
                left: `${(f.bboxX ?? 0) * 100}%`,
                top: `${(f.bboxY ?? 0) * 100}%`,
                width: `${(f.bboxWidth ?? 0) * 100}%`,
                height: `${(f.bboxHeight ?? 0) * 100}%`,
              }}
              title={f.fieldName}
            />
          ))}
        </div>
      )}
    </div>
  )
}
