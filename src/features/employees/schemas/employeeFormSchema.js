/**
 * employeeFormSchema.js
 * Zod schema for employee create / edit forms.
 * Single source of truth — used by React Hook Form and API validation.
 */
import { z } from 'zod';

const phoneRegex = /^[+\d\s\-().]{7,20}$/;
const ibanRegex  = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

export const EmployeeSchema = z.object({
    // ── Required ──────────────────────────────────────────────────────────────
    name:          z.string().min(2, 'Name muss mind. 2 Zeichen haben').max(100),
    role:          z.enum(['Aushilfe', 'Vollzeit', 'Manager'], { required_error: 'Bitte Rolle wählen' }),

    // ── Contact ───────────────────────────────────────────────────────────────
    email:         z.string().email('Gültige E-Mail erforderlich').optional().or(z.literal('')),
    phone:         z.string().regex(phoneRegex, 'Ungültige Telefonnummer').optional().or(z.literal('')),

    // ── Contract ──────────────────────────────────────────────────────────────
    contract_type: z.enum(['Minijob', 'Teilzeit', 'Vollzeit']).optional(),
    hourly_rate:   z.coerce.number().min(0, 'Muss ≥ 0 sein').max(200).optional().or(z.literal('')),
    weekly_hours:  z.coerce.number().min(0).max(60).optional().or(z.literal('')),
    entry_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: JJJJ-MM-TT').optional().or(z.literal('')),

    // ── Personal ──────────────────────────────────────────────────────────────
    birthday:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: JJJJ-MM-TT').optional().or(z.literal('')),
    street:        z.string().max(200).optional().or(z.literal('')),
    postal_code:   z.string().regex(/^\d{5}$/, 'PLZ muss 5 Ziffern haben').optional().or(z.literal('')),
    city:          z.string().max(100).optional().or(z.literal('')),
    nationality:   z.string().max(60).optional().or(z.literal('')),

    // ── Banking (sensitive) ───────────────────────────────────────────────────
    iban:          z.string().regex(ibanRegex, 'Ungültige IBAN').optional().or(z.literal('')),
    bic:           z.string().min(8).max(11).optional().or(z.literal('')),
    bank_name:     z.string().max(100).optional().or(z.literal('')),

    // ── Tax ───────────────────────────────────────────────────────────────────
    tax_id:        z.string().max(30).optional().or(z.literal('')),

    // ── Clothing ─────────────────────────────────────────────────────────────
    tshirt_size:   z.enum(['XS','S','M','L','XL','XXL','XXXL']).optional().or(z.literal('')),

    // ── Meta ──────────────────────────────────────────────────────────────────
    color:         z.string().optional().or(z.literal('')),
    is_active:     z.boolean().default(true),
    skills:        z.array(z.string()).default([]),
});

export const EmployeeCreateSchema = EmployeeSchema;
export const EmployeeUpdateSchema = EmployeeSchema.partial().required({ name: true, role: true });

/** Default values for a new employee form */
export const EMPLOYEE_DEFAULTS = {
    name: '', role: 'Aushilfe', email: '', phone: '',
    contract_type: 'Minijob', hourly_rate: '', weekly_hours: '',
    entry_date: '', birthday: '', street: '', postal_code: '', city: '',
    nationality: '', iban: '', bic: '', bank_name: '', tax_id: '',
    tshirt_size: '', color: '', is_active: true, skills: [],
};