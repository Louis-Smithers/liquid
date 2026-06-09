import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '../../context/AuthContext';

interface OcrField {
  fieldName: string;
  extractedValue: string | null;
  confidence: number;
}

interface OcrScanResult {
  rawDocumentPath: string;
  fields: OcrField[];
}

interface Client {
  id: string;
  shortcode: string;
  cadenceName: string;
}

interface Debtor {
  id: string;
  name: string;
}

export function OcrReviewForm({ result, onConfirm, loading }: { result: OcrScanResult, onConfirm: (data: any) => void, loading: boolean }) {
  const { session } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  
  const getField = (name: string) => result.fields.find(f => f.fieldName === name);
  const getVal = (name: string) => getField(name)?.extractedValue || '';
  
  const [formData, setFormData] = useState({
    invoiceNumber: getVal('invoiceNumber'),
    invoiceDate: getVal('invoiceDate'),
    amount: getVal('amount'),
    clientShortcode: getVal('clientShortcode'),
    addToNsQueue: false,
    debtorId: 'new',
    newDebtorName: getVal('vendorName') || 'Unknown Vendor',
  });

  useEffect(() => {
    fetch('/api/clients', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      .then(r => r.json())
      .then(data => setClients(data))
      .catch(console.error);

    fetch('/api/debtors', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      .then(r => r.json())
      .then(data => setDebtors(data))
      .catch(console.error);
  }, [session]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientShortcode) {
      alert("Please select a client.");
      return;
    }
    
    const isNew = formData.debtorId === 'new';
    onConfirm({
      rawDocumentPath: result.rawDocumentPath,
      invoiceNumber: formData.invoiceNumber,
      invoiceDate: formData.invoiceDate || new Date().toISOString().split('T')[0],
      amount: parseFloat(formData.amount) || 0,
      clientShortcode: formData.clientShortcode,
      debtorId: isNew ? null : formData.debtorId,
      newDebtorName: isNew ? formData.newDebtorName : null,
      addToNsQueue: formData.addToNsQueue,
      notes: ''
    });
  };

  const renderInput = (id: keyof typeof formData, label: string, fieldName?: string, type = "text") => {
    const field = fieldName ? getField(fieldName) : null;
    const isLowConfidence = field && field.confidence < 0.80;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className={isLowConfidence ? "text-amber-600 font-bold" : ""}>{label}</Label>
          {isLowConfidence && <span className="text-xs text-amber-600" title={`Confidence: ${(field.confidence * 100).toFixed(0)}%`}>⚠️ Check Value</span>}
        </div>
        <Input 
          id={id} 
          type={type} 
          value={formData[id] as string | number} 
          onChange={e => setFormData({...formData, [id]: e.target.value})} 
          className={isLowConfidence ? "border-amber-400 bg-amber-50" : ""}
          required={type !== 'checkbox'}
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {renderInput('invoiceNumber', 'Invoice Number', 'invoiceNumber')}
        {renderInput('invoiceDate', 'Invoice Date', 'invoiceDate', 'date')}
        {renderInput('amount', 'Amount', 'amount', 'number')}
      </div>

      <div className="space-y-2 border p-4 rounded-md">
        <Label>Debtor (Vendor)</Label>
        <Select value={formData.debtorId} onValueChange={(v) => setFormData({...formData, debtorId: v})}>
          <SelectTrigger>
            <SelectValue placeholder="Select an existing debtor or create new..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">-- Create New Debtor --</SelectItem>
            {debtors.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {formData.debtorId === 'new' && (
          <div className="mt-4">
            {renderInput('newDebtorName', 'New Debtor Name', 'vendorName')}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <Label>Client</Label>
        <Select value={formData.clientShortcode} onValueChange={(v) => setFormData({...formData, clientShortcode: v})}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client..." />
          </SelectTrigger>
          <SelectContent>
            {clients.map(c => (
              <SelectItem key={c.shortcode} value={c.shortcode}>{c.cadenceName} ({c.shortcode})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2 border p-4 rounded-md">
        <Checkbox 
          id="addToNsQueue" 
          checked={formData.addToNsQueue} 
          onCheckedChange={(c) => setFormData({...formData, addToNsQueue: c as boolean})} 
        />
        <Label htmlFor="addToNsQueue" className="font-normal cursor-pointer">Add to NS Queue</Label>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Confirming...' : 'Confirm Invoice'}
      </Button>
    </form>
  );
}
