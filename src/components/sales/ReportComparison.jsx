import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, CreditCard, Minus } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function ReportComparison({ reports, open, onClose }) {
    if (!reports || reports.length === 0) return null;

    // Sortiere Berichte nach Datum
    const sortedReports = [...reports].sort((a, b) => new Date(a.report_date) - new Date(b.report_date));

    // Berechne Vergleichsdaten
    const comparisonData = sortedReports.map(report => ({
        date: format(new Date(report.report_date), 'dd.MM.yyyy', { locale: de }),
        shortDate: format(new Date(report.report_date), 'dd.MM', { locale: de }),
        umsatz: report.total_revenue || 0,
        transaktionen: report.total_transactions || 0,
        durchschnitt: report.average_transaction || 0,
        bar: report.extracted_data?.payment_methods?.cash || 0,
        ec: report.extracted_data?.payment_methods?.ec || 0,
        gutschein: report.extracted_data?.payment_methods?.voucher || 0,
        sonstige: report.extracted_data?.payment_methods?.other || 0
    }));

    // Berechne Durchschnittswerte
    const avgRevenue = comparisonData.reduce((sum, d) => sum + d.umsatz, 0) / comparisonData.length;
    const avgTransactions = comparisonData.reduce((sum, d) => sum + d.transaktionen, 0) / comparisonData.length;

    // Finde höchsten und niedrigsten Wert
    const maxRevenue = Math.max(...comparisonData.map(d => d.umsatz));
    const minRevenue = Math.min(...comparisonData.map(d => d.umsatz));
    const maxDay = comparisonData.find(d => d.umsatz === maxRevenue);
    const minDay = comparisonData.find(d => d.umsatz === minRevenue);

    const getTrendIcon = (value, avg) => {
        if (value > avg * 1.05) return <TrendingUp className="w-4 h-4 text-status-ok" />;
        if (value < avg * 0.95) return <TrendingDown className="w-4 h-4 text-status-danger" />;
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">
                        Berichtsvergleich ({sortedReports.length} Berichte)
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {comparisonData[0]?.date} - {comparisonData[comparisonData.length - 1]?.date}
                    </p>
                </DialogHeader>

                {/* Zusammenfassung */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Ø Umsatz</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{avgRevenue.toFixed(2)} €</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Max: {maxRevenue.toFixed(2)} € ({maxDay?.shortDate})
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Ø Transaktionen</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{avgTransactions.toFixed(0)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Gesamt: {comparisonData.reduce((s, d) => s + d.transaktionen, 0)}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Gesamtumsatz</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {comparisonData.reduce((s, d) => s + d.umsatz, 0).toFixed(2)} €
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Spanne: {(maxRevenue - minRevenue).toFixed(2)} €
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Umsatz-Verlauf */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-status-warn" />
                            Umsatz-Verlauf
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="shortDate" />
                                <YAxis />
                                <Tooltip 
                                    formatter={(value) => `${value.toFixed(2)} €`}
                                    labelFormatter={(label) => `Datum: ${label}`}
                                />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="umsatz" 
                                    stroke="#f59e0b" 
                                    strokeWidth={2}
                                    name="Umsatz"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Zahlungsarten-Vergleich */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-status-warn" />
                            Zahlungsarten im Vergleich
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="shortDate" />
                                <YAxis />
                                <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                                <Legend />
                                <Bar dataKey="bar" fill="#10b981" name="Bar" />
                                <Bar dataKey="ec" fill="#3b82f6" name="EC-Karte" />
                                <Bar dataKey="gutschein" fill="#f59e0b" name="Gutschein" />
                                <Bar dataKey="sonstige" fill="#6366f1" name="Sonstige" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Detail-Tabelle */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-status-warn" />
                            Detailvergleich
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-3">Datum</th>
                                        <th className="text-right py-2 px-3">Umsatz</th>
                                        <th className="text-center py-2 px-3">Trend</th>
                                        <th className="text-right py-2 px-3">Transaktionen</th>
                                        <th className="text-right py-2 px-3">Ø Bon</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonData.map((day, idx) => (
                                        <tr key={idx} className="border-b hover:bg-card">
                                            <td className="py-2 px-3 font-medium">{day.date}</td>
                                            <td className="py-2 px-3 text-right">
                                                {day.umsatz.toFixed(2)} €
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                {getTrendIcon(day.umsatz, avgRevenue)}
                                            </td>
                                            <td className="py-2 px-3 text-right">{day.transaktionen}</td>
                                            <td className="py-2 px-3 text-right">
                                                {day.durchschnitt.toFixed(2)} €
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    );
}