import { useState, useMemo, useEffect } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { usePermissions } from '@/components/auth/usePermissions';
import EmployeeAvatar from '@/components/employees/EmployeeAvatar';
import EmployeeDeleteDialog from '@/components/employees/EmployeeDeleteDialog';
import PermissionsManager from '@/components/employees/PermissionsManager';
import SalaryHistoryModal from '@/components/employees/SalaryHistoryModal';
import EmployeePersonalFormExport from '@/components/employees/EmployeePersonalFormExport';
import RVBefreiungExport from '@/components/employees/RVBefreiungExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { calculateCompletion, isComplete } from '@/lib/employeeCompleteness';
import { createNotification } from '@/utils/createNotification';
import {
  ArrowLeft, Save, Loader2, Phone, MessageCircle, Mail,
  UserPlus, ContactRound, Trash2, CheckCircle2, AlertCircle,
  User, FileText, Shield, Banknote, ShoppingBag, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const COLORS = [
  '#ef4444','#f97316','#f59e0b','#84cc16',
  '#22c55e','#14b8a6','#06b6d4','#0ea5e9',
  '#3b82f6','#6366f1','#8b5cf6','#a855f7',
  '#d946ef','#ec4899','#f43f5e','#64748b',
];

const roleColors = {
  'Aushilfe': 'bg-muted/80 text-muted-foreground border border-border',
  'Vollzeit':  'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  'Manager':   'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  'Teilzeit':  'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
};

const TABS = [
  { id: 'profil',    label: 'Profil',      icon: User },
  { id: 'vertrag',   label: 'Vertrag',     icon: Banknote },
  { id: 'zugang',    label: 'Zugang',      icon: Shield },
  { id: 'dokumente', label: 'Dokumente',   icon: FileText },
];

// ── Reusable field row ─────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="space-y-4">
      {title && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-2">{title}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function EmployeeProfile() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const queryClient    = useQueryClient();
  const permissions    = usePermissions();
  const isNew          = id === 'new';

  const BLANK = {
    name: '', short_name: '', employee_number: '', role: 'Aushilfe',
    skills: [], contract_type: '', hourly_rate: '', vacation_days_per_year: '',
    weekly_hours: '', color: COLORS[0], phone: '', email: '', birthday: '',
    birth_name: '', birth_place: '', nationality: '', entry_date: '',
    tshirt_size: '', pullover_size: '', street: '', postal_code: '', city: '',
    activity: '', education: '', tax_id: '', pension_number: '',
    health_insurance: '', pension_exemption: false, has_main_job: false,
    has_other_minijob: false, other_minijob_details: '', bank_name: '',
    iban: '', bic: '', is_active: true,
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  };

  const [form,        setForm]        = useState(BLANK);
  const [activeTab,   setActiveTab]   = useState('profil');
  const [showDelete,  setShowDelete]  = useState(false);
  const [dirty,       setDirty]       = useState(false);

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setDirty(true); };

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => base44.entities.Employee.get(id),
    enabled: !!id && !isNew,
    staleTime: STALE.MEDIUM,
  });

  // Sync employee data into form when loaded (onSuccess removed in React Query v5)
  React.useEffect(() => {
    if (employee) {
      setForm({ ...BLANK, ...employee });
      setDirty(false);
    }
  }, [employee?.id, employee?.updated_date]);

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: STALE.SLOW,
  });

  // ── Weiterblättern (Prev/Next) durch alle aktiven Mitarbeiter ─────────────
  const { data: navEmployees = [] } = useQuery({
    queryKey: ['employees-nav-list'],
    queryFn: async () => {
      const all = await base44.entities.Employee.list();
      return all
        .filter(e => e.is_active !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
    },
    enabled: !isNew,
    staleTime: STALE.MEDIUM,
  });

  const navIndex = !isNew ? navEmployees.findIndex(e => e.id === id) : -1;
  const navInfo = navIndex >= 0
    ? { index: navIndex, total: navEmployees.length, hasPrev: navIndex > 0, hasNext: navIndex < navEmployees.length - 1 }
    : null;

  const handleNavigateEmployee = (direction) => {
    if (navIndex < 0) return;
    const nextIdx = direction === 'next' ? navIndex + 1 : navIndex - 1;
    if (nextIdx < 0 || nextIdx >= navEmployees.length) return;
    if (dirty && !window.confirm('Ungespeicherte Änderungen verwerfen und zum nächsten Mitarbeiter wechseln?')) return;
    navigate(`/EmployeeProfile/${navEmployees[nextIdx].id}`);
  };

  // ── Derived permissions ───────────────────────────────────────────────────
  const isOwn   = currentUser?.email === employee?.email;
  // optimistic: wenn currentUser noch nicht geladen, eigenes Profil annehmen (verhindert flackerndes disabled)
  const canEdit = !currentUser ? true : (isOwn || permissions.isManager);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async (data) => {
      if (isNew) return base44.entities.Employee.create(data);
      // Track salary changes
      if (permissions.isManager && employee &&
          (employee.hourly_rate !== data.hourly_rate || employee.contract_type !== data.contract_type)) {
        await base44.entities.SalaryHistory.create({
          employee_id: id, employee_name: data.name,
          old_hourly_rate: employee.hourly_rate, new_hourly_rate: data.hourly_rate,
          old_contract_type: employee.contract_type, new_contract_type: data.contract_type,
          change_reason: 'Manuelle Anpassung',
          effective_date: new Date().toISOString().split('T')[0],
          changed_by: currentUser?.email || 'System',
        });
      }
      await base44.entities.Employee.update(id, data);
      if (isOwn && !permissions.isManager) {
        await createNotification({ type: 'employee_update', title: 'Mitarbeiterdaten geändert', message: `${data.name} hat Profildaten aktualisiert.`, relatedId: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      toast.success(isNew ? 'Mitarbeiter angelegt' : 'Gespeichert');
      setDirty(false);
      if (isNew) navigate(-1);
    },
    onError: e => toast.error('Fehler: ' + (e?.message || 'Unbekannt')),
  });

  const handleInvite = async () => {
    try {
      const appRole = form.role === 'Manager' ? 'admin' : 'user';
      await base44.users.inviteUser(form.email, appRole);
      toast.success(`Einladung an ${form.name} gesendet`);
    } catch (err) {
      const reason = err?.message || err?.error || 'Unbekannter Fehler';
      toast.error(`Einladung fehlgeschlagen: ${reason}`);
    }
  };

  const handleVCard = () => {
    const nameParts = form.name.trim().split(' ');
    const last  = nameParts.slice(-1)[0] || '';
    const first = nameParts.slice(0, -1).join(' ') || form.name;
    const bday  = form.birthday ? form.birthday.replace(/-/g, '') : '';
    const vcard = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `FN:${form.name}`, `N:${last};${first};;;`,
      form.phone ? `TEL;TYPE=CELL:${form.phone}` : '',
      form.email ? `EMAIL:${form.email}` : '',
      bday ? `BDAY:${bday}` : '',
      'ORG:Bar Team', `TITLE:${form.role || ''}`,
      'END:VCARD',
    ].filter(Boolean).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard;charset=utf-8' }));
    a.download = `${form.name.replace(/\s+/g, '_')}.vcf`;
    a.click();
  };

  const handleOrderItem = (type, size) => {
    base44.entities.TodoItem.create({
      title: `${type === 'tshirt' ? 'T-Shirt' : 'Pullover'} bestellen: ${form.name} (${size})`,
      category: 'Einkauf', priority: 'mittel', status: 'offen',
    }).then(() => toast.success('Bestellung zur Aufgabenliste hinzugefügt!'));
  };

  // ── Loading / error states ─────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );

  if (!isNew && !employee) return (
    <div className="p-6 text-center">
      <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
      <p className="text-muted-foreground">Mitarbeiter nicht gefunden.</p>
      <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">← Zurück</Button>
    </div>
  );

  const completion = employee ? calculateCompletion(employee) : 0;

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <div className="max-w-2xl mx-auto px-3 py-4">

        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* Avatar + name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isNew && (
              <EmployeeAvatar
                employee={form}
                size="sm"
                upload={canEdit}
                onUploaded={url => { set('profile_image_url', url); saveMut.mutate({ ...form, profile_image_url: url }); }}
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                {isNew ? 'Neuer Mitarbeiter' : form.name}
              </h1>
              {!isNew && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className={cn('text-[10px]', roleColors[form.role] || 'bg-muted text-muted-foreground')}>
                    {form.role}
                  </Badge>
                  {completion < 100 && (
                    <span className="text-[10px] text-amber-400">{completion}% vollständig</span>
                  )}
                  {completion === 100 && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Weiterblättern Prev/Next */}
          {!isNew && navInfo && (
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="text-[11px] text-muted-foreground tabular-nums mr-0.5 hidden sm:inline">
                {navInfo.index + 1} / {navInfo.total}
              </span>
              <button
                type="button"
                onClick={() => handleNavigateEmployee('prev')}
                disabled={!navInfo.hasPrev}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Vorheriger Mitarbeiter">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigateEmployee('next')}
                disabled={!navInfo.hasNext}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Nächster Mitarbeiter">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Save button */}
          {canEdit && (
            <Button
              onClick={() => saveMut.mutate(form)}
              disabled={saveMut.isPending || !dirty}
              className={cn(
                'shrink-0 min-h-[44px] transition-all',
                dirty ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-secondary text-muted-foreground'
              )}
            >
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="ml-1.5 hidden sm:inline">{dirty ? 'Speichern' : 'Gespeichert'}</span>
            </Button>
          )}
        </div>

        {/* ── Quick contact strip (not for new) ────────────────────── */}
        {!isNew && (form.phone || form.email) && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
            {form.phone && (
              <>
                <a href={`tel:${form.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground min-h-[44px] whitespace-nowrap"
                >
                  <Phone className="w-4 h-4 shrink-0" /> {form.phone}
                </a>
                <a href={`https://wa.me/${form.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm min-h-[44px] whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" /> WhatsApp
                </a>
              </>
            )}
            {form.email && (
              <a href={`mailto:${form.email}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-border text-sm text-muted-foreground min-h-[44px] whitespace-nowrap"
              >
                <Mail className="w-4 h-4 shrink-0" /> {form.email}
              </a>
            )}
            {(form.phone || form.email) && (
              <button onClick={handleVCard}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-border text-sm text-muted-foreground min-h-[44px] whitespace-nowrap hover:text-foreground transition-colors"
              >
                <ContactRound className="w-4 h-4 shrink-0" /> Kontakt
              </button>
            )}
          </div>
        )}

        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-medium transition-all min-h-[52px] touch-manipulation',
                activeTab === tab.id
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
            TAB: PROFIL
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'profil' && (
          <div className="space-y-6">

            <Section title="Basisdaten">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name *">
                  <Input value={form.name} onChange={e => set('name', e.target.value)} disabled={!canEdit} placeholder="Vorname Nachname" />
                </Field>
                <Field label="Kürzel / Spitzname">
                  <Input value={form.short_name} onChange={e => set('short_name', e.target.value)} disabled={!canEdit} maxLength={10} placeholder="z.B. Marco" />
                </Field>
                <Field label="Personalnr.">
                  <Input value={form.employee_number} onChange={e => set('employee_number', e.target.value)} disabled={!permissions.isManager} />
                </Field>
                <Field label="Rolle">
                  <Select value={form.role} onValueChange={v => set('role', v)} disabled={!permissions.isManager}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Aushilfe','Vollzeit','Teilzeit','Manager'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {permissions.isManager && (
                <Field label="Fähigkeiten">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Barkeeper','Service','Sonderaufgaben'].map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={form.skills?.includes(s)}
                          onCheckedChange={v => set('skills', v ? [...(form.skills||[]), s] : (form.skills||[]).filter(x=>x!==s))}
                        />
                        <span className="text-sm text-foreground">{s}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              {permissions.isManager && (
                <Field label="Farbe">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => set('color', c)}
                        className={cn('w-7 h-7 rounded-full border-2 transition-all', form.color === c ? 'border-white scale-110' : 'border-transparent')}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </Field>
              )}
            </Section>

            <Section title="Kontakt">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Telefon">
                  <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} disabled={!canEdit} placeholder="+49 …" />
                </Field>
                <Field label="E-Mail">
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={!canEdit} />
                </Field>
              </div>
            </Section>

            <Section title="Persönliche Daten">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Geburtstag">
                  <Input type="date" value={form.birthday} onChange={e => set('birthday', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="Geburtsname">
                  <Input value={form.birth_name} onChange={e => set('birth_name', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="Geburtsort">
                  <Input value={form.birth_place} onChange={e => set('birth_place', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="Nationalität">
                  <Input value={form.nationality} onChange={e => set('nationality', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="Eintrittsdatum">
                  <Input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} disabled={!permissions.isManager} />
                </Field>
              </div>
            </Section>

            <Section title="Adresse">
              <div className="space-y-3">
                <Field label="Straße">
                  <Input value={form.street} onChange={e => set('street', e.target.value)} disabled={!canEdit} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="PLZ">
                    <Input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} disabled={!canEdit} />
                  </Field>
                  <Field label="Stadt">
                    <Input value={form.city} onChange={e => set('city', e.target.value)} disabled={!canEdit} />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Notfallkontakt">
              <div className="space-y-3">
                <Field label="Name">
                  <Input
                    value={form.emergency_contact_name}
                    onChange={e => set('emergency_contact_name', e.target.value)}
                    disabled={!canEdit}
                    placeholder="z.B. Maria Muster"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefon">
                    <Input
                      type="tel"
                      value={form.emergency_contact_phone}
                      onChange={e => set('emergency_contact_phone', e.target.value)}
                      disabled={!canEdit}
                      placeholder="+49 …"
                    />
                  </Field>
                  <Field label="Beziehung">
                    <Input
                      value={form.emergency_contact_relation}
                      onChange={e => set('emergency_contact_relation', e.target.value)}
                      disabled={!canEdit}
                      placeholder="z.B. Ehepartner"
                    />
                  </Field>
                </div>
              </div>
            </Section>

            {permissions.isManager && (
              <Section title="Kleidung">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="T-Shirt Größe">
                    <Input value={form.tshirt_size} onChange={e => set('tshirt_size', e.target.value)} disabled={!permissions.isManager} />
                  </Field>
                  <Field label="Pullover Größe">
                    <Input value={form.pullover_size} onChange={e => set('pullover_size', e.target.value)} disabled={!permissions.isManager} />
                  </Field>
                </div>
                {(form.tshirt_size || form.pullover_size) && (
                  <div className="flex gap-2">
                    {form.tshirt_size && (
                      <Button variant="outline" size="sm" onClick={() => handleOrderItem('tshirt', form.tshirt_size)} className="flex-1">
                        <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> T-Shirt bestellen
                      </Button>
                    )}
                    {form.pullover_size && (
                      <Button variant="outline" size="sm" onClick={() => handleOrderItem('pullover', form.pullover_size)} className="flex-1">
                        <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> Pullover bestellen
                      </Button>
                    )}
                  </div>
                )}
              </Section>
            )}

            {permissions.isManager && !isNew && (
              <Section title="">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Mitarbeiter aktiv</p>
                    <p className="text-xs text-muted-foreground">Deaktiviert = Ehemaliger</p>
                  </div>
                  <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: VERTRAG
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'vertrag' && (
          <div className="space-y-6">
            <Section title="Vertrag & Vergütung">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Vertragsart">
                  <Select value={form.contract_type} onValueChange={v => set('contract_type', v)} disabled={!permissions.isManager}>
                    <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                    <SelectContent>
                      {['Minijob','Teilzeit','Vollzeit','Werkstudent'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Stundensatz (€)">
                  <Input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value === '' ? null : Number(e.target.value))} disabled={!permissions.isManager} />
                </Field>
                <Field label="Wochenstunden">
                  <Input type="number" step="0.5" value={form.weekly_hours} onChange={e => set('weekly_hours', e.target.value === '' ? null : Number(e.target.value))} disabled={!permissions.isManager} />
                </Field>
                <Field label="Urlaubstage / Jahr">
                  <Input type="number" value={form.vacation_days_per_year} onChange={e => set('vacation_days_per_year', e.target.value === '' ? null : Number(e.target.value))} disabled={!permissions.isManager} />
                </Field>
                <Field label="Tätigkeit">
                  <Input value={form.activity} onChange={e => set('activity', e.target.value)} disabled={!permissions.isManager} />
                </Field>
                <Field label="Ausbildung">
                  <Input value={form.education} onChange={e => set('education', e.target.value)} disabled={!canEdit} />
                </Field>
              </div>
            </Section>

            <Section title="Steuer & Soziales">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Steuer-ID">
                  <Input value={form.tax_id} onChange={e => set('tax_id', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="Rentenversicherungsnr.">
                  <Input value={form.pension_number} onChange={e => set('pension_number', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="Krankenkasse">
                  <Input value={form.health_insurance} onChange={e => set('health_insurance', e.target.value)} disabled={!canEdit} />
                </Field>
              </div>
              <div className="space-y-3 pt-1">
                {[
                  { key: 'pension_exemption', label: 'RV-Befreiung beantragt', desc: 'Minijob — Rentenversicherungsbefreiung' },
                  { key: 'has_main_job', label: 'Hauptbeschäftigung vorhanden', desc: 'Parallel zum Minijob' },
                  { key: 'has_other_minijob', label: 'Weiterer Minijob vorhanden', desc: '' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
                    </div>
                    <Switch checked={!!form[key]} onCheckedChange={v => set(key, v)} disabled={!canEdit} />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Bankdaten">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Bank">
                  <Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="IBAN">
                  <Input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} disabled={!canEdit} />
                </Field>
                <Field label="BIC">
                  <Input value={form.bic} onChange={e => set('bic', e.target.value.toUpperCase())} disabled={!canEdit} />
                </Field>
              </div>
            </Section>

            {!isNew && permissions.isManager && (
              <Section title="">
                <SalaryHistoryModal employee={form.id ? form : employee} />
              </Section>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: ZUGANG
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'zugang' && (
          <div className="space-y-4">
            {permissions.isManager && !isNew && (
              <>
                {form.email && (
                  <Button
                    onClick={handleInvite}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white min-h-[44px]"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    App-Zugang senden an {form.email}
                  </Button>
                )}
                {!form.email && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm text-amber-400 font-medium">Keine E-Mail hinterlegt</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Bitte im Profil-Tab nachtragen, dann kann eine Einladung versendet werden.</p>
                  </div>
                )}
                <div className="mt-4">
                  <PermissionsManager
                    employee={employee || form}
                    onSave={async (perms) => {
                      await base44.entities.Employee.update(id, { permissions: perms });
                      queryClient.invalidateQueries({ queryKey: ['employees'] });
                      toast.success('Berechtigungen aktualisiert');
                    }}
                  />
                </div>
              </>
            )}
            {!permissions.isManager && (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nur Manager können Zugänge verwalten.</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: DOKUMENTE
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'dokumente' && (
          <div className="space-y-4">
            {permissions.isManager && !isNew && (
              <>
                <EmployeePersonalFormExport
                  employee={employee || form}
                  onEmployeeUpdate={updated => queryClient.setQueryData(['employees'], prev => prev?.map(e => e.id === updated.id ? updated : e))}
                />
                <RVBefreiungExport
                  employee={employee || form}
                  onEmployeeUpdate={updated => queryClient.setQueryData(['employees'], prev => prev?.map(e => e.id === updated.id ? updated : e))}
                />
              </>
            )}
            {(!permissions.isManager || isNew) && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Keine Dokumente verfügbar.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Bottom actions (delete) ───────────────────────────── */}
        {permissions.isManager && !isNew && (
          <div className="mt-10 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setShowDelete(true)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full min-h-[44px]"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Mitarbeiter löschen
            </Button>
          </div>
        )}
      </div>

      {showDelete && (
        <EmployeeDeleteDialog
          employee={employee || form}
          currentUser={currentUser}
          onClose={() => { setShowDelete(false); navigate(-1); }}
        />
      )}
    </div>
  );
}