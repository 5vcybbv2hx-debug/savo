import { useMemo } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SwipeRow from '@/components/ui/SwipeRow';

/**
 * "Offene Aufgaben heute": alle nicht erledigten Aufgaben des Tages,
 * gruppiert nach Bereich — ohne Personenfilter. Wer abgehakt hat, zeigt
 * die Liste "Alle" über completed_by; assigned_to spielt hier keine Rolle.
 */
export default function OpenTasksToday({ tasks = [], onComplete, onBulkComplete, disabled }) {
    const openTasks = tasks.filter(t => !t.is_completed);
    const doneCount = tasks.length - openTasks.length;

    const groups = useMemo(() => {
        const map = {};
        openTasks.forEach(task => {
            if (!map[task.area]) map[task.area] = [];
            map[task.area].push(task);
        });
        return Object.keys(map).sort().map(area => ({
            area,
            tasks: map[area],
            all: tasks.filter(t => t.area === area),
        }));
    }, [openTasks, tasks]);

    if (tasks.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Heute sind keine Aufgaben fällig</p>
            </div>
        );
    }

    if (openTasks.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-status-ok">Alles erledigt — {doneCount} Aufgaben</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-xs text-muted-foreground px-1">
                {openTasks.length} offen · {doneCount} erledigt · gruppiert nach Bereich
            </p>

            {groups.map(group => (
                <div key={group.area}>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-foreground">{group.area}</h3>
                            <Badge variant="outline" className="text-xs border-status-warn/50 text-status-warn">
                                {group.tasks.length} offen
                            </Badge>
                        </div>
                        {onBulkComplete && (
                            <button
                                onClick={() => onBulkComplete(group.all)}
                                className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5"
                            >
                                Alle erledigen
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {group.tasks.map(task => (
                            <SwipeRow
                                key={task.id}
                                onSwipeRight={() => onComplete(task)}
                                revealColorRight="bg-status-ok/70"
                                revealIconRight={Check}
                                disabled={disabled}
                                contentClassName="rounded-xl"
                            >
                                <button
                                    onClick={() => onComplete(task)}
                                    className="w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] text-left bg-card border-border hover:border-primary/40 shadow-sm"
                                >
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-border" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm leading-tight text-foreground">{task.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{task.frequency}</p>
                                    </div>
                                </button>
                            </SwipeRow>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}