import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, MessageCircle } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export default function TeamMeetingReminder() {
    const { data: scheduleList = [] } = useQuery({
        queryKey: ['team-meeting-schedule'],
        queryFn: async () => {
            const items = await base44.entities.TeamMeetingSchedule.list('-created_date');
            return items;
        }
    });

    const currentSchedule = scheduleList[0] || null;

    if (!currentSchedule) return null;

    const meetingDate = parseISO(currentSchedule.date);
    const today = new Date();
    const daysUntilMeeting = differenceInDays(meetingDate, today);

    // Zeige Erinnerung nur 7 Tage vor der Teamsitzung
    if (daysUntilMeeting < 0 || daysUntilMeeting > 7) {
        return null;
    }

    const formattedDate = format(meetingDate, 'EEEE, dd.MM.yyyy', { locale: de });
    const whatsappMessage = `📅 Teamsitzung am ${formattedDate} um ${currentSchedule.time} Uhr${currentSchedule.location ? ` im ${currentSchedule.location}` : ''}\n\nBitte gebt Bescheid, ob ihr dabei seid! ✓`;

    const handleWhatsAppShare = () => {
        const encodedMessage = encodeURIComponent(whatsappMessage);
        // Diese URL öffnet WhatsApp mit der vorausgefüllten Nachricht
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    };

    const getReminderColor = () => {
        if (daysUntilMeeting === 0) return 'bg-status-danger/30 border-status-danger/70';
        if (daysUntilMeeting <= 2) return 'bg-status-warn/30 border-status-warn/70';
        return 'bg-status-warn/30 border-status-warn/70';
    };

    const getReminderTextColor = () => {
        if (daysUntilMeeting === 0) return 'text-status-danger/25';
        if (daysUntilMeeting <= 2) return 'text-status-warn/25';
        return 'text-status-warn/25';
    };

    return (
        <Card className={`${getReminderColor()} border p-4 mb-6`}>
            <div className="flex items-start gap-4">
                <AlertCircle className={`w-6 h-6 ${getReminderTextColor()} shrink-0 mt-0.5`} />
                <div className="flex-1">
                    <h3 className={`font-semibold ${getReminderTextColor()} mb-2`}>
                        {daysUntilMeeting === 0 
                            ? '🚀 Teamsitzung heute!' 
                            : `📢 Teamsitzung in ${daysUntilMeeting} ${daysUntilMeeting === 1 ? 'Tag' : 'Tagen'}`}
                    </h3>
                    <p className={`text-sm ${getReminderTextColor()} mb-3`}>
                        {formattedDate} um {currentSchedule.time} Uhr
                        {currentSchedule.location && ` im ${currentSchedule.location}`}
                    </p>
                    
                    <div className="bg-surface rounded-lg p-3 mb-3">
                        <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                            {whatsappMessage}
                        </p>
                    </div>

                    <Button
                        onClick={handleWhatsAppShare}
                        className="bg-status-ok/70 hover:bg-status-ok/70 text-white gap-2"
                        size="sm"
                    >
                        <MessageCircle className="w-4 h-4" />
                        In WhatsApp-Gruppe posten
                    </Button>
                </div>
            </div>
        </Card>
    );
}