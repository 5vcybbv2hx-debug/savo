import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReportProblemButton({ task, userName }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('mittel');

    const createTodoMutation = useMutation({
        mutationFn: (data) => base44.entities.TodoItem.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['todos']);
            setOpen(false);
            setDescription('');
            setPriority('mittel');
            alert('Problem als Aufgabe gemeldet!');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const todoData = {
            title: `Problem: ${task.title} (${task.area})`,
            description: description,
            priority: priority,
            category: 'Reparatur',
            status: 'offen',
            assigned_to: userName
        };

        createTodoMutation.mutate(todoData);
    };

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className="text-status-warn hover:text-status-warn hover:bg-status-warn/15"
            >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Problem melden
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-status-warn" />
                            Problem melden
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="p-3 bg-secondary/50 rounded-lg border border-border">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">Bereich: {task.area}</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Problembeschreibung</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Was ist kaputt oder muss repariert werden?"
                                rows={4}
                                required
                                className="resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Priorität</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="niedrig">Niedrig</SelectItem>
                                    <SelectItem value="mittel">Mittel</SelectItem>
                                    <SelectItem value="hoch">Hoch</SelectItem>
                                    <SelectItem value="dringend">Dringend</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-primary/15 border border-primary/25 rounded-lg p-3">
                            <p className="text-xs text-primary">
                                💡 Das Problem wird automatisch als Aufgabe in der Todo-Liste angelegt (Kategorie: Reparatur)
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setOpen(false)} 
                                className="flex-1"
                                disabled={createTodoMutation.isPending}
                            >
                                Abbrechen
                            </Button>
                            <Button 
                                type="submit" 
                                className="flex-1 bg-status-warn/70 hover:bg-status-warn/70"
                                disabled={createTodoMutation.isPending}
                            >
                                {createTodoMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Melde...
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        Problem melden
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}