import React from 'react';
import { Wrench, useNavigate } from 'react-router-dom';
import { Wrench, createPageUrl } from '@/utils';
import { Wrench, usePermissions } from '@/components/auth/usePermissions';
import { Wrench, useQuery } from '@tanstack/react-query';
import { Wrench, base44 } from '@/api/base44Client';
import { Wrench, STALE } from '@/lib/queryUtils';
import { Wrench, cn } from '@/lib/utils';
import { Wrench, MapPin, CheckSquare, ListChecks, Brush, Star, Tv } from 'lucide-react';
import { Wrench, format } from 'date-fns';

function StatBadge({ count, variant = 'default' }) {
    if (!count) return null;
    return (
        <span className={cn(
            'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
            variant === 'warning' ? 'bg-orange-500/20 text-orange-400' :
            variant === 'danger'  ? 'bg-destructive/20 text-destructive' :
                                    'bg-primary/20 text-primary'
        )}>
            {count}
        </span>
    );
}

function NavCard({ icon: Icon, label, description, page, badge, badgeVariant, permission }) {
    const navigate = useNavigate();
    const permissions = usePermissions();
    if (permission && !permissions[permission]) return null;
    return (
        <button
            onClick={() => navigate(createPageUrl(page))}
            className="flex items-center gap-4 w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] bg-card border-border/50 hover:border-border hover:bg-accent/20 cursor-pointer"
        >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            {badge !== undefined && <StatBadge count={badge} variant={badgeVariant} />}
        </button>
    );
}

export default function BetriebHub() {
    const permissions = usePermissions();
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: todos = [] } = useQuery({
        queryKey: ['todos-open-today'],
        queryFn: () => base44.entities.Todo.filter({ status: 'open' }, '-created_date', 100),
        staleTime: STALE.MEDIUM,
        enabled: permissions.canViewTodos,
    });

    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations-today'],
        queryFn: () => base44.entities.Reservation.filter({ date: today }, 'time', 100),
        staleTime: STALE.MEDIUM,
        enabled: permissions.canViewReservations,
    });

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Betrieb</h1>
                <p className="text-muted-foreground text-sm mt-1">Gäste, Aufgaben & tägliche Abläufe</p>
            </div>

            {/* Gäste */}
            <div className="mb-6">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Gäste</p>
                <div className="space-y-2">
                    <NavCard icon={MapPin} label="Gäste & Tische"
                        description={reservations.length > 0 ? `${reservations.length} Reservierungen heute` : 'Tische & Reservierungen'}
                        page="GuestHub" badge={reservations.length || undefined} permission="canViewReservations" />
                </div>
            </div>

            {/* Aufgaben */}
            <div className="mb-6">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Aufgaben</p>
                <div className="space-y-2">
                    <NavCard icon={CheckSquare} label="Aufgaben"       description="Todos & offene Punkte"            page="Todos"       badge={todos.length || undefined} permission="canViewTodos" />
                    <NavCard icon={ListChecks}  label="Wochenaufgaben" description="Wiederkehrende Wochenplanung"     page="WeeklyTasks" permission="canViewTodos" />
                    <NavCard icon={Brush}       label="Putzliste"      description="Reinigungsaufgaben & Checkliste"  page="Cleaning"    permission="canViewCleaning" />
                    <NavCard icon={Wrench}      label="Wartung"        description="Geräte & Wartungsaufgaben verwalten"  page="Maintenance" permission="canViewSettings" />
                </div>
            </div>

            {/* Veranstaltungen */}
            {permissions.canViewEvents && (
                <div className="mb-6">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Veranstaltungen</p>
                    <div className="space-y-2">
                        <NavCard icon={Star} label="Events" description="Veranstaltungen planen & verwalten" page="Events" permission="canViewEvents" />
                    </div>
                </div>
            )}

            {/* Marketing & Display */}
            {permissions.isManager && (
                <div className="mb-6">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Marketing & Display</p>
                    <div className="space-y-2">
                        <NavCard icon={Tv} label="TV-Display"
                            description="Slideshow für Bar-TV verwalten"
                            page="DisplayManager" permission="isManager" />
                    </div>
                </div>
            )}
        </div>
    );
}
