import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download } from 'lucide-react';
import QRCode from 'qrcode';

export default function CleaningQRGenerator({ open, onClose }) {
    const [selectedArea, setSelectedArea] = useState(null);
    const canvasRef = useRef(null);

    const { data: tasks = [] } = useQuery({
        queryKey: ['cleaning-tasks-all'],
        queryFn: () => base44.entities.CleaningTask.filter({ is_active: true }, 'area'),
        enabled: open
    });

    const areas = [...new Set(tasks.map(t => t.area).filter(Boolean))].sort();

    useEffect(() => {
        if (selectedArea && canvasRef.current) {
            const url = `${window.location.origin}/CleaningChecklist?area=${encodeURIComponent(selectedArea)}`;
            QRCode.toCanvas(canvasRef.current, url, {
                width: 256,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' }
            });
        }
    }, [selectedArea]);

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `reinigung-${selectedArea}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-status-warn" />
                        Reinigungs-QR Codes
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Bereich auswählen:</p>
                    <div className="flex flex-wrap gap-2">
                        {areas.map(area => (
                            <button
                                key={area}
                                onClick={() => setSelectedArea(area)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                    selectedArea === area
                                        ? 'bg-status-warn/20 border-status-warn/50 text-status-warn'
                                        : 'border-border text-muted-foreground hover:bg-accent/50'
                                }`}
                            >
                                {area}
                            </button>
                        ))}
                    </div>

                    {selectedArea && (
                        <div className="flex flex-col items-center gap-3 pt-2">
                            <div className="p-3 bg-card rounded-xl">
                                <canvas ref={canvasRef} />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                QR-Code für <strong>{selectedArea}</strong> ausdrucken und aufhängen
                            </p>
                            <Button onClick={handleDownload} variant="outline" className="gap-2 w-full">
                                <Download className="w-4 h-4" />
                                PNG herunterladen
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}