/**
 * EmployeeForm.jsx
 * Multi-section employee form using React Hook Form + Zod.
 * Sections split by data sensitivity: public info vs banking vs meta.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmployeeSchema, EMPLOYEE_DEFAULTS } from '../schemas/employeeFormSchema';
import { TextField, SelectField, SubmitButton, FieldWrapper } from '@/lib/formUtils';
import { Button } from '@/components/ui/button';
import { Controller } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const ROLE_OPTIONS          = [{ value: 'Aushilfe', label: 'Aushilfe' }, { value: 'Vollzeit', label: 'Vollzeit' }, { value: 'Manager', label: 'Manager' }];
const CONTRACT_OPTIONS      = [{ value: 'Minijob', label: 'Minijob' }, { value: 'Teilzeit', label: 'Teilzeit' }, { value: 'Vollzeit', label: 'Vollzeit' }];
const TSHIRT_OPTIONS        = ['XS','S','M','L','XL','XXL','XXXL'].map(s => ({ value: s, label: s }));
const ALL_SKILLS            = ['Barkeeper', 'Service', 'Sonderaufgaben'];

export default function EmployeeForm({ defaultValues, onSubmit, onCancel, isPending }) {
    const form = useForm({
        resolver: zodResolver(EmployeeSchema),
        defaultValues: { ...EMPLOYEE_DEFAULTS, ...defaultValues },
    });

    const { control, watch } = form;
    const skills = watch('skills') ?? [];

    const toggleSkill = (skill) => {
        const next = skills.includes(skill) ? skills.filter(s => s !== skill) : [...skills, skill];
        form.setValue('skills', next, { shouldValidate: true });
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* ── Stammdaten ───────────────────────────────────────────────── */}
            <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Stammdaten</h3>
                <div className="grid grid-cols-2 gap-3">
                    <TextField name="name"      label="Name"         required form={form} className="col-span-2" />
                    <TextField name="short_name" label="Spitzname (z.B. Ana, An Na)" form={form} className="col-span-2" />
                    <SelectField name="role"    label="Rolle"        required form={form} options={ROLE_OPTIONS} />
                    <SelectField name="contract_type" label="Vertrag" form={form} options={CONTRACT_OPTIONS} />
                    <TextField name="hourly_rate"  label="Stundensatz (€)" form={form} type="number" />
                    <TextField name="weekly_hours" label="Wochenstunden"   form={form} type="number" />
                    <TextField name="entry_date"   label="Eintrittsdatum"  form={form} type="date" className="col-span-2" />
                </div>
                <FieldWrapper label="Fähigkeiten">
                    <div className="flex flex-wrap gap-2">
                        {ALL_SKILLS.map(skill => (
                            <button
                                key={skill}
                                type="button"
                                onClick={() => toggleSkill(skill)}
                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                    skills.includes(skill)
                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                        : 'border-border text-muted-foreground hover:border-amber-500/30'
                                }`}
                            >
                                {skill}
                            </button>
                        ))}
                    </div>
                </FieldWrapper>
            </section>

            {/* ── Kontakt ──────────────────────────────────────────────────── */}
            <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kontakt</h3>
                <div className="grid grid-cols-2 gap-3">
                    <TextField name="email" label="E-Mail" form={form} type="email" className="col-span-2" />
                    <TextField name="phone" label="Telefon" form={form} />
                    <TextField name="birthday" label="Geburtstag" form={form} type="date" />
                    <TextField name="street"      label="Straße"  form={form} className="col-span-2" />
                    <TextField name="postal_code" label="PLZ"     form={form} />
                    <TextField name="city"        label="Ort"     form={form} />
                </div>
            </section>

            {/* ── Bankdaten ────────────────────────────────────────────────── */}
            <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bankverbindung</h3>
                <div className="grid grid-cols-2 gap-3">
                    <TextField name="bank_name" label="Bank"  form={form} className="col-span-2" />
                    <TextField name="iban"      label="IBAN"  form={form} className="col-span-2" placeholder="DE00 0000 0000 0000 0000 00" />
                    <TextField name="bic"       label="BIC"   form={form} />
                    <TextField name="tax_id"    label="Steuer-ID" form={form} />
                </div>
            </section>

            {/* ── Sonstiges ────────────────────────────────────────────────── */}
            <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sonstiges</h3>
                <div className="grid grid-cols-2 gap-3">
                    <SelectField name="tshirt_size" label="T-Shirt Größe" form={form} options={TSHIRT_OPTIONS} />
                    <TextField   name="color"       label="Farbe (Hex)"   form={form} type="color" />
                    <Controller
                        name="is_active"
                        control={control}
                        render={({ field }) => (
                            <div className="flex items-center gap-2 self-end pb-1">
                                <Switch checked={field.value} onCheckedChange={field.onChange} id="is_active" />
                                <Label htmlFor="is_active">Aktiv</Label>
                            </div>
                        )}
                    />
                </div>
            </section>

            {/* ── Actions ──────────────────────────────────────────────────── */}
            <div className="flex justify-end gap-2 pt-2">
                {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>}
                <SubmitButton isPending={isPending} />
            </div>
        </form>
    );
}