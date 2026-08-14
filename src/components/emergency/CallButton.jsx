import React, { useState } from 'react';
import CallHub from './CallHub';
import { Phone } from 'lucide-react';

/**
 * Discreet call button — fixed bottom-right, replaces the red pulsing EmergencyButton.
 * Opens the CallHub overlay with 4 zones (Chef/Taxi, 112/110, medical assist, incident).
 */
export default function CallButton() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="Anrufen"
                className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-12 h-12 rounded-full bg-card border border-border shadow-md hover:bg-accent active:scale-95 transition-all flex items-center justify-center"
            >
                <Phone className="w-5 h-5 text-foreground" strokeWidth={2} />
            </button>

            <CallHub open={open} onClose={() => setOpen(false)} />
        </>
    );
}