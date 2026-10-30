// Stunden-Berechnung für Wunschschichten (Manager-Prüfansicht)

// Dauer eines Wunschs aus start_time/end_time in Stunden.
// Nacht-Schichten (end_time <= start_time) laufen über Mitternacht.
export function shiftHours(start, end) {
    const toMin = (t) => {
        if (!t) return null;
        const [h, m] = String(t).split(':').map(Number);
        if (Number.isNaN(h)) return null;
        return h * 60 + (Number.isNaN(m) ? 0 : m);
    };
    const s = toMin(start);
    const e = toMin(end);
    if (s === null || e === null) return 0;
    let diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
}

// 1 Nachkommastelle mit deutschem Komma: 8 -> "8,0"
export function formatHours(hours) {
    return (Math.round((hours || 0) * 10) / 10).toFixed(1).replace('.', ',');
}

// Anzahl + Stundensumme pro Mitarbeiter (Schlüssel: employee_id)
export function statsByEmployee(requests) {
    const map = {};
    (requests || []).forEach(r => {
        const key = r.employee_id || r.employee_name;
        if (!key) return;
        const entry = map[key] || {
            employee_id: r.employee_id,
            employee_name: r.employee_name,
            count: 0,
            hours: 0,
        };
        entry.count += 1;
        entry.hours += shiftHours(r.start_time, r.end_time);
        map[key] = entry;
    });
    return map;
}