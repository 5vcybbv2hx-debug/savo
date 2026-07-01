import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { CheckCircle2, Circle, ClipboardList, Loader2, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function CleaningChecklist() {
    const params = new URLSearchParams(window.location.search);
    const area = params.get('area') || '';

    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW
    });

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['cleaning-tasks-area', area],
        queryFn: () => base44.entities.CleaningTask.filter({ area, is_active: true }, 'title'),
        enabled: !!area,
        staleTime: STALE.MEDIUM
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            // Per QR-Code an der Putzstation aufgerufen -> oft Keller/Lager mit
            // schlechtem Empfang. Abhaken darf dabei nicht ins Leere laufen.
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'CleaningTask', type: 'update', id, data });
                return { id, data, offline: true };
            }
            try {
                await base44.entities.CleaningTask.update(id, data);
                return { id, data, offline: false };
            } catch (err) {
                await queueMutation({ entityName: 'CleaningTask', type: 'update', id, data });
                return { id, data, offline: true };
            }
        },
        onSuccess: ({ id, data, offline }) => {
            if (offline) {
                queryClient.setQueryData(['cleaning-tasks-area', area], (old = []) =>
                    old.map(t => t.id === id ? { ...t, ...data } : t)
                );
            } else {
                queryClient.invalidateQueries({ queryKey: ['cleaning-tasks-area', area] });
            }
        }
    });

    useEffect(() => {
        const handleOnline = () => {
            syncMutations(base44)
                .then(() => queryClient.invalidateQueries({ queryKey: ['cleaning-tasks-area', area] }))
                .catch(console.error);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [queryClient, area]);

    const activeTasks = tasks.filter(t => !t.is_completed);
    const doneTasks = tasks.filter(t => t.is_completed);
    const allDone = tasks.length > 0 && activeTasks.length === 0;

    const toggleTask = (task) => {
        const nowDone = !task.is_completed;
        updateMutation.mutate({
            id: task.id,
            data: {
                is_completed: nowDone,
                completed_by: nowDone ? (currentUser?.full_name || currentUser?.email || 'Unbekannt') : null,
                completed_at: nowDone ? new Date().toISOString() : null,
                last_reset: nowDone ? new Date().toISOString().split('T')[0] : task.last_reset
            }
        });
    };

    const markAllDone = () => {
        Promise.all(activeTasks.map(task => toggleTask(task)));
    };

    if (!area) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="text-center text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">Kein Bereich angegeben</p>
                    <p className="text-sm mt-1">Bitte QR-Code neu scannen</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className={cn(
                'sticky top-0 z-10 border-b border-border/50 backdrop-blur-xl px-4 py-4',
                allDone ? 'bg-green-500/10' : 'bg-card/95'
            )}>
                <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-bold text-foreground">{area}</h1>
                        <p className="text-sm text-muted-foreground">
                            {isLoading ? 'Lade...' : `${doneTasks.length} / ${tasks.length} erledigt`}
                        </p>
                    </div>
                    {allDone ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border gap-1">
                            <CheckCheck className="w-3.5 h-3.5" />
                            Fertig!
                        </Badge>
                    ) : activeTasks.length > 0 && (
                        <Button
                            size="sm"
                            onClick={markAllDone}
                            className="bg-amber-600 hover:bg-amber-700 gap-1"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Alle erledigt
                        </Button>
                    )}
                </div>

                {/* Progress bar */}
                {tasks.length > 0 && (
                    <div className="max-w-lg mx-auto mt-3">
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={cn('h-full rounded-full transition-all duration-500', allDone ? 'bg-green-500' : 'bg-amber-500')}
                                style={{ width: `${(doneTasks.length / tasks.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
                {isLoading && (
                    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Aufgaben laden...</span>
                    </div>
                )}

                {!isLoading && tasks.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Keine Aufgaben für diesen Bereich</p>
                    </div>
                )}

                {/* Active tasks */}
                {activeTasks.map(task => (
                    <button
                        key={task.id}
                        onClick={() => toggleTask(task)}
                        disabled={updateMutation.isPending}
                        className="w-full flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:border-amber-500/40 active:scale-[0.98] transition-all text-left"
                    >
                        <Circle className="w-6 h-6 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p className="font-medium text-foreground">{task.title}</p>
                            {task.assigned_to_name && (
                                <p className="text-xs text-muted-foreground mt-0.5">→ {task.assigned_to_name}</p>
                            )}
                            <Badge variant="outline" className="text-xs mt-1">{task.frequency}</Badge>
                        </div>
                    </button>
                ))}

                {/* Done tasks */}
                {doneTasks.length > 0 && (
                    <div className="mt-6 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                            Erledigt ({doneTasks.length})
                        </p>
                        {doneTasks.map(task => (
                            <button
                                key={task.id}
                                onClick={() => toggleTask(task)}
                                disabled={updateMutation.isPending}
                                className="w-full flex items-start gap-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20 hover:border-green-500/40 active:scale-[0.98] transition-all text-left opacity-70"
                            >
                                <CheckCircle2 className="w-6 h-6 text-green-500 mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="font-medium text-foreground line-through">{task.title}</p>
                                    {task.completed_by && (
                                        <p className="text-xs text-muted-foreground mt-0.5 no-underline">
                                            ✓ {task.completed_by}
                                            {task.completed_at && ` · ${new Date(task.completed_at).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}`}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}