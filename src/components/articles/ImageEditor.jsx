import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RotateCw, ZoomIn, Check, X, Square, RectangleHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const ASPECT_RATIOS = [
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: 'Frei', value: null },
];

export default function ImageEditor({ open, onClose, imageUrl, onSave }) {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [aspectRatio, setAspectRatio] = useState(1); // default 1:1 square
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const containerRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState(320);

    // Responsive canvas size
    useEffect(() => {
        const update = () => {
            const w = window.innerWidth;
            setCanvasSize(Math.min(w - 48, 400));
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    useEffect(() => {
        if (open && imageUrl) {
            setScale(1);
            setRotation(0);
            setPosition({ x: 0, y: 0 });
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                imageRef.current = img;
                drawCanvas();
            };
            img.src = imageUrl;
        }
    }, [open, imageUrl]);

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        const size = canvasSize;
        const cropH = aspectRatio ? size / aspectRatio : size;

        canvas.width = size;
        canvas.height = cropH;

        ctx.clearRect(0, 0, size, cropH);
        ctx.save();

        ctx.translate(size / 2 + position.x, cropH / 2 + position.y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);

        // fit image to canvas initially
        const fitScale = Math.max(size / img.width, cropH / img.height);
        ctx.drawImage(img, -img.width / 2 * fitScale, -img.height / 2 * fitScale, img.width * fitScale, img.height * fitScale);

        ctx.restore();
    }, [canvasSize, aspectRatio, position, rotation, scale]);

    useEffect(() => {
        if (imageRef.current) drawCanvas();
    }, [drawCanvas]);

    const getEventPos = (e, rect) => {
        if (e.touches) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleDragStart = (e) => {
        e.preventDefault();
        setIsDragging(true);
        const rect = canvasRef.current.getBoundingClientRect();
        const pos = getEventPos(e, rect);
        setDragStart({ x: pos.x - position.x, y: pos.y - position.y });
    };

    const handleDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const pos = getEventPos(e, rect);
        setPosition({ x: pos.x - dragStart.x, y: pos.y - dragStart.y });
    };

    const handleDragEnd = () => setIsDragging(false);

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
            onSave(file);
        }, 'image/jpeg', 0.92);
    };

    const cropH = aspectRatio ? canvasSize / aspectRatio : canvasSize;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl max-h-[95dvh] overflow-y-auto p-4">
                <DialogHeader>
                    <DialogTitle>Bild zuschneiden</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    {/* Aspect ratio */}
                    <div>
                        <Label className="text-sm font-semibold mb-2 block">Format</Label>
                        <div className="flex gap-2 flex-wrap">
                            {ASPECT_RATIOS.map(ar => (
                                <button
                                    key={ar.label}
                                    type="button"
                                    onClick={() => setAspectRatio(ar.value)}
                                    className={cn(
                                        'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                                        aspectRatio === ar.value
                                            ? 'bg-status-warn/70 text-foreground border-status-warn/70'
                                            : 'border-border text-muted-foreground'
                                    )}
                                >
                                    {ar.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Canvas — THIS IS THE EXACT SAVED AREA */}
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                            <span className="inline-block w-3 h-3 border-2 border-status-warn/70 rounded-sm" />
                            Der Bereich im Rahmen wird gespeichert — ziehe zum Verschieben
                        </p>
                        <div
                            ref={containerRef}
                            className="relative rounded-xl overflow-hidden border-2 border-status-warn/70 shadow-lg shadow-amber-500/20 mx-auto cursor-move touch-none"
                            style={{ width: canvasSize, height: cropH, maxWidth: '100%' }}
                        >
                            <canvas
                                ref={canvasRef}
                                onMouseDown={handleDragStart}
                                onMouseMove={handleDragMove}
                                onMouseUp={handleDragEnd}
                                onMouseLeave={handleDragEnd}
                                onTouchStart={handleDragStart}
                                onTouchMove={handleDragMove}
                                onTouchEnd={handleDragEnd}
                                className="w-full h-full object-cover"
                                style={{ touchAction: 'none', display: 'block', width: canvasSize, height: cropH }}
                            />
                            {/* Corner markers */}
                            <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-status-warn/70 rounded-tl-sm pointer-events-none" />
                            <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-status-warn/70 rounded-tr-sm pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-status-warn/70 rounded-bl-sm pointer-events-none" />
                            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-status-warn/70 rounded-br-sm pointer-events-none" />
                        </div>
                    </div>

                    {/* Zoom */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-sm"><ZoomIn className="w-4 h-4" /> Zoom</Label>
                            <span className="text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
                        </div>
                        <Slider
                            value={[scale]}
                            onValueChange={([v]) => setScale(v)}
                            min={0.5}
                            max={4}
                            step={0.05}
                            className="w-full"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setRotation(r => (r + 90) % 360)} className="flex-1 h-11">
                            <RotateCw className="w-4 h-4 mr-2" /> Drehen
                        </Button>
                        <Button type="button" variant="outline" onClick={() => { setScale(1); setRotation(0); setPosition({ x: 0, y: 0 }); }} className="flex-1 h-11">
                            <X className="w-4 h-4 mr-2" /> Reset
                        </Button>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-base">
                            Abbrechen
                        </Button>
                        <Button type="button" onClick={handleSave} className="flex-1 h-12 text-base bg-status-ok/70 hover:bg-status-ok/70">
                            <Check className="w-4 h-4 mr-2" /> Übernehmen
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}