import { useMemo } from 'react';
import { Check, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SwipeRow from '@/components/ui/SwipeRow';
import { isoWeek, todayStr } from '@/lib/cleaningSchedule';

/**
 * Wochentagsaufgaben des Tages: nur die Aufgaben, die heute laut Wochentag
 * und KW-Parität dran sind, gruppiert nach Bereich. Aufgaben derselben
 * Wochentage in der anderen Kalenderwoche stehen darunter als Hinweis
 * "nächste Woche fällig" — sie sind heute nicht offen und nicht überfällig.
 */
export default function WeekdayTasksSection({ tasks = [], nextWeekTasks = [], onComplete, disabled }) {
    const today = todayStr();

    const groups = useMemo(() => {
        const map = {};
        tasks.forEach(task => {
            if (!map[task.area]) map[task.area] = [];
            map[task.area].push(task);
        });
        return Object.keys(map).sort().map(area => ({
            area,
            tasks: map[area].filter(t => !t.is_completed).concat(map[area].filter(t => t.is_completed)),
        }));
    }, [tasks]);

    if (tasks.length === 0 && nextWeekTasks.length === 0) return null;

    const openCount = tasks.filter(t => !t.is_completed).length;

    return (
        <div className="rounded-xl border border-border bg-card/60 p-3 mb-4">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm text-foreground">Wochentagsaufgaben</h3>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        KW {isoWeek(today)}
                    </Badge>
                </div>
                {openCount > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">{openCount} offen</span>
                )}
            </div>

            {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-2">Heute ist keine Wochentagsaufgabe dran.</p>
            ) : (
                <div className="space-y-3">
                    {groups.map(group => (
                        <div key={group.area}>
                            <p className="text-[13.5px] font-medium text-foreground tracking-tight text-muted-foreground px-1 mb-1.5">
                                {group.area} · diese Woche
                            </p>
                            <div className="space-y-2">
                                {group.tasks.map(task => (
                                    <SwipeRow
                                        key={task.id}
                                        onSwipeRight={() => onComplete(task)}
                                        revealColorRight="bg-emerald-600"
                                        revealIconRight={Check}
                                        disabled={disabled}
                                        contentClassName="rounded-xl"
                                    >
                                        <button
                                            onClick={() => onComplete(task)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] text-left ${
                                                task.is_completed
                                                    ? 'bg-muted/50 border-border/50 opacity-60'
                                                    : 'bg-card border-border hover:border-primary/40 shadow-sm'
                                            }`}
                                        >
                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                                task.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-border'
                                            }`}>
                                                {task.is_completed && <Check className="w-4 h-4 text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-medium text-sm leading-tight ${task.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    diese Woche fällig{task.completed_by ? ` · ✓ ${task.completed_by}` : ''}
                                                </p>
                                            </div>
                                        </button>
                                    </SwipeRow>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {nextWeekTasks.length > 0 && (
                <p className="text-[11px] text-muted-foreground px-1 mt-3 pt-2 border-t border-border/60">
                    Nächste Woche fällig: {nextWeekTasks.map(t => t.title).join(', ')}
                </p>
            )}
        </div>
    );
}