/**
 * CalendarMoreMenu — MoreVertical-Dropdown für den Schichtplan-Header.
 * Bündelt alle Verwaltungsfunktionen: Filter, Schnell-Planen, Schichtwünsche,
 * Export (JSON/ICS), Schicht-Anforderungen, Standard-Regeln, Monats-Check.
 *
 * Props: { permissions, shifts, reservations, onToggleFilters, onQuickPlan,
 *          onWishes, onBackup, onAdminModal }
 */
import React from 'react';
import { MoreVertical, Filter, Zap, CalendarDays, Download, Users, Settings2, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { exportCalendarICS } from '@/components/shifts/CalendarExport';

export default function CalendarMoreMenu({
    permissions, shifts, reservations,
    onToggleFilters, onQuickPlan, onWishes, onBackup, onAdminModal,
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Mehr Optionen" className="h-9 w-9">
                    <MoreVertical className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onToggleFilters}>
                    <Filter className="w-4 h-4 mr-2" /> Filter
                </DropdownMenuItem>
                {permissions.isManager && (
                    <DropdownMenuItem onClick={onQuickPlan}>
                        <Zap className="w-4 h-4 mr-2" /> Schnell-Planen
                    </DropdownMenuItem>
                )}
                {permissions.isManager && (
                    <DropdownMenuItem onClick={onWishes}>
                        <CalendarDays className="w-4 h-4 mr-2" /> Schichtwünsche
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Export</DropdownMenuLabel>
                <DropdownMenuItem onClick={onBackup}>
                    <Download className="w-4 h-4 mr-2" /> JSON Backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCalendarICS(shifts, reservations)}>
                    <Download className="w-4 h-4 mr-2" /> Kalender (ICS)
                </DropdownMenuItem>
                {permissions.isAdmin && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Verwaltung</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onAdminModal('requirements')}>
                            <Users className="w-4 h-4 mr-2" /> Schicht-Anforderungen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAdminModal('rules')}>
                            <Settings2 className="w-4 h-4 mr-2" /> Standard-Regeln
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAdminModal('monthly')}>
                            <CalendarCheck className="w-4 h-4 mr-2" /> Monats-Check
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}