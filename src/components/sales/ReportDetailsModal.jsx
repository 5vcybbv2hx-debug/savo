import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, FileText, CreditCard, Banknote, Edit2, Save, X, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ReportDetailsModal({ report, open, onClose }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedPayments, setEditedPayments] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    if (!report) return null;

    const data = report.extracted_data || {};
    const confidenceScore = data.confidence_score || 100;
    const isLowConfidence = confidenceScore < 80;

    const paymentMethods = editedPayments || data.payment_methods || {};

    const handleEdit = () => {
        setEditedPayments({ ...data.payment_methods });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setEditedPayments(null);
        setIsEditing(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedData = {
                ...report.extracted_data,
                payment_methods: editedPayments
            };
            
            const totalRevenue = Object.values(editedPayments).reduce((sum, val) => sum + (val || 0), 0);
            
            await base44.entities.SalesReport.update(report.id, {
                extracted_data: updatedData,
                total_revenue: totalRevenue
            });
            
            setIsEditing(false);
            onClose();
        } catch (error) {
            alert('Fehler beim Speichern: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const updatePayment = (key, value) => {
        setEditedPayments(prev => ({
            ...prev,
            [key]: parseFloat(value) || 0
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-surface border-border">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-status-warn" />
                            {report.report_type} - {new Date(report.report_date).toLocaleDateString('de-DE')}
                        </div>
                        {!isEditing && (
                            <Button
                                onClick={handleEdit}
                                variant="outline"
                                size="sm"
                                className="border-status-warn/70 text-status-warn hover:bg-status-warn/70 hover:text-white"
                            >
                                <Edit2 className="w-4 h-4 mr-2" />
                                Bearbeiten
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: PDF Viewer */}
                    <div className="space-y-4">
                        <Card className="p-4 bg-surface border-border">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-white font-semibold">Original PDF</h3>
                                <Button
                                    onClick={() => window.open(report.file_url, '_blank')}
                                    variant="outline"
                                    size="sm"
                                    className="border-border text-muted-foreground hover:bg-surface"
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    In neuem Tab öffnen
                                </Button>
                            </div>
                            <div className="bg-surface rounded-lg overflow-hidden" style={{ height: '600px' }}>
                                <iframe
                                    src={report.file_url}
                                    className="w-full h-full"
                                    title="PDF Bericht"
                                />
                            </div>
                        </Card>
                    </div>

                    {/* Right: Analysis */}
                    <div className="space-y-6">
                    {/* Confidence Score */}
                    <Card className="p-4 bg-surface border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {isLowConfidence ? (
                                    <AlertCircle className="w-5 h-5 text-status-warn" />
                                ) : (
                                    <CheckCircle2 className="w-5 h-5 text-status-ok" />
                                )}
                                <span className="text-white font-medium">Datenqualität</span>
                            </div>
                            <Badge className={isLowConfidence ? 'bg-status-warn/15 text-status-warn' : 'bg-status-ok/15 text-status-ok'}>
                                {confidenceScore}% Genauigkeit
                            </Badge>
                        </div>
                        {isLowConfidence && (
                            <p className="text-sm text-status-warn/25 mt-2">
                                ⚠️ Niedrige Erkennungsgenauigkeit - bitte manuell überprüfen
                            </p>
                        )}
                    </Card>

                    {/* Summary */}
                    <Card className="p-4 bg-surface border-border">
                        <h3 className="text-white font-semibold mb-3">Zusammenfassung</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Gesamtumsatz</p>
                                <p className="text-lg font-bold text-white">
                                    {(data.total_revenue || report.total_revenue || 0).toFixed(2)} €
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Transaktionen</p>
                                <p className="text-lg font-bold text-white">
                                    {data.total_transactions || report.total_transactions || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Ø Bonwert</p>
                                <p className="text-lg font-bold text-white">
                                    {report.average_transaction?.toFixed(2) || 0} €
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Datum</p>
                                <p className="text-lg font-bold text-white">
                                    {data.date || new Date(report.report_date).toLocaleDateString('de-DE')}
                                </p>
                            </div>
                        </div>
                    </Card>

                        {/* Payment Methods */}
                        {data.payment_methods && (
                            <Card className="p-4 bg-surface border-border">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white font-semibold flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-status-warn" />
                                        Zahlungsarten
                                    </h3>
                                    {isEditing && (
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                size="sm"
                                                className="bg-status-ok/70 hover:bg-status-ok/70"
                                            >
                                                <Save className="w-4 h-4 mr-1" />
                                                Speichern
                                            </Button>
                                            <Button
                                                onClick={handleCancel}
                                                size="sm"
                                                variant="outline"
                                                className="border-border"
                                            >
                                                <X className="w-4 h-4 mr-1" />
                                                Abbrechen
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {/* Bargeld */}
                                    <div className="p-3 rounded-lg bg-surface border border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Banknote className="w-4 h-4 text-status-ok" />
                                            <span className="text-sm text-muted-foreground">Bargeld</span>
                                        </div>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={paymentMethods.cash || 0}
                                                onChange={(e) => updatePayment('cash', e.target.value)}
                                                className="bg-surface border-border text-white"
                                            />
                                        ) : (
                                            <p className="text-lg font-bold text-white">
                                                {(paymentMethods.cash || 0).toFixed(2)} €
                                            </p>
                                        )}
                                    </div>

                                    {/* EC-Karte */}
                                    <div className="p-3 rounded-lg bg-surface border border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CreditCard className="w-4 h-4 text-primary" />
                                            <span className="text-sm text-muted-foreground">EC-Karte</span>
                                        </div>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={paymentMethods.ec || 0}
                                                onChange={(e) => updatePayment('ec', e.target.value)}
                                                className="bg-surface border-border text-white"
                                            />
                                        ) : (
                                            <p className="text-lg font-bold text-white">
                                                {(paymentMethods.ec || 0).toFixed(2)} €
                                            </p>
                                        )}
                                    </div>

                                    {/* Gutschein */}
                                    <div className="p-3 rounded-lg bg-surface border border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="w-4 h-4 text-status-warn" />
                                            <span className="text-sm text-muted-foreground">Gutschein</span>
                                        </div>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={paymentMethods.voucher || 0}
                                                onChange={(e) => updatePayment('voucher', e.target.value)}
                                                className="bg-surface border-border text-white"
                                            />
                                        ) : (
                                            <p className="text-lg font-bold text-white">
                                                {(paymentMethods.voucher || 0).toFixed(2)} €
                                            </p>
                                        )}
                                    </div>

                                    {/* Sonstiges */}
                                    <div className="p-3 rounded-lg bg-surface border border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm text-muted-foreground">Sonstiges</span>
                                        </div>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={paymentMethods.other || 0}
                                                onChange={(e) => updatePayment('other', e.target.value)}
                                                className="bg-surface border-border text-white"
                                            />
                                        ) : (
                                            <p className="text-lg font-bold text-white">
                                                {(paymentMethods.other || 0).toFixed(2)} €
                                            </p>
                                        )}
                                    </div>

                                    {/* Summe */}
                                    <div className="p-3 rounded-lg bg-status-warn/20 border border-status-warn/30">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-status-warn">Gesamt</span>
                                            <p className="text-lg font-bold text-white">
                                                {Object.values(paymentMethods).reduce((sum, val) => sum + (val || 0), 0).toFixed(2)} €
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        )}

                    {/* Items */}
                    {data.items && data.items.length > 0 && (
                        <Card className="p-4 bg-surface border-border">
                            <h3 className="text-white font-semibold mb-3">Verkaufte Artikel</h3>
                            <div className="space-y-2">
                                {data.items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border"
                                    >
                                        <div>
                                            <p className="text-white font-medium">{item.name}</p>
                                            {item.category && (
                                                <p className="text-xs text-muted-foreground">{item.category}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-medium">{item.revenue?.toFixed(2)} €</p>
                                            <p className="text-xs text-muted-foreground">{item.quantity}x</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                        {/* Raw Data (für Debugging) */}
                        <Card className="p-4 bg-surface border-border">
                            <h3 className="text-white font-semibold mb-3">Rohdaten (JSON)</h3>
                            <pre className="text-xs text-muted-foreground bg-surface p-3 rounded overflow-x-auto max-h-40">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        </Card>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}