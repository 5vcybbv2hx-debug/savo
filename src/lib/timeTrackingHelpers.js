import { differenceInMinutes } from 'date-fns';

/**
 * Berechnet die gesamte Pausenzeit in Minuten aus einem breaks-Array.
 * Laufende Pausen (end === null) werden bis zur aktuellen Zeit berechnet.
 *
 * Geteilte Utility fuer TimeTracking.jsx UND SmartDashboard.jsx (ClockCard) —
 * beide Stempeluhr-Oberflaechen muessen exakt dieselbe Pausen- und
 * Lohnberechnung verwenden, sonst driften die Werte je nachdem ueber
 * welche Oberflaeche ein Mitarbeiter aus-/einstempelt.
 */
export function calcTotalBreakMinutes(breaks) {
    if (!Array.isArray(breaks) || breaks.length === 0) return 0;
    const now = new Date();
    return breaks.reduce((sum, b) => {
        if (!b?.start) return sum;
        const start = new Date(b.start);
        const end = b.end ? new Date(b.end) : now;
        return sum + Math.max(0, differenceInMinutes(end, start));
    }, 0);
}

/**
 * Gesetzliche Mindestpause nach ArbZG: 30 Min ab >6h, 45 Min ab >9h.
 */
export function calcLegalBreak(workMinutes) {
    const h = workMinutes / 60;
    if (h > 9) return 45;
    if (h > 6) return 30;
    return 0;
}
