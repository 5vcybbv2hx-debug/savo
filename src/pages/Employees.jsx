/**
 * Mitarbeiter — Teamübersicht
 *
 * v2 Verbesserungen:
 *  - Toolbar konsolidiert: nur + Neu + ··· Mehr-Dropdown für seltene Aktionen
 *  - Suche als Toggle (Lupe-Icon)
 *  - Skill-Filter dynamisch aus vorhandenen Skills generiert
 *  - Einladungs-Status sichtbar auf Karte (Mail-Icon wenn noch nicht eingeladen)
 *  - Urlaubs-/Abwesenheits-Indikator pro Karte
 *  - Ehemalige bleibt aufklappbar
 */
import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import EmployeeAvatar from '@/components/employees/EmployeeAvatar';
import EmployeeDeleteDialog from '@/components/employees/EmployeeDeleteDialog';
import WorkTimeModelsManager from '@/components/employees/WorkTimeModelsManager';
import PersonalFormDigital from '@/components/employees/PersonalFormDigital';
import PersonalFormUploader from '@/components/employees/PersonalFormUploader';
import EmployeesCSVExport from '@/components/employees/EmployeesCSVExport';
import PDFExportButton from '@/components/export/PDFExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    Plus, Search, Phone, MessageCircle, Archive,
    ChevronRight, Users, AlertCircle, X, MoreHorizontal,
    UserCheck, Palmtree, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { createNotification } from '@/utils/createNotification';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROLE_COLORS = {
    'Aushilfe': 'bg-muted/80 text-muted-foreground border border-border',
    'Vollzeit':  'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    'Manager':   'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    'Teilzeit':  'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
};

function getVacationStatus(vacations, employeeId) {
    if (!vacations?.length) return null;
    const today = new Date();
    const active = vacations.find(v =>
        v.employee_id === employeeId &&
        v.status === 'genehmigt' &&
        isWithinInterval(today, {
            start: parseISO(v.start_date),
            end:   parseISO(v.end_date),
        })
    );
    return active || null;
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Employees() {
    const permissions  = usePermissions();
    const navigate     = useNavigate();
    const queryClient  = useQueryClient();

    const [searchOpen,   setSearchOpen]   = useState(false);
    const [search,       setSearch]       = useState('');
    const [skillFilter,  setSkillFilter]  = useState([]);
    const [showInactive, setShowInactive] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [inviting,     setInviting]     = useState(null);

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn:  () => base44.entities.Employee.list('name', 500),
        staleTime: STALE.MEDIUM,
    });

    const { data: companyInfo } = useQuery({
        queryKey: ['company-info'],
        queryFn:  async () => { const r = await base44.entities.CompanyInfo.list('-last_updated', 1); return r?.[0] || null; },
        staleTime: STALE.SLOW,
    });

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn:  () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const { data: vacations = [] } = useQuery({
        queryKey: ['vacations-active'],
        queryFn:  () => base44.entities.VacationRequest.filter({ status: 'genehmigt' }, '-start_date', 200),
        staleTime: STALE.MEDIUM,
    });

    // ── Dynamische Skills aus vorhandenen Mitarbeitern ────────────────────────
    const allSkills = useMemo(() => {
        const set = new Set();
        employees.forEach(e => e.skills?.forEach(s => set.add(s)));
        return [...set].sort();
    }, [employees]);

    // ── Listen ────────────────────────────────────────────────────────────────
    const active = useMemo(() =>
        employees.filter(e => {
            if (e.is_active === false) return false;
            const q = search.toLowerCase();
            const matchSearch = !search
                || (e.name  || '').toLowerCase().includes(q)
                || (e.role  || '').toLowerCase().includes(q)
                || (e.email || '').toLowerCase().includes(q);
            const matchSkills = skillFilter.length === 0 ||
                skillFilter.every(s => e.skills?.includes(s));
            return matchSearch && matchSkills;
        }),
        [employees, search, skillFilter]
    );

    const inactive     = useMemo(() => employees.filter(e => e.is_active === false), [employees]);
    const missingEmail = useMemo(() => active.filter(e => !e.email), [active]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const toggleSkill = s =>
        setSkillFilter(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

    const handleInvite = async emp => {
        if (!emp.email) { toast.error('Keine E-Mail hinterlegt'); return; }
        setInviting(emp.id);
        try {
            const appRole = emp.role === 'Manager' ? 'admin' : 'user';
            await base44.users.inviteUser(emp.email, appRole);
            await createNotification({
                type: 'invite_sent', title: 'Einladung gesendet',
                message: `${emp.name} wurde zur App eingeladen.`,
                relatedId: emp.id,
            });
            toast.success(`Einladung an ${emp.name} gesendet`);
        } catch (err) {
            const reason = err?.message || err?.error || 'Unbekannter Fehler';
            toast.error(`Einladung fehlgeschlagen: ${reason}`);
        } finally {
            setInviting(null);
        }
    };

    // ── Permission guard ──────────────────────────────────────────────────────
    if (permissions.isLoading) return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
            <div className="h-10 rounded-xl animate-shimmer bg-muted" />
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl animate-shimmer bg-muted" />
            ))}
        </div>
    );

    if (!permissions.canViewEmployees) return <PermissionDenied />;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Mitarbeiter</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {active.length} aktiv{inactive.length > 0 ? ` · ${inactive.length} ehemalig` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Suche-Toggle */}
                        <button
                            onClick={() => { setSearchOpen(s => !s); if (searchOpen) setSearch(''); }}
                            className={cn(
                                'w-9 h-9 flex items-center justify-center rounded-lg border transition-all',
                                searchOpen
                                    ? 'bg-accent border-border text-foreground'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                            )}>
                            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                        </button>

                        {/* WhatsApp Gruppe */}
                        {companyInfo?.whatsapp_group_link && (
                            <a href={companyInfo.whatsapp_group_link}
                                target="_blank" rel="noopener noreferrer"
                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-all"
                                title="Team-WhatsApp-Gruppe">
                                <MessageCircle className="w-4 h-4" />
                            </a>
                        )}

                        {/* Mehr-Dropdown für seltene Aktionen */}
                        {permissions.isManager && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem asChild>
                                        <WorkTimeModelsManager asMenuItem />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <PersonalFormDigital
                                            asMenuItem
                                            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
                                        />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <PersonalFormUploader
                                            asMenuItem
                                            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
                                        />
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <EmployeesCSVExport employees={active} asMenuItem />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <PDFExportButton
                                            asMenuItem
                                            data={active}
                                            filename="mitarbeiter"
                                            title="Mitarbeiterliste"
                                            columns={[
                                                { label: 'Name',        field: 'name'          },
                                                { label: 'Rolle',       field: 'role'          },
                                                { label: 'Vertrag',     field: 'contract_type' },
                                                { label: 'Stundensatz', render: e => e.hourly_rate ? `${e.hourly_rate} €` : '-' },
                                                { label: 'Email',       field: 'email'         },
                                            ]}
                                        />
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Neuer Mitarbeiter */}
                        {permissions.isManager && (
                            <Button
                                onClick={() => navigate('/EmployeeProfile/new')}
                                className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Neu</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Suche (Toggle) ───────────────────────────────────────── */}
                {searchOpen && (
                    <Input autoFocus
                        placeholder="Name, Rolle oder E-Mail…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-10" />
                )}

                {/* ── Skill-Filter (dynamisch) ─────────────────────────────── */}
                {allSkills.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                        {allSkills.map(s => (
                            <button key={s} onClick={() => toggleSkill(s)}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                                    skillFilter.includes(s)
                                        ? 'bg-amber-600 border-amber-600 text-white'
                                        : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                                )}>
                                {s}
                            </button>
                        ))}
                        {skillFilter.length > 0 && (
                            <button onClick={() => setSkillFilter([])}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-all whitespace-nowrap">
                                ✕ Filter
                            </button>
                        )}
                    </div>
                )}

                {/* ── Alert: fehlende E-Mails ──────────────────────────────── */}
                {permissions.isManager && missingEmail.length > 0 && (
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/8 border border-amber-500/25">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-400">
                                {missingEmail.length} Mitarbeiter ohne E-Mail
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {missingEmail.map(e => e.name).join(', ')}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Mitarbeiter-Liste ────────────────────────────────────── */}
                {isLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-16 rounded-xl animate-shimmer bg-muted" />
                        ))}
                    </div>
                ) : active.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="font-semibold text-foreground">Keine Mitarbeiter gefunden</p>
                        <p className="text-sm mt-1">Filter anpassen oder neuen Mitarbeiter anlegen</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {active.map(emp => {
                            const isOwn      = currentUser?.email === emp.email;
                            const onVacation = getVacationStatus(vacations, emp.id);
                            const hasNoInvite = !emp.email;

                            return (
                                <div key={emp.id}
                                    onClick={() => navigate(`/EmployeeProfile/${emp.id}`)}
                                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card hover:border-border cursor-pointer transition-all group min-h-[64px]">

                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <EmployeeAvatar employee={emp} size="sm" />
                                        {onVacation && (
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center border border-background" title="Im Urlaub">
                                                <Palmtree className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="text-sm font-semibold text-foreground truncate">{emp.name}</p>
                                            {isOwn && (
                                                <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5 font-bold shrink-0">
                                                    Ich
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', ROLE_COLORS[emp.role] || 'bg-muted text-muted-foreground')}>
                                                {emp.role}
                                            </span>
                                            {emp.skills?.slice(0, 2).map(s => (
                                                <span key={s} className="text-[10px] text-muted-foreground">· {s}</span>
                                            ))}
                                            {onVacation && (
                                                <span className="text-[10px] text-blue-400 font-medium">
                                                    · Urlaub bis {format(parseISO(onVacation.end_date), 'dd.MM.', { locale: de })}
                                                </span>
                                            )}
                                            {permissions.isManager && (
                                                <Link
                                                    to={`${createPageUrl('TimeManagement')}?employee=${emp.id}`}
                                                    onClick={e => e.stopPropagation()}
                                                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                                                    title="Zeiterfassung öffnen"
                                                >
                                                    <Clock className="w-2.5 h-2.5" />
                                                    Zeiten
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {/* Aktionen */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Keine E-Mail — Badge statt Icon */}
                                        {permissions.isManager && hasNoInvite && (
                                            <span className="text-[9px] font-semibold px-1.5 py-1 rounded-full bg-muted text-muted-foreground/60 border border-border shrink-0"
                                                title="Keine E-Mail hinterlegt — kann nicht eingeladen werden">
                                                Keine Mail
                                            </span>
                                        )}
                                        {permissions.isManager && emp.email && (
                                            <button
                                                onClick={e => { e.stopPropagation(); handleInvite(emp); }}
                                                disabled={inviting === emp.id}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-all min-h-[44px] min-w-[44px]"
                                                title="App-Einladung senden">
                                                {inviting === emp.id
                                                    ? <Clock className="w-3.5 h-3.5 animate-pulse" />
                                                    : <UserCheck className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                        )}
                                        {/* Schnellkontakt */}
                                        {emp.phone && (
                                            <>
                                                <a href={`tel:${emp.phone}`}
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-all min-h-[44px] min-w-[44px]"
                                                    title="Anrufen">
                                                    <Phone className="w-3.5 h-3.5" />
                                                </a>
                                                <a href={`https://wa.me/${emp.phone.replace(/\D/g, '')}`}
                                                    target="_blank" rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all min-h-[44px] min-w-[44px]"
                                                    title="WhatsApp">
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                </a>
                                            </>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-0.5" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Ehemalige ────────────────────────────────────────────── */}
                {permissions.isManager && inactive.length > 0 && (
                    <div className="pt-2">
                        <button
                            onClick={() => setShowInactive(v => !v)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-all text-sm font-medium w-full">
                            <Archive className="w-4 h-4" />
                            Ehemalige ({inactive.length})
                            <span className="ml-auto text-xs">{showInactive ? '▲' : '▼'}</span>
                        </button>
                        {showInactive && (
                            <div className="space-y-2 mt-2">
                                {inactive.map(emp => (
                                    <div key={emp.id}
                                        onClick={() => navigate(`/EmployeeProfile/${emp.id}`)}
                                        className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/30 bg-card opacity-50 hover:opacity-70 cursor-pointer transition-all min-h-[56px]">
                                        <EmployeeAvatar employee={emp} size="sm" className="shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{emp.name}</p>
                                            <p className="text-xs text-muted-foreground">{emp.role} · Ehemals</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Dialog */}
            {deleteTarget && (
                <EmployeeDeleteDialog
                    employee={deleteTarget}
                    currentUser={currentUser}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}