import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { STALE } from '@/lib/queryUtils';
import MonatsabschlussKarte from './MonatsabschlussKarte';
import MonatAnlegenDialog from './MonatAnlegenDialog';
import {
    kasseStats, lohnStats, defaultFaellig, lastMonths, lastMonthsStart, monthLabel,
} from '@/lib/monatsabschluss';

const KEY = ['monatsabschluss-buchhaltung'];

/** Alle Datensätze einer Abfrage holen (max. 6 Seiten à 500) */
async function fetchAll(entity, query) {
    let items = [];
    let cursor;
    for (let i = 0; i < 6; i++) {
        const page = await entity.filter(query, { sort: 'date', limit: 500, cursor });
        items = items.concat(page.items || []);
        if (!page.has_more) break;
        cursor = page.next_cursor;
    }
    return items;
}

/** Routine „Monatsabschluss für den Steuerberater" — ein Eintrag pro Monat. */
export default function SteuerberaterTab() {
    const queryClient = useQueryClient();
    const { toast }   = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);

    const today = format(new Date(), 'yyyy-MM-dd');
    const from  = lastMonthsStart(12);

    const { data: rows, isLoading } = useQuery({
        queryKey: KEY,
        queryFn: async () => {
            const page = await base44.entities.MonatsabschlussBuchhaltung.filter({}, { sort: '-month', limit: 100 });
            return page.items;
        },
        staleTime: STALE.FAST,
    });

    // Tagesabschlüsse der letzten 12 Monate für den Kassenstand
    const { data: revenues } = useQuery({
        queryKey: ['monatsabschluss-revenues', from],
        queryFn: () => fetchAll(base44.entities.DailyRevenue, { date: { $gte: from } }),
        staleTime: STALE.MEDIUM,
    });

    // Zeiteinträge der letzten 12 Monate für die Lohnzeile
    const { data: timeEntries } = useQuery({
        queryKey: ['monatsabschluss-timeentries', from],
        queryFn: () => fetchAll(base44.entities.TimeEntry, { date: { $gte: from } }),
        staleTime: STALE.MEDIUM,
    });

    const bookedDates = useMemo(() => new Set((revenues || []).map(r => r.date)), [revenues]);
    const existingMonths = useMemo(() => (rows || []).map(r => r.month), [rows]);

    // ── Bulk-Anlage: beim ersten Öffnen die letzten 12 Monate anlegen ────────
    const ensuredRef = useRef(false);
    useEffect(() => {
        if (ensuredRef.current || !rows || !revenues) return;
        ensuredRef.current = true;

        const existing = new Set(rows.map(r => r.month));
        const missing = lastMonths(12)
            .filter(m => !existing.has(m))
            .map(m => {
                const kasse = kasseStats(m, bookedDates, today);
                return {
                    month: m,
                    status: 'offen',
                    faellig_am: defaultFaellig(m),
                    check_kasse: kasse.complete,
                    auto_kasse_tage: kasse.booked,
                    auto_kasse_erwartet: kasse.expected,
                };
            });

        if (missing.length === 0) return;
        base44.entities.MonatsabschlussBuchhaltung.bulkCreate(missing)
            .then(() => queryClient.invalidateQueries({ queryKey: KEY }))
            .catch(() => toast({ title: 'Monate konnten nicht angelegt werden', variant: 'destructive' }));
    }, [rows, revenues, bookedDates, today, queryClient, toast]);

    // ── Kasse: Häkchen automatisch setzen, wenn alle Tage gebucht sind ───────
    const autoRef = useRef(false);
    useEffect(() => {
        if (autoRef.current || !rows || !revenues) return;
        autoRef.current = true;

        const fixes = rows
            .filter(r => !r.check_kasse)
            .map(r => ({ r, kasse: kasseStats(r.month, bookedDates, today) }))
            .filter(({ kasse }) => kasse.complete)
            .map(({ r, kasse }) => ({
                id: r.id,
                check_kasse: true,
                auto_kasse_tage: kasse.booked,
                auto_kasse_erwartet: kasse.expected,
            }));

        if (fixes.length === 0) return;
        base44.entities.MonatsabschlussBuchhaltung.bulkUpdate(fixes)
            .then(() => queryClient.invalidateQueries({ queryKey: KEY }))
            .catch(() => {});
    }, [rows, revenues, bookedDates, today, queryClient]);

    // ── Speichern ────────────────────────────────────────────────────────────
    const patch = async (id, data) => {
        const updated = await base44.entities.MonatsabschlussBuchhaltung.update(id, data);
        queryClient.setQueryData(KEY, prev =>
            Array.isArray(prev) ? prev.map(r => (r.id === id ? { ...r, ...(updated || data) } : r)) : prev
        );
    };

    const buildPaket = async row => {
        await patch(row.id, { status: 'fertig', paket_gebaut_am: today });
        toast({ title: 'Paket gebaut', description: `${monthLabel(row.month)} ist bereit zum Versand.` });
    };

    const markSent = async row => {
        await patch(row.id, { status: 'versendet', versendet_am: today });
        toast({ title: 'Als versendet markiert', description: monthLabel(row.month) });
    };

    const createMonth = async month => {
        const kasse = kasseStats(month, bookedDates, today);
        await base44.entities.MonatsabschlussBuchhaltung.create({
            month,
            status: 'offen',
            faellig_am: defaultFaellig(month),
            check_kasse: kasse.complete,
            auto_kasse_tage: kasse.booked,
            auto_kasse_erwartet: kasse.expected,
        });
        await queryClient.invalidateQueries({ queryKey: KEY });
    };

    // ── Darstellung ──────────────────────────────────────────────────────────
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[13.5px] font-medium text-foreground tracking-tight">Monatsabschlüsse</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Monat anlegen
                </Button>
            </div>

            {isLoading && (
                <Card className="p-6 text-center text-sm text-muted-foreground">Lädt…</Card>
            )}

            {!isLoading && (rows || []).length === 0 && (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                    Noch keine Monatsabschlüsse angelegt.
                </Card>
            )}

            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                {(rows || []).map(row => (
                    <MonatsabschlussKarte
                        key={row.id}
                        row={row}
                        today={today}
                        kasse={kasseStats(row.month, bookedDates, today)}
                        lohn={lohnStats(row.month, timeEntries || [])}
                        onPatch={patch}
                        onBuildPaket={buildPaket}
                        onMarkSent={markSent}
                    />
                ))}
            </div>

            <MonatAnlegenDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                existingMonths={existingMonths}
                onCreate={createMonth}
            />
        </div>
    );
}