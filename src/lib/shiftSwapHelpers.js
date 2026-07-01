import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Sortiere Bids chronologisch, erste Reaktion oben
 */
export function sortBidsByTimestamp(bids) {
  return [...bids].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );
}

/**
 * Gruppiere Bids nach Status
 */
export function groupBidsByStatus(bids) {
  return {
    // 'ausstehend' = über Marketplace-Button beworben (gleichwertig mit 'annehmen')
    annehmen: bids.filter(b => b.status === 'annehmen' || b.status === 'ausstehend'),
    unter_umständen: bids.filter(b => b.status === 'unter_umständen'),
    ablehnen: bids.filter(b => b.status === 'ablehnen')
  };
}

/**
 * Validiere Direkten Tausch (Schicht-Überschneidungen prüfen)
 */
export async function validateDirectSwap(employeeId, shiftDate, shiftTime) {
  try {
    // ⚠️ War Shift.filter({}) ohne Limit — bei 750+ Schichten im System konnte
    // ein echter Konflikt ausserhalb des SDK-Default-Batches unentdeckt
    // bleiben (falsches "valid: true" trotz Doppel-Buchung). Jetzt direkt
    // serverseitig nach employee_id + date gefiltert — praeziser und schneller.
    const conflicting = await base44.entities.Shift.filter({
      employee_id: employeeId,
      date: shiftDate
    });

    if (conflicting.length > 0) {
      return {
        valid: false,
        error: 'Mitarbeiter hat bereits eine Schicht an diesem Tag'
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Führe direkten Tausch durch
 */
export async function executeDirectSwap(
  shift1Id,
  shift2Id,
  employee1Id,
  employee1Name,
  employee2Id,
  employee2Name,
  currentUserEmail
) {
  try {
    // Hole beide Schichten
    const shift1List = await base44.entities.Shift.filter({ id: shift1Id });
    const shift2List = await base44.entities.Shift.filter({ id: shift2Id });
    
    if (!shift1List[0] || !shift2List[0]) {
      throw new Error('Eine oder beide Schichten nicht gefunden');
    }
    
    const shift1 = shift1List[0];
    const shift2 = shift2List[0];
    
    // Validiere Konflikte
    const val1 = await validateDirectSwap(employee2Id, shift1.date, shift1.start_time);
    const val2 = await validateDirectSwap(employee1Id, shift2.date, shift2.start_time);
    
    if (!val1.valid || !val2.valid) {
      throw new Error(val1.error || val2.error);
    }
    
    // Tausch durchführen
    await base44.entities.Shift.update(shift1.id, {
      employee_id: employee2Id,
      employee_name: employee2Name
    });
    
    await base44.entities.Shift.update(shift2.id, {
      employee_id: employee1Id,
      employee_name: employee1Name
    });
    
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Formatiere Bid-Timestamp für Anzeige
 */
export function formatBidTime(bid) {
  if (!bid?.created_date && !bid?.created_at) return '';
  try {
    const d = new Date(bid.created_date || bid.created_at);
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/**
 * Lesbares Label für Bid-Status
 */
export function getStatusLabel(status) {
  const labels = {
    annehmen:         'Möchte übernehmen',
    ausstehend:       'Ausstehend',
    unter_umständen:  'Eventuell',
    ablehnen:         'Abgelehnt',
    akzeptiert:       'Akzeptiert',
    abgelehnt:        'Abgelehnt',
  };
  return labels[status] || status || '–';
}

/**
 * Tailwind-Farbklassen für Bid/Request-Status
 */
export function getStatusColor(status) {
  const colors = {
    annehmen:         'text-green-400 bg-green-500/15 border-green-500/30',
    ausstehend:       'text-amber-400 bg-amber-500/15 border-amber-500/30',
    unter_umständen:  'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
    ablehnen:         'text-red-400 bg-red-500/15 border-red-500/30',
    akzeptiert:       'text-green-400 bg-green-500/15 border-green-500/30',
    abgelehnt:        'text-red-400 bg-red-500/15 border-red-500/30',
    offen:            'text-blue-400 bg-blue-500/15 border-blue-500/30',
    genehmigt:        'text-green-400 bg-green-500/15 border-green-500/30',
    storniert:        'text-slate-400 bg-slate-500/15 border-slate-500/30',
    abgeschlossen:    'text-slate-400 bg-slate-500/15 border-slate-500/30',
  };
  return colors[status] || 'text-muted-foreground bg-muted border-border';
}