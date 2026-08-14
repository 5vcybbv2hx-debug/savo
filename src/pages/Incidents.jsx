import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { STALE } from '@/lib/queryUtils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Siren, Flame, AlertTriangle, Pill, HardHat, ShieldAlert, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const TYPE_META = {
    medizinisch:    { label: 'Medizinisch',    icon: Siren,        color: 'text-red-400 bg-red-500/10' },
    gewalt:         { label: 'Gewalt',         icon: ShieldAlert,  color: 'text-red-400 bg-red-500/10' },
    feuer:          { label: 'Feuer',          icon: Flame,        color: 'text-orange-400 bg-orange-500/10' },
    ueberfall:      { label: 'Überfall',       icon: AlertTriangle,color: 'text-orange-400 bg-orange-500/10' },
    diebstahl:      { label: 'Diebstahl',      icon: AlertTriangle,color: 'text-orange-400 bg-orange-500/10' },
    drogen:         { label: 'Drogen',         icon: Pill,         color: 'text-yellow-400 bg-yellow-500/10' },
    arbeitsunfall:  { label: 'Arbeitsunfall',  icon: HardHat,      color: 'text-yellow-400 bg-yellow-500/10' },
};

const STATUS_BADGE = {
    aktiv:        'bg-red-500/15 text-red-400 border-red-500/30',
    dokumentiert: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    abgeschlossen:'bg-green-500/15 text-green-400 border-green-500/30',
    archiviert:   'bg-muted text-muted-foreground border-border',
};

const FILTERS = [
    { key: 'all',         label: 'Alle' },
    { key: 'aktiv',       label: 'Aktiv' },
    { key: 'abgeschlossen', label: 'Abgeschlossen' },
    { key: 'training',   label: 'Schulung' },
];

export default function Incidents() {
    const permissions = usePermissions();
    const [filter, setFilter] = useState('all');

    const { data: incidents = [], isLoading } = useQuery({
        queryKey: ['incidents'],
        queryFn: () => base44.entities.Incident.list('-incident_time', 200),
        staleTime: STALE.MEDIUM,
        enabled: permissions.isManager,
    });

    const filtered = useMemo(() => {
        if (filter === 'all') return incidents;
        if (filter === 'training') return incidents.filter(i => i.is_training);
        return incidents.filter(i => i.status === filter);
    }, [incidents, filter]);

    if (permissions.isLoading) {
        return <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl animate-shimmer bg-muted" />)}
        </div>;
    }
    if (!permissions.isManager) return <PermissionDenied />;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
                <div className="flex items-center gap-3">
                    <Link to="/" className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Vorfälle</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">{incidents.length} insgesamt</p>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {FILTERS.map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                filter === f.key
                                    ? 'bg-amber-600 border-amber-600 text-white'
                                    : 'border-border text-muted-foreground hover:text-foreground'
                            )}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl animate-shimmer bg-muted" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Vorfälle</p>
                        <p className="text-sm mt-1">Noch keine Vorfälle in diesem Filter.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(inc => {
                            const meta = TYPE_META[inc.type] || TYPE_META.medizinisch;
                            const Icon = meta.icon;
                            return (
                                <Link key={inc.id} to={`/incidents/${inc.id}`}
                                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all min-h-[64px]">
                                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', meta.color)}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-foreground truncate">{meta.label}</p>
                                            {inc.is_training && (
                                                <span className="text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 font-bold shrink-0">TRAINING</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {inc.what || 'Keine Beschreibung'} · {inc.who || '—'}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                            {inc.incident_time ? format(parseISO(inc.incident_time), 'dd.MM.yyyy HH:mm', { locale: de }) : '—'}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className={cn('text-[10px] shrink-0', STATUS_BADGE[inc.status] || STATUS_BADGE.aktiv)}>
                                        {inc.status}
                                    </Badge>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}