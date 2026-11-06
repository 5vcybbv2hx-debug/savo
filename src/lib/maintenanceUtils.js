/**
 * Maintenance utility functions
 * All date/status logic lives here — never directly in JSX.
 */

// Days-until-due threshold for "bald fällig"
export const WARNING_DAYS = 30;

/**
 * Calculate the next maintenance date from a base date + frequency string.
 * Returns ISO date string (YYYY-MM-DD).
 */
export function calculateNextMaintenance(dateStr, frequency) {
    const d = new Date(dateStr);
    switch (frequency) {
        case 'täglich':         d.setDate(d.getDate() + 1);       break;
        case 'wöchentlich':     d.setDate(d.getDate() + 7);       break;
        case 'monatlich':       d.setMonth(d.getMonth() + 1);     break;
        case 'quartalsweise':   d.setMonth(d.getMonth() + 3);     break;
        case 'halbjährlich':    d.setMonth(d.getMonth() + 6);     break;
        case 'jährlich':        d.setFullYear(d.getFullYear() + 1); break;
        case 'alle zwei Jahre': d.setFullYear(d.getFullYear() + 2); break;
        default: break;
    }
    return d.toISOString().split('T')[0];
}

/**
 * Derive the visual status of a task purely from its next_maintenance date.
 * Returns: 'überfällig' | 'bald fällig' | 'ok'
 */
export function getTaskStatus(task) {
    if (!task.next_maintenance) return 'ok';
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(task.next_maintenance);
    const diffDays = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0)             return 'überfällig';
    if (diffDays <= WARNING_DAYS) return 'bald fällig';
    return 'ok';
}

/**
 * Sort tasks by urgency: überfällig → bald fällig → ok.
 * Within same status sort by next_maintenance ascending.
 */
export function sortTasksByUrgency(tasks) {
    const order = { 'überfällig': 0, 'bald fällig': 1, 'ok': 2 };
    return [...tasks].sort((a, b) => {
        const sa = order[getTaskStatus(a)];
        const sb = order[getTaskStatus(b)];
        if (sa !== sb) return sa - sb;
        return (a.next_maintenance || '').localeCompare(b.next_maintenance || '');
    });
}

/**
 * Human-readable label for a date string, relative to today.
 */
export function formatRelativeDate(dateStr) {
    if (!dateStr) return '–';
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    const d       = new Date(dateStr);
    const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0)  return 'Heute';
    if (diffDays === 1)  return 'Morgen';
    if (diffDays === -1) return 'Gestern';
    if (diffDays < 0)   return `${Math.abs(diffDays)} Tage überfällig`;
    if (diffDays <= 30) return `in ${diffDays} Tagen`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
}

export const STATUS_CONFIG = {
    'überfällig': {
        label: 'Überfällig',
        bg:    'bg-status-danger/15 dark:bg-status-danger/30',
        text:  'text-status-danger dark:text-status-danger',
        badge: 'bg-status-danger/15 text-status-danger border-status-danger/25',
        border:'border-l-red-500',
        dot:   'bg-status-danger/70',
    },
    'bald fällig': {
        label: 'Bald fällig',
        bg:    'bg-status-warn/15 dark:bg-status-warn/20',
        text:  'text-status-warn dark:text-status-warn',
        badge: 'bg-status-warn/15 text-status-warn border-status-warn/25',
        border:'border-l-yellow-500',
        dot:   'bg-status-warn/70',
    },
    'ok': {
        label: 'OK',
        bg:    'bg-status-ok/15 dark:bg-status-ok/20',
        text:  'text-status-ok dark:text-status-ok',
        badge: 'bg-status-ok/15 text-status-ok border-status-ok/25',
        border:'border-l-green-500',
        dot:   'bg-status-ok/70',
    },
};

export const CATEGORY_ICONS = {
    'Sicherheit': '🔥',
    'Technik':    '⚙️',
    'Hygiene':    '🧴',
    'Elektrik':   '⚡',
    'Sonstiges':  '🔧',
};