import { useState } from 'react';
import { Search, Calendar, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReservationCard from './ReservationCard';

const STATUS_FILTERS = [
    { value: 'alle', label: 'Alle' },
    { value: 'bestätigt', label: 'Bestätigt' },
    { value: 'vorgemerkt', label: 'Vorgemerkt' },
    { value: 'storniert', label: 'Storniert' },
];

export default function GuestHubReservationsTab({
    active, archived, resTab, setResTab,
    statusFilter, setStatusFilter,
    searchTerm, setSearchTerm,
    permissions, tables, resLoading,
    onEdit, onArchive, onDelete, onConfirm, onCancel, onAddReservation
}) {
    const displayed = resTab === 'aktiv' ? active : archived;

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="Name oder Telefon..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10" />
            </div>

            <div className="flex rounded-xl bg-secondary/50 p-1 gap-1 border border-border">
                {[{ key: 'aktiv', label: 'Aktiv', count: active.length }, { key: 'archiv', label: 'Archiv', count: archived.length }].map(({ key, label, count }) => (
                    <button key={key} onClick={() => setResTab(key)}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                            resTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                        {label}
                        <span className={cn('inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full text-xs px-1.5', resTab === key ? 'bg-status-warn/70 text-muted-foreground font-bold' : 'bg-muted text-muted-foreground')}>{count}</span>
                    </button>
                ))}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
                {STATUS_FILTERS.map(f => (
                    <button key={f.value} onClick={() => setStatusFilter(f.value)}
                        className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                            statusFilter === f.value ? 'bg-status-warn/70 border-status-warn/70 text-muted-foreground' : 'border-border text-muted-foreground hover:border-foreground')}>
                        {f.label}
                    </button>
                ))}
            </div>

            {resLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-secondary/40 animate-pulse" />)}</div>
            ) : displayed.length > 0 ? (
                <div className="space-y-2.5">
                    {displayed.map(res => (
                        <ReservationCard key={res.id} reservation={res} permissions={permissions}
                            onEdit={onEdit}
                            onArchive={onArchive} onDelete={onDelete}
                            onConfirm={onConfirm} onCancel={onCancel} tables={tables} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <Calendar className="w-12 h-12 opacity-30" />
                    <p className="text-sm">Keine Einträge</p>
                    {resTab === 'aktiv' && !searchTerm && statusFilter === 'alle' && permissions.canEditReservations && (
                        <Button size="sm" onClick={onAddReservation}
                            className="bg-status-warn/70 hover:bg-status-warn/70 text-muted-foreground">
                            <Plus className="w-4 h-4 mr-1.5" />Erste Reservierung
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}