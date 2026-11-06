/**
 * Zentrale Notification Filter- und Sortierlogik
 */

// Rollen-Definition
export const ROLE_HIERARCHY = {
  'admin': ['admin', 'manager', 'mitarbeiter', 'aushilfe'],
  'manager': ['manager', 'mitarbeiter', 'aushilfe'],
  'mitarbeiter': ['mitarbeiter'],
  'aushilfe': ['aushilfe']
};

export const PRIORITY_LEVELS = {
  'kritisch': 0,
  'wichtig': 1,
  'info': 2
};

// Standardeinstellungen
export const DEFAULT_SETTINGS = {
  categories: {
    schicht: true,
    aufgabe: true,
    wartung: true,
    reservierung: true,
    system: true
  },
  min_priority: 'info',
  only_assigned_tasks: true
};

/**
 * Filtert Benachrichtigungen basierend auf Benutzerrolle
 */
export function filterByRole(notifications, userRole) {
  const allowedRoles = ROLE_HIERARCHY[userRole] || ['mitarbeiter'];
  
  return notifications.filter(notif => {
    // Wenn keine target_roles definiert, für alle sichtbar
    if (!notif.target_roles || notif.target_roles.length === 0) {
      return true;
    }
    // Prüfe ob mindestens eine target_role in allowedRoles enthalten ist
    return notif.target_roles.some(role => allowedRoles.includes(role));
  });
}

/**
 * Filtert Benachrichtigungen basierend auf Benutzer-Einstellungen
 */
export function filterByUserSettings(notifications, settings, userEmail, userRole) {
  if (!settings) return notifications;

  return notifications.filter(notif => {
    // 1. Kategorie check
    if (settings.categories[notif.category] === false) {
      return false;
    }

    // 2. Priorität check (wenn kritisch, immer anzeigen)
    if (notif.priority === 'kritisch') {
      return true;
    }
    
    const minPriorityLevel = PRIORITY_LEVELS[settings.min_priority] ?? 2;
    const notifPriorityLevel = PRIORITY_LEVELS[notif.priority] ?? 2;
    
    if (notifPriorityLevel > minPriorityLevel) {
      return false;
    }

    // 3. Only assigned tasks check (für Mitarbeiter)
    if (settings.only_assigned_tasks && notif.category === 'aufgabe') {
      // Zeige Aufgaben-Notifications nur wenn der User zugewiesen ist
      // Managers und Admins sehen alle Aufgaben
      if (userRole === 'mitarbeiter' || userRole === 'aushilfe') {
        const isAssigned =
          notif.created_by === userEmail ||
          notif.message?.toLowerCase().includes(userEmail?.split('@')[0]?.toLowerCase()) ||
          notif.related_id != null; // Falls related_id gesetzt: Todo ist relevant
        if (!isAssigned) return false;
      }
    }

    return true;
  });
}

/**
 * Kombinierte Filterlogik: Rolle + Einstellungen
 */
export function getVisibleNotifications(notifications, userRole, userEmail, settings, employeeId) {
  // Recipient-Filter: wenn recipient_id oder recipient_email gesetzt, nur für diesen Nutzer sichtbar
  let filtered = notifications.filter(notif => {
    if (!notif.recipient_id && !notif.recipient_email) return true; // globale Nachricht
    if (employeeId && notif.recipient_id === employeeId) return true;
    if (userEmail && notif.recipient_email === userEmail) return true;
    return false;
  });
  filtered = filterByRole(filtered, userRole);
  filtered = filterByUserSettings(filtered, settings, userEmail, userRole);
  return filtered;
}

/**
 * Sortiert Benachrichtigungen nach Priorität + Datum
 */
export function sortByPriorityAndDate(notifications) {
  return [...notifications].sort((a, b) => {
    // Zuerst nach Priorität
    const aPriority = PRIORITY_LEVELS[a.priority] ?? 2;
    const bPriority = PRIORITY_LEVELS[b.priority] ?? 2;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Dann nach Datum (neuer zuerst)
    return new Date(b.created_date) - new Date(a.created_date);
  });
}

/**
 * Gruppiert Benachrichtigungen nach Status (gelesen/ungelesen)
 */
export function groupByReadStatus(notifications, userEmail) {
  return {
    unread: notifications.filter(n => !n.read_by?.includes(userEmail)),
    read: notifications.filter(n => n.read_by?.includes(userEmail))
  };
}

/**
 * Kategorie-Beschreibung
 */
export const CATEGORY_LABELS = {
  'schicht': '📅 Schichtplan',
  'aufgabe': '✓ Aufgaben',
  'wartung': '🔧 Wartung',
  'reservierung': '🍴 Reservierungen',
  'system': '⚙️ System',
  'admin': '🔐 Admin'
};

export const CATEGORY_COLORS = {
  'schicht': 'bg-primary/15 text-primary dark:bg-primary/30 dark:text-primary',
  'aufgabe': 'bg-status-warn/15 text-status-warn dark:bg-status-warn/30 dark:text-status-warn',
  'wartung': 'bg-status-danger/15 text-status-danger dark:bg-status-danger/30 dark:text-status-danger',
  'reservierung': 'bg-status-ok/15 text-status-ok dark:bg-status-ok/30 dark:text-status-ok',
  'system': 'bg-card text-muted-foreground dark:bg-surface dark:text-muted-foreground',
  'admin': 'bg-primary text-primary dark:bg-primary/30 dark:text-primary'
};