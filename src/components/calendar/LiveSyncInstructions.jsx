import React, { useState, useEffect } from 'react';
import { Calendar, Copy, Check, ExternalLink, Info, KeyRound, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { appParams } from '@/lib/app-params';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function LiveSyncInstructions() {
    const [copied, setCopied] = useState(false);
    const [generating, setGenerating] = useState(false);
    const queryClient = useQueryClient();

    // CompanyInfo laden (geteilter Cache mit Layout/Branding)
    const { data: company } = useQuery({
        queryKey: ['company-info'],
        queryFn: () => base44.entities.CompanyInfo.list().then(r => r?.[0] || null),
        staleTime: 60_000,
    });

    const feedToken = company?.calendar_feed_token;

    // Token generieren falls noch keines vorhanden ist
    const generateToken = async () => {
        setGenerating(true);
        try {
            const tokenBytes = new Uint8Array(24);
            crypto.getRandomValues(tokenBytes);
            const token = btoa(String.fromCharCode(...tokenBytes))
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

            if (company?.id) {
                await base44.entities.CompanyInfo.update(company.id, { calendar_feed_token: token });
            } else {
                await base44.entities.CompanyInfo.create({
                    company_name: 'Mein Betrieb',
                    calendar_feed_token: token,
                });
            }
            await queryClient.invalidateQueries({ queryKey: ['company-info'] });
            toast.success('Token generiert!');
        } catch (err) {
            toast.error('Fehler beim Generieren des Tokens');
        } finally {
            setGenerating(false);
        }
    };

    // Korrekte kanonische URL — funktioniert in Preview und auf der echten App
    const appId = appParams.appId;
    const base = (appParams.appBaseUrl || '').replace(/\/$/, '');
    const origin = base || window.location.origin;
    const calendarUrl = feedToken
        ? `${origin}/api/apps/${appId}/functions/calendar-feed?token=${feedToken}`
        : '';

    const copyUrl = () => {
        navigator.clipboard.writeText(calendarUrl);
        setCopied(true);
        toast.success('URL kopiert!');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    Live-Synchronisation
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Kalender Live-Synchronisation
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Automatische Synchronisation</p>
                            <p>Alle Schichten, Reservierungen und Geburtstage werden automatisch in deinen Kalender synchronisiert. Änderungen werden innerhalb von 1 Stunde aktualisiert.</p>
                        </div>
                    </div>

                    {/* Token-Schutz: Kalender-URL nur mit gültigem Token */}
                    {!feedToken ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                            <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-amber-800 mb-1">Zugriffstoken erforderlich</p>
                                <p className="text-sm text-amber-700 mb-3">
                                    Der Kalender-Feed ist durch ein persönliches Token geschützt, damit nur berechtigte Personen Zugriff auf Schicht- und Personaldaten haben.
                                </p>
                                <Button onClick={generateToken} disabled={generating} size="sm" className="gap-2">
                                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                    Token generieren
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Kalender-URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={calendarUrl}
                                    readOnly
                                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-muted-foreground"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={copyUrl}
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <button
                                onClick={generateToken}
                                disabled={generating}
                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                            >
                                <KeyRound className="w-3 h-3" />
                                {generating ? 'Generiere...' : 'Token neu generieren (alte URL wird ungültig)'}
                            </button>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-800">Anleitung</h3>
                        
                        {/* Google Calendar */}
                        <Card className="p-4 border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
                                    <span className="text-foreground font-bold text-sm">G</span>
                                </div>
                                <h4 className="font-semibold text-slate-800">Google Kalender</h4>
                            </div>
                            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                <li>Öffne <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Google Kalender <ExternalLink className="w-3 h-3" /></a></li>
                                <li>Klicke auf das <strong>+</strong> neben "Andere Kalender"</li>
                                <li>Wähle <strong>"Per URL hinzufügen"</strong></li>
                                <li>Füge die obige URL ein und klicke auf "Kalender hinzufügen"</li>
                            </ol>
                        </Card>

                        {/* Apple Calendar */}
                        <Card className="p-4 border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded bg-card flex items-center justify-center">
                                    <span className="text-foreground font-bold text-sm"></span>
                                </div>
                                <h4 className="font-semibold text-slate-800">Apple Kalender</h4>
                            </div>
                            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                <li>Öffne die <strong>Kalender App</strong> auf Mac/iPhone</li>
                                <li>Gehe zu <strong>Ablage → Neues Kalenderabonnement</strong> (Mac) oder <strong>Einstellungen → Accounts → Account hinzufügen</strong> (iPhone)</li>
                                <li>Füge die obige URL ein</li>
                                <li>Klicke auf "Abonnieren" und bestätige</li>
                            </ol>
                        </Card>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-slate-800 mb-2">Was wird synchronisiert?</p>
                        <ul className="space-y-1 list-disc list-inside">
                            <li><strong>Schichten:</strong> Alle geplanten Mitarbeiter-Schichten</li>
                            <li><strong>Reservierungen:</strong> Alle bestätigten und vorgemerkten Reservierungen</li>
                            <li><strong>Urlaub:</strong> Alle genehmigte Urlaubsanträge</li>
                            <li><strong>Feiertage:</strong> Gesetzliche Feiertage Baden-Württemberg</li>
                            <li><strong>Geburtstage:</strong> Geburtstage aller Mitarbeiter (jährlich wiederkehrend)</li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}