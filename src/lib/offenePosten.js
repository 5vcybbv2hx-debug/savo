/**
 * offenePosten.js — Anzeige- und Filterlogik für den Tab „Schulden & Fahrplan".
 *
 * Zentrale Quelle für Zahlenformate, Badge-Optik, Sortierung und Filter,
 * damit Kacheln, Filter und Karten dieselben Regeln verwenden.
 */
import { SAVO_BLUE } from '@/lib/brandAssets';

export { SAVO_BLUE };

// ── Formate ───────────────────────────────────────────────────────────────────
export const fmtEUR = (n) =>
    `${(Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return d && m && y ? `${d}.${m}.${y}` : '';
};

// ── Statusgruppen ─────────────────────────────────────────────────────────────
// „Offen" umfasst offen + geplant (dieselbe Abgrenzung wie die Kopf-Kacheln).
export const OFFENE_STATUS = ['offen', 'geplant'];
export const ABGEBAUTE_STATUS = ['bezahlt', 'erledigt'];

export const STATUS_META = {
    offen:    { label: 'Offen',    className: 'border' },
    geplant:  { label: 'Geplant',  className: 'border border-border bg-muted text-muted-foreground' },
    bezahlt:  { label: 'Bezahlt',  className: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    erledigt: { label: 'Erledigt', className: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    info:     { label: 'Info',     className: 'border border-border bg-muted text-muted-foreground' },
};

export const FAHRPLAN_STATUS_META = {
    aktiv:    { label: 'Aktiv',    style: { color: SAVO_BLUE, borderColor: SAVO_BLUE, backgroundColor: 'rgba(0,153,219,0.10)' } },
    geplant:  { label: 'Geplant',  className: 'border border-border bg-muted text-muted-foreground' },
    erledigt: { label: 'Erledigt', className: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

export const PRIORITAET_META = {
    kritisch: { label: 'Kritisch', className: 'border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',    dot: 'bg-red-500'    },
    hoch:     { label: 'Hoch',     className: 'border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
    mittel:   { label: 'Mittel',   className: 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
    niedrig:  { label: 'Niedrig',  className: 'border border-border bg-muted text-muted-foreground',                   dot: 'bg-muted-foreground' },
};

export const PRIORITAET_OPTIONS = ['kritisch', 'hoch', 'mittel', 'niedrig'];
export const SCHULDNER_OPTIONS  = ['Pierre', 'Sandra', 'SAVO'];

export const PRIORITAET_RANK = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };

// status-Parameter ist null → alle Posten
export const SCHULDNER_FILTER = [
    { id: 'Pierre', label: 'Pierre', statuses: null },
    { id: 'Sandra', label: 'Sandra', statuses: null },
    { id: 'SAVO',   label: 'SAVO',   statuses: null },
    { id: 'Alle',   label: 'Alle',   statuses: null },
];

export const STATUS_FILTER = [
    { id: 'offen',          label: 'Offen',           statuses: OFFENE_STATUS     },
    { id: 'abgeschlossen',  label: 'Bezahlt+Erledigt', statuses: ABGEBAUTE_STATUS },
    { id: 'alle',           label: 'Alle',            statuses: null             },
];

export const isOverdue = (posten, today = todayISO()) =>
    !!posten.faelligkeit && posten.faelligkeit < today && !ABGEBAUTE_STATUS.includes(posten.status);

/** Sortiert nach Priorität, danach nach Fälligkeit (ohne Datum zuletzt). */
export function sortPosten(list) {
    return [...list].sort((a, b) => {
        const prio = (PRIORITAET_RANK[a.prioritaet] ?? 9) - (PRIORITAET_RANK[b.prioritaet] ?? 9);
        if (prio !== 0) return prio;
        return (a.faelligkeit || '9999-12-31').localeCompare(b.faelligkeit || '9999-12-31');
    });
}

/** Kopf-Kacheln: offene Summen je Schuldner sowie Summe der abgebauten Posten. */
export function schuldenKpi(list) {
    const sum = (rows) => rows.reduce((s, p) => s + (Number(p.betrag) || 0), 0);
    const offen = list.filter(p => OFFENE_STATUS.includes(p.status));
    const abgebaut = list.filter(p => ABGEBAUTE_STATUS.includes(p.status));
    return {
        gesamtOffen:  sum(offen),
        pierre:       sum(offen.filter(p => p.schuldner === 'Pierre')),
        sandra:       sum(offen.filter(p => p.schuldner === 'Sandra')),
        anzahlOffen:  offen.length,
        abgebaut:     sum(abgebaut),
    };
}