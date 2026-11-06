import React from 'react';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function CalendarExport({ shifts, reservations }) {
    const generateICS = () => {
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//BarManager//Calendar Export//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:BarManager Kalender',
            'X-WR-TIMEZONE:Europe/Berlin',
            'X-WR-CALDESC:Schichten, Reservierungen und Geburtstage'
        ];

        // Add shifts
        shifts.forEach((shift, index) => {
            const shiftDate = shift.date;
            const startTime = shift.start_time.replace(':', '');
            const endTime = shift.end_time.replace(':', '');
            
            // Handle overnight shifts
            let endDate = shiftDate;
            if (shift.end_time < shift.start_time) {
                const nextDay = new Date(shiftDate);
                nextDay.setDate(nextDay.getDate() + 1);
                endDate = format(nextDay, 'yyyy-MM-dd');
            }

            const startDateTime = `${shiftDate.replace(/-/g, '')}T${startTime}00`;
            const endDateTime = `${endDate.replace(/-/g, '')}T${endTime}00`;

            icsContent.push(
                'BEGIN:VEVENT',
                `UID:shift-${shift.id}@barmanager.app`,
                `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
                `DTSTART:${startDateTime}`,
                `DTEND:${endDateTime}`,
                `SUMMARY:Schicht: ${shift.employee_name}`,
                `DESCRIPTION:Schichttyp: ${shift.shift_type}\\nMitarbeiter: ${shift.employee_name}${shift.notes ? '\\nNotizen: ' + shift.notes : ''}`,
                `LOCATION:Bar`,
                `STATUS:CONFIRMED`,
                `SEQUENCE:0`,
                'END:VEVENT'
            );
        });

        // Add reservations
        reservations.forEach((reservation, index) => {
            const resDate = reservation.date;
            const resTime = reservation.time.replace(':', '');
            const startDateTime = `${resDate.replace(/-/g, '')}T${resTime}00`;
            
            // Estimate 2 hours for reservation
            const endDate = new Date(`${resDate}T${reservation.time}`);
            endDate.setHours(endDate.getHours() + 2);
            const endDateTime = format(endDate, "yyyyMMdd'T'HHmmss");

            icsContent.push(
                'BEGIN:VEVENT',
                `UID:reservation-${reservation.id}@barmanager.app`,
                `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
                `DTSTART:${startDateTime}`,
                `DTEND:${endDateTime}`,
                `SUMMARY:Reservierung: ${reservation.customer_name}`,
                `DESCRIPTION:Gast: ${reservation.customer_name}\\nPersonen: ${reservation.guests}${reservation.table ? '\\nTisch: ' + reservation.table : ''}${reservation.notes ? '\\nNotizen: ' + reservation.notes : ''}`,
                `LOCATION:Bar`,
                `STATUS:${reservation.status === 'bestätigt' ? 'CONFIRMED' : 'TENTATIVE'}`,
                `SEQUENCE:0`,
                'END:VEVENT'
            );
        });

        icsContent.push('END:VCALENDAR');
        return icsContent.join('\r\n');
    };

    const handleExport = () => {
        const icsContent = generateICS();
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `barmanager-kalender-${format(new Date(), 'yyyy-MM-dd')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const hasEvents = shifts.length > 0 || reservations.length > 0;

    return (
        <Button
            onClick={handleExport}
            disabled={!hasEvents}
            className="bg-status-ok/70 hover:bg-status-ok/70"
        >
            <Download className="w-4 h-4 mr-2" />
            Kalender exportieren (.ics)
        </Button>
    );
}