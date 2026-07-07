import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Check, Link2, Calendar, Apple, Mail, ShieldAlert, MessageSquare, ExternalLink, Loader2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { usePermissions } from '@/components/auth/usePermissions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Baut die oeffentliche Funktions-URL IMMER ueber die feste Base44-Plattform-
// Domain + appId — niemals ueber window.location.origin. Grund: wird dieser
// Link im Editor-Vorschau-Modus generiert (z.B. wenn ein Manager die Seite
// dort testet), zeigt window.location.origin auf die interne
// "preview--<app>-<id>.base44.app"-Domain. Die verlangt eine aktive
// Base44-Session — ein iPhone/Google-Kalender kann sich dort nie
// authentifizieren ("Accountinformationen konnten nicht ueberprueft werden").
// Die base44.app/api/apps/{appId}/functions/...-Route ist dagegen IMMER
// oeffentlich erreichbar, egal ob der Link aus Preview oder Live-App kommt.
function getCalendarFunctionUrl(queryString) {
    return `https://base44.app/api/apps/${appParams.appId}/functions/my-shifts-calendar?${queryString}`;
}

const INSTRUCTIONS = [
    { icon: Calendar, name: 'Google Calendar', steps: 'Andere Kalender → Per URL hinzufügen → Link einfügen', color: 'text-blue-400' },
    { icon: Apple, name: 'Apple Calendar', steps: 'Ablage → Kalenderabo → Link einfügen', color: 'text-gray-300' },
    { icon: Mail, name: 'Outlook', steps: 'Kalender hinzufügen → Aus Internet → Link einfügen', color: 'text-cyan-400' },
];

export default function CalendarSubscribeSection() {
    const { data: employee } = useCurrentEmployee();
    const permissions = usePermissions();
    const [abonnementLink, setAbonnementLink] = useState('');
    const [copied, setCopied] = useState(false);

    // Team-Benachrichtigung
    const [teamModalOpen, setTeamModalOpen] = useState(false);
    const [teamEmployees, setTeamEmployees] = useState([]);
    const [preparing, setPreparing] = useState(false);
    const [notified, setNotified] = useState(
        localStorage.getItem('calendarOnboardingSent') === 'true'
    );

    useEffect(() => {
        if (!employee?.id) return;
        if (employee.calendar_token) {
            setAbonnementLink(getCalendarFunctionUrl(`token=${employee.calendar_token}`));
            return;
        }
        // Try to generate a token
        base44.functions.invoke('generateCalendarToken', { employee_id: employee.id })
            .then(res => {
                if (res?.data?.token) {
                    setAbonnementLink(getCalendarFunctionUrl(`token=${res.data.token}`));
                }
            })
            .catch(() => {
                // Fallback: employee_id based link
                setAbonnementLink(getCalendarFunctionUrl(`employee_id=${employee.id}`));
            });
    }, [employee?.id]);

    const buildWhatsAppMessage = (empName, calUrl) => {
        const firstName = empName.split(' ')[0];
        return `Hallo ${firstName} 👋

Kleines Update zum Schicht-Kalender 📅 Falls du schon einen Kalender-Link eingerichtet hast: bitte den ALTEN einmal löschen und danach den NEUEN unten abonnieren – so bleibt alles sauber und aktuell.

*1️⃣ Alten Kalender löschen (falls vorhanden):*
📱 iPhone: Einstellungen → Kalender → Accounts → alten Eintrag antippen → „Account löschen"
💻 Google Calendar: calendar.google.com → Zahnrad → Einstellungen → „Kalender abonnieren" links → alten Eintrag entfernen (Mülleimer-Symbol)

*2️⃣ Neuen Kalender abonnieren:*
📱 iPhone: Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen → diesen Link einfügen:

${calUrl}

💻 Google Calendar: calendar.google.com → „Weitere Kalender" (+) → Per URL → Link einfügen

Einmal neu einrichten, danach läuft alles automatisch – deine Schichten aktualisieren sich von selbst (kann ein paar Stunden dauern, bis dein Handy sie zieht). Bei Fragen einfach melden! 🙌`;
    };

    const handlePrepareTeamNotification = async () => {
        setPreparing(true);
        try {
            const employees = await base44.entities.Employee.filter({ is_active: true });
            const withPhone = employees.filter(e => e.phone && !e.is_system_account);

            const prepared = [];
            for (const emp of withPhone) {
                let token = emp.calendar_token;
                if (!token) {
                    try {
                        const res = await base44.functions.invoke('generateCalendarToken', { employee_id: emp.id });
                        token = res?.data?.token;
                    } catch { /* fallback below */ }
                }
                const calUrl = token
                    ? getCalendarFunctionUrl(`token=${token}`)
                    : getCalendarFunctionUrl(`employee_id=${emp.id}&token=${token || ''}`);
                const message = buildWhatsAppMessage(emp.name, calUrl);
                const phone = emp.phone.replace(/\D/g, '');
                prepared.push({
                    id: emp.id,
                    name: emp.name,
                    phone: emp.phone,
                    color: emp.color,
                    waLink: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
                });
            }

            if (prepared.length === 0) {
                toast.error('Keine Mitarbeiter mit Telefonnummer gefunden');
                return;
            }

            setTeamEmployees(prepared);
            setTeamModalOpen(true);
            toast.success(`${prepared.length} Mitarbeiter vorbereitet`);
        } catch (err) {
            toast.error('Fehler: ' + (err?.message || 'Unbekannt'));
        } finally {
            setPreparing(false);
        }
    };

    const handleCopy = async () => {
        if (!abonnementLink) return;
        try {
            await navigator.clipboard.writeText(abonnementLink);
            setCopied(true);
            toast.success('Link kopiert!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const el = document.createElement('textarea');
            el.value = abonnementLink;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            toast.success('Link kopiert!');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-semibold text-foreground mb-1">Kalender abonnieren</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Persönlicher iCal-Abo-Link, der sich automatisch aktualisiert.
            </p>

            <div className="flex gap-2 mb-4">
                <Input
                    readOnly
                    value={abonnementLink || 'Link wird geladen…'}
                    className="font-mono text-xs"
                    onClick={(e) => e.target.select()}
                />
                <Button
                    onClick={handleCopy}
                    disabled={!abonnementLink}
                    className="shrink-0"
                >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? 'Kopiert' : 'Kopieren'}
                </Button>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
                {INSTRUCTIONS.map((app) => (
                    <div
                        key={app.name}
                        className="flex-1 min-w-[200px] p-3 rounded-xl bg-secondary/40 border border-border/50"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <app.icon className={`w-4 h-4 ${app.color}`} />
                            <span className="text-sm font-bold text-foreground">{app.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">{app.steps}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    Der Link ist personalisiert und zeigt nur deine eigenen Schichten. Teile ihn nicht mit anderen.
                </p>
            </div>

            {/* Einmalige Team-Benachrichtigung — nur für Manager/Admin */}
            {(permissions.isManager || permissions.isAdmin) && (
                <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-1">
                        Team benachrichtigen
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                        Schicke allen Mitarbeitern einmalig eine WhatsApp-Anleitung
                        zum Kalender-Abo.
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePrepareTeamNotification}
                        disabled={notified || preparing}
                        className="w-full gap-2 min-h-[44px]"
                    >
                        {preparing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Bereite vor…</>
                        ) : notified ? (
                            <><Check className="w-4 h-4" />Benachrichtigung vorbereitet</>
                        ) : (
                            <><MessageSquare className="w-4 h-4" />Team per WhatsApp informieren</>
                        )}
                    </Button>
                </div>
            )}

            {/* Team-Benachrichtigung Dialog */}
            <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-green-400" />
                            WhatsApp an Team ({teamEmployees.length})
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground -mt-1 mb-2">
                        Tippe auf einen Mitarbeiter, um WhatsApp mit der fertigen Nachricht zu öffnen.
                    </p>
                    <div className="space-y-2">
                        {teamEmployees.map(emp => (
                            <div key={emp.id}
                                className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                    style={{ backgroundColor: emp.color || '#64748b' }}>
                                    {emp.name?.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{emp.phone}</p>
                                </div>
                                <a
                                    href={emp.waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-xs font-medium hover:bg-green-500/25 transition-all min-h-[44px] flex items-center"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Senden
                                </a>
                            </div>
                        ))}
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            localStorage.setItem('calendarOnboardingSent', 'true');
                            setNotified(true);
                            setTeamModalOpen(false);
                            toast.success('Alle Links geöffnet — als erledigt markiert');
                        }}
                        className="w-full mt-2 min-h-[44px]"
                    >
                        <Check className="w-4 h-4 mr-1.5" />Als erledigt markieren
                    </Button>
                </DialogContent>
            </Dialog>
        </Card>
    );
}