import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Printer, Tag, Euro } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    buildSlotLabelPdf, openPdfForPrint, generateSlotCode, qrDataUrl,
} from '@/lib/slotLabels';
import SlotLabelPreview from './label/SlotLabelPreview';
import LabelSlotPicker from './label/LabelSlotPicker';
import PriceLabelTab from './label/PriceLabelTab';

const HISTORY_KEY = 'label_print_history';

function readHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function pushHistory(entry) {
    try {
        const next = [{ ...entry, ts: Date.now() }, ...readHistory()].slice(0, 20);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next[0];
    } catch { return entry; }
}

/**
 * Etikettendruck für 62-mm-Endlosrolle (Brother QL-800).
 * Fach-Etiketten (short_code als QR) und Preisschilder, je 62 × 30 mm.
 */
export default function SlotLabelPrintDialog({ open, onClose, initialSlotId, initialAreaId }) {
    const qc = useQueryClient();
    const [tab, setTab] = useState('slots');
    const [areaId, setAreaId] = useState('');
    const [furnitureId, setFurnitureId] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [busy, setBusy] = useState(false);
    const [previewQr, setPreviewQr] = useState('');
    const [lastPrint, setLastPrint] = useState(() => readHistory()[0] || null);
    const appliedRef = useRef('');

    const { data: areas = [] } = useQuery({
        queryKey: ['st-areas'],
        queryFn: () => base44.entities.Area.list('sort_order', 100),
        enabled: open,
        staleTime: STALE.SLOW,
    });
    const { data: furniture = [] } = useQuery({
        queryKey: ['st-furniture'],
        queryFn: () => base44.entities.Furniture.list('sort_order', 200),
        enabled: open,
        staleTime: STALE.SLOW,
    });
    const { data: slots = [] } = useQuery({
        queryKey: ['slots'],
        queryFn: () => base44.entities.StorageSlot.list('name', 1000),
        enabled: open,
        staleTime: STALE.MEDIUM,
    });

    // Startauswahl (einzelnes Fach aus der Fach-Liste, oder ganzer Bereich)
    useEffect(() => {
        if (!open) { appliedRef.current = ''; return; }
        if (!slots.length) return;
        const key = `${initialSlotId || ''}|${initialAreaId || ''}`;
        if (appliedRef.current === key) return;
        appliedRef.current = key;
        if (initialSlotId) {
            const slot = slots.find(s => s.id === initialSlotId);
            if (slot) {
                setAreaId(slot.area_id || '');
                setFurnitureId(slot.furniture_id || '');
                setSelectedIds([slot.id]);
            }
        } else {
            setAreaId(initialAreaId || '');
            setFurnitureId('');
            setSelectedIds([]);
        }
    }, [open, initialSlotId, initialAreaId, slots]);

    const selectedSlots = useMemo(
        () => slots.filter(s => selectedIds.includes(s.id)),
        [slots, selectedIds]
    );
    const previewSlot = selectedSlots[0] || null;

    useEffect(() => {
        if (!previewSlot?.short_code) { setPreviewQr(''); return; }
        let cancelled = false;
        qrDataUrl(previewSlot.short_code).then(url => { if (!cancelled) setPreviewQr(url); }).catch(() => {});
        return () => { cancelled = true; };
    }, [previewSlot?.short_code]);

    const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    // Short-Codes nachziehen: fehlende Codes werden erzeugt (Muster RA-SC-XXXX) und gespeichert
    const ensureShortCodes = async (list) => {
        const taken = new Set(slots.map(s => s.short_code).filter(Boolean));
        const result = [];
        for (const slot of list) {
            if (slot.short_code) { result.push(slot); continue; }
            const code = generateSlotCode(slot.area_name, slot.furniture_name, taken);
            taken.add(code);
            await base44.entities.StorageSlot.update(slot.id, { short_code: code });
            result.push({ ...slot, short_code: code });
        }
        return result;
    };

    const buildSlotDoc = async (print) => {
        if (selectedSlots.length === 0) return;
        setBusy(true);
        try {
            const withCodes = await ensureShortCodes(selectedSlots);
            const missing = withCodes.length - selectedSlots.filter(s => s.short_code).length;
            if (missing > 0) {
                qc.invalidateQueries({ queryKey: ['slots'] });
                toast.success(`${missing} Short-Code${missing === 1 ? '' : 's'} automatisch erzeugt und gespeichert`);
            }
            const items = await Promise.all(withCodes.map(async slot => ({
                code: slot.short_code,
                name: slot.name || '',
                path: [slot.area_name, slot.furniture_name].filter(Boolean).join(' · '),
                qr: await qrDataUrl(slot.short_code),
            })));
            const doc = buildSlotLabelPdf(items);
            if (print) openPdfForPrint(doc);
            else doc.save(`fach-etiketten_${items.length}x_62x30.pdf`);
            setLastPrint(pushHistory({ kind: 'Fach-Etiketten', count: items.length }));
        } finally { setBusy(false); }
    };

    const previewCode = previewSlot?.short_code || 'XX-XX-0000';

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Printer className="w-5 h-5 text-primary" />
                        Etiketten drucken
                        <span className="ml-auto text-[10px] font-normal text-muted-foreground">62 × 30 mm</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex gap-1.5">
                    {[
                        { id: 'slots', label: 'Fach-Etiketten', icon: Tag },
                        { id: 'price', label: 'Preisschilder', icon: Euro },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-all',
                                tab === t.id
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'slots' ? (
                    <>
                        <LabelSlotPicker
                            areas={areas}
                            furniture={furniture}
                            slots={slots}
                            areaId={areaId}
                            furnitureId={furnitureId}
                            onAreaChange={setAreaId}
                            onFurnitureChange={setFurnitureId}
                            selectedIds={selectedIds}
                            onToggle={toggle}
                            onSetSelection={setSelectedIds}
                        />

                        <div className="bg-secondary/30 rounded-xl p-3 flex justify-center overflow-x-auto">
                            {previewSlot ? (
                                <SlotLabelPreview
                                    code={previewCode}
                                    name={previewSlot.name}
                                    path={[previewSlot.area_name, previewSlot.furniture_name].filter(Boolean).join(' · ')}
                                    qrUrl={previewSlot.short_code ? previewQr : ''}
                                />
                            ) : (
                                <p className="text-xs text-muted-foreground py-6">Fächer auswählen, um die Vorschau zu sehen.</p>
                            )}
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-snug">
                            Nutzbreite 58 mm · 1 Etikett pro Seite · QR = Short-Code
                            {previewSlot && !previewSlot.short_code && ' · fehlender Short-Code wird beim Erzeugen automatisch erzeugt'}
                        </p>

                        <div className="flex gap-2">
                            <Button
                                onClick={() => buildSlotDoc(false)}
                                disabled={busy || selectedSlots.length === 0}
                                className="flex-1 gap-1.5"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                PDF ({selectedSlots.length})
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => buildSlotDoc(true)}
                                disabled={busy || selectedSlots.length === 0}
                                className="gap-1.5"
                            >
                                <Printer className="w-4 h-4" /> Drucken
                            </Button>
                        </div>
                    </>
                ) : (
                    <PriceLabelTab open={open && tab === 'price'} />
                )}

                <div className="border-t border-border/60 pt-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                        Im Druckdialog „Tatsächliche Größe / 100 %" wählen, damit nichts skaliert wird.
                    </p>
                    {lastPrint && (
                        <p className="text-[10px] text-muted-foreground">
                            Zuletzt: {lastPrint.count} × {lastPrint.kind} · {new Date(lastPrint.ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}