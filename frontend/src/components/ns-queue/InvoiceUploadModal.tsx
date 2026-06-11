import { useState, useRef, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { Upload, FileText, CheckCircle, XCircle, Loader2, AlertTriangle, Plus } from 'lucide-react'

interface Debtor {
  id: string
  name: string
}

interface OcrField {
  fieldName: string
  extractedValue: string | null
  confidence: number
}

interface ScanResult {
  rawDocumentPath: string
  fields: OcrField[]
}

type FileStatus = 'pending' | 'scanning' | 'review' | 'confirming' | 'done' | 'error'

interface UploadedFile {
  id: string
  file: File
  status: FileStatus
  scanResult?: ScanResult
  error?: string
  invoiceId?: string
  formData?: ConfirmForm
}

interface ConfirmForm {
  invoiceNumber: string
  invoiceDate: string
  amount: string
  debtorId: string
  newDebtorName: string
}

interface Client {
  shortcode: string
  cadenceName: string
}

interface InvoiceUploadModalProps {
  open: boolean
  onClose: () => void
  clientShortcode: string
  onInvoicesAdded: () => void
  debtors: Debtor[]
  clients?: Client[]
  onClientsNeeded?: () => void
}

function getField(fields: OcrField[], name: string) {
  return fields.find(f => f.fieldName === name)
}
function getVal(fields: OcrField[], name: string) {
  return getField(fields, name)?.extractedValue ?? ''
}

export function InvoiceUploadModal({
  open,
  onClose,
  clientShortcode: initialClientShortcode,
  onInvoicesAdded,
  debtors,
  clients,
  onClientsNeeded,
}: InvoiceUploadModalProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [pickedClient, setPickedClient] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const clientShortcode = initialClientShortcode || pickedClient

  const selectedFile = files.find(f => f.id === selectedId) ?? null

  const handleClose = () => {
    setFiles([])
    setSelectedId(null)
    setPickedClient('')
    onClose()
  }

  // Load clients list when modal opens without a pre-filled client
  useEffect(() => {
    if (open && !initialClientShortcode && onClientsNeeded) {
      onClientsNeeded()
    }
  }, [open, initialClientShortcode, onClientsNeeded])

  const scanFile = useCallback(async (entry: UploadedFile) => {
    setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'scanning' } : f))
    try {
      const formData = new FormData()
      formData.append('file', entry.file)
      const res = await api.post<ScanResult>('/api/ocr/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const scan = res.data
      const form: ConfirmForm = {
        invoiceNumber: getVal(scan.fields, 'invoiceNumber'),
        invoiceDate: getVal(scan.fields, 'invoiceDate'),
        amount: getVal(scan.fields, 'amount'),
        debtorId: 'new',
        newDebtorName: getVal(scan.fields, 'vendorName') || 'Unknown Vendor',
      }
      setFiles(prev => prev.map(f =>
        f.id === entry.id ? { ...f, status: 'review', scanResult: scan, formData: form } : f
      ))
      setSelectedId(entry.id)
    } catch {
      setFiles(prev => prev.map(f =>
        f.id === entry.id ? { ...f, status: 'error', error: 'Scan failed' } : f
      ))
    }
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter(f => {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) return false
      if (f.size > 10 * 1024 * 1024) return false
      return true
    })
    const entries: UploadedFile[] = valid.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
    }))
    setFiles(prev => [...prev, ...entries])
    entries.forEach(e => scanFile(e))
  }, [scanFile])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const dropped = Array.from(e.dataTransfer.files)
    addFiles(dropped)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const updateForm = (id: string, patch: Partial<ConfirmForm>) => {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, formData: { ...f.formData!, ...patch } } : f
    ))
  }

  const confirmFile = async (entry: UploadedFile) => {
    if (!entry.scanResult || !entry.formData) return
    const { formData: form, scanResult: scan } = entry

    if (!form.invoiceNumber) { alert('Invoice number is required.'); return }

    setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'confirming' } : f))

    try {
      const isNew = form.debtorId === 'new'
      const payload = {
        rawDocumentPath: scan.rawDocumentPath,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate || new Date().toISOString().split('T')[0],
        amount: parseFloat(form.amount) || 0,
        clientShortcode,
        debtorId: isNew ? null : form.debtorId,
        newDebtorName: isNew ? form.newDebtorName : null,
        addToNsQueue: true,
        notes: '',
      }
      const res = await api.post<{ invoiceId: string }>('/api/ocr/confirm', payload)
      setFiles(prev => prev.map(f =>
        f.id === entry.id ? { ...f, status: 'done', invoiceId: res.data.invoiceId } : f
      ))
      onInvoicesAdded()
      // auto-select next review item
      const next = files.find(f => f.id !== entry.id && f.status === 'review')
      setSelectedId(next?.id ?? null)
    } catch {
      setFiles(prev => prev.map(f =>
        f.id === entry.id ? { ...f, status: 'error', error: 'Confirm failed' } : f
      ))
    }
  }

  const doneCount = files.filter(f => f.status === 'done').length
  const pendingCount = files.filter(f => f.status === 'review').length

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-5xl w-full h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
          <DialogTitle className="text-lg font-semibold">Upload Invoices &amp; Add to Queue</DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {initialClientShortcode ? (
                <span className="text-sm text-muted-foreground">
                  Client: <span className="font-medium text-[#4648D4]">{clientShortcode}</span>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">Client:</span>
                  <Select value={pickedClient} onValueChange={setPickedClient}>
                    <SelectTrigger className="h-8 w-56 text-sm">
                      <SelectValue placeholder="Select a client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clients ?? []).map(c => (
                        <SelectItem key={c.shortcode} value={c.shortcode}>
                          {c.cadenceName} ({c.shortcode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {files.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {doneCount}/{files.length} confirmed
                  {pendingCount > 0 && <span className="ml-2 text-amber-600">{pendingCount} awaiting review</span>}
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: file list + drop zone */}
          <div className="w-64 shrink-0 border-r bg-[#F7F9FB] flex flex-col">
            {/* Drop zone */}
            <div
              className={`m-3 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                !clientShortcode
                  ? 'border-muted-foreground/20 opacity-50 cursor-not-allowed'
                  : dragActive
                  ? 'border-[#4648D4] bg-[#EEF2FF] cursor-pointer'
                  : 'border-muted-foreground/25 hover:border-[#4648D4]/50 hover:bg-white cursor-pointer'
              }`}
              onDragEnter={clientShortcode ? handleDrag : undefined}
              onDragLeave={clientShortcode ? handleDrag : undefined}
              onDragOver={clientShortcode ? handleDrag : undefined}
              onDrop={clientShortcode ? handleDrop : undefined}
              onClick={() => clientShortcode && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleInputChange}
              />
              <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Drop files or click</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">PDF, JPG, PNG · max 10MB</p>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {files.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No files yet</p>
              )}
              {files.map(f => (
                <button
                  key={f.id}
                  onClick={() => f.status === 'review' || f.status === 'error' ? setSelectedId(f.id) : undefined}
                  className={`w-full text-left rounded-md px-3 py-2 text-xs transition-colors flex items-start gap-2 ${
                    selectedId === f.id
                      ? 'bg-[#EEF2FF] border border-[#C7D2FE]'
                      : f.status === 'review'
                      ? 'hover:bg-white border border-transparent hover:border-[#C7C4D7]'
                      : 'border border-transparent cursor-default'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {f.status === 'scanning' && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4648D4]" />}
                    {f.status === 'pending' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {f.status === 'review' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    {f.status === 'confirming' && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4648D4]" />}
                    {f.status === 'done' && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                    {f.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate text-[#191C1E]">{f.file.name}</span>
                    <span className={`block mt-0.5 ${
                      f.status === 'done' ? 'text-green-600' :
                      f.status === 'error' ? 'text-red-500' :
                      f.status === 'review' ? 'text-amber-600' :
                      'text-muted-foreground'
                    }`}>
                      {f.status === 'scanning' ? 'Scanning...' :
                       f.status === 'pending' ? 'Queued' :
                       f.status === 'review' ? 'Needs review' :
                       f.status === 'confirming' ? 'Confirming...' :
                       f.status === 'done' ? 'Added to queue' :
                       f.error ?? 'Error'}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {files.length > 0 && (
              <div className="p-3 border-t bg-white shrink-0">
                <button
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-[#4648D4] hover:underline"
                  onClick={() => inputRef.current?.click()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add more files
                </button>
              </div>
            )}
          </div>

          {/* Right: review form */}
          <div className="flex-1 overflow-y-auto bg-white">
            {!selectedFile || selectedFile.status === 'done' ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                {selectedFile?.status === 'done' ? (
                  <>
                    <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                    <p className="font-semibold text-[#191C1E]">Invoice added to queue</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedFile.invoiceId}</p>
                    {pendingCount > 0 && (
                      <Button
                        className="mt-4"
                        size="sm"
                        onClick={() => {
                          const next = files.find(f => f.status === 'review')
                          if (next) setSelectedId(next.id)
                        }}
                      >
                        Review next ({pendingCount})
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="font-semibold text-[#191C1E]">Select a file to review</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {files.length === 0
                        ? 'Drop invoice files on the left to get started'
                        : 'Click a file in the list to review its extracted data'}
                    </p>
                  </>
                )}
              </div>
            ) : selectedFile.status === 'scanning' || selectedFile.status === 'pending' ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#4648D4]" />
                <p className="text-sm text-muted-foreground">Scanning {selectedFile.file.name}…</p>
              </div>
            ) : selectedFile.status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <XCircle className="h-10 w-10 text-red-500" />
                <p className="font-semibold text-[#191C1E]">Scan failed</p>
                <p className="text-sm text-muted-foreground">{selectedFile.error}</p>
                <Button size="sm" variant="outline" onClick={() => scanFile(selectedFile)}>Retry</Button>
              </div>
            ) : selectedFile.formData && selectedFile.scanResult ? (
              <ReviewForm
                file={selectedFile}
                debtors={debtors}
                clientShortcode={clientShortcode}
                onChange={patch => updateForm(selectedFile.id, patch)}
                onConfirm={() => confirmFile(selectedFile)}
                confirming={selectedFile.status === 'confirming'}
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReviewForm({
  file,
  debtors,
  clientShortcode,
  onChange,
  onConfirm,
  confirming,
}: {
  file: UploadedFile
  debtors: Debtor[]
  clientShortcode: string
  onChange: (patch: Partial<ConfirmForm>) => void
  onConfirm: () => void
  confirming: boolean
}) {
  const form = file.formData!
  const scan = file.scanResult!

  const fieldConf = (name: string) => getField(scan.fields, name)?.confidence ?? 1
  const isLow = (name: string) => fieldConf(name) < 0.8

  return (
    <div className="p-6 space-y-5">
      <div>
        <p className="font-semibold text-[#191C1E] truncate">{file.file.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Review the extracted fields below and confirm to add to the NS queue.</p>
      </div>

      {/* Invoice Number */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="inv-number" className={isLow('invoiceNumber') ? 'text-amber-600 font-semibold' : ''}>
            Invoice Number
          </Label>
          {isLow('invoiceNumber') && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Low confidence
            </span>
          )}
        </div>
        <Input
          id="inv-number"
          value={form.invoiceNumber}
          onChange={e => onChange({ invoiceNumber: e.target.value })}
          className={isLow('invoiceNumber') ? 'border-amber-400 bg-amber-50' : ''}
        />
      </div>

      {/* Date + Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="inv-date" className={isLow('invoiceDate') ? 'text-amber-600 font-semibold' : ''}>
              Date
            </Label>
            {isLow('invoiceDate') && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          </div>
          <Input
            id="inv-date"
            type="date"
            value={form.invoiceDate}
            onChange={e => onChange({ invoiceDate: e.target.value })}
            className={isLow('invoiceDate') ? 'border-amber-400 bg-amber-50' : ''}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="inv-amount" className={isLow('amount') ? 'text-amber-600 font-semibold' : ''}>
              Amount
            </Label>
            {isLow('amount') && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          </div>
          <Input
            id="inv-amount"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={e => onChange({ amount: e.target.value })}
            className={isLow('amount') ? 'border-amber-400 bg-amber-50' : ''}
          />
        </div>
      </div>

      {/* Debtor */}
      <div className="space-y-1.5 rounded-md border p-4">
        <Label>Debtor</Label>
        <Select value={form.debtorId} onValueChange={v => onChange({ debtorId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select debtor or create new…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">— Create New Debtor —</SelectItem>
            {debtors.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.debtorId === 'new' && (
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="new-debtor" className={isLow('vendorName') ? 'text-amber-600 font-semibold' : ''}>
              New Debtor Name
            </Label>
            <Input
              id="new-debtor"
              value={form.newDebtorName}
              onChange={e => onChange({ newDebtorName: e.target.value })}
              className={isLow('vendorName') ? 'border-amber-400 bg-amber-50' : ''}
            />
          </div>
        )}
      </div>

      {/* Client (locked) */}
      <div className="space-y-1.5">
        <Label>Client</Label>
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-slate-50 text-sm">
          <Badge variant="secondary" className="font-mono">{clientShortcode}</Badge>
          <span className="text-muted-foreground text-xs">pre-filled from NS queue</span>
        </div>
      </div>

      {/* NS Queue (locked on) */}
      <div className="flex items-center gap-3 rounded-md border bg-[#EEF2FF] border-[#C7D2FE] px-4 py-3">
        <CheckCircle className="h-4 w-4 text-[#4648D4] shrink-0" />
        <span className="text-sm text-[#4648D4] font-medium">Will be added to the active NS queue draft</span>
      </div>

      <Button
        className="w-full bg-[#4648D4] hover:bg-[#3537b3]"
        onClick={onConfirm}
        disabled={confirming || !form.invoiceNumber}
      >
        {confirming ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirming…</>
        ) : (
          'Confirm & Add to Queue'
        )}
      </Button>
    </div>
  )
}
