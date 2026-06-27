import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Link2, Calendar, Apple, Mail, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { toast } from 'sonner';

const INSTRUCTIONS = [
    { icon: Calendar, name: 'Google Calendar', steps: 'Andere Kalender → Per URL hinzufügen → Link einfügen', color: 'text-blue-400' },
    { icon: Apple, name: 'Apple Calendar', steps: 'Ablage → Kalenderabo → Link einfügen', color: 'text-gray-300' },
    { icon: Mail, name: 'Outlook', steps: 'Kalender hinzufügen → Aus Internet → Link einfügen', color: 'text-cyan-400' },
];

export default function CalendarSubscribeSection() {
    const { data: employee } = useCurrentEmployee();
    const [abonnementLink, setAbonnementLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!employee?.id) return;
        if (employee.calendar_token) {
            setAbonnementLink(`${window.location.origin}/api/functions/my-shifts-calendar?token=${employee.calendar_token}`);
            return;
        }
        // Try to generate a token
        base44.functions.invoke('generateCalendarToken', { employee_id: employee.id })
            .then(res => {
                if (res?.data?.token) {
                    setAbonnementLink(`${window.location.origin}/api/functions/my-shifts-calendar?token=${res.data.token}`);
                }
            })
            .catch(() => {
                // Fallback: employee_id based link
                setAbonnementLink(`${window.location.origin}/api/functions/my-shifts-calendar?employee_id=${employee.id}`);
            });
    }, [employee?.id]);

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
        </Card>
    );
}