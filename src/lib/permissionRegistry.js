/**
 * ZENTRALE PERMISSION-REGISTRY
 * 
 * Vollständige Erfassung aller Seiten, Unterbereiche und Funktionen der App
 * mit granularer Rechtevergabe auf 3 Ebenen:
 * 1. Seite (page level)
 * 2. Unterbereich / Unterkategorie (section level)
 * 3. Aktion / Funktion (action level)
 * 
 * Rechtemodell:
 * - none = kein Zugriff / nicht sichtbar
 * - view = sichtbar / nur lesen
 * - edit = sichtbar und bearbeiten
 */

export const PERMISSION_LEVELS = {
  NONE: 'none',    // Kein Zugriff
  VIEW: 'view',    // Sichtbar / nur lesen
  EDIT: 'edit',    // Sichtbar und bearbeiten
};

export const PERMISSION_REGISTRY = {
  // ────────────────────────────────────────────────────────────────
  // 1. DASHBOARD
  // ────────────────────────────────────────────────────────────────
  dashboard: {
    pageKey: 'Dashboard',
    displayName: 'Dashboard',
    description: 'Übersichtliche Startseite mit Kennzahlen und schnellen Aktionen',
    category: 'Core',
    sections: {
      overview: {
        key: 'dashboard_overview',
        displayName: 'Übersicht',
        description: 'Kennzahlen, KPIs und Statusanzeigen',
        actions: ['view'],
      },
      warnings: {
        key: 'dashboard_warnings',
        displayName: 'Warnungen & Hinweise',
        description: 'Alarm-Panel mit dringenden Aufgaben und Problemen',
        actions: ['view'],
      },
      managerPanel: {
        key: 'dashboard_manager',
        displayName: 'Manager-Panel',
        description: 'Manager-spezifische Kennzahlen, Genehmigungen, Schichttausch',
        actions: ['view', 'edit'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 2. LAGERPLÄTZE / WAREHOUSE
  // ────────────────────────────────────────────────────────────────
  storage: {
    pageKey: 'Storage',
    displayName: 'Lagerplätze',
    description: 'Verwaltung von Lagerbereichen, Möbeln, Behältern und Artikelzuordnung',
    category: 'Inventory',
    sections: {
      overview: {
        key: 'storage_overview',
        displayName: 'Lagerübersicht',
        description: 'Alle Lagerplätze einsehen und durchsuchen',
        actions: ['view'],
      },
      structure: {
        key: 'storage_structure',
        displayName: 'Struktur verwalten',
        description: 'Bereiche, Möbel und Behälter erstellen / bearbeiten / löschen',
        actions: ['view', 'edit', 'delete'],
      },
      slots: {
        key: 'storage_slots',
        displayName: 'Fächer verwalten',
        description: 'Lagerplatzfächer erstellen und bearbeiten',
        actions: ['view', 'edit', 'delete'],
      },
      assignment: {
        key: 'storage_assignment',
        displayName: 'Artikel zuordnen',
        description: 'Artikel zu Lagerplätzen zuordnen, Mindest-/Maximalbestände setzen',
        actions: ['view', 'edit'],
      },
      stock: {
        key: 'storage_stock',
        displayName: 'Bestände pflegen',
        description: 'Lagerbestände manuell erfassen und korrigieren',
        actions: ['view', 'edit'],
      },
      labels: {
        key: 'storage_labels',
        displayName: 'Etiketten',
        description: 'Lagerplatz-Etiketten drucken und QR-Codes scannen',
        actions: ['view', 'edit', 'print', 'scan'],
      },
      export: {
        key: 'storage_export',
        displayName: 'Export',
        description: 'Lagerdaten als PDF oder Excel exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 3. GETRÄNKEKARTE / DRINK MENU
  // ────────────────────────────────────────────────────────────────
  drinkMenu: {
    pageKey: 'DrinkMenu',
    displayName: 'Getränkekarte',
    description: 'Verwaltung von Getränken, Kategorien und Wochenspecials',
    category: 'Inventory',
    sections: {
      menuView: {
        key: 'menu_view',
        displayName: 'Karte einsehen',
        description: 'Speisekarte anschauen und durchsuchen',
        actions: ['view'],
      },
      itemManagement: {
        key: 'menu_items',
        displayName: 'Getränke bearbeiten',
        description: 'Getränke erstellen, bearbeiten, löschen, Preise ändern',
        actions: ['view', 'edit', 'delete'],
      },
      categories: {
        key: 'menu_categories',
        displayName: 'Kategorien verwalten',
        description: 'Getränkekategorien erstellen und bearbeiten',
        actions: ['view', 'edit'],
      },
      specialsManagement: {
        key: 'menu_specials',
        displayName: 'Wochenspecial verwalten',
        description: 'Spezielle Angebote für die Woche definieren',
        actions: ['view', 'edit'],
      },
      guestLink: {
        key: 'menu_guestlink',
        displayName: 'Gäste-Link',
        description: 'QR-Code und Link für öffentliche Speisekarte verwalten',
        actions: ['view', 'edit'],
      },
      allergens: {
        key: 'menu_allergens',
        displayName: 'Allergene & Zusatzstoffe',
        description: 'Allergene und Zusatzstoffe zu Getränken hinzufügen',
        actions: ['view', 'edit'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 4. ZEITERFASSUNG / TIME TRACKING
  // ────────────────────────────────────────────────────────────────
  timeTracking: {
    pageKey: 'TimeTracking',
    displayName: 'Zeiterfassung',
    description: 'Ein-/Ausstempeln, Zeiten einsehen und genehmigen',
    category: 'HR',
    sections: {
      ownTimes: {
        key: 'time_own',
        displayName: 'Eigene Zeiten',
        description: 'Eigene Ein-/Ausstempel und Zeiteinträge',
        actions: ['view', 'edit'],
      },
      teamTimes: {
        key: 'time_team',
        displayName: 'Teamzeiten',
        description: 'Zeiten anderer Mitarbeiter einsehen',
        actions: ['view'],
      },
      approvals: {
        key: 'time_approvals',
        displayName: 'Genehmigungen',
        description: 'Zeiteinträge genehmigen und ablehnen (nur Manager)',
        actions: ['view', 'edit', 'approve'],
      },
      clockOut: {
        key: 'time_clockout',
        displayName: 'Aktives Ausstempeln',
        description: 'Mitarbeiter aktiv aus Schicht ausstempeln (Manager-Funktion)',
        actions: ['view', 'edit'],
      },
      corrections: {
        key: 'time_corrections',
        displayName: 'Korrekturen',
        description: 'Fehlerhafte Zeiten korrigieren',
        actions: ['view', 'edit'],
      },
      export: {
        key: 'time_export',
        displayName: 'Export',
        description: 'Zeitdaten exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 5. SCHICHTPLAN / SHIFTS
  // ────────────────────────────────────────────────────────────────
  shifts: {
    pageKey: 'Shifts',
    displayName: 'Schichtplan',
    description: 'Schichten planen, tauschen und verwalten',
    category: 'HR',
    sections: {
      overview: {
        key: 'shifts_overview',
        displayName: 'Übersicht',
        description: 'Schichtplan ansehen und filtern',
        actions: ['view'],
      },
      create: {
        key: 'shifts_create',
        displayName: 'Schichten erstellen',
        description: 'Neue Schichten eintragen',
        actions: ['view', 'edit'],
      },
      edit: {
        key: 'shifts_edit',
        displayName: 'Schichten bearbeiten',
        description: 'Bestehende Schichten ändern oder löschen',
        actions: ['view', 'edit', 'delete'],
      },
      swap: {
        key: 'shifts_swap',
        displayName: 'Schichttausch',
        description: 'Schichten tauschen und Tauschvermittlung',
        actions: ['view', 'edit'],
      },
      unavailability: {
        key: 'shifts_unavailable',
        displayName: 'Nicht verfügbar',
        description: 'Wunschtage und Nichtverfügbarkeiten eintragen',
        actions: ['view', 'edit'],
      },
      calendar: {
        key: 'shifts_calendar',
        displayName: 'Teamkalender',
        description: 'Übersicht aller Schichten und Urlaube im Kalender',
        actions: ['view'],
      },
      export: {
        key: 'shifts_export',
        displayName: 'Export',
        description: 'Schichtplan exportieren oder abonnieren',
        actions: ['view', 'export'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 6. URLAUB / VACATION
  // ────────────────────────────────────────────────────────────────
  vacation: {
    pageKey: 'MyArea',
    displayName: 'Urlaub',
    description: 'Urlaubsanträge stellen und verwalten (nur Vollzeit)',
    category: 'HR',
    sections: {
      own: {
        key: 'vacation_own',
        displayName: 'Mein Urlaub',
        description: 'Eigene Urlaubsanträge stellen und einsehen',
        actions: ['view', 'edit'],
      },
      approve: {
        key: 'vacation_approve',
        displayName: 'Genehmigungen',
        description: 'Urlaubsanträge genehmigen/ablehnen (nur Manager)',
        actions: ['view', 'edit', 'approve'],
      },
      overview: {
        key: 'vacation_overview',
        displayName: 'Team-Übersicht',
        description: 'Überblick aller Urlaube im Team',
        actions: ['view'],
      },
      statistics: {
        key: 'vacation_stats',
        displayName: 'Statistiken',
        description: 'Urlaubsberichte und Auswertungen',
        actions: ['view', 'export'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 7. RESERVIERUNGEN
  // ────────────────────────────────────────────────────────────────
  reservations: {
    pageKey: 'Reservations',
    displayName: 'Reservierungen',
    description: 'Tischreservierungen verwalten',
    category: 'Operations',
    sections: {
      view: {
        key: 'reservations_view',
        displayName: 'Ansehen',
        description: 'Reservierungen anschauen',
        actions: ['view'],
      },
      create: {
        key: 'reservations_create',
        displayName: 'Erstellen',
        description: 'Neue Reservierung eintragen',
        actions: ['view', 'edit'],
      },
      edit: {
        key: 'reservations_edit',
        displayName: 'Bearbeiten',
        description: 'Reservierung ändern oder löschen',
        actions: ['view', 'edit', 'delete'],
      },
      eventOverride: {
        key: 'reservations_event',
        displayName: 'Event-Überschreibung',
        description: 'Reservierungen bearbeiten, obwohl Eventsperre aktiv ist',
        actions: ['view', 'edit'],
      },
      export: {
        key: 'reservations_export',
        displayName: 'Export',
        description: 'Reservierungen exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 8. GÄSTE & TISCHE / SEATING
  // ────────────────────────────────────────────────────────────────
  seating: {
    pageKey: 'SeatingChart',
    displayName: 'Gäste & Tische',
    description: 'Tische und Gasteraumaufteilung verwalten',
    category: 'Operations',
    sections: {
      tableView: {
        key: 'seating_view',
        displayName: 'Tische ansehen',
        description: 'Tischlayout anschauen',
        actions: ['view'],
      },
      tableEdit: {
        key: 'seating_edit',
        displayName: 'Tische bearbeiten',
        description: 'Tische erstellen, bearbeiten und löschen',
        actions: ['view', 'edit', 'delete'],
      },
      tableNames: {
        key: 'seating_names',
        displayName: 'Tischnamen',
        description: 'Tischnamen konfigurieren',
        actions: ['view', 'edit'],
      },
      layout: {
        key: 'seating_layout',
        displayName: 'Layout',
        description: 'Raumaufteilung und Tischanordnung definieren',
        actions: ['view', 'edit'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 9. MITARBEITER / EMPLOYEES
  // ────────────────────────────────────────────────────────────────
  employees: {
    pageKey: 'Employees',
    displayName: 'Mitarbeiter',
    description: 'Mitarbeiterdaten und Profile verwalten',
    category: 'HR',
    sections: {
      own: {
        key: 'employees_own',
        displayName: 'Eigenes Profil',
        description: 'Eigene Daten einsehen und bearbeiten',
        actions: ['view', 'edit'],
      },
      list: {
        key: 'employees_list',
        displayName: 'Mitarbeiterliste',
        description: 'Alle Mitarbeiter anschauen',
        actions: ['view'],
      },
      manage: {
        key: 'employees_manage',
        displayName: 'Verwalten',
        description: 'Mitarbeiter hinzufügen, bearbeiten, löschen',
        actions: ['view', 'edit', 'delete'],
      },
      permissions: {
        key: 'employees_permissions',
        displayName: 'Berechtigungen',
        description: 'Mitarbeiterberechtigungen verwalten',
        actions: ['view', 'edit'],
      },
      personalForms: {
        key: 'employees_forms',
        displayName: 'Persönliche Formulare',
        description: 'Arbeitsverträge und Personalbogen exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 10. REPORTS / BERICHTE
  // ────────────────────────────────────────────────────────────────
  reports: {
    pageKey: 'Reports',
    displayName: 'Reports',
    description: 'Verkaufs- und Businessberichte',
    category: 'Analytics',
    sections: {
      view: {
        key: 'reports_view',
        displayName: 'Ansehen',
        description: 'Berichte anschauen',
        actions: ['view'],
      },
      upload: {
        key: 'reports_upload',
        displayName: 'Hochladen',
        description: 'PDF-Reports hochladen und importieren',
        actions: ['view', 'edit'],
      },
      export: {
        key: 'reports_export',
        displayName: 'Exportieren',
        description: 'Berichte als Excel oder PDF exportieren',
        actions: ['view', 'export'],
      },
      analysis: {
        key: 'reports_analysis',
        displayName: 'Analyse',
        description: 'Daten analysieren und Kennzahlen anschauen',
        actions: ['view'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 11. EINKAUF / SHOPPING & ARTICLES
  // ────────────────────────────────────────────────────────────────
  shopping: {
    pageKey: 'Shopping',
    displayName: 'Einkauf',
    description: 'Einkaufliste und Artikel verwalten',
    category: 'Inventory',
    sections: {
      list: {
        key: 'shopping_list',
        displayName: 'Einkaufliste',
        description: 'Einkaufliste ansehen und pflegen',
        actions: ['view', 'edit'],
      },
      articles: {
        key: 'shopping_articles',
        displayName: 'Artikel',
        description: 'Artikel-Katalog verwalten',
        actions: ['view', 'edit', 'delete'],
      },
      categories: {
        key: 'shopping_categories',
        displayName: 'Kategorien',
        description: 'Artikelkategorien erstellen und bearbeiten',
        actions: ['view', 'edit'],
      },
      suppliers: {
        key: 'shopping_suppliers',
        displayName: 'Lieferanten',
        description: 'Lieferantendaten verwalten',
        actions: ['view', 'edit'],
      },
      barcodes: {
        key: 'shopping_barcodes',
        displayName: 'Barcodes',
        description: 'Artikel mit Barcode scannen',
        actions: ['view', 'scan'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 12. REINIGUNG / CLEANING
  // ────────────────────────────────────────────────────────────────
  cleaning: {
    pageKey: 'Cleaning',
    displayName: 'Reinigung',
    description: 'Reinigungsaufgaben und Checklisten verwalten',
    category: 'Operations',
    sections: {
      tasks: {
        key: 'cleaning_tasks',
        displayName: 'Aufgaben',
        description: 'Reinigungsaufgaben einsehen und abhaken',
        actions: ['view', 'edit'],
      },
      manage: {
        key: 'cleaning_manage',
        displayName: 'Verwalten',
        description: 'Aufgaben erstellen und bearbeiten',
        actions: ['view', 'edit', 'delete'],
      },
      reports: {
        key: 'cleaning_reports',
        displayName: 'Berichte',
        description: 'Reinigungsberichte anschauen und exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 13. VERANSTALTUNGEN / EVENTS
  // ────────────────────────────────────────────────────────────────
  events: {
    pageKey: 'Events',
    displayName: 'Veranstaltungen',
    description: 'Events und Veranstaltungen planen',
    category: 'Operations',
    sections: {
      view: {
        key: 'events_view',
        displayName: 'Ansehen',
        description: 'Events anschauen',
        actions: ['view'],
      },
      manage: {
        key: 'events_manage',
        displayName: 'Verwalten',
        description: 'Events erstellen, bearbeiten, löschen',
        actions: ['view', 'edit', 'delete'],
      },
      ideas: {
        key: 'events_ideas',
        displayName: 'Ideen',
        description: 'Event-Ideen sammeln und bewerten',
        actions: ['view', 'edit'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 14. AUFGABEN / TODO
  // ────────────────────────────────────────────────────────────────
  todos: {
    pageKey: 'Todos',
    displayName: 'Aufgaben',
    description: 'Team-Aufgaben und To-Do-Listen',
    category: 'Operations',
    sections: {
      own: {
        key: 'todos_own',
        displayName: 'Meine Aufgaben',
        description: 'Eigene Aufgaben ansehen',
        actions: ['view', 'edit'],
      },
      all: {
        key: 'todos_all',
        displayName: 'Alle Aufgaben',
        description: 'Alle Team-Aufgaben ansehen',
        actions: ['view', 'edit', 'delete'],
      },
      create: {
        key: 'todos_create',
        displayName: 'Erstellen',
        description: 'Neue Aufgaben erstellen',
        actions: ['view', 'edit'],
      },
      categories: {
        key: 'todos_categories',
        displayName: 'Kategorien',
        description: 'Aufgabenkategorien verwalten',
        actions: ['view', 'edit'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 15. EINSTELLUNGEN / SETTINGS
  // ────────────────────────────────────────────────────────────────
  settings: {
    pageKey: 'Settings',
    displayName: 'Einstellungen',
    description: 'App-Konfiguration und System-Einstellungen',
    category: 'Admin',
    sections: {
      profile: {
        key: 'settings_profile',
        displayName: 'Mein Profil',
        description: 'Persönliche Einstellungen ändern',
        actions: ['view', 'edit'],
      },
      company: {
        key: 'settings_company',
        displayName: 'Betrieb',
        description: 'Betriebsdaten und Konfiguration',
        actions: ['view', 'edit'],
      },
      notifications: {
        key: 'settings_notifications',
        displayName: 'Benachrichtigungen',
        description: 'Benachrichtigungseinstellungen',
        actions: ['view', 'edit'],
      },
      theme: {
        key: 'settings_theme',
        displayName: 'Design',
        description: 'Farbschema und visuelle Einstellungen',
        actions: ['view', 'edit'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // 16. WEITERE PAGES
  // ────────────────────────────────────────────────────────────────
  myArea: {
    pageKey: 'MyArea',
    displayName: 'Mein Bereich',
    description: 'Persönliche Übersicht',
    category: 'Core',
    sections: {
      overview: {
        key: 'myarea_overview',
        displayName: 'Übersicht',
        description: 'Persönliche Daten und Status',
        actions: ['view', 'edit'],
      },
    },
  },

  inventory: {
    pageKey: 'Inventory',
    displayName: 'Inventur',
    description: 'Lagerverwaltung und Inventuren',
    category: 'Inventory',
    sections: {
      sessions: {
        key: 'inventory_sessions',
        displayName: 'Inventur-Sitzungen',
        description: 'Inventur-Sessions erstellen und durchführen',
        actions: ['view', 'edit'],
      },
    },
  },

  warehouse: {
    pageKey: 'Warehouse',
    displayName: 'Lager',
    description: 'Warenwirtschaft und Lagerbestände',
    category: 'Inventory',
    sections: {
      overview: {
        key: 'warehouse_overview',
        displayName: 'Übersicht',
        description: 'Lagerbestände anschauen',
        actions: ['view'],
      },
    },
  },

  maintenance: {
    pageKey: 'Maintenance',
    displayName: 'Wartung',
    description: 'Wartungsaufgaben und Reparaturen',
    category: 'Operations',
    sections: {
      tasks: {
        key: 'maintenance_tasks',
        displayName: 'Aufgaben',
        description: 'Wartungsaufgaben verwalten',
        actions: ['view', 'edit'],
      },
    },
  },

  teamMeeting: {
    pageKey: 'TeamMeeting',
    displayName: 'Teamsitzung',
    description: 'Team-Besprechungen und Diskussionspunkte',
    category: 'Operations',
    sections: {
      topics: {
        key: 'meeting_topics',
        displayName: 'Besprechungspunkte',
        description: 'Themen für Teamsitzung',
        actions: ['view', 'edit'],
      },
      manage: {
        key: 'meeting_manage',
        displayName: 'Verwalten (Manager)',
        description: 'Themen bearbeiten und Status ändern',
        actions: ['view', 'edit'],
      },
    },
  },

  // Weitere Pages (min. Erfassung)
  myShifts: {
    pageKey: 'MyShifts',
    displayName: 'Meine Schichten',
    category: 'HR',
    sections: {
      overview: {
        key: 'myshifts_overview',
        displayName: 'Übersicht',
        actions: ['view'],
      },
    },
  },

  teamCalendar: {
    pageKey: 'TeamCalendar',
    displayName: 'Team-Kalender',
    category: 'HR',
    sections: {
      view: {
        key: 'teamcalendar_view',
        displayName: 'Kalender',
        actions: ['view'],
      },
    },
  },

  priceCalculator: {
    pageKey: 'PriceCalculator',
    displayName: 'Preiskalkulator',
    category: 'Operations',
    sections: {
      calculate: {
        key: 'pricecalc_use',
        displayName: 'Nutzen',
        actions: ['view'],
      },
    },
  },

  recipes: {
    pageKey: 'Recipes',
    displayName: 'Rezepte',
    category: 'Inventory',
    sections: {
      view: {
        key: 'recipes_view',
        displayName: 'Ansehen',
        actions: ['view'],
      },
      manage: {
        key: 'recipes_manage',
        displayName: 'Verwalten',
        actions: ['view', 'edit'],
      },
    },
  },

  salesAnalysis: {
    pageKey: 'SalesAnalysis',
    displayName: 'Verkaufsanalyse',
    category: 'Analytics',
    sections: {
      view: {
        key: 'sales_view',
        displayName: 'Ansehen',
        actions: ['view'],
      },
    },
  },

  dailyAnalysis: {
    pageKey: 'DailyAnalysis',
    displayName: 'Tagesabschluss',
    category: 'Analytics',
    sections: {
      view: {
        key: 'daily_view',
        displayName: 'Ansehen',
        actions: ['view'],
      },
      manage: {
        key: 'daily_manage',
        displayName: 'Verwalten',
        actions: ['view', 'edit'],
      },
    },
  },

  shiftAnalytics: {
    pageKey: 'ShiftAnalytics',
    displayName: 'Schichtanalyse',
    category: 'Analytics',
    sections: {
      view: {
        key: 'shiftanalytics_view',
        displayName: 'Ansehen',
        actions: ['view'],
      },
    },
  },

  wastage: {
    pageKey: 'Wastage',
    displayName: 'Schwund',
    category: 'Inventory',
    sections: {
      record: {
        key: 'wastage_record',
        displayName: 'Erfassen',
        actions: ['view', 'edit'],
      },
      analyze: {
        key: 'wastage_analyze',
        displayName: 'Analysieren',
        actions: ['view'],
      },
    },
  },

  documents: {
    pageKey: 'Documents',
    displayName: 'Dokumente',
    category: 'Admin',
    sections: {
      view: {
        key: 'documents_view',
        displayName: 'Ansehen',
        actions: ['view'],
      },
      manage: {
        key: 'documents_manage',
        displayName: 'Verwalten',
        actions: ['view', 'edit'],
      },
    },
  },

  auditLog: {
    pageKey: 'AuditLog',
    displayName: 'Audit-Log',
    category: 'Admin',
    sections: {
      view: {
        key: 'auditlog_view',
        displayName: 'Ansehen',
        actions: ['view'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────
  // BUCHHALTUNG
  // ────────────────────────────────────────────────────────────────
  accountingDashboard: {
    pageKey: 'AccountingDashboard',
    displayName: 'Buchhaltung Dashboard',
    description: 'Übersicht über alle Buchhaltungsdaten und -aufgaben',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_dashboard',
        displayName: 'Dashboard ansehen',
        description: 'Buchhaltungs-Dashboard anschauen',
        actions: ['view'],
      },
    },
  },

  accountingCashbook: {
    pageKey: 'AccountingCashbook',
    displayName: 'Kassenbuch',
    description: 'Kassenein- und -ausgaben erfassen und verwalten',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_cashbook_view',
        displayName: 'Kassenbuch ansehen',
        description: 'Kassenbuch-Einträge einsehen',
        actions: ['view'],
      },
      edit: {
        key: 'accounting_cashbook_edit',
        displayName: 'Kassenbuch bearbeiten',
        description: 'Einträge erstellen und bearbeiten',
        actions: ['view', 'edit'],
      },
      export: {
        key: 'accounting_cashbook_export',
        displayName: 'Kassenbuch exportieren',
        description: 'Kassenbuch als CSV/DATEV exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  accountingReceipts: {
    pageKey: 'AccountingReceipts',
    displayName: 'Belege',
    description: 'Eingangs- und Ausgangsbelege hochladen, prüfen und freigeben',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_receipts_view',
        displayName: 'Belege ansehen',
        description: 'Belege einsehen und durchsuchen',
        actions: ['view'],
      },
      upload: {
        key: 'accounting_receipts_upload',
        displayName: 'Belege hochladen',
        description: 'Neue Belege hochladen und KI-Erkennung starten',
        actions: ['view', 'edit'],
      },
      approve: {
        key: 'accounting_receipts_approve',
        displayName: 'Belege freigeben',
        description: 'Belege prüfen und für Export freigeben',
        actions: ['view', 'edit', 'approve'],
      },
      export: {
        key: 'accounting_receipts_export',
        displayName: 'Belege exportieren',
        description: 'Belege als CSV exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  accountingCreditors: {
    pageKey: 'AccountingCreditors',
    displayName: 'Kreditoren',
    description: 'Eingangsrechnungen von Lieferanten verwalten',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_creditors_view',
        displayName: 'Kreditoren ansehen',
        description: 'Eingangsrechnungen einsehen',
        actions: ['view'],
      },
      edit: {
        key: 'accounting_creditors_edit',
        displayName: 'Kreditoren bearbeiten',
        description: 'Rechnungen erfassen und Zahlungsstatus aktualisieren',
        actions: ['view', 'edit', 'delete'],
      },
      export: {
        key: 'accounting_creditors_export',
        displayName: 'Kreditoren exportieren',
        description: 'Kreditoren-Daten exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  accountingDebitors: {
    pageKey: 'AccountingDebitors',
    displayName: 'Debitoren',
    description: 'Ausgangsrechnungen an Kunden verwalten',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_debitors_view',
        displayName: 'Debitoren ansehen',
        description: 'Ausgangsrechnungen einsehen',
        actions: ['view'],
      },
      edit: {
        key: 'accounting_debitors_edit',
        displayName: 'Debitoren bearbeiten',
        description: 'Rechnungen erstellen und Zahlungsstatus aktualisieren',
        actions: ['view', 'edit', 'delete'],
      },
      export: {
        key: 'accounting_debitors_export',
        displayName: 'Debitoren exportieren',
        description: 'Debitoren-Daten exportieren',
        actions: ['view', 'export'],
      },
    },
  },

  accountingExport: {
    pageKey: 'AccountingExport',
    displayName: 'Exportcenter',
    description: 'DATEV- und CSV-Exporte erstellen und herunterladen',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_export_view',
        displayName: 'Export ansehen',
        description: 'Exportcenter einsehen',
        actions: ['view'],
      },
      export: {
        key: 'accounting_export_run',
        displayName: 'Exporte erstellen',
        description: 'DATEV- und CSV-Exporte generieren und herunterladen',
        actions: ['view', 'export'],
      },
    },
  },

  accountingMonthlyClosing: {
    pageKey: 'AccountingMonthlyClosing',
    displayName: 'Monatsabschluss',
    description: 'Monat prüfen, abschließen und sperren',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_closing_view',
        displayName: 'Monatsabschluss ansehen',
        description: 'Status und Checkliste einsehen',
        actions: ['view'],
      },
      close: {
        key: 'accounting_closing_close',
        displayName: 'Monat abschließen',
        description: 'Monat als abgeschlossen markieren',
        actions: ['view', 'edit', 'close'],
      },
      lock: {
        key: 'accounting_closing_lock',
        displayName: 'Monat sperren',
        description: 'Monat endgültig sperren (nur Admin)',
        actions: ['view', 'edit', 'lock'],
      },
    },
  },

  accountingDatev: {
    pageKey: 'AccountingExport',
    displayName: 'DATEV Export',
    description: 'DATEV-konforme Buchungsdaten exportieren',
    category: 'Buchhaltung',
    sections: {
      view: {
        key: 'accounting_datev_view',
        displayName: 'DATEV ansehen',
        description: 'DATEV-Export einsehen',
        actions: ['view'],
      },
      export: {
        key: 'accounting_datev_export',
        displayName: 'DATEV exportieren',
        description: 'DATEV-Datei generieren und herunterladen',
        actions: ['view', 'export'],
      },
    },
  },
};

/**
 * STANDARD-ROLLEN
 * 
 * Template-basierte Rechte, die pro Mitarbeiter überschreibbar sind
 */
export const STANDARD_ROLES = {
  admin: {
    displayName: 'Admin',
    description: 'Vollständiger Zugriff auf alle Funktionen',
    permissions: {}, // wird weiter unten mit 'edit' für alles gefüllt
  },

  manager: {
    displayName: 'Manager',
    description: 'Manager-Funktionen: Planung, Genehmigungen, Team-Übersicht',
    permissions: {
      // Dashboard & Überblick
      dashboard_overview: 'view',
      dashboard_warnings: 'view',
      dashboard_manager: 'edit',

      // Schichtplan
      shifts_overview: 'view',
      shifts_create: 'edit',
      shifts_edit: 'edit',
      shifts_swap: 'edit',
      shifts_calendar: 'view',

      // Zeiterfassung
      time_own: 'view',
      time_team: 'view',
      time_approvals: 'edit',
      time_clockout: 'edit',

      // Urlaub
      vacation_own: 'view',
      vacation_approve: 'edit',
      vacation_overview: 'view',

      // Mitarbeiter
      employees_list: 'view',
      employees_manage: 'edit',
      employees_permissions: 'edit',

      // Reports
      reports_view: 'view',
      reports_analysis: 'view',

      // Reservierungen
      reservations_view: 'view',
      reservations_create: 'edit',
      reservations_edit: 'edit',

      // Team-Verwaltung
      teammeeting_topics: 'view',
      teammeeting_manage: 'edit',
      cleaning_manage: 'edit',
      maintenance_tasks: 'edit',

      // Einkauf
      shopping_list: 'edit',
      shopping_articles: 'view',
      shopping_suppliers: 'view',

      // Buchhaltung (Manager: alles außer Sperren)
      accounting_dashboard: 'view',
      accounting_cashbook_view: 'view',
      accounting_cashbook_edit: 'edit',
      accounting_cashbook_export: 'edit',
      accounting_receipts_view: 'view',
      accounting_receipts_upload: 'edit',
      accounting_receipts_approve: 'edit',
      accounting_receipts_export: 'edit',
      accounting_creditors_view: 'view',
      accounting_creditors_edit: 'edit',
      accounting_creditors_export: 'edit',
      accounting_debitors_view: 'view',
      accounting_debitors_edit: 'edit',
      accounting_debitors_export: 'edit',
      accounting_export_view: 'view',
      accounting_export_run: 'edit',
      accounting_closing_view: 'view',
      accounting_closing_close: 'edit',
      accounting_datev_view: 'view',
      accounting_datev_export: 'edit',

      // Weitere Standardrechte
      myarea_overview: 'view',
      myshifts_overview: 'view',
      teamcalendar_view: 'view',
    },
  },

  employee: {
    displayName: 'Mitarbeiter',
    description: 'Basis-Zugriff: Meine Schichten, Zeiten, Aufgaben',
    permissions: {
      // Dashboard
      dashboard_overview: 'view',

      // Schichtplan (einsehen + Tausch)
      shifts_overview: 'view',
      shifts_swap: 'view',
      shifts_unavailable: 'edit',
      shifts_calendar: 'view',

      // Zeiterfassung (eigen)
      time_own: 'edit',
      time_team: 'view',

      // Meine Daten
      employees_own: 'edit',
      myarea_overview: 'view',
      myshifts_overview: 'view',

      // Aufgaben
      todos_own: 'view',
      todos_all: 'view',

      // Reservierungen (lesen)
      reservations_view: 'view',

      // Menu
      menu_view: 'view',

      // Getränkekarte & Rezepte
      recipes_view: 'view',

      // Teamsitzung
      teammeeting_topics: 'view',

      // Buchhaltung: Belege hochladen, eigene ansehen
      accounting_receipts_view: 'view',
      accounting_receipts_upload: 'edit',

      // Settings
      settings_profile: 'edit',
      settings_notifications: 'edit',
    },
  },

  taxAdvisor: {
    displayName: 'Steuerberater',
    description: 'Nur-Lese-Zugriff auf Buchhaltungsdaten, Export, Kommentare',
    permissions: {
      accounting_dashboard: 'view',
      accounting_cashbook_view: 'view',
      accounting_cashbook_export: 'view',
      accounting_receipts_view: 'view',
      accounting_receipts_export: 'view',
      accounting_creditors_view: 'view',
      accounting_creditors_export: 'view',
      accounting_debitors_view: 'view',
      accounting_debitors_export: 'view',
      accounting_export_view: 'view',
      accounting_export_run: 'view',
      accounting_closing_view: 'view',
      accounting_datev_view: 'view',
      accounting_datev_export: 'edit',
    },
  },
};

// Admin-Rolle: alles auf 'edit'
STANDARD_ROLES.admin.permissions = Object.entries(PERMISSION_REGISTRY).reduce((acc, [key, page]) => {
  Object.entries(page.sections || {}).forEach(([sectionKey, section]) => {
    acc[section.key] = 'edit';
  });
  return acc;
}, {});

/**
 * Helper: Berechtigungen für einen Mitarbeiter zusammenstellen
 * 
 * Combines role template + individual overrides
 */
export function getEmployeePermissions(employee) {
  const role = employee.role || 'employee';
  const roleTemplate = STANDARD_ROLES[role.toLowerCase()] || STANDARD_ROLES.employee;
  
  // Basis: Rollen-Template
  const merged = { ...roleTemplate.permissions };

  // Überrides aus employee.permissions (falls vorhanden)
  if (employee.permissions && typeof employee.permissions === 'object') {
    Object.assign(merged, employee.permissions);
  }

  return merged;
}

/**
 * Helper: Check ob Mitarbeiter Zugriff auf einen Bereich hat
 */
export function canAccessPermission(employee, permissionKey, requiredLevel = 'view') {
  const perms = getEmployeePermissions(employee);
  const level = perms[permissionKey] || 'none';

  if (level === 'none') return false;
  if (requiredLevel === 'view') return level !== 'none';
  if (requiredLevel === 'edit') return level === 'edit';
  
  return false;
}