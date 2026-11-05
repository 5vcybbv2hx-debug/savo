import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { useErrorHandler } from '@/components/error/ErrorHandler';
import { usePermissions } from '@/components/auth/usePermissions';
import SmartDashboard from '@/components/dashboard/SmartDashboard';
import CalendarSyncBanner from '@/components/dashboard/CalendarSyncBanner';

export default function Dashboard() {
    const permissions = usePermissions();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.SLOW,
    });

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const { handleError } = useErrorHandler();

    if (permissions.isLoading || !user) {
        return (
            <div className="min-h-screen bg-background pb-28 md:pb-8">
                <div className="max-w-2xl mx-auto px-5 py-4 sm:py-6 space-y-3 animate-pulse">
                    <div className="space-y-2 pt-1">
                        <div className="h-5 w-40 rounded-md bg-surface" />
                        <div className="h-3 w-28 rounded-md bg-surface" />
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="grid grid-cols-3 gap-2">
                            {[0, 1, 2].map(i => <div key={i} className="h-[62px] rounded-xl bg-surface" />)}
                        </div>
                    </div>
                    <div className="h-12 rounded-xl border border-border bg-card" />
                    <div className="h-[88px] rounded-2xl border border-border bg-card" />
                    <div className="h-[120px] rounded-2xl border border-border bg-card" />
                </div>
            </div>
        );
    }

    const currentEmployee = employees.find(e => e.email === user.email);

    return (
        <>
        <CalendarSyncBanner employee={currentEmployee || null} />
        <SmartDashboard
            currentUser={user}
            currentEmployee={currentEmployee || null}
            isManager={permissions.isManager}
            permissions={permissions}
        />
        </>
    );
}