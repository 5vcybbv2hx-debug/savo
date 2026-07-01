import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Separator } from '@/components/ui/separator';
import { usePermissions } from '@/components/auth/usePermissions';
import CalendarSubscribeSection from './CalendarSubscribeSection';
import ShiftPlanPDFSection from './ShiftPlanPDFSection';

export default function CalendarExportTab({ activeTab }) {
    const permissions = usePermissions();

    const { data: shifts = [] } = useQuery({
        queryKey: ['calendar-export-shifts'],
        // ⚠️ Limit erhoeht — 750 Shifts im System, Export durfte keine
        // aelteren Schichten verschweigen.
        queryFn: () => base44.entities.Shift.list('-date', 3000),
        enabled: activeTab === 'calendar'
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['calendar-export-employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        enabled: activeTab === 'calendar' && (permissions.isManager || permissions.isAdmin)
    });

    const { data: company } = useQuery({
        queryKey: ['company-info'],
        queryFn: () => base44.entities.CompanyInfo.list().then(r => r[0] || null),
        enabled: activeTab === 'calendar'
    });

    return (
        <div className="space-y-6">
            <CalendarSubscribeSection />

            {(permissions.isManager || permissions.isAdmin) && (
                <>
                    <Separator />
                    <ShiftPlanPDFSection
                        shifts={shifts}
                        employees={employees}
                        companyName={company?.company_name || 'Bar'}
                    />
                </>
            )}
        </div>
    );
}