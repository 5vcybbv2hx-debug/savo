/**
 * BankAccountSelect — Auswahl des Zielkontos für einen Zahlungseingang.
 *
 * Wird im Rechnungsformular (ExternalBusiness) und im ConsumptionConfirmModal
 * (Angebot → Rechnung) verwendet. Zeigt alle aktiven BankAccounts plus die
 * Option "Wie Firmenprofil" (kein Snapshot → PDF nutzt company.iban).
 *
 * Default-Auswahl: das Konto, dessen IBAN mit company.iban übereinstimmt;
 * sonst das erste aktive Konto; sonst "Wie Firmenprofil".
 */
import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Landmark } from 'lucide-react';

const normIban = (iban) => (iban || '').replace(/\s/g, '');

export function defaultBankAccountId(bankAccounts, company) {
    const active = (bankAccounts || []).filter(a => a.active !== false);
    if (company?.iban) {
        const match = active.find(a => normIban(a.iban) === normIban(company.iban));
        if (match) return match.id;
    }
    return active[0]?.id || '';
}

export function ibanLast4(iban) {
    const n = normIban(iban);
    return n ? `••••${n.slice(-4)}` : '';
}

export default function BankAccountSelect({ value, onChange, bankAccounts, company, label = 'Zahlungseingang auf Konto' }) {
    const activeAccounts = useMemo(
        () => (bankAccounts || []).filter(a => a.active !== false),
        [bankAccounts]
    );

    const selectValue = value || 'company';

    if (activeAccounts.length === 0) {
        return (
            <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5">
                    <Landmark className="w-3 h-3" /> {label}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                    Keine Bankkonten angelegt — das PDF verwendet die IBAN aus dem Firmenprofil.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <Label className="text-[11px] flex items-center gap-1.5">
                <Landmark className="w-3 h-3" /> {label}
            </Label>
            <Select value={selectValue} onValueChange={(v) => onChange(v === 'company' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="company">
                        Wie Firmenprofil{company?.iban ? ` (${ibanLast4(company.iban)})` : ''}
                    </SelectItem>
                    {activeAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                            {a.name} — {a.bank_name} · IBAN {ibanLast4(a.iban) || '—'}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}