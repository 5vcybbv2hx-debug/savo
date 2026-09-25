import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Search } from 'lucide-react';
import { eur } from './format';
import { toast } from 'sonner';

export default function JobDrinksTab({ job }) {
    const qc = useQueryClient();
    const [query, setQuery] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);

    const { data: lines = [] } = useQuery({
        queryKey: ['external-job-lines', job.id],
        queryFn: () => base44.entities.ExternalJobLine.filter({ job_id: job.id }, '-created_date', 500),
        staleTime: STALE.SHORT,
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles-for-job-picker', query],
        queryFn: () => base44.entities.Article.list('name', 50),
        staleTime: STALE.MEDIUM,
        enabled: pickerOpen,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ['external-job-lines', job.id] });

    const addLine = useMutation({
        mutationFn: (article) => base44.entities.ExternalJobLine.create({
            job_id: job.id,
            article_id: article.id,
            article_name: article.name,
            planned_qty: 1,
            unit: article.unit || '',
            price_per_unit: article.price || 0,
            notes: '',
        }),
        onSuccess: () => { invalidate(); setPickerOpen(false); setQuery(''); },
        onError: e => toast.error('Hinzufügen fehlgeschlagen: ' + e.message),
    });

    const updateLine = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ExternalJobLine.update(id, data),
        onSuccess: invalidate,
        onError: e => toast.error('Speichern fehlgeschlagen: ' + e.message),
    });
    const removeLine = useMutation({
        mutationFn: (id) => base44.entities.ExternalJobLine.delete(id),
        onSuccess: invalidate,
    });

    const filtered = articles.filter(a => a.name?.toLowerCase().includes(query.toLowerCase()));
    const total = lines.reduce((s, l) => s + (Number(l.planned_qty) || 0) * (Number(l.price_per_unit) || 0), 0);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>Getränkeplanung</Label>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setPickerOpen(true)}>
                    <Plus className="w-3.5 h-3.5" /> Artikel hinzufügen
                </Button>
            </div>

            {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Noch keine Artikel geplant.</p>
            ) : (
                <div className="space-y-2">
                    {lines.map(l => (
                        <div key={l.id} className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-foreground truncate">{l.article_name}</span>
                                <button onClick={() => removeLine.mutate(l.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <Label className="text-[10px] text-muted-foreground">Menge</Label>
                                    <Input type="number" step="0.01" value={l.planned_qty ?? ''} onChange={e => updateLine.mutate({ id: l.id, data: { planned_qty: Number(e.target.value) || 0 } })} className="h-8 text-sm" />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-muted-foreground">Einheit</Label>
                                    <Input value={l.unit || ''} onChange={e => updateLine.mutate({ id: l.id, data: { unit: e.target.value } })} className="h-8 text-sm" />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-muted-foreground">Preis/Einh.</Label>
                                    <Input type="number" step="0.01" value={l.price_per_unit ?? ''} onChange={e => updateLine.mutate({ id: l.id, data: { price_per_unit: Number(e.target.value) || 0 } })} className="h-8 text-sm" />
                                </div>
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>Zeilensumme</span>
                                <span className="font-semibold text-foreground">{eur((Number(l.planned_qty) || 0) * (Number(l.price_per_unit) || 0))} €</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Geplant gesamt</span>
                <span className="font-bold text-foreground">{eur(total)} €</span>
            </div>

            {pickerOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setPickerOpen(false)}>
                    <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-border">
                            <Label>Artikel suchen</Label>
                            <div className="relative mt-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Artikelname…" className="pl-9" autoFocus />
                            </div>
                        </div>
                        <div className="overflow-y-auto p-2 flex-1">
                            {filtered.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">Keine Artikel gefunden.</p>
                            ) : filtered.map(a => (
                                <button key={a.id} onClick={() => addLine.mutate(a)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent/50 flex items-center gap-3">
                                    <Plus className="w-4 h-4 text-primary shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                                        <p className="text-[11px] text-muted-foreground">{a.category || ''} {a.price ? `· ${eur(a.price)} €` : ''}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}