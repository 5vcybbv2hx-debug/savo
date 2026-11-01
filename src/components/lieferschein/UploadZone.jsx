import React, { useRef, useState } from 'react';
import { Camera, FileUp, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UploadZone({ file, onSelect, disabled }) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList) => {
    const picked = fileList?.[0];
    if (picked) onSelect(picked);
  };

  const isImage = file && file.type?.startsWith('image/');

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && galleryRef.current?.click()}
        className={cn(
          'rounded-2xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          dragging ? 'border-primary bg-primary/10' : 'border-border bg-card/60 hover:border-primary/50',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
          <FileUp className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">Lieferschein hierher ziehen</p>
        <p className="text-xs text-muted-foreground mt-1">Foto oder PDF · antippen zum Auswählen</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          <Camera className="w-4 h-4" /> Kamera
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-secondary text-foreground text-sm font-semibold disabled:opacity-50"
        >
          <FileText className="w-4 h-4" /> Datei
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {file && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/60 border border-border">
          {isImage ? (
            <img src={URL.createObjectURL(file)} alt="Lieferschein" className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-card flex items-center justify-center text-primary">
              <FileText className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
          </div>
          <button type="button" onClick={() => onSelect(null)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}