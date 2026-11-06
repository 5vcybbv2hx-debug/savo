import React, { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Cake, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FrOmvmQFvvBJvqo4CJaBPA';

export default function UpcomingBirthdaysWidget({ employees = [] }) {
    const upcomingBirthdays = useMemo(() => {
        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        return employees
            .filter(emp => emp.birthday)
            .map(emp => {
                const [, month, day] = emp.birthday.split('-');
                const nextBday = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day));
                
                // Vergleich nur auf Tagesbasis — so wird "heute" nicht übersprungen
                if (nextBday < todayMidnight) {
                    nextBday.setFullYear(nextBday.getFullYear() + 1);
                }
                
                const daysUntil = Math.round((nextBday - todayMidnight) / (1000 * 60 * 60 * 24));
                return { 
                    emp, 
                    date: nextBday, 
                    daysUntil,
                    dateString: format(nextBday, 'EEEE, d. MMMM', { locale: de })
                };
            })
            .filter(({ daysUntil }) => daysUntil >= 0 && daysUntil <= 7)
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }, [employees]);

    if (upcomingBirthdays.length === 0) {
        return null;
    }

    const getWhatsAppLink = (phone) => {
        if (!phone) return null;
        return `https://wa.me/${phone}`;
    };

    return (
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/10 border-primary/20">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Cake className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">Geburtstage</h3>
                </div>
                <a 
                    href={WHATSAPP_GROUP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp-Gruppe"
                    className="p-1 hover:bg-status-ok/20 rounded-lg transition-colors"
                >
                    <MessageCircle className="w-4 h-4 text-status-ok" />
                </a>
            </div>
            <div className="space-y-3">
                {upcomingBirthdays.map(({ emp, daysUntil, dateString }) => {
                    const whatsappLink = getWhatsAppLink(emp.phone);
                    return (
                        <div key={emp.id} className="p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-all">
                            <div className="flex items-start gap-3">
                                <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                                    style={{ backgroundColor: emp.color || '#a855f7' }}
                                >
                                    {emp.name?.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                                    <p className="text-xs text-primary font-medium">{dateString}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {daysUntil === 0 ? (
                                        <span className="text-xs px-2 py-1 bg-primary/30 text-primary rounded-full font-bold whitespace-nowrap">Heute! 🎂</span>
                                    ) : (
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
                                            daysUntil === 1 
                                                ? 'bg-status-warn/20 text-status-warn' 
                                                : 'bg-surface text-muted-foreground'
                                        }`}>
                                            in {daysUntil}d
                                        </span>
                                    )}
                                    {whatsappLink && (
                                        <a 
                                            href={whatsappLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`WhatsApp an ${emp.name}`}
                                            className="p-1.5 hover:bg-status-ok/20 rounded-lg transition-colors"
                                        >
                                            <MessageCircle className="w-4 h-4 text-status-ok" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}