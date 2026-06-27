import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays, CalendarRange, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { generateShiftPDF } from '@/lib/shiftPDFGenerator';
import { toast } from 'sonner';

export default function ShiftPlanPDFSection({ shifts, employees, companyName }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleGenerate = (mode) => {
        const ok = generateShiftPDF(mode, selectedDate, shifts, employees, companyName);
        if (!ok) {
            toast.error('Pop-up wurde blockiert. Bitte Pop-ups erlauben und erneut versuchen.');
        }
    };

    return (
        <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-semibold text-foreground mb-1">Schichtplan drucken (PDF)</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Druckbare Monats- oder Wochenübersicht als PDF.
            </p>

            <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium text-foreground">Zeitraum:</span>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start gap-2">
                            <CalendarDays className="w-4 h-4" />
                            {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
                            <ChevronDown className="w-3 h-3 ml-auto opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => {
                                if (d) {
                                    setSelectedDate(d);
                                    setPopoverOpen(false);
                                }
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    onClick={() => handleGenerate('month')}
                    className="flex-1"
                >
                    <CalendarRange className="w-4 h-4 mr-2" />
                    Monatsplan PDF
                </Button>
                <Button
                    onClick={() => handleGenerate('week')}
                    variant="outline"
                    className="flex-1"
                >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Wochenplan PDF
                </Button>
            </div>
        </Card>
    );
}