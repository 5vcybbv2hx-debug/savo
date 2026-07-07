import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { useMutation } from '@tanstack/react-query';
import { Calendar, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Baut die oeffentliche Funktions-URL IMMER ueber die feste Base44-Plattform-
// Domain + appId — niemals ueber window.location.origin/appBaseUrl-Fallback.
// Grund: wird dieser Link im Editor-Vorschau-Modus generiert, zeigt
// window.location.origin auf die interne "preview--<app>-<id>.base44.app"-
// Domain, die eine aktive Base44-Session verlangt — externe Kalender-Clients
// (iPhone, Google Kalender) koennen sich dort nie authentifizieren
// ("Accountinformationen konnten nicht ueberprueft werden"). Die
// base44.app/api/apps/{appId}/functions/...-Route ist dagegen IMMER
// oeffentlich erreichbar, egal ob der Link aus Preview oder Live-App kommt.
const getFunctionUrl = (functionName) => {
    const appId = appParams.appId;
    return `https://base44.app/api/apps/${appId}/functions/${functionName}`;
};

const STORAGE_KEY = 'calendarSyncDismissed_v1';

export default function CalendarSyncBanner({ employee }) {
    const [dismissed, setDismissed] = useState(false);
    const [token, setToken] = useState(employee?.calendar_token || null);
    const [copied, setCopied] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        if (!employee?.id) return;
        const saved = localStorage.getItem(`${STORAGE_KEY}_${employee.id}`);
        if (saved === 'true') setDismissed(true);
    }, [employee?.id]);

    const calendarUrl = token
        ? `${getFunctionUrl('my-shifts-calendar')}?employee_id=${employee?.id}&token=${token}`
        : null;

    const generateMutation = useMutation({
        mutationFn: () => base44.functions.invoke('generateCalendarToken', { employee_id: employee.id }),
        onSuccess: (res) => {
            setToken(res.data.token);
            toast.success('Kalender-Link erstellt!');
        },
        onError: (err) => toast.error('Fehler: ' + err.message),
    });

    const copyUrl = async () => {
        if (!calendarUrl) return;
        await navigator.clipboard.writeText(calendarUrl);
        setCopied(true);
        toast.success('Link kopiert!');
        setTimeout(() => setCopied(false), 2000);
    };

    const confirm = () => {
        localStorage.setItem(`${STORAGE_KEY}_${employee.id}`, 'true');
        setDismissed(true);
        toast.success('Super! Schichten werden jetzt synchronisiert 📅');
    };

    const dismiss = () => {
        localStorage.setItem(`${STORAGE_KEY}_${employee.id}`, 'true');
        setDismissed(true);
    };

    if (dismissed || !employee) return null;

    return (
        <div className="mx-3 mt-3 md:mx-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-300">📅 Neu: Kalender-Abo für deine Schichten</p>
                        <p className="text-xs text-amber-400/80 mt-0.5">
                            Abonniere deinen persönlichen Schichtkalender — inkl. Geburtstage & Teamsitzungen.
                        </p>
                    </div>
                </div>
                <button onClick={dismiss} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {!token ? (
                <Button
                    size="sm"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white w-full"
                >
                    <Calendar className="w-4 h-4 mr-2" />
                    {generateMutation.isPending ? 'Erstelle Link…' : 'Meinen Kalender-Link erstellen'}
                </Button>
            ) : (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={calendarUrl}
                            readOnly
                            className="flex-1 px-3 py-2 text-xs bg-background border border-border rounded-lg font-mono text-foreground"
                        />
                        <Button size="icon" variant="outline" onClick={copyUrl} className="shrink-0">
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>

                    <div className="text-xs text-amber-400/80 space-y-1">
                        <p className="font-medium text-amber-300">So abonnieren (iPhone):</p>
                        <p>Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → Kalender-Abo hinzufügen → Link einfügen → Speichern</p>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button
                            size="sm"
                            onClick={confirm}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Habe ich abonniert ✓
                        </Button>
                        <Button size="sm" variant="ghost" onClick={dismiss} className="text-muted-foreground text-xs">
                            Später
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}