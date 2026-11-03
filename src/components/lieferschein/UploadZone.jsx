import React, { useRef, useState } from 'react';
import { Camera, FileUp, FileText, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_PAGES } from '@/lib/deliveryNoteExtraction';

/** Mehrseiten-Upload: jede Seite wird einzeln hochgeladen und als Thumbnail geführt. */
export default function UploadZone({ pages = [], onAddFiles, onRemovePage, disabled, isUploading }) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const limitReached = pages.length >= MAX_PAGES;

  const handleFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (picked.length > 0) onAddFiles(picked);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!limitReached) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && !limitReached && galleryRef.current?.click()}
        className={cn(
          'rounded-2xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          dragging ? 'border-primary bg-primary/10' : 'border-border bg-card/60 hover:border-primary/50',
          (disabled || limitReached) && 'opacity-60 cursor-not-allowed'
        )}
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
          <FileUp className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">Lieferschein hierher ziehen</p>
        <p className="text-xs text-muted-foreground mt-1">
          Alle Seiten auf einmal wählen · Foto oder PDF · max. {MAX_PAGES} Seiten
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || limitReached}
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          <Camera className="w-4 h-4" /> Seite fotografieren
        </button>
        <button
          type="button"
          disabled={disabled || limitReached}
          onClick={() => galleryRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-secondary text-foreground text-sm font-semibold disabled:opacity-50"
        >
          <FileText className="w-4 h-4" /> Seiten wählen
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Seiten werden hochgeladen…
        </div>
      )}

      {pages.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">
            {pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'} · ein Beleg
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {pages.map((page, index) => (
              <div key={page.id} className="relative rounded-xl overflow-hidden border border-border bg-secondary/60">
                <div className="aspect-[3/4] flex items-center justify-center overflow-hidden">
                  {page.isImage ? (
                    <img src={page.url} alt={`Seite ${index + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-7 h-7 text-primary" />
                  )}
                </div>
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-background/90 text-[10px] font-bold text-foreground">
                  S. {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemovePage(page.id)}
                  disabled={disabled}
                  className="absolute top-1 right-1 w-6 h-6 rounded-md bg-background/90 text-muted-foreground hover:text-destructive flex items-center justify-center disabled:opacity-50"
                  title="Seite entfernen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}