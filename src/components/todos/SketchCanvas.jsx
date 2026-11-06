import React, { useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SketchCanvas({ open, onClose, onSketchAdded, isLoading }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;

        const ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, [open]);

    const startDrawing = (e) => {
        if (!canvasRef.current) return;
        const { clientX, clientY } = e.touches ? e.touches[0] : e;
        const rect = canvasRef.current.getBoundingClientRect();
        const ctx = canvasRef.current.getContext('2d');

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || !canvasRef.current) return;
        const { clientX, clientY } = e.touches ? e.touches[0] : e;
        const rect = canvasRef.current.getBoundingClientRect();
        const ctx = canvasRef.current.getContext('2d');

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const saveSketch = async () => {
        if (!canvasRef.current) return;
        setSaving(true);
        try {
            const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'));
            const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });

            onSketchAdded({
                type: 'sketch',
                url: file_url,
                thumbnail_url: file_url,
            });
            onClose();
        } catch (err) {
            alert('Fehler beim Speichern: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-lg sm:max-w-2xl h-[100dvh] sm:h-auto flex flex-col p-0 gap-0 rounded-none sm:rounded-2xl">
                <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
                    <DialogTitle>Skizze zeichnen</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="flex-1 rounded-xl border-2 border-border bg-card cursor-crosshair touch-none"
                    />
                </div>

                <div className="px-4 py-3 border-t border-border bg-card space-y-3 shrink-0">
                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            onClick={clearCanvas}
                            disabled={saving || isLoading}
                            variant="outline"
                            className="h-10 rounded-lg gap-1.5"
                        >
                            <Trash2 className="w-4 h-4" />
                            Löschen
                        </Button>
                        <Button
                            onClick={onClose}
                            disabled={saving || isLoading}
                            variant="outline"
                            className="h-10 rounded-lg gap-1.5"
                        >
                            <X className="w-4 h-4" />
                            Abbrechen
                        </Button>
                        <Button
                            onClick={saveSketch}
                            disabled={saving || isLoading}
                            className="h-10 rounded-lg gap-1.5 bg-status-ok/70 hover:bg-status-ok/70"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {saving ? 'Speichert…' : 'Speichern'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}