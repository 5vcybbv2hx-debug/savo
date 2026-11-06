import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

const DAYS = [
    { key: 'mo', label: 'Montag' },
    { key: 'di', label: 'Dienstag' },
    { key: 'mi', label: 'Mittwoch' },
    { key: 'do', label: 'Donnerstag' },
    { key: 'fr', label: 'Freitag' },
    { key: 'sa', label: 'Samstag' },
    { key: 'so', label: 'Sonntag' },
];

const DEFAULT_HOURS = { open: false, from: '18:00', to: '01:00' };

function parseHours(value) {
    if (!value) return Object.fromEntries(DAYS.map(d => [d.key, { ...DEFAULT_HOURS }]));
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (typeof parsed === 'object' && parsed !== null && 'mo' in parsed) {
            return parsed;
        }
    } catch (_) {}
    // Freitext vorhanden → ignorieren, leer starten
    return Object.fromEntries(DAYS.map(d => [d.key, { ...DEFAULT_HOURS }]));
}

export default function OpeningHoursEditor({ value, onChange }) {
    const hours = parseHours(value);

    const update = (dayKey, field, val) => {
        const updated = { ...hours, [dayKey]: { ...hours[dayKey], [field]: val } };
        onChange(JSON.stringify(updated));
    };

    return (
        <div className="space-y-2">
            {DAYS.map(({ key, label }) => {
                const day = hours[key] || { ...DEFAULT_HOURS };
                return (
                    <div key={key} className="flex items-center gap-3">
                        <span className="w-24 text-sm text-foreground/75 shrink-0">{label}</span>
                        <Switch
                            checked={!!day.open}
                            onCheckedChange={(v) => update(key, 'open', v)}
                        />
                        {day.open ? (
                            <div className="flex items-center gap-2 flex-1">
                                <Input
                                    type="time"
                                    value={day.from}
                                    onChange={(e) => update(key, 'from', e.target.value)}
                                    className="bg-background border-border/70 text-foreground w-32"
                                />
                                <span className="text-muted-foreground text-sm">–</span>
                                <Input
                                    type="time"
                                    value={day.to}
                                    onChange={(e) => update(key, 'to', e.target.value)}
                                    className="bg-background border-border/70 text-foreground w-32"
                                />
                            </div>
                        ) : (
                            <span className="text-sm text-muted-foreground italic">Geschlossen</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}