import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { suggestedCreateMonth, monthLabel } from '@/lib/monatsabschluss';

/** Monat manuell anlegen — Vorschlag ist der Vormonat, solange er fehlt. */
export default function MonatAnlegenDialog({ open, onOpenChange, existingMonths = [], onCreate }) {
    const [month, setMonth] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setMonth(suggestedCreateMonth(existingMonths));
            setError('');
        }
        // Vorschlag nur beim Öffnen neu berechnen
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = async () => {
        if (!month) return;
        if (existingMonths.includes(month)) {
            setError('Für diesen Monat gibt es bereits einen Abschluss.');
            return;
        }
        setSaving(true);
        try {
            await onCreate(month);
            onOpenChange(false);
        } catch (e) {
            setError('Anlegen fehlgeschlagen. Bitte erneut versuchen.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Monat anlegen</DialogTitle>
                </DialogHeader>

                <div className="space-y-2">
                    <label className="text-[11px] font-medium text-muted-foreground">Monat</label>
                    <Input type="month" value={month} onChange={e => { setMonth(e.target.value); setError(''); }} />
                    <p className="text-[11px] text-muted-foreground">
                        {month ? `Neuer Abschluss für ${monthLabel(month)}` : 'Monat auswählen'}
                    </p>
                    {error && <p className="text-[11px] text-status-danger">{error}</p>}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                    <Button onClick={submit} disabled={!month || saving}>Anlegen</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}