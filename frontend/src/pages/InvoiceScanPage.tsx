import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileDropZone } from '../components/ocr/FileDropZone';
import { OcrReviewForm } from '../components/ocr/OcrReviewForm';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';

export function InvoiceScanPage() {
  const { session } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scanResult, setScanResult] = useState<any>(null);
  const [successData, setSuccessData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async (file: File) => {
    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to scan document');
      setScanResult(await res.json());
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (data: any) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ocr/confirm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to confirm invoice');
      setSuccessData(await res.json());
      setStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-3xl font-bold">Scan Invoice</h1>
      
      {error && <div className="mb-6 rounded bg-destructive/15 p-4 text-destructive">{error}</div>}

      {step === 1 && (
        <div>
          <p className="mb-6 text-muted-foreground">Upload an invoice to extract data automatically.</p>
          <FileDropZone onFileSelect={handleScan} loading={loading} />
        </div>
      )}

      {step === 2 && scanResult && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Review Extracted Data</h2>
          <OcrReviewForm result={scanResult} onConfirm={handleConfirm} loading={loading} />
        </div>
      )}

      {step === 3 && successData && (
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold">Invoice Confirmed!</h2>
          <p className="mb-6 text-muted-foreground">
            Invoice ID: <strong>{successData.invoiceId}</strong> has been created.
            {successData.notificationSheetId && <span> It was also added to the NS Queue.</span>}
          </p>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => { setStep(1); setScanResult(null); setSuccessData(null); }}>
              Scan Another
            </Button>
            <Button variant="outline" asChild>
              <Link to="/clients">Go to Clients</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
