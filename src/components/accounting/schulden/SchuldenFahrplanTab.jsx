/**
 * SchuldenFahrplanTab — Bereich „Schulden & Fahrplan" im Buchhaltungs-Modul.
 *
 * Zeigt Kopf-Kacheln, den Fahrplan (FahrplanPhase) und die Posten-Liste
 * (OffenerPosten) mit Schuldner-/Status-Filter, Details und Aktionen.
 * Nur für Manager und Admins — die Sichtbarkeit regelt AccountingDashboard.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { OFFENE_STATUS, SCHULDNER_OPTIONS, schuldnerMeta, todayISO, sortPosten } from '@/lib/offenePosten';
import { toast } from 'sonner';
import { Loader2, Scale } from 'lucide-react';
import { Card } from '@/components/ui/card';
import SchuldenKopfKacheln from '@/components/accounting/schulden/SchuldenKopfKacheln';
import FahrplanPhasen from '@/components/accounting/schulden/FahrplanPhasen';
import SchuldenFilterBar from '@/components/accounting/schulden/SchuldenFilterBar';
import PostenKarte from '@/components/accounting/schulden/PostenKarte';

const POSTEN_KEY = ['offene-posten'];
const PHASEN_KEY = ['fahrplan-phasen'];

export default function SchuldenFahrplanTab() {
    const queryClient = useQueryClient();
    const [schuldner, setSchuldner] = useState('Alle');
    const [statusFilter, setStatusFilter] = useState('offen');

    const { data: posten = [], isLoading } = useQuery({
        queryKey: POSTEN_KEY,
        queryFn: () => base44.entities.OffenerPosten.list('-created_date', 300),
        staleTime: STALE.MEDIUM,
    });

    const { data: phasen = [] } = useQuery({
        queryKey: PHASEN_KEY,
        queryFn: () => base44.entities.FahrplanPhase.list('sort_order', 100),
        staleTime: STALE.SLOW,
    });

    // ── Änderung am Posten (Status/Priorität) — optimistic ────────────────────
    const updatePosten = useMutation({
        mutationFn: ({ id, data }) => base44.entities.OffenerPosten.update(id, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: POSTEN_KEY });
            const previous = queryClient.getQueryData(POSTEN_KEY);
            queryClient.setQueryData(POSTEN_KEY, old =>
                (old || []).map(p => (p.id === id ? { ...p, ...data } : p))
            );
            return { previous };
        },
        onError: (error, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(POSTEN_KEY, context.previous);
            toast.error(error?.message || 'Änderung konnte nicht gespeichert werden');
        },
        onSuccess: (_result, { data }) => {
            if (data.status === 'bezahlt') toast.success('Als bezahlt markiert');
            else if (data.prioritaet) toast.success('Priorität aktualisiert');
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: POSTEN_KEY }),
    });

    const markPaid = (p) => updatePosten.mutate({
        id: p.id,
        data: { status: 'bezahlt', bezahlt_am: todayISO() },
    });

    const changePriority = (p, prioritaet) => updatePosten.mutate({ id: p.id, data: { prioritaet } });

    // ── Filter + Sortierung ───────────────────────────────────────────────────
    const statusRule = statusFilter === 'offen'
        ? OFFENE_STATUS
        : statusFilter === 'abgeschlossen'
            ? ['bezahlt', 'erledigt']
            : null;

    const sichtbar = useMemo(() => {
        const rows = posten.filter(p =>
            (schuldner === 'Alle' || p.schuldner === schuldner) &&
            (!statusRule || statusRule.includes(p.status))
        );
        return sortPosten(rows);
    }, [posten, schuldner, statusFilter]);

    return (
        <div className="space-y-4">
            {/* ── Kopf ── */}
            <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Scale className="w-4 h-4 text-primary" />
                    Schulden & Fahrplan
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Offene Posten, Fristen und die nächsten Schritte
                </p>

                {/* Legende der Schuldner-Farben */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Zuordnung
                    </span>
                    {SCHULDNER_OPTIONS.map(s => {
                        const meta = schuldnerMeta(s);
                        return (
                            <span
                                key={s}
                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                                style={{ color: meta.dotColor }}
                            >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.dotColor }} />
                                {meta.label}
                            </span>
                        );
                    })}
                </div>
            </div>

            <SchuldenKopfKacheln posten={posten} />

            <FahrplanPhasen phasen={phasen} />

            {/* ── Posten ── */}
            <section className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                    <h2 className="text-sm font-bold text-foreground">Posten</h2>
                    <span className="text-[11px] text-muted-foreground">{sichtbar.length} angezeigt</span>
                </div>

                <SchuldenFilterBar
                    schuldner={schuldner}
                    status={statusFilter}
                    onSchuldner={setSchuldner}
                    onStatus={setStatusFilter}
                />

                {isLoading ? (
                    <div className="flex items-center justify-center py-14 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Posten werden geladen …
                    </div>
                ) : sichtbar.length === 0 ? (
                    <Card className="p-6 text-center">
                        <p className="text-sm font-semibold text-foreground">Keine Posten in dieser Ansicht</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {posten.length === 0
                                ? 'Es sind noch keine offenen Posten erfasst.'
                                : 'Für diesen Filter gibt es keine Einträge.'}
                        </p>
                    </Card>
                ) : (
                    <div className="space-y-2.5">
                        {sichtbar.map(p => (
                            <PostenKarte
                                key={p.id}
                                posten={p}
                                onMarkPaid={markPaid}
                                onPriorityChange={changePriority}
                                isPending={updatePosten.isPending}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}