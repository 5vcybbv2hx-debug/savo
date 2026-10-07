import React from 'react';
import { Check, Clock, RotateCcw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import TaskManager from './TaskManager';
import ReportProblemButton from './ReportProblemButton';
{/* bulk-complete v2 */}

const frequencyLabels = {
    'täglich': 'Täglich',
    'am Wochenende': 'Wochenende',
    'wöchentlich': 'Wöchentlich',
    'alle zwei Wochen': 'Alle 2 Wochen',
    'monatlich': 'Monatlich',
    'an Sonderöffnungstagen': 'Sonderöffnungstage'
};

export default function CleaningList({ tasks, areas, onComplete, onReset, userName }) {
    const groupedTasks = tasks.reduce((acc, task) => {
        const area = task.area || 'Sonstiges';
        if (!acc[area]) acc[area] = [];
        acc[area].push(task);
        return acc;
    }, {});

    // Sortiere Bereiche: "Wochentagsaufgaben" immer zuerst
    const sortedAreas = Object.keys(groupedTasks).sort((a, b) => {
        if (a === 'Wochentagsaufgaben') return -1;
        if (b === 'Wochentagsaufgaben') return 1;
        return a.localeCompare(b);
    });

    const getAreaColor = (areaName) => {
        const area = areas.find(a => a.name === areaName);
        return area?.color || '#64748b';
    };

    return (
        <div className="space-y-4">
            {sortedAreas.map((area) => {
                const areaTasks = groupedTasks[area];
                const completedCount = areaTasks.filter(t => t.is_completed).length;
                const progress = (completedCount / areaTasks.length) * 100;
                
                return (
                    <Card key={area} className="bg-card border-border overflow-hidden">
                         {/* Area Header */}
                         <div 
                             className="px-4 py-3 flex items-center justify-between"
                             style={{ borderLeft: `4px solid ${getAreaColor(area)}` }}
                         >
                             <div className="flex items-center gap-3">
                                 <div 
                                     className="w-2 h-2 rounded-full"
                                     style={{ backgroundColor: getAreaColor(area) }}
                                 />
                                 <h3 className="font-semibold text-foreground text-base">{area}</h3>
                                <Badge 
                                    variant="outline" 
                                    className={cn(
                                        "text-xs",
                                        completedCount === areaTasks.length 
                                            ? "border-emerald-500 text-emerald-500" 
                                            : "border-border/70 text-muted-foreground"
                                    )}
                                >
                                    {completedCount}/{areaTasks.length}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                {areaTasks.filter(t => !t.is_completed).length > 0 && (
                                    <button
                                        onClick={() => {
                                            const openTasks = areaTasks.filter(t => !t.is_completed);
                                            openTasks.forEach(task => onComplete(task));
                                        }}
                                        className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5"
                                        title="Alle offenen Aufgaben dieses Bereichs als erledigt markieren"
                                    >
                                        Alle erledigen
                                    </button>
                                )}
                                <span className="text-xs text-muted-foreground">
                                    {Math.round(progress)}%
                                </span>
                            </div>
                            </div>

                        {/* Progress Bar */}
                        <div className="h-1 bg-border">
                            <div 
                                className="h-full transition-all duration-300"
                                style={{ 
                                    width: `${progress}%`,
                                    backgroundColor: getAreaColor(area)
                                }}
                            />
                        </div>

                        {/* Open Tasks First, Then Completed */}
                         <div className="divide-y divide-border">
                             {/* Open Tasks Section */}
                             {areaTasks
                             .filter(t => !t.is_completed)
                             .map((task) => (
                             <div 
                                 key={task.id}
                                 className="px-4 py-4 bg-card hover:bg-accent/30 transition-colors border-l-2 border-amber-500"
                             >
                                 <div className="flex items-center gap-3">
                                     <button
                                         onClick={() => onComplete(task)}
                                         className={cn(
                                             "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                             "border-amber-500 hover:bg-amber-500/20 hover:border-amber-400"
                                         )}
                                     >
                                     </button>

                                     <div className="flex-1 min-w-0">
                                         <p className="text-sm font-semibold text-foreground">
                                            {task.title}
                                         </p>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                               <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400">
                                                   {frequencyLabels[task.frequency]}
                                               </span>
                                               {task.due_date && (
                                                   <span className="text-[10px] text-amber-500 font-medium">
                                                       📅 {format(new Date(task.due_date), 'dd.MM.yyyy', { locale: de })}
                                                   </span>
                                               )}
                                               {task.due_weekdays && task.due_weekdays.length > 0 && (
                                                   <span className="text-[10px] text-amber-300 font-medium">
                                                       📆 {task.due_weekdays.map(d => d.slice(0,2)).join(', ')}
                                                   </span>
                                               )}
                                            </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                            <ReportProblemButton task={task} userName={userName} />
                                            <TaskManager task={task} areas={areas} />
                                            </div>
                                            </div>
                                            </div>
                                            ))}

                                            {/* Completed Tasks Section */}
                                            {areaTasks
                                            .filter(t => t.is_completed)
                                            .length > 0 && (
                                            <>
                                            <div className="px-4 py-2 bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                            ✓ Erledigt ({areaTasks.filter(t => t.is_completed).length})
                                            </div>
                                            {areaTasks
                                            .filter(t => t.is_completed)
                                            .map((task) => (
                                            <div 
                                            key={task.id}
                                            className="px-4 py-3 bg-card/50 hover:bg-card transition-colors opacity-75"
                                            >
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => onComplete(task)}
                                                    className={cn(
                                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                                        "border-emerald-500 bg-emerald-500"
                                                    )}
                                                >
                                                    <Check className="w-3 h-3 text-foreground" />
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-muted-foreground line-through">
                                                       {task.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                       <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                                           {frequencyLabels[task.frequency]}
                                                       </span>
                                                       {task.completed_by && (
                                                           <Link 
                                                               to={createPageUrl('Employees')}
                                                               className="text-[10px] text-foreground0 hover:text-amber-500 transition-colors flex items-center gap-1"
                                                               onClick={(e) => e.stopPropagation()}
                                                           >
                                                               👤 {task.completed_by.split(' ')[0]}
                                                               {task.completed_at && ` · ${format(new Date(task.completed_at), 'HH:mm')}`}
                                                               <ExternalLink className="w-2 h-2" />
                                                           </Link>
                                                       )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                                                        onClick={() => onReset(task)}
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            </div>
                                            ))}
                                            </>
                                            )}
                        </div>
                    </Card>
                );
            })}
            
            {tasks.length === 0 && (
                 <div className="text-center py-12 text-muted-foreground">
                     <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                     <p>Keine aktiven Aufgaben vorhanden</p>
                 </div>
             )}
        </div>
    );
}