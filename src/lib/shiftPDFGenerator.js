import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addDays, isWeekend, isToday, getDay, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Escapes HTML special characters in a string.
 */
function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Returns a short abbreviation for a shift type name.
 */
function shiftAbbr(name) {
    if (!name) return '—';
    const upper = name.toUpperCase();
    const map = { 'ÖFFNUNG': 'ÖFF', 'SCHLUSS': 'SCH', 'NACHT': 'NCH', 'VORSCH': 'VOR', 'MITTAG': 'MIT', 'ABEND': 'ABD' };
    for (const [k, v] of Object.entries(map)) {
        if (upper.includes(k)) return v;
    }
    return upper.substring(0, 3);
}

/**
 * Builds the HTML for a monthly shift plan (A4 Landscape).
 */
function buildMonthHTML(selectedDate, shifts, employees, companyName) {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getDaysInMonth(new Date(year, month));
    const monthName = format(selectedDate, 'MMMM yyyy', { locale: de });
    const today = new Date();
    const printedAt = format(today, 'dd.MM.yyyy', { locale: de });

    const sortedEmployees = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const empIds = new Set(sortedEmployees.map(e => e.id));

    // Index shifts by employee + day
    const shiftMap = {};
    shifts.forEach(s => {
        if (!s.date) return;
        const day = parseInt(s.date.split('-')[2], 10);
        if (isNaN(day)) return;
        const key = `${s.employee_id}_${day}`;
        if (!shiftMap[key]) shiftMap[key] = [];
        shiftMap[key].push(s);
    });

    let dayHeaderCells = '';
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const we = isWeekend(dateObj);
        const todayCol = isToday(dateObj);
        const cls = we ? 'we' : todayCol ? 'today' : '';
        dayHeaderCells += `<th class="${cls}">${d}<span class="dn">${DAY_NAMES[getDay(dateObj)]}</span></th>`;
    }

    let bodyRows = '';
    sortedEmployees.forEach(emp => {
        let cells = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const we = isWeekend(dateObj);
            const todayCol = isToday(dateObj);
            const cls = we ? 'we' : todayCol ? 'today' : '';
            const key = `${emp.id}_${d}`;
            const dayShifts = shiftMap[key] || [];
            const cellContent = dayShifts.map(s =>
                `<div class="shift"><span class="abbr">${esc(shiftAbbr(s.shift_type))}</span><span class="times">${esc(s.start_time || '')}${s.end_time ? '–' + esc(s.end_time) : ''}</span></div>`
            ).join('');
            cells += `<td class="${cls}">${cellContent}</td>`;
        }
        bodyRows += `<tr><td class="emp-name">${esc(emp.name)}</td>${cells}</tr>`;
    });

    if (sortedEmployees.length === 0) {
        bodyRows = `<tr><td colspan="${daysInMonth + 1}" class="empty">Keine aktiven Mitarbeiter gefunden</td></tr>`;
    }

    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Schichtplan ${esc(monthName)} – ${esc(companyName)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 9px; color: #1a1a1a; }
.header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px; }
.header h1 { font-size: 18px; }
.header .meta { text-align: right; font-size: 10px; color: #666; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 3px 2px; text-align: center; vertical-align: top; }
th { background: #f0f0f0; font-weight: 700; font-size: 10px; }
th .dn { display: block; font-size: 7px; font-weight: 400; color: #999; }
td.emp-name { text-align: left; font-weight: 600; white-space: nowrap; background: #f8f8f8; min-width: 100px; font-size: 9px; }
td.we, th.we { background: #e8e8e8; }
td.today, th.today { background: #fef3c7; }
.shift { display: flex; flex-direction: column; align-items: center; margin-bottom: 1px; }
.shift .abbr { font-weight: 700; font-size: 8px; }
.shift .times { font-size: 7px; color: #555; }
.empty { text-align: center; padding: 20px; color: #999; }
.footer { margin-top: 10px; font-size: 8px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
@media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
    <h1>${esc(companyName)} – Schichtplan</h1>
    <div class="meta">
        <div style="font-size:14px;font-weight:700">${esc(monthName)}</div>
        <div>Gedruckt am ${esc(printedAt)}</div>
    </div>
</div>
<table>
    <thead>
        <tr>
            <th class="emp-name">Mitarbeiter</th>
            ${dayHeaderCells}
        </tr>
    </thead>
    <tbody>
        ${bodyRows}
    </tbody>
</table>
<div class="footer">Erstellt mit SAVO · Alle Angaben ohne Gewähr</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

/**
 * Builds the HTML for a weekly shift plan (A4 Portrait).
 */
function buildWeekHTML(selectedDate, shifts, employees, companyName) {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekLabel = `${format(weekStart, 'dd.MM.', { locale: de })} – ${format(weekEnd, 'dd.MM.yyyy', { locale: de })}`;
    const printedAt = format(new Date(), 'dd.MM.yyyy', { locale: de });

    const sortedEmployees = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Index shifts by employee + date string
    const shiftMap = {};
    shifts.forEach(s => {
        if (!s.date) return;
        const key = `${s.employee_id}_${s.date}`;
        if (!shiftMap[key]) shiftMap[key] = [];
        shiftMap[key].push(s);
    });

    const dayHeaders = days.map(d => {
        const we = isWeekend(d);
        const todayCol = isToday(d);
        const cls = we ? 'we' : todayCol ? 'today' : '';
        return `<th class="${cls}">${format(d, 'EEEE', { locale: de })}<span class="dn">${format(d, 'dd.MM.')}</span></th>`;
    }).join('');

    const bodyRows = sortedEmployees.length === 0
        ? `<tr><td colspan="8" class="empty">Keine aktiven Mitarbeiter gefunden</td></tr>`
        : sortedEmployees.map(emp => {
            const cells = days.map(d => {
                const we = isWeekend(d);
                const todayCol = isToday(d);
                const cls = we ? 'we' : todayCol ? 'today' : '';
                const dateStr = format(d, 'yyyy-MM-dd');
                const key = `${emp.id}_${dateStr}`;
                const dayShifts = shiftMap[key] || [];
                const content = dayShifts.map(s => {
                    const color = s.color || '';
                    const style = color ? ` style="border-left:3px solid ${esc(color)}"` : '';
                    return `<div class="shift"${style}><span class="type">${esc(s.shift_type || 'Schicht')}</span><span class="times">${esc(s.start_time || '')}${s.end_time ? '–' + esc(s.end_time) : ''}</span></div>`;
                }).join('');
                return `<td class="${cls}">${content}</td>`;
            }).join('');
            return `<tr><td class="emp-name">${esc(emp.name)}</td>${cells}</tr>`;
        }).join('');

    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Wochenplan ${esc(weekLabel)} – ${esc(companyName)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 10px; color: #1a1a1a; }
.header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px; }
.header h1 { font-size: 16px; }
.header .meta { text-align: right; font-size: 10px; color: #666; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #ccc; padding: 4px 3px; text-align: center; vertical-align: top; }
th { background: #f0f0f0; font-weight: 700; font-size: 10px; }
th .dn { display: block; font-size: 8px; font-weight: 400; color: #999; }
td.emp-name { text-align: left; font-weight: 600; white-space: nowrap; background: #f8f8f8; width: 120px; font-size: 10px; }
td.we, th.we { background: #e8e8e8; }
td.today, th.today { background: #fef3c7; }
.shift { text-align: left; margin-bottom: 2px; padding-left: 2px; }
.shift .type { font-weight: 600; font-size: 9px; display: block; }
.shift .times { font-size: 8px; color: #555; }
.empty { text-align: center; padding: 20px; color: #999; }
.footer { margin-top: 10px; font-size: 8px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
@media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
    <h1>${esc(companyName)} – Wochenplan</h1>
    <div class="meta">
        <div style="font-size:13px;font-weight:700">${esc(weekLabel)}</div>
        <div>Gedruckt am ${esc(printedAt)}</div>
    </div>
</div>
<table>
    <thead>
        <tr>
            <th class="emp-name">Mitarbeiter</th>
            ${dayHeaders}
        </tr>
    </thead>
    <tbody>
        ${bodyRows}
    </tbody>
</table>
<div class="footer">Erstellt mit SAVO · Alle Angaben ohne Gewähr</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

/**
 * Opens a new browser tab with the generated shift plan HTML and triggers print.
 */
export function generateShiftPDF(mode, selectedDate, shifts, employees, companyName) {
    const html = mode === 'week'
        ? buildWeekHTML(selectedDate, shifts, employees, companyName)
        : buildMonthHTML(selectedDate, shifts, employees, companyName);

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        URL.revokeObjectURL(url);
        return false;
    }
    // Revoke after a delay to allow the new tab to load
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
}