import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { DollarSign, CreditCard, Banknote, Receipt, ShoppingBag, Users, Gift, FileText, Pencil, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function DayDetailModal({ open, onOpenChange, revenue, tipDistribution, laborCost, staffCount }) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});

    useEffect(() => {
        if (revenue) {
            setForm({
                revenue: revenue.revenue ?? '',
                revenue_cash: revenue.revenue_cash ?? '',
                revenue_ec: revenue.revenue_ec ?? '',
                vat: revenue.vat ?? '',
                own_consumption: revenue.own_consumption ?? '',
                notes: revenue.notes ?? '',
            });
        }
        setEditing(false);
    }, [revenue]);

    const updateMutation = useMutation({
        mutationFn: async () => {
            // We need to find the actual DailyRevenue record by date
            const records = await base44.entities.DailyRevenue.filter({ date: revenue.date });
            if (!records[0]) throw new Error('Datensatz nicht gefunden');
            await base44.entities.DailyRevenue.update(records[0].id, {
                revenue: parseFloat(form.revenue) || 0,
                revenue_cash: form.revenue_cash !== '' ? parseFloat(form.revenue_cash) : null,
                revenue_ec: form.revenue_ec !== '' ? parseFloat(form.revenue_ec) : null,
                vat: form.vat !== '' ? parseFloat(form.vat) : null,
                own_consumption: form.own_consumption !== '' ? parseFloat(form.own_consumption) : null,
                notes: form.notes || null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-revenues'] });
            setEditing(false);
        }
    });

    if (!revenue) return null;

    const date = parseISO(revenue.date);

    const rows = [
        { label: 'Gesamtumsatz', key: 'revenue', value: revenue.revenue, color: 'text-status-ok', icon: DollarSign, required: true },
        { label: 'Umsatz Bar', key: 'revenue_cash', value: revenue.revenue_cash, color: 'text-status-warn', icon: Banknote },
        { label: 'Umsatz EC', key: 'revenue_ec', value: revenue.revenue_ec, color: 'text-primary', icon: CreditCard },
        { label: 'Umsatzsteuer', key: 'vat', value: revenue.vat, color: 'text-muted-foreground', icon: Receipt },
        { label: 'Eigenbedarf', key: 'own_consumption', value: revenue.own_consumption, color: 'text-status-warn', icon: ShoppingBag },
    ];

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) setEditing(false); onOpenChange(v); }}>
            <DialogContent className="bg-background border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-foreground text-xl">
                            {format(date, 'EEEE, dd. MMMM yyyy', { locale: de })}
                        </DialogTitle>
                        {!editing ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(true)}
                                className="border-border/70 text-foreground/75 hover:text-foreground"
                            >
                                <Pencil className="w-3.5 h-3.5 mr-1" /> Bearbeiten
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditing(false)}
                                    className="border-border/70 text-foreground/75"
                                    disabled={updateMutation.isPending}
                                >
                                    <X className="w-3.5 h-3.5 mr-1" /> Abbrechen
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => updateMutation.mutate()}
                                    className="bg-status-warn/70 hover:bg-status-warn/70"
                                    disabled={updateMutation.isPending}
                                >
                                    <Check className="w-3.5 h-3.5 mr-1" /> {updateMutation.isPending ? 'Speichern...' : 'Speichern'}
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Linke Spalte: Daten */}
                    <div className="space-y-4">
                        {/* Umsatzdaten */}
                        <div className="bg-card rounded-xl p-4 space-y-3">
                            <h3 className="text-[13.5px] font-medium text-muted-foreground tracking-tight flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Z-Abschlag
                            </h3>
                            {rows.map(({ label, key, value, color, icon: Icon, required }) => (
                                editing ? (
                                    <div key={key} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-foreground/75 text-sm w-32 shrink-0">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                            {label}
                                        </div>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder={required ? 'Pflichtfeld' : 'optional'}
                                            value={form[key]}
                                            onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                                            className="bg-secondary border-border/70 text-foreground text-right h-8 text-sm"
                                        />
                                        <span className="text-muted-foreground text-sm">€</span>
                                    </div>
                                ) : (
                                    <div key={key} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-foreground/75 text-sm">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                            {label}
                                        </div>
                                        {value != null ? (
                                            <span className={`font-semibold ${color}`}>{value.toFixed(2)} €</span>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">–</span>
                                        )}
                                    </div>
                                )
                            ))}

                            {/* Notizen */}
                            {editing ? (
                                <div>
                                    <Label className="text-xs text-muted-foreground">Notizen</Label>
                                    <Input
                                        type="text"
                                        placeholder="Notizen"
                                        value={form.notes}
                                        onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                        className="bg-secondary border-border/70 text-foreground h-8 text-sm mt-1"
                                    />
                                </div>
                            ) : revenue.notes ? (
                                <div className="pt-2 border-t border-border">
                                    <p className="text-xs text-muted-foreground mb-1">Notizen</p>
                                    <p className="text-foreground/75 text-sm">{revenue.notes}</p>
                                </div>
                            ) : null}
                        </div>

                        {/* Personalkosten */}
                        <div className="bg-card rounded-xl p-4 space-y-2">
                            <h3 className="text-[13.5px] font-medium text-muted-foreground tracking-tight flex items-center gap-2">
                                <Users className="w-4 h-4" /> Personal
                            </h3>
                            <div className="flex justify-between">
                                <span className="text-foreground/75 text-sm">Personalkosten</span>
                                <span className="text-status-warn font-semibold">{laborCost.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-foreground/75 text-sm">Mitarbeiter</span>
                                <span className="text-foreground/75 font-semibold">{staffCount}</span>
                            </div>
                            {revenue.revenue > 0 && laborCost > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-foreground/75 text-sm">Personalkostenquote</span>
                                    <Badge className="bg-status-warn/40 text-status-warn border-status-warn/70">
                                        {((laborCost / revenue.revenue) * 100).toFixed(1)} %
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {/* Trinkgeld */}
                        {tipDistribution && (
                            <div className="bg-card rounded-xl p-4 space-y-2">
                                <h3 className="text-[13.5px] font-medium text-muted-foreground tracking-tight flex items-center gap-2">
                                    <Gift className="w-4 h-4" /> Trinkgeld
                                </h3>
                                <div className="flex justify-between">
                                    <span className="text-foreground/75 text-sm">Gesamt</span>
                                    <span className="text-primary font-semibold">{tipDistribution.total_tips.toFixed(2)} €</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-foreground/75 text-sm">Pro Person</span>
                                    <span className="text-primary font-semibold">{tipDistribution.tip_per_person.toFixed(2)} €</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-foreground/75 text-sm">Quote</span>
                                    <span className="text-muted-foreground text-sm">{tipDistribution.tip_percentage} %</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rechte Spalte: PDF Vorschau */}
                    <div className="flex flex-col">
                        <h3 className="text-[13.5px] font-medium text-muted-foreground tracking-tight mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Z-Abschlag PDF
                        </h3>
                        {revenue.pdf_url ? (
                            <div className="flex-1 bg-card rounded-xl overflow-hidden" style={{ minHeight: '400px' }}>
                                <iframe
                                    src={revenue.pdf_url}
                                    className="w-full h-full rounded-xl"
                                    style={{ minHeight: '400px' }}
                                    title="Z-Abschlag PDF"
                                />
                            </div>
                        ) : (
                            <div className="flex-1 bg-card rounded-xl flex flex-col items-center justify-center text-muted-foreground min-h-[200px]">
                                <FileText className="w-12 h-12 mb-3 opacity-30" />
                                <p className="text-sm">Kein PDF hochgeladen</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}