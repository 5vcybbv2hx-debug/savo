/**
 * ConsumptionConfirmModal — "Tatsächlichen Verbrauch bestätigen".
 *
 * Wird beim Klick auf "In Rechnung umwandeln" (Angebot mit Status "Gesendet")
 * gezeigt, BEVOR die DebitorInvoice erzeugt wird. Pro Angebotsposition kann der
 * tatsächlich verbrauchte/gelieferte Wert bestätigt werden. Kategorie-spezifisch:
 *   - Getraenke       : "Tatsächlich verbraucht" (vorbelegt mit geplanter Menge)
 *                       + optional "Leergut zurück" → Verbrauch = geliefert − Leergut
 *   - Miete/Equipment : "Zurückgebracht (Anzahl)" → Menge = geliefert − zurück, min. 0
 *   - Personal        : "Tatsächliche Stunden" (vorbelegt mit geplanter Menge)
 *   - Speisen/Sonstig : "Tatsächlich verbraucht" (vorbelegt mit geplanter Menge)
 *
 * Zeigt live eine Zwischensumme (netto / USt / brutto) der bestätigten Mengen.
 * Erst "Verbrauch bestätigen & Rechnung erstellen" erzeugt die Rechnung.
 */
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wine, Boxes, Clock, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const eur = n => (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const CATS = ['Getraenke', 'Speisen', 'Personal', 'Miete/Equipment', 'Sonstiges'];

const isEquipment = c => c === 'Miete/Equipment';
const isPersonal = c => c === 'Personal';
const isGetraenke = c => c === 'Getraenke';

// Bestätigte Verrechnungs-Menge je Kategorie
export function confirmedQuantity(p, row) {
    const delivered = Number(p.quantity_provided) || 0;
    if (isEquipment(p.category)) {
        const returned = Number(row?.returned) || 0;
        return Math.max(0, delivered - returned);
    }
    if (isGetraenke(p.category) && row?.leergut != null && row.leergut !== '') {
        const leergut = Number(row.leergut) || 0;
        return Math.max(0, delivered - leergut);
    }
    return Number(row?.amount) || 0;
}

function CategoryIcon({ category }) {
    if (isEquipment(category)) return <Boxes className="w-3.5 h-3.5" />;
    if (isPersonal(category)) return <Clock className="w-3.5 h-3.5" />;
    return <Wine className="w-3.5 h-3.5" />;
}

export default function ConsumptionConfirmModal({ offer, open, onClose, onConfirm, isPending }) {
    const positions = useMemo(() => (offer?.positions || []).filter(p => p.description?.trim()), [offer]);

    // Edit-State pro Position (Kategorie-abhängige Felder)
    const [rows, setRows] = useState(null);
    React.useEffect(() => {
        if (open) {
            const init = {};
            positions.forEach((p, i) => {
                init[i] = {
                    amount: p.quantity ?? '',
                    leergut: '',
                    returned: '',
                };
            });
            setRows(init);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, offer?.id]);

    const setRow = (i, k, v) => setRows(r => ({ ...r, [i]: { ...r[i], [k]: v } }));

    // Bei Getränken: Leergut eintragen → Verbrauch automatisch = geliefert − Leergut (überschreibbar)
    const handleLeergut = (i, p, value) => {
        const next = { ...rows[i], leergut: value };
        if (value !== '' && Number(value) > 0 && p.quantity_provided != null) {
            const auto = Math.max(0, (Number(p.quantity_provided) || 0) - (Number(value) || 0));
            next.amount = auto;
        }
        setRows(r => ({ ...r, [i]: next }));
    };

    // Live-Zwischensumme (neuer Netto-Betrag der Rechnung)
    const live = useMemo(() => {
        const net = positions.reduce((s, p, i) => {
            const row = rows?.[i] || {};
            return s + confirmedQuantity(p, row) * (Number(p.unit_price) || 0);
        }, 0);
        const rate = Number(offer?.tax_rate) || 0;
        const vat = net * rate / 100;
        return { net, vat, gross: net + vat };
    }, [positions, rows, offer?.tax_rate]);

    if (!offer) return null;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Tatsächlichen Verbrauch bestätigen</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                        Prüfe je Position die tatsächlich verbrauchten Mengen, bevor die Rechnung erstellt wird.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2.5">
                    {positions.map((p, i) => {
                        const row = rows?.[i] || {};
                        const qty = confirmedQuantity(p, row);
                        const lineTotal = qty * (Number(p.unit_price) || 0);
                        return (
                            <div key={i} className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2">
                                {/* Kopf: Beschreibung + Kategorie */}
                                <div className="flex items-start gap-2">
                                    <div className="mt-0.5 text-foreground"><CategoryIcon category={p.category} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground leading-snug">{p.description}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1 text-[10px] text-muted-foreground">
                                            {p.category && (
                                                <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/50">{p.category}</span>
                                            )}
                                            {p.unit && (
                                                <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/50">Einheit: {p.unit}</span>
                                            )}
                                            <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/50">Geplant: {eur(p.quantity)}</span>
                                            {p.quantity_provided != null && p.quantity_provided !== '' && (
                                                <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/50">Geliefert: {Number(p.quantity_provided)}</span>
                                            )}
                                            <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/50">
                                                {eur(p.unit_price)} €{p.unit ? `/${p.unit}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Kategorie-abhängige Eingabe */}
                                {isEquipment(p.category) ? (
                                    <div className="grid grid-cols-2 gap-2 items-end">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Zurückgebracht (Anzahl)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={row.returned ?? ''}
                                                onChange={(e) => setRow(i, 'returned', e.target.value)}
                                                placeholder="0"
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Verrechnete Menge</Label>
                                            <div className="h-9 px-3 rounded-lg bg-background/40 border border-border/50 flex items-center text-sm font-semibold text-foreground">
                                                {qty}
                                            </div>
                                        </div>
                                    </div>
                                ) : isPersonal(p.category) ? (
                                    <div className="grid grid-cols-2 gap-2 items-end">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Tatsächliche Stunden</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.25"
                                                value={row.amount ?? ''}
                                                onChange={(e) => setRow(i, 'amount', e.target.value)}
                                                placeholder="0"
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Summe</Label>
                                            <div className="h-9 px-3 rounded-lg bg-background/40 border border-border/50 flex items-center text-sm font-semibold text-foreground">
                                                {eur(lineTotal)} €
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {isGetraenke(p.category) && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <RefreshCcw className="w-3 h-3" /> Leergut zurück (optional)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={row.leergut ?? ''}
                                                    onChange={(e) => handleLeergut(i, p, e.target.value)}
                                                    placeholder={`Auto: Geliefert (${p.quantity_provided != null ? Number(p.quantity_provided) : 0}) − Leergut`}
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 items-end">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">
                                                    Tatsächlich {isGetraenke(p.category) ? 'verbraucht' : 'verbraucht / geliefert'}
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={row.amount ?? ''}
                                                    onChange={(e) => setRow(i, 'amount', e.target.value)}
                                                    placeholder={String(p.quantity ?? 0)}
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Summe</Label>
                                                <div className="h-9 px-3 rounded-lg bg-background/40 border border-border/50 flex items-center text-sm font-semibold text-foreground">
                                                    {eur(lineTotal)} €
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Live-Zwischensumme */}
                <div className="rounded-xl bg-secondary/40 border border-border/50 p-3.5 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Netto</span><span className="num">{eur(live.net)} &euro;</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>USt {Number(offer?.tax_rate) || 0} %</span><span className="num">{eur(live.vat)} &euro;</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/50">
                        <span>Rechnungssumme (brutto)</span><span className="num">{eur(live.gross)} &euro;</span>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
                        Abbrechen
                    </Button>
                    <Button
                        className={cn('flex-1 bg-primary text-primary-foreground')}
                        onClick={() => onConfirm(rows)}
                        disabled={isPending}
                    >
                        {isPending ? 'Wird erstellt…' : 'Verbrauch bestätigen & Rechnung erstellen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}