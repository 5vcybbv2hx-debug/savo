/**
 * MyShiftsCalendarSync — kompakter Kalender-Sync
 * Lebt im ··· Menü von MyShifts, nicht mehr als eigener Tab.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Copy, Check, RefreshCw, AlertCircle, ExternalLink, Smartphone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const getFunctionUrl = (name) => {
    const appId = appParams.appId;
    return `https://base44.app/api/apps/${appId}/functions/${name}`;
};

export default function MyShiftsCalendarSync({ employeeId, existingToken }) {
    const [calToken, setCalToken] = useState(existingToken || null);
    const [copied,   setCopied]   = useState(false);
    const [loading,  setLoading]  = useState(false);

    const calendarUrl = calToken
        ? `${getFunctionUrl('my-shifts-calendar')}?employee_id=${employeeId}&token=${calToken}`
        : null;
    // webcal:// öffnet direkt die Kalender-App auf iPhone/iPad
    const webcalUrl = calendarUrl
        ? calendarUrl.replace(/^https?:\/\//, 'webcal://')
        : null;

    const generateToken = async () => {
        setLoading(true);
        try {
            const res = await base44.functions.invoke('generateCalendarToken', { employee_id: employeeId });
            setCalToken(res.data.token);
            toast.success('Kalender-Link erstellt');
        } catch (err) {
            toast.error('Fehler: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async () => {
        if (!calendarUrl) return;
        await navigator.clipboard.writeText(calendarUrl);
        setCopied(true);
        toast.success('Link kopiert!');
        setTimeout(() => setCopied(false), 2500);
    };

    // ── Kein Token vorhanden ──────────────────────────────────────────────────
    if (!calToken) {
        return (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">Schichten im Kalender</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Erstelle einen persönlichen Link — deine Schichten, Geburtstage und Teamsitzungen
                        landen automatisch in iPhone, Google oder Outlook.
                    </p>
                </div>
                <Button onClick={generateToken} disabled={loading}
                    className="bg-amber-600 hover:bg-amber-700 text-white">
                    {loading
                        ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Erstelle…</>
                        : <><Calendar className="w-4 h-4 mr-2" />Link erstellen</>
                    }
                </Button>
            </div>
        );
    }

    // ── Token vorhanden ───────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* URL-Box */}
            <div>
                <p className="text-xs text-muted-foreground mb-2">Dein persönlicher Kalender-Link:</p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={calendarUrl}
                        readOnly
                        className="flex-1 px-3 py-2 text-[11px] bg-secondary border border-border rounded-lg text-foreground font-mono truncate"
                    />
                    <Button onClick={copyToClipboard} variant="outline" size="icon" className="shrink-0">
                        {copied
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <Copy className="w-4 h-4" />
                        }
                    </Button>
                </div>
            </div>

            {/* Direkt-Öffnen Button — öffnet Kalender-App sofort */}
            {webcalUrl && (
                <a
                    href={webcalUrl}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
                >
                    <Smartphone className="w-4 h-4" />
                    Kalender direkt abonnieren
                </a>
            )}

            {/* Info-Badge */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                    Link ist <strong className="text-foreground">dauerhaft gültig</strong> — kein erneuter Login nötig.
                    iPhone synchronisiert automatisch alle 15 Minuten.
                </p>
            </div>

            {/* Anleitungen kompakt */}
            <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">So einrichten:</p>

                <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
                    {[
                        {
                            icon: '📱',
                            label: 'iPhone / iPad',
                            steps: ['Einstellungen → Kalender → Accounts', '„Account hinzufügen" → „Andere"', '„Kalender-Abo hinzufügen" → Link einfügen']
                        },
                        {
                            icon: '🌐',
                            label: 'Google Calendar',
                            steps: ['calendar.google.com öffnen', '„+" neben „Weitere Kalender" → „Per URL"', 'Link einfügen → Kalender hinzufügen']
                        },
                        {
                            icon: '📧',
                            label: 'Outlook',
                            steps: ['Kalender öffnen → „Kalender hinzufügen"', '„Aus dem Internet abonnieren"', 'Link einfügen → Importieren']
                        },
                    ].map(({ icon, label, steps }) => (
                        <details key={label} className="group">
                            <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none hover:bg-secondary/30 transition-colors">
                                <span className="text-sm">{icon}</span>
                                <span className="text-xs font-semibold text-foreground flex-1">{label}</span>
                                <span className="text-muted-foreground text-xs group-open:hidden">▸</span>
                                <span className="text-muted-foreground text-xs hidden group-open:block">▾</span>
                            </summary>
                            <ol className="px-4 pb-3 pt-1 space-y-0.5 list-decimal list-inside">
                                {steps.map((step, i) => (
                                    <li key={i} className="text-xs text-muted-foreground">{step}</li>
                                ))}
                            </ol>
                        </details>
                    ))}
                </div>
            </div>

            {/* Neuen Link generieren */}
            <div className="pt-2 border-t border-border space-y-2">
                {calendarUrl?.startsWith('http://') && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-400 font-medium">
                            Dein Link ist veraltet (http://) — bitte neuen Link generieren!
                        </p>
                    </div>
                )}
                <button onClick={generateToken} disabled={loading}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                    <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
                    Neuen Link generieren (invalidiert alten)
                </button>
            </div>
        </div>
    );
}