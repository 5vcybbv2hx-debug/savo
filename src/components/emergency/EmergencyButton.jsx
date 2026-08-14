import React, { useState } from 'react';
import EmergencyModal from './EmergencyModal';
import { ShieldAlert } from 'lucide-react';

/**
 * Global pulsing red emergency button — fixed bottom-right, visible for all staff.
 * Opens the EmergencyModal overlay.
 */
export default function EmergencyButton() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="Notfall"
                className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-lg shadow-red-900/40 flex items-center justify-center animate-pulse"
            >
                <ShieldAlert className="w-7 h-7 text-white" strokeWidth={2.2} />
            </button>

            <EmergencyModal open={open} onClose={() => setOpen(false)} />
        </>
    );
}