import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function TipCalculator({ open, onOpenChange, date, revenue, staffCount, timeEntries, onSuccess }) {
    const [tipPercentage, setTipPercentage] = useState('10');

    const calculation = useMemo(() => {
        const tipAmount = (revenue * (parseFloat(tipPercentage) || 0)) / 100;
        const perPerson = staffCount > 0 ? tipAmount / staffCount : 0;
        
        return {
            totalTips: tipAmount,
            tipPerPerson: perPerson,
            staffCount
        };
    }, [revenue, tipPercentage, staffCount]);

    const mutation = useMutation({
        mutationFn: async () => {
            const distributionDetails = timeEntries.map(te => ({
                employee_id: te.employee_id,
                employee_name: te.employee_name,
                tip_amount: calculation.tipPerPerson
            }));

            await base44.entities.TipDistribution.create({
                date,
                total_revenue: revenue,
                tip_percentage: parseFloat(tipPercentage),
                total_tips: calculation.totalTips,
                employee_count: staffCount,
                tip_per_person: calculation.tipPerPerson,
                distribution_details: distributionDetails
            });
        },
        onSuccess: () => {
            onOpenChange(false);
            onSuccess?.();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Trinkgeld berechnen</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="percentage" className="text-foreground/75">Trinkgeldprozentsatz (%)</Label>
                        <Input 
                            id="percentage"
                            type="number" 
                            step="0.1"
                            min="0"
                            max="100"
                            value={tipPercentage}
                            onChange={(e) => setTipPercentage(e.target.value)}
                            className="bg-secondary border-border/70 text-foreground mt-1"
                        />
                    </div>

                    <Alert className="bg-primary/20 border-primary">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        <AlertDescription className="text-primary">
                            <div className="font-semibold mb-2">Berechnung:</div>
                            <div className="text-sm space-y-1">
                                <p>Umsatz: {revenue.toFixed(2)} €</p>
                                <p>{tipPercentage}% Trinkgeld: <span className="font-bold">{calculation.totalTips.toFixed(2)} €</span></p>
                                <p>Mitarbeiter: {staffCount}</p>
                                <p className="border-t border-primary pt-1 mt-1">
                                    Pro Person: <span className="font-bold text-lg">{calculation.tipPerPerson.toFixed(2)} €</span>
                                </p>
                            </div>
                        </AlertDescription>
                    </Alert>

                    <div className="flex gap-2 pt-4">
                        <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                        >
                            Abbrechen
                        </Button>
                        <Button 
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex-1 bg-primary hover:bg-primary"
                        >
                            {mutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}