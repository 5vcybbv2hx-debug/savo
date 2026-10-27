import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Vollbild-Ansicht eines Briefscans mit Umschalten zwischen Fenster und Vergrößerung. */
export default function BriefVollbildModal({ open, onOpenChange, url, titel }) {
    const [zoom, setZoom] = useState(false);

    useEffect(() => { if (!open) setZoom(false); }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-full h-[88vh] p-0 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
                    <DialogTitle className="text-sm font-semibold truncate">{titel || 'Briefscan'}</DialogTitle>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => setZoom(z => !z)}>
                        {zoom ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                        {zoom ? 'Ans Fenster' : 'Vergrößern'}
                    </Button>
                </div>
                <div className="flex-1 overflow-auto bg-background/60 p-2">
                    <img
                        src={url}
                        alt={titel || 'Briefscan'}
                        onClick={() => setZoom(z => !z)}
                        style={zoom ? { width: '200%', maxWidth: 'none' } : undefined}
                        className={cn('block mx-auto', zoom ? 'cursor-zoom-out' : 'max-h-full object-contain cursor-zoom-in')}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}