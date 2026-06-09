import { useState, useRef } from 'react';
import { Button } from '../ui/button';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
}

export function FileDropZone({ onFileSelect, loading }: FileDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files[0]);
    }
  };

  const handleFiles = (file: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert("Invalid file type. Only PDF, JPG, and PNG are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Max size is 10MB.");
      return;
    }
    onFileSelect(file);
  };

  return (
    <div 
      className={`relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input 
        ref={inputRef} 
        type="file" 
        className="hidden" 
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        disabled={loading}
      />
      <div className="text-center">
        <p className="text-lg font-medium mb-2">Drag and drop your invoice here</p>
        <p className="text-sm text-muted-foreground mb-6">Supports PDF, JPG, PNG (Max 10MB)</p>
        <Button onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? 'Uploading...' : 'Select File'}
        </Button>
      </div>
    </div>
  );
}
