import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { usePermissions } from '@/components/auth/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { cn } from '@/lib/utils';
import {
    Users, Calendar, Clock, Shield, ArrowLeftRight,
    Palmtree, Video, Trophy, ListChecks, MapPin
} from 'lucide-react';
import { format } from 'date-fns';

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

function NavCard({ icon: Icon, label, description, page, badge, badgeVariant, permission, onClick }) {
    const navigate = useNavigate();
    const permissions = usePermissions();
    if (permission && !permissions[permission]) return null;
    return (
        <button
            onClick={onClick || (() => navigate(createPageUrl(page)))}
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

export default function TeamHub() {
    const permissions = usePermissions();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Offene Schichttausch-Anfragen
    const { data: swapRequests = [] } = useQuery({
        queryKey: ['shift-swaps-open'],
        queryFn: () => base44.entities.ShiftSwapRequest.filter({ status: 'offen' }, '-created_date', 50),
        staleTime: STALE.MEDIUM,
        enabled: permissions.canRequestShiftSwap,
    });

    // Mitarbeiter-Count
    const { data: employees = [] } = useQuery({
        queryKey: ['employees-count'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 100),
        staleTime: STALE.SLOW,
        enabled: permissions.canViewEmployees,
    });

    // Urlaubsanträge offen
    const { data: vacationRequests = [] } = useQuery({
        queryKey: ['vacation-open'],
        queryFn: () => base44.entities.VacationRequest.filter({ status: 'pending' }, '-created_date', 50),
        staleTime: STALE.MEDIUM,
        enabled: permissions.canViewVacation,
    });

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Team</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {employees.length > 0 ? `${employees.length} aktive Mitarbeiter` : 'Team & Schichten verwalten'}
                </p>
            </div>

            {/* Planung */}
            <div className="mb-6">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Planung</p>
                <div className="space-y-2">
                    <NavCard icon={Calendar}      label="Schichtplan"     description="Wochenansicht, Schichten planen"    page="Calendar"      permission="canViewShifts" />
                    <NavCard icon={ListChecks}    label="Teamkalender"    description="Alle Schichten im Überblick"        page="TeamCalendar"  permission="canViewTeamCalendar" />
                    <NavCard icon={MapPin}        label="Stationsplan"    description="Bereiche & Stationen zuweisen"      page="Stationsplan"  permission="canViewShifts" />
                </div>
            </div>

            {/* Mein Bereich */}
            <div className="mb-6">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Mein Bereich</p>
                <div className="space-y-2">
                    <NavCard icon={Clock}         label="Meine Schichten"  description="Eigene Schichten & Verfügbarkeit" page="MyShifts"       permission="canViewShifts" />
                    <NavCard icon={Clock}         label="Zeiterfassung"    description="Arbeitsstunden & Übersicht"        page="TimeManagement" permission="canViewOwnTimeEntries" />
                    <NavCard icon={ArrowLeftRight} label="Schichttausch"   description="Anfragen senden & verwalten"      page="ShiftSwaps"    badge={swapRequests.length || undefined} permission="canRequestShiftSwap" />
                    <NavCard icon={Palmtree}      label="Urlaub"           description="Urlaubsanträge & Planung"          page="Vacation"      badge={vacationRequests.length || undefined} permission="canViewVacation" />
                </div>
            </div>

            {/* Verwaltung */}
            {(permissions.canViewEmployees || permissions.canEditEmployeePermissions || permissions.canViewTeamMeeting) && (
                <div className="mb-6">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Verwaltung</p>
                    <div className="space-y-2">
                        <NavCard icon={Users}    label="Mitarbeiter"    description="Profile, Kontakte & Daten"        page="Employees"    permission="canViewEmployees" />
                        <NavCard icon={Shield}   label="Berechtigungen" description="Rollen & Zugriffsrechte"          page="PermissionsNew"  permission="canEditEmployeePermissions" />
                        <NavCard icon={Video}    label="Teamsitzung"    description="Meeting-Notizen & Protokolle"     page="TeamMeeting"  permission="canViewTeamMeeting" />
                    </div>
                </div>
            )}
        </div>
    );
}
