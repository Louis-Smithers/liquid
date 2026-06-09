import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileDropZone } from '@/components/ocr/FileDropZone'
import { api } from '@/lib/api'

export function NSQueueUploadPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Upload, 2: Poll, 3: Verify
  const [batchId, setBatchId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [currentDocIndex, setCurrentDocIndex] = useState(0)

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
    } catch (err) {
      alert("Failed to upload files.")
    }
  }

  const pollBatch = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/ocr/batch/${id}`)
        setDocuments(res.data.documents)
        
        const allReadyOrFailed = res.data.documents.every((d: any) => d.ocrStatus === 'Ready' || d.ocrStatus === 'Failed')
        if (allReadyOrFailed && res.data.documents.length > 0) {
          clearInterval(interval)
          setStep(3)
        }
      } catch (err) {
        console.error("Polling error", err)
      }
    }, 2000)
  }

  const handleConfirm = async (formData: any) => {
    if (!batchId) return
    const doc = documents[currentDocIndex]
    try {
      await api.post(`/api/ocr/batch/${batchId}/files/${doc.id}/confirm`, formData)
      
      if (currentDocIndex < documents.length - 1) {
        setCurrentDocIndex(prev => prev + 1)
      } else {
        setStep(4) // Done
      }
    } catch (err) {
      alert("Failed to confirm document.")
    }
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[960px] bg-[#F7F9FB] p-8">
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

        {step === 3 && documents.length > 0 && (
          <div className="flex h-full gap-6">
            {/* Verify UI (Side by side) */}
            <div className="flex-1 bg-slate-50 border rounded-lg flex items-center justify-center p-4 overflow-hidden relative">
              <span className="text-slate-400">PDF Preview (react-pdf would render here with bbox overlays)</span>
            </div>
            
            <div className="w-[400px] border rounded-lg p-6 flex flex-col space-y-4 bg-white">
              <h3 className="font-semibold text-lg">Verify Data ({currentDocIndex + 1} of {documents.length})</h3>
              <p className="text-sm text-slate-500">File: {documents[currentDocIndex].fileName}</p>
              
              {/* Form placeholder */}
              <div className="flex-1 space-y-4">
                 <p className="text-xs text-amber-600 bg-amber-50 p-2 border border-amber-200 rounded">
                   Review extracted fields below. Matches are pre-filled.
                 </p>
                 {documents[currentDocIndex].fields?.map((f: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1 text-sm">
                      <label className="font-medium text-slate-700 capitalize">{f.fieldName}</label>
                      <input className="border rounded p-2" defaultValue={f.value} />
                    </div>
                 ))}
                 
                 {/* Client/Debtor Mock Form */}
                 <div className="flex flex-col gap-1 text-sm pt-4 border-t">
                    <label className="font-medium text-slate-700">Client Shortcode</label>
                    <input className="border rounded p-2" defaultValue="TEST" />
                 </div>
                 <div className="flex flex-col gap-1 text-sm">
                    <label className="font-medium text-slate-700">Debtor Name (or select ID)</label>
                    <input className="border rounded p-2" defaultValue="Test Debtor" />
                 </div>
              </div>
              
              <Button className="w-full" onClick={() => handleConfirm({
                  invoiceNumber: "INV-" + Math.floor(Math.random() * 10000),
                  invoiceDate: new Date().toISOString().split('T')[0],
                  amount: 100,
                  clientShortcode: "TEST",
                  newDebtorName: "Test Debtor",
                  addToNsQueue: true
              })}>Confirm & Add to Draft</Button>
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
