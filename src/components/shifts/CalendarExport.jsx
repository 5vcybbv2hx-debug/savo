import { Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';

/**
 * Generiert ICS-Content aus Schichten + Reservierungen.
 * Als named export extrahiert, damit CalendarMoreMenu es direkt aufrufen kann.
 */
export function generateICSContent(shifts, reservations) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Bar Manager//Schichtplan & Reservierungen//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Bar Management',
        'X-WR-TIMEZONE:Europe/Berlin'
    ];

    shifts.forEach(shift => {
        const date = shift.date.replace(/-/g, '');
        const startTime = shift.start_time.replace(':', '') + '00';
        const endTime = shift.end_time.replace(':', '') + '00';
        const startHour = parseInt(shift.start_time.split(':')[0]);
        const endHour = parseInt(shift.end_time.split(':')[0]);
        let endDate = date;
        if (endHour < startHour) {
            const dateObj = new Date(shift.date);
            dateObj.setDate(dateObj.getDate() + 1);
            endDate = format(dateObj, 'yyyyMMdd');
        }
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${shift.id}@barmanager.app`);
        lines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
        lines.push(`DTSTART:${date}T${startTime}`);
        lines.push(`DTEND:${endDate}T${endTime}`);
        lines.push(`SUMMARY:${shift.employee_name} - ${shift.shift_type}`);
        if (shift.notes) lines.push(`DESCRIPTION:${shift.notes}`);
        lines.push('STATUS:CONFIRMED');
        lines.push('END:VEVENT');
    });

    if (reservations) {
        reservations.forEach(res => {
            if (res.status === 'storniert') return;
            const date = res.date.replace(/-/g, '');
            const time = res.time.replace(':', '') + '00';
            const endHour = parseInt(res.time.split(':')[0]) + 2;
            const endTime = endHour.toString().padStart(2, '0') + res.time.split(':')[1] + '00';
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:res-${res.id}@barmanager.app`);
            lines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
            lines.push(`DTSTART:${date}T${time}`);
            lines.push(`DTEND:${date}T${endTime}`);
            lines.push(`SUMMARY:Reservierung: ${res.customer_name} (${res.guests} Pers.)`);
            let desc = `${res.guests} Personen`;
            if (res.table) desc += ` - Tisch ${res.table}`;
            if (res.phone) desc += `\\nTel: ${res.phone}`;
            if (res.notes) desc += `\\n${res.notes}`;
            lines.push(`DESCRIPTION:${desc}`);
            lines.push('STATUS:CONFIRMED');
            lines.push('END:VEVENT');
        });
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

export function exportCalendarICS(shifts, reservations) {
    const icsContent = generateICSContent(shifts, reservations);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bar-management-${format(new Date(), 'yyyy-MM-dd')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export default function CalendarExport({ shifts, reservations }) {
    const handleExport = () => exportCalendarICS(shifts, reservations);

    return (
        <Button
            variant="outline"
            onClick={handleExport}
            disabled={shifts.length === 0 && (!reservations || reservations.length === 0)}
            className="gap-2"
        >
            <Download className="w-4 h-4" />
            Kalender exportieren
        </Button>
    );
}