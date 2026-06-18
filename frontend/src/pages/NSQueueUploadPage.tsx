import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from '@/components/ui/copy-button'
import { PasteButton } from '@/components/ui/paste-button'
import { DocumentPreview } from '@/components/ocr/DocumentPreview'
import { FileDropZone } from '@/components/ocr/FileDropZone'
import { api } from '@/lib/api'
import type { UploadBatch, StagedDoc, ConfirmDocPayload } from '@/types/ocr-batch'

interface Client {
  shortcode: string
  cadenceName: string
}

interface Debtor {
  id: string
  name: string
}

const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: 'Invoice Number',
  date: 'Invoice Date',
  amount: 'Amount',
  poNumber: 'PO Number',
}

export function NSQueueUploadPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Upload, 2: Poll, 3: Verify, 4: Done
  const [batchId, setBatchId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [documents, setDocuments] = useState<StagedDoc[]>([])
  const [currentDocIndex, setCurrentDocIndex] = useState(0)
  const [activeField, setActiveField] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [confirming, setConfirming] = useState(false)

  // Per-document form state, keyed by doc id, so edits survive re-polling.
  const [forms, setForms] = useState<Record<string, ConfirmDocPayload>>({})

  useEffect(() => {
    api.get<Client[]>('/api/clients').then(res => setClients(res.data)).catch(() => {})
    api.get<Debtor[]>('/api/debtors').then(res => setDebtors(res.data)).catch(() => {})
  }, [])

  // Navigate away protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (step > 1 && step < 4) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [step])

  const handleFileSelect = (newFile: File) => {
    setFiles(prev => [...prev, newFile])
  }

  const fieldVal = (doc: StagedDoc, name: string) => doc.fields.find(f => f.fieldName === name)?.value ?? ''

  const buildFormFromDoc = useCallback((doc: StagedDoc): ConfirmDocPayload => {
    const bestClient = doc.match.clients[0]
    const bestDebtor = doc.match.debtors[0]
    return {
      invoiceNumber: fieldVal(doc, 'invoiceNumber'),
      invoiceDate: fieldVal(doc, 'date') || new Date().toISOString().split('T')[0],
      amount: Number(fieldVal(doc, 'amount')) || 0,
      clientShortcode: bestClient?.shortcode ?? '',
      createClient: false,
      debtorId: bestDebtor?.id ?? null,
      newDebtorName: bestDebtor ? null : '',
      poRef: fieldVal(doc, 'poNumber') || null,
      notes: null,
    }
  }, [])

  const startUpload = async () => {
    if (files.length === 0) return
    try {
      const batchRes = await api.post('/api/ocr/batch')
      const newBatchId = batchRes.data.id
      setBatchId(newBatchId)

      const formData = new FormData()
      files.forEach(f => formData.append('files', f))

      await api.post(`/api/ocr/batch/${newBatchId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setStep(2)
      pollBatch(newBatchId)
    } catch {
      alert("Failed to upload files.")
    }
  }

  const pollBatch = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get<UploadBatch>(`/api/ocr/batch/${id}`)
        setDocuments(res.data.documents)

        const allReadyOrFailed = res.data.documents.every(d => d.ocrStatus === 'Ready' || d.ocrStatus === 'Failed')
        if (allReadyOrFailed && res.data.documents.length > 0) {
          clearInterval(interval)
          // Seed editable form state for every doc that's ready to review.
          setForms(prev => {
            const next = { ...prev }
            for (const doc of res.data.documents) {
              if (doc.ocrStatus === 'Ready' && !next[doc.id]) {
                next[doc.id] = buildFormFromDoc(doc)
              }
            }
            return next
          })
          setStep(3)
        }
      } catch (err) {
        console.error("Polling error", err)
      }
    }, 2000)
  }

  const reviewableDocs = documents.filter(d => d.ocrStatus === 'Ready')
  const currentDoc = reviewableDocs[currentDocIndex]
  const currentForm = currentDoc ? forms[currentDoc.id] : undefined

  const updateForm = (patch: Partial<ConfirmDocPayload>) => {
    if (!currentDoc) return
    setForms(prev => ({ ...prev, [currentDoc.id]: { ...prev[currentDoc.id], ...patch } }))
  }

  const handleConfirm = async () => {
    if (!batchId || !currentDoc || !currentForm) return
    if (!currentForm.invoiceNumber) { alert('Invoice number is required.'); return }
    if (!currentForm.clientShortcode) { alert('Client is required.'); return }

    setConfirming(true)
    try {
      await api.post(`/api/ocr/batch/${batchId}/files/${currentDoc.id}/confirm`, currentForm)

      if (currentDocIndex < reviewableDocs.length - 1) {
        setCurrentDocIndex(prev => prev + 1)
        setActiveField(null)
      } else {
        setStep(4)
      }
    } catch {
      alert("Failed to confirm document.")
    } finally {
      setConfirming(false)
    }
  }

  const isLow = (name: string) => {
    if (!currentDoc) return false
    const conf = currentDoc.fields.find(f => f.fieldName === name)?.confidence ?? 1
    return conf < 0.8
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div className="flex items-center space-x-4 pb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/ns-queue')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-semibold">Upload Invoices</h1>
      </div>

      <div className="flex-1 bg-white border shadow-sm rounded-lg p-8">
        {step === 1 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-semibold text-center">Select PDFs or Images</h2>
            <FileDropZone onFileSelect={handleFileSelect} loading={false} />
            {files.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium">Selected Files ({files.length}):</h3>
                <ul className="space-y-2">
                  {files.map((f, i) => <li key={i} className="text-sm text-slate-600 border p-2 rounded">{f.name}</li>)}
                </ul>
                <Button className="w-full" onClick={startUpload}>Start Upload & OCR Processing</Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <h2 className="text-xl font-semibold">Processing Files with Tesseract OCR...</h2>
            <div className="space-y-2 text-left bg-slate-50 p-4 rounded-md border">
              {documents.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span>{d.fileName}</span>
                  <span className={d.ocrStatus === 'Ready' ? 'text-green-600 font-semibold' : 'text-slate-500'}>
                    {d.ocrStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && currentDoc && currentForm && (
          <div className="flex h-full gap-6">
            {/* Document preview with bbox highlights */}
            <div className="flex-1 bg-slate-50 border rounded-lg p-2 overflow-hidden relative">
              <DocumentPreview
                fileUrl={`/api/ocr/batch/${batchId}/files/${currentDoc.id}/file`}
                fields={currentDoc.fields.map(f => ({
                  fieldName: f.fieldName,
                  bboxX: f.bboxX,
                  bboxY: f.bboxY,
                  bboxWidth: f.bboxWidth,
                  bboxHeight: f.bboxHeight,
                }))}
                activeField={activeField}
                onFieldClick={setActiveField}
              />
            </div>

            <div className="w-[420px] border rounded-lg p-6 flex flex-col space-y-4 bg-white overflow-y-auto">
              <h3 className="font-semibold text-lg">Verify Data ({currentDocIndex + 1} of {reviewableDocs.length})</h3>
              <p className="text-sm text-slate-500">File: {currentDoc.fileName}</p>

              <div className="flex-1 space-y-4">
                {/* Extracted fields */}
                {currentDoc.fields.map(f => {
                  const label = FIELD_LABELS[f.fieldName] ?? f.fieldName
                  const low = isLow(f.fieldName)
                  return (
                    <div key={f.fieldName} className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between">
                        <label className={`font-medium ${low ? 'text-amber-600' : 'text-slate-700'}`}>{label}</label>
                        {low && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Low confidence</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          className={`flex-1 border rounded p-2 ${low ? 'border-amber-400 bg-amber-50' : ''} ${activeField === f.fieldName ? 'ring-1 ring-[#4648D4]' : ''}`}
                          value={
                            f.fieldName === 'invoiceNumber' ? currentForm.invoiceNumber :
                            f.fieldName === 'date' ? currentForm.invoiceDate :
                            f.fieldName === 'amount' ? String(currentForm.amount) :
                            f.fieldName === 'poNumber' ? currentForm.poRef ?? '' : ''
                          }
                          onFocus={() => setActiveField(f.fieldName)}
                          onChange={e => {
                            const v = e.target.value
                            if (f.fieldName === 'invoiceNumber') updateForm({ invoiceNumber: v })
                            else if (f.fieldName === 'date') updateForm({ invoiceDate: v })
                            else if (f.fieldName === 'amount') updateForm({ amount: Number(v) || 0 })
                            else if (f.fieldName === 'poNumber') updateForm({ poRef: v })
                          }}
                        />
                        <PasteButton onPaste={v => {
                          if (f.fieldName === 'invoiceNumber') updateForm({ invoiceNumber: v })
                          else if (f.fieldName === 'date') updateForm({ invoiceDate: v })
                          else if (f.fieldName === 'amount') updateForm({ amount: Number(v) || 0 })
                          else if (f.fieldName === 'poNumber') updateForm({ poRef: v })
                        }} />
                        <CopyButton value={f.value ?? ''} />
                      </div>
                    </div>
                  )
                })}

                {/* Client */}
                <div className="space-y-1.5 pt-4 border-t">
                  <Label>Client</Label>
                  <Select value={currentForm.clientShortcode} onValueChange={v => updateForm({ clientShortcode: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.shortcode} value={c.shortcode}>{c.cadenceName} ({c.shortcode})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentDoc.match.clients.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Best match: {currentDoc.match.clients[0].name} ({Math.round(currentDoc.match.clients[0].score * 100)}%)
                    </p>
                  )}
                </div>

                {/* Debtor */}
                <div className="space-y-1.5 rounded-md border p-3">
                  <Label>Debtor</Label>
                  <Select
                    value={currentForm.debtorId ?? 'new'}
                    onValueChange={v => updateForm(v === 'new' ? { debtorId: null, newDebtorName: '' } : { debtorId: v, newDebtorName: null })}
                  >
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
                  {currentForm.debtorId === null && (
                    <div className="mt-2 flex items-center gap-1">
                      <Input
                        placeholder="New debtor name"
                        value={currentForm.newDebtorName ?? ''}
                        onChange={e => updateForm({ newDebtorName: e.target.value })}
                      />
                      <PasteButton onPaste={v => updateForm({ newDebtorName: v })} />
                    </div>
                  )}
                </div>
              </div>

              <Button className="w-full" onClick={handleConfirm} disabled={confirming || !currentForm.invoiceNumber}>
                {confirming ? 'Confirming…' : 'Confirm & Add to Draft'}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-semibold">All documents verified!</h2>
            <p className="text-slate-500">They have been added to the Notification Sheet drafts.</p>
            <Button onClick={() => navigate('/ns-queue')}>Return to Queue</Button>
          </div>
        )}
      </div>
    </div>
  )
}
