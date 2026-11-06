import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PhotoUploader({ onPhotoAdded, isLoading }) {
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    const handleFileSelect = async (files) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const file = files[0];
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            onPhotoAdded({
                type: 'photo',
                url: file_url,
                thumbnail_url: file_url,
            });
            setShowOptions(false);
        } catch (err) {
            alert('Fehler beim Upload: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-2">
            {!showOptions ? (
                <Button
                    onClick={() => setShowOptions(true)}
                    disabled={isLoading || uploading}
                    className="w-full h-12 rounded-xl gap-2 bg-primary/70 hover:bg-primary/70 text-white font-semibold"
                >
                    {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Camera className="w-4 h-4" />
                    )}
                    {uploading ? 'Wird hochgeladen…' : 'Foto hinzufügen'}
                </Button>
            ) : (
                <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border/40">
                    <button
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploading}
                        className={cn(
                            'w-full px-4 py-3 rounded-lg font-medium text-sm border transition-all flex items-center justify-center gap-2',
                            uploading
                                ? 'opacity-50 cursor-not-allowed'
                                : 'border-border bg-card hover:bg-accent text-foreground'
                        )}
                    >
                        <Camera className="w-4 h-4" />
                        Kamera
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={cn(
                            'w-full px-4 py-3 rounded-lg font-medium text-sm border transition-all flex items-center justify-center gap-2',
                            uploading
                                ? 'opacity-50 cursor-not-allowed'
                                : 'border-border bg-card hover:bg-accent text-foreground'
                        )}
                    >
                        <Upload className="w-4 h-4" />
                        Galerie
                    </button>
                    <button
                        onClick={() => setShowOptions(false)}
                        disabled={uploading}
                        className="w-full px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-all"
                    >
                        Abbrechen
                    </button>
                </div>
            )}

            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
            />
        </div>
    );
}