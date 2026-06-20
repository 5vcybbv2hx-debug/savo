import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, endOfWeek, parseISO, addDays, subDays } from 'date-fns';
import { getTodayOperationDate } from '@/lib/nightUtils';
import { getTaskStatus } from '@/lib/maintenanceUtils';
import { STALE } from '@/lib/queryUtils';

export function useDashboardData({ isManager, currentEmployee }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const twoWeeksLater = format(addDays(new Date(), 14), 'yyyy-MM-dd');

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts-dashboard', today],
        queryFn: () => base44.entities.Shift.filter({ date_gte: subDays(new Date(), 1).toISOString().slice(0, 10) }, 'date', 500),
        staleTime: STALE.SLOW,
        gcTime: 15 * 60_000,
    });

    const { data: events = [] } = useQuery({
        queryKey: ['events'],
        queryFn: () => base44.entities.Event.list('date', 30),
        staleTime: STALE.SLOW,
        gcTime: 15 * 60_000,
    });

    const { data: reservations = [] } = useQuery({
        queryKey: ['reservations', 'active'],
        queryFn: () => base44.entities.Reservation.filter({ is_archived: false }, '-date', 100),
        staleTime: STALE.MEDIUM,
        gcTime: 10 * 60_000,
    });

    const { data: todos = [] } = useQuery({
        queryKey: ['todos'],
        queryFn: () => base44.entities.TodoItem.filter({ is_archived: false }),
        staleTime: STALE.SLOW,
        gcTime: 15 * 60_000,
    });
    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
        gcTime: 20 * 60_000,
    });
    const { data: articles = [] } = useQuery({
        queryKey: ['articles-low-stock'],
        queryFn: () => base44.entities.Article.list('name', 100),
        staleTime: STALE.SLOW,
        gcTime: 15 * 60_000,
        enabled: isManager,
        select: (data) => data.filter(a => a.min_stock > 0 && a.current_stock <= a.min_stock),
    });
    const { data: shopping = [] } = useQuery({
        queryKey: ['shopping-list'],
        queryFn: () => base44.entities.ShoppingList.list('-created_date', 50),
        staleTime: STALE.SLOW,
        enabled: isManager,
    });
    const { data: maintenanceTasks = [] } = useQuery({
        queryKey: ['maintenance-tasks'],
        queryFn: () => base44.entities.MaintenanceTask.filter({ is_active: true }),
        enabled: isManager,
        staleTime: STALE.SLOW,
    });
    const { data: timeEntries = [] } = useQuery({
        queryKey: ['time-entries-dashboard'],
        queryFn: () => base44.entities.TimeEntry.list('-date', isManager ? 80 : 20),
        staleTime: STALE.MEDIUM,
    });

    // Ausstehend = status='eingereicht' ODER employee_confirmed=true — noch nicht vom Manager genehmigt
    const pendingTimeEntries = isManager ? timeEntries.filter(e =>
        (e.status === 'eingereicht' || e.employee_confirmed === true) &&
        e.status !== 'genehmigt'
    ) : [];

    const { data: vacationRequests = [] } = useQuery({
        queryKey: ['vacation-requests'],
        queryFn: () => base44.entities.VacationRequest.list('-created_date', 20),
        enabled: isManager,
        staleTime: STALE.SLOW,
    });

    // Derived values
    const todayShifts = shifts.filter(s => s.date === today);
    const todayEvents = events.filter(e => e.date === today && e.status !== 'abgesagt');
    const todayReservations = reservations.filter(r => r.date === today && r.status !== 'storniert');
    const upcomingEvents = events.filter(e => new Date(e.date) > new Date());
    const openTodos = todos.filter(t => t.status !== 'erledigt');

    const myTodos = currentEmployee
        ? openTodos.filter(t => t.assigned_to === currentEmployee.email || t.assigned_to === currentEmployee.name)
        : openTodos;

    const upcomingShifts = useMemo(() => {
        const future = shifts.filter(s => s.date >= today);
        return future.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
    }, [shifts, today]);

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEntries = timeEntries.filter(e => {
        if (e.employee_id !== currentEmployee?.id) return false;
        const d = parseISO(e.date);
        return d >= weekStart && d <= weekEnd;
    });
    const hoursThisWeek = weekEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);

    const myUpcomingShifts = shifts.filter(s => s.employee_id === currentEmployee?.id && s.date >= today);
    const approvedVacations = vacationRequests.filter(v => v.employee_id === currentEmployee?.id && v.status === 'genehmigt' && v.type === 'Urlaub');
    const usedVacationDays = approvedVacations.reduce((sum, v) => sum + (v.days_count || 0), 0);
    const remainingVacationDays = (currentEmployee?.vacation_days_per_year || 0) - usedVacationDays;

    const pendingVacationRequests = vacationRequests.filter(r => r.status === 'beantragt');
    const urgentMaintenance = maintenanceTasks.filter(t => getTaskStatus(t) === 'überfällig');

    return {
        today,
        shifts,
        events,
        reservations,
        todos,
        employees,
        articles,
        shopping,
        maintenanceTasks,
        timeEntries,
        pendingTimeEntries,
        vacationRequests,
        // derived
        todayShifts,
        todayEvents,
        todayReservations,
        upcomingEvents,
        openTodos,
        myTodos,
        upcomingShifts,
        hoursThisWeek,
        myUpcomingShifts,
        remainingVacationDays,
        lowStockArticles: articles,
        pendingVacationRequests,
        urgentMaintenance,
    };
}