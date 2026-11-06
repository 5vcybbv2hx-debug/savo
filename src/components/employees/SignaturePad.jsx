import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';

export default function SignaturePad({ label, onSign }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const startDraw = (e) => {
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
        setIsEmpty(false);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDraw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        setIsDrawing(false);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSign(isEmpty ? null : dataUrl);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
        onSign(null);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Löschen
                </Button>
            </div>
            <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-card" style={{ touchAction: 'none' }}>
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={150}
                    className="w-full"
                    style={{ cursor: 'crosshair', display: 'block' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                />
            </div>
            {isEmpty && <p className="text-xs text-muted-foreground text-center">Mit Finger oder Maus unterschreiben</p>}
        </div>
    );
}