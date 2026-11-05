import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Building2, Upload, Plus, ArrowDownCircle, ArrowUpCircle,
    CheckCircle2, CircleDot, Minus, Search, Trash2, RefreshCw, FileText, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import MonthNavigator from '@/components/accounting/MonthNavigator';

const fmt = (n) => n?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0,00';

// ── CSV Parser — supports common German bank formats ─────────────────────────
function parseCSV(text, bankAccountId, bankAccountName) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Try to detect delimiter
    const delimiters = [';', ',', '\t'];
    const firstLine = lines[0];
    const delimiter = delimiters.find(d => firstLine.split(d).length > 3) || ';';

    const parseRow = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
            else { current += ch; }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseRow(lines[0]).map(h => h.replace(/"/g, '').toLowerCase().trim());

    // Column mapping — covers Sparkasse, Volksbank, DKB, N26, Commerzbank
    const colMap = {
        booking_date: ['buchungstag', 'buchungsdatum', 'datum', 'date', 'valutadatum', 'buchung'],
        value_date: ['valutadatum', 'wertstellung', 'wertstellungsdatum', 'value date'],
        counterpart_name: ['auftraggeber/beguenstigter', 'auftraggeber / begünstigter', 'beguenstigter/auftraggeber', 'name', 'empfaenger', 'empfänger', 'zahlungspflichtiger', 'kontoinhaber'],
        counterpart_iban: ['kontonummer/iban', 'iban', 'kontonummer', 'konto'],
        reference: ['verwendungszweck', 'buchungstext', 'betreff', 'reference', 'description', 'grund'],
        amount: ['betrag', 'umsatz', 'amount', 'summe', 'wert'],
        transaction_type: ['buchungsart', 'transaktionsart', 'art', 'type'],
    };

    const findCol = (key) => {
        for (const alias of colMap[key] || []) {
            const idx = headers.findIndex(h => h.includes(alias));
            if (idx >= 0) return idx;
        }
        return -1;
    };

    const cols = {};
    for (const key of Object.keys(colMap)) cols[key] = findCol(key);

    const parseAmount = (str) => {
        if (!str) return 0;
        const cleaned = str.replace(/"/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-+]/g, '');
        return parseFloat(cleaned) || 0;
    };

    const parseDate = (str) => {
        if (!str) return '';
        const s = str.replace(/"/g, '').trim();
        // DD.MM.YYYY
        const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        return s;
    };

    const transactions = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        if (row.length < 2) continue;

        const amount = cols.amount >= 0 ? parseAmount(row[cols.amount]) : 0;
        if (amount === 0 && cols.amount >= 0) continue;

        const bookingDate = cols.booking_date >= 0 ? parseDate(row[cols.booking_date]) : '';
        if (!bookingDate) continue;

        transactions.push({
            bank_account_id: bankAccountId,
            bank_account_name: bankAccountName,
            booking_date: bookingDate,
            value_date: cols.value_date >= 0 ? parseDate(row[cols.value_date]) : bookingDate,
            amount,
            counterpart_name: cols.counterpart_name >= 0 ? row[cols.counterpart_name]?.replace(/"/g, '').trim() : '',
            counterpart_iban: cols.counterpart_iban >= 0 ? row[cols.counterpart_iban]?.replace(/"/g, '').trim() : '',
            reference: cols.reference >= 0 ? row[cols.reference]?.replace(/"/g, '').trim() : '',
            transaction_type: amount > 0 ? 'Eingang' : 'Ausgang',
            match_status: 'unmatched',
        });
    }
    return transactions;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AccountCard({ account, selected, onClick }) {
    return (
        <Card
            onClick={onClick}
            className={cn(
                'p-4 cursor-pointer transition-all',
                selected ? 'border-blue-500/50 bg-blue-500/5' : 'border-border hover:border-border/80'
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="font-semibold text-sm text-foreground">{account.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{account.bank_name}</p>
                    {account.iban && <p className="text-xs text-muted-foreground font-mono mt-0.5">{account.iban}</p>}
                </div>
                <div className="text-right">
                    {account.current_balance != null && (
                        <p className={cn('text-base font-bold', account.current_balance >= 0 ? 'text-green-400' : 'text-red-400')}>
                            {fmt(account.current_balance)} €
                        </p>
                    )}
                    {account.balance_date && (
                        <p className="text-[10px] text-muted-foreground">Stand: {account.balance_date}</p>
                    )}
                </div>
            </div>
        </Card>
    );
}

function TransactionRow({ tx, onMatchToggle }) {
    const isIncoming = tx.amount > 0;
    const matchColor = tx.match_status === 'matched' ? 'text-green-400' : tx.match_status === 'ignored' ? 'text-muted-foreground' : 'text-amber-400';
    const MatchIcon = tx.match_status === 'matched' ? CheckCircle2 : tx.match_status === 'ignored' ? Minus : CircleDot;

    return (
        <div className={cn(
            'flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-accent/30 transition-colors',
            tx.match_status === 'ignored' && 'opacity-50'
        )}>
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', isIncoming ? 'bg-green-500/15' : 'bg-red-500/15')}>
                {isIncoming
                    ? <ArrowDownCircle className="w-4 h-4 text-green-400" />
                    : <ArrowUpCircle className="w-4 h-4 text-red-400" />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{tx.counterpart_name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{tx.reference || tx.transaction_type}</p>
                <p className="text-xs text-muted-foreground">{tx.booking_date}</p>
            </div>
            <div className="text-right shrink-0">
                <p className={cn('text-sm font-bold', isIncoming ? 'text-green-400' : 'text-red-400')}>
                    {isIncoming ? '+' : ''}{fmt(tx.amount)} €
                </p>
                <button onClick={() => onMatchToggle(tx)} className={cn('text-xs flex items-center gap-1 justify-end mt-0.5', matchColor)}>
                    <MatchIcon className="w-3 h-3" />
                    {tx.match_status === 'matched' ? 'Zugeordnet' : tx.match_status === 'ignored' ? 'Ignoriert' : 'Offen'}
                </button>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountingBank() {
    const queryClient = useQueryClient();
    const csvRef = useRef();
    const [selectedAccountId, setSelectedAccountId] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [search, setSearch] = useState('');
    const [matchFilter, setMatchFilter] = useState('alle');
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importPreview, setImportPreview] = useState(null); // {rows, fileName}
    const [accountForm, setAccountForm] = useState({
        name: '', bank_name: '', iban: '', bic: '', account_type: 'Girokonto',
        current_balance: '', balance_date: format(new Date(), 'yyyy-MM-dd'), notes: '', active: true
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: () => base44.entities.BankAccount.list('name')
    });

    const { data: transactions = [] } = useQuery({
        queryKey: ['bank-transactions', selectedAccountId],
        queryFn: () => selectedAccountId
            ? base44.entities.BankTransaction.filter({ bank_account_id: selectedAccountId }, '-booking_date')
            : base44.entities.BankTransaction.list('-booking_date'),
    });

    const createAccount = useMutation({
        mutationFn: (d) => base44.entities.BankAccount.create(d),
        onSuccess: (acc) => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            setShowAddAccount(false);
            setSelectedAccountId(acc.id);
            setAccountForm({ name: '', bank_name: '', iban: '', bic: '', account_type: 'Girokonto', current_balance: '', balance_date: format(new Date(), 'yyyy-MM-dd'), notes: '', active: true });
        }
    });

    const bulkCreateTransactions = useMutation({
        mutationFn: (rows) => base44.entities.BankTransaction.bulkCreate(rows),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
            setImportPreview(null);
        }
    });

    const updateTransaction = useMutation({
        mutationFn: ({ id, data }) => base44.entities.BankTransaction.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-transactions'] })
    });

    const handleCSVFile = (file) => {
        if (!file) return;
        const account = accounts.find(a => a.id === selectedAccountId);
        if (!account) { alert('Bitte zuerst ein Konto auswählen.'); return; }
        setImporting(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const rows = parseCSV(text, account.id, account.name);
            setImportPreview({ rows, fileName: file.name });
            setImporting(false);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    const handleMatchToggle = (tx) => {
        const next = tx.match_status === 'unmatched' ? 'ignored' : tx.match_status === 'ignored' ? 'matched' : 'unmatched';
        updateTransaction.mutate({ id: tx.id, data: { match_status: next } });
    };

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    const filtered = transactions.filter(tx => {
        const matchMonth = tx.booking_date?.startsWith(selectedMonth);
        const matchSearch = !search ||
            tx.counterpart_name?.toLowerCase().includes(search.toLowerCase()) ||
            tx.reference?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = matchFilter === 'alle' || tx.match_status === matchFilter;
        return matchMonth && matchSearch && matchStatus;
    });

    const totalIn = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = filtered.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    const unmatchedCount = filtered.filter(t => t.match_status === 'unmatched').length;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-6">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-400" />
                        <h1 className="page-title">Bankkonten</h1>
                        {unmatchedCount > 0 && (
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-xs">{unmatchedCount} offen</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <MonthNavigator value={selectedMonth} onChange={setSelectedMonth} />
                        <Button size="sm" variant="outline" onClick={() => setShowAddAccount(true)} className="gap-1">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-6 max-w-3xl mx-auto pt-4 space-y-4">

                {/* Konten-Auswahl */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {accounts.map(acc => (
                        <AccountCard
                            key={acc.id}
                            account={acc}
                            selected={selectedAccountId === acc.id}
                            onClick={() => setSelectedAccountId(acc.id === selectedAccountId ? null : acc.id)}
                        />
                    ))}
                    {accounts.length === 0 && (
                        <Card className="p-8 text-center text-muted-foreground col-span-2 border-dashed border-border">
                            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">Noch keine Bankkonten</p>
                            <Button onClick={() => setShowAddAccount(true)} size="sm" className="mt-3 bg-blue-500 hover:bg-blue-600 text-primary-foreground">
                                <Plus className="w-4 h-4 mr-1" /> Konto hinzufügen
                            </Button>
                        </Card>
                    )}
                </div>

                {/* CSV Import */}
                {selectedAccount && (
                    <Card className="p-4 border-dashed border-blue-500/30 bg-blue-500/5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-foreground">Kontoauszug importieren</p>
                                <p className="text-xs text-muted-foreground mt-0.5">CSV-Export aus deinem Online-Banking (Sparkasse, Volksbank, DKB, N26 …)</p>
                            </div>
                            <label className="cursor-pointer">
                                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-primary-foreground gap-1.5 pointer-events-none">
                                    {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    CSV hochladen
                                </Button>
                                <input ref={csvRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => handleCSVFile(e.target.files?.[0])} />
                            </label>
                        </div>
                    </Card>
                )}

                {/* Import Preview */}
                {importPreview && (
                    <Card className="border-border overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                            <div>
                                <p className="font-semibold text-sm text-foreground">Import-Vorschau: {importPreview.fileName}</p>
                                <p className="text-xs text-muted-foreground">{importPreview.rows.length} Buchungen erkannt</p>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setImportPreview(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                                <Button size="sm" className="bg-green-500 hover:bg-green-600 text-primary-foreground gap-1"
                                    onClick={() => bulkCreateTransactions.mutate(importPreview.rows)}
                                    disabled={bulkCreateTransactions.isPending}>
                                    {bulkCreateTransactions.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    {bulkCreateTransactions.isPending ? 'Importiere…' : `${importPreview.rows.length} importieren`}
                                </Button>
                            </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                            {importPreview.rows.slice(0, 20).map((row, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2">
                                    <span className={cn('text-xs w-20 shrink-0', row.amount > 0 ? 'text-green-400' : 'text-red-400')}>
                                        {row.amount > 0 ? '+' : ''}{fmt(row.amount)} €
                                    </span>
                                    <span className="text-xs text-muted-foreground w-24 shrink-0">{row.booking_date}</span>
                                    <span className="text-xs text-foreground truncate">{row.counterpart_name || row.reference}</span>
                                </div>
                            ))}
                            {importPreview.rows.length > 20 && (
                                <p className="text-xs text-center text-muted-foreground py-2">… und {importPreview.rows.length - 20} weitere</p>
                            )}
                        </div>
                    </Card>
                )}

                {/* Buchungen */}
                {transactions.length > 0 && (
                    <>
                        {/* KPIs */}
                        <div className="grid grid-cols-3 gap-3">
                            <Card className="p-3 border-border">
                                <p className="text-xs text-muted-foreground">Eingänge</p>
                                <p className="text-base font-bold text-green-400 mt-0.5">{fmt(totalIn)} €</p>
                            </Card>
                            <Card className="p-3 border-border">
                                <p className="text-xs text-muted-foreground">Ausgänge</p>
                                <p className="text-base font-bold text-red-400 mt-0.5">{fmt(Math.abs(totalOut))} €</p>
                            </Card>
                            <Card className="p-3 border-border">
                                <p className="text-xs text-muted-foreground">Saldo</p>
                                <p className={cn('text-base font-bold mt-0.5', (totalIn + totalOut) >= 0 ? 'text-green-400' : 'text-red-400')}>
                                    {fmt(totalIn + totalOut)} €
                                </p>
                            </Card>
                        </div>

                        {/* Filter & Suche */}
                        <div className="flex flex-col gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input placeholder="Empfänger, Verwendungszweck…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                            </div>
                            <div className="flex gap-2">
                                {[['alle', 'Alle'], ['unmatched', 'Offen'], ['matched', 'Zugeordnet'], ['ignored', 'Ignoriert']].map(([val, label]) => (
                                    <button key={val} onClick={() => setMatchFilter(val)}
                                        className={cn('px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                                            matchFilter === val ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:bg-accent'
                                        )}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Buchungsliste */}
                        <Card className="border-border overflow-hidden">
                            {filtered.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Keine Buchungen gefunden</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/30">
                                    {filtered.map(tx => (
                                        <TransactionRow key={tx.id} tx={tx} onMatchToggle={handleMatchToggle} />
                                    ))}
                                </div>
                            )}
                        </Card>
                    </>
                )}
            </div>

            {/* Konto hinzufügen Modal */}
            {showAddAccount && (
                <div className="fixed inset-0 z-50 flex flex-col bg-background">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-400" />
                            <span className="font-bold text-foreground">Bankkonto hinzufügen</span>
                        </div>
                        <button onClick={() => setShowAddAccount(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-lg mx-auto w-full">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Bezeichnung *</Label>
                            <Input value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="z.B. Geschäftskonto" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Kreditinstitut *</Label>
                            <Input value={accountForm.bank_name} onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })} placeholder="z.B. Sparkasse Berlin" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Kontoart</Label>
                            <Select value={accountForm.account_type} onValueChange={v => setAccountForm({ ...accountForm, account_type: v })}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['Girokonto','Sparkonto','Tagesgeld','Kreditkarte','Sonstiges'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">IBAN</Label>
                            <Input value={accountForm.iban} onChange={e => setAccountForm({ ...accountForm, iban: e.target.value })} placeholder="DE12 3456 7890 …" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">BIC</Label>
                            <Input value={accountForm.bic} onChange={e => setAccountForm({ ...accountForm, bic: e.target.value })} placeholder="XXXXDEXX" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Aktueller Kontostand (€)</Label>
                                <Input type="number" step="0.01" value={accountForm.current_balance} onChange={e => setAccountForm({ ...accountForm, current_balance: e.target.value })} placeholder="0,00" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Stand-Datum</Label>
                                <Input type="date" value={accountForm.balance_date} onChange={e => setAccountForm({ ...accountForm, balance_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Notizen</Label>
                            <Textarea value={accountForm.notes} onChange={e => setAccountForm({ ...accountForm, notes: e.target.value })} rows={2} />
                        </div>
                    </div>
                    <div className="px-4 py-3 border-t border-border bg-card flex gap-3 max-w-lg mx-auto w-full">
                        <Button variant="outline" onClick={() => setShowAddAccount(false)} className="flex-1">Abbrechen</Button>
                        <Button
                            onClick={() => createAccount.mutate({ ...accountForm, current_balance: parseFloat(accountForm.current_balance) || null })}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-primary-foreground"
                            disabled={!accountForm.name || !accountForm.bank_name || createAccount.isPending}
                        >
                            {createAccount.isPending ? 'Speichern…' : 'Konto speichern'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}