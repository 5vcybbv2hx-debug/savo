import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronRight, PenLine } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { STALE } from '@/lib/queryUtils';

/**
 * Kompakte Karte für Mitarbeiter: zeigt das laufende Wunschschicht-Fenster
 * inkl. eigener Einträge. Rendert nichts, wenn kein Fenster aktiv ist.
 */
export default function WishShiftsCard({ employee }) {
    const navigate = useNavigate();
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: accesses = [] } = useQuery({
        queryKey: ['my-provisional-access', employee?.id],
        queryFn: () => base44.entities.ProvisionalShiftAccess.filter({
            employee_id: employee.id,
            is_active: true,
        }),
        enabled: !!employee?.id,
        staleTime: STALE.MEDIUM,
    });

    const { data: requests = [] } = useQuery({
        queryKey: ['my-provisional-requests', employee?.id],
        queryFn: () => base44.entities.ProvisionalShiftRequest.filter({ employee_id: employee.id }),
        enabled: !!employee?.id,
        staleTime: STALE.MEDIUM,
    });

    const access = accesses[0];
    const windowActive = !!access && access.start_date <= today && access.end_date >= today;
    if (!windowActive) return null;

    const pending = requests.filter(r => r.status === 'ausstehend').length;
    const confirmed = requests.filter(r => r.status === 'bestätigt').length;

    return (
        <Card className="border-status-warn/30 bg-status-warn/5">
            <CardContent className="p-3 space-y-3">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-status-warn/20 text-status-warn">
                        <CalendarDays className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Wunschschichten</p>
                        <p className="text-xs text-muted-foreground">
                            {format(parseISO(access.start_date), 'dd.MM.')} – {format(parseISO(access.end_date), 'dd.MM.yyyy')} · Eingabe offen
                        </p>
                        {access.note && (
                            <p className="text-xs text-status-warn/80 mt-0.5 italic">{access.note}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="text-[10px] bg-status-warn/20 text-status-warn border-status-warn/30">
                        {pending} ausstehend
                    </Badge>
                    <Badge className="text-[10px] bg-status-ok/20 text-status-ok border-status-ok/30">
                        {confirmed} bestätigt
                    </Badge>
                </div>

                <Button
                    onClick={() => navigate(createPageUrl('Calendar'))}
                    className="w-full bg-status-warn/70 hover:bg-status-warn/70 gap-2 h-10"
                >
                    <PenLine className="w-4 h-4" />
                    Wunsch eintragen
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </CardContent>
        </Card>
    );
}