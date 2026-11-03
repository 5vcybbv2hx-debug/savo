/**
 * Centralized React Query key factory.
 * Use these everywhere to prevent inconsistencies and stale data.
 *
 * Usage:
 *   queryKey: QK.articles()
 *   queryKey: QK.articlesFiltered({ is_active: true })
 *   qc.invalidateQueries({ queryKey: QK.articles() })
 */

export const QK = {
  // Articles
  articles:         () => ['articles'],
  articlesFiltered: (filter) => ['articles', filter],

  // Storage hierarchy
  areas:        () => ['areas'],
  furniture:    () => ['furniture'],
  furnitureBy:  (areaId) => ['furniture', { areaId }],
  containers:   () => ['containers'],
  containersBy: (furnitureId) => ['containers', { furnitureId }],
  slots:        () => ['slots'],
  slotsBy:      (filter) => ['slots', filter],

  // Assignments / Stock
  assignments:      () => ['assignments'],
  assignmentsBy:    (filter) => ['assignments', filter],

  // Reservations
  reservations:     () => ['reservations'],
  reservationsBy:   (filter) => ['reservations', filter],

  // Tables / Rooms
  tables:           () => ['tables'],
  rooms:            () => ['rooms'],

  // Employees / Shifts
  employees:        () => ['employees'],
  shifts:           () => ['shifts'],
  shiftsBy:         (filter) => ['shifts', filter],

  // Todos
  todos:            () => ['todos'],
  todosBy:          (filter) => ['todos', filter],
  todoCategories:   () => ['todoCategories'],

  // Menu
  menuItems:        () => ['menuItems'],
  menuItemsBy:      (filter) => ['menuItems', filter],
  weeklySpecials:   () => ['weeklySpecials'],
  weeklySpecialItems: () => ['weeklySpecialItems'],

  // Events
  events:           () => ['events'],

  // Cleaning
  cleaningTasks:    () => ['cleaningTasks'],

  // Notifications
  notifications:    () => ['notifications'],

  // Time
  timeEntries:      () => ['timeEntries'],

  // Suppliers
  suppliers:        () => ['suppliers'],

  // Rundgang-Protokoll
  rundgangSessions:     (daysBack) => ['rundgangSessions', { daysBack }],
  rundgangSessionToday: (date) => ['rundgangSessions', 'today', date],
};

/**
 * Call this after any mutating operation to refresh all storage-related data.
 * queryClient.invalidateQueries(INVALIDATE.storage()) — invalidates all storage keys.
 */
export const INVALIDATE = {
  storage: () => ({ queryKey: ['areas'] }),
  storageAll: (qc) => {
    qc.invalidateQueries({ queryKey: QK.areas() });
    qc.invalidateQueries({ queryKey: QK.furniture() });
    qc.invalidateQueries({ queryKey: QK.containers() });
    qc.invalidateQueries({ queryKey: QK.slots() });
    qc.invalidateQueries({ queryKey: QK.assignments() });
  },
};