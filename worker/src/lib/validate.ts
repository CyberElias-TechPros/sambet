import { z } from 'zod';
import { ORG_STATUSES } from './normalize';

export const PHONE_MAX = 20;

const emailStr = z
  .string()
  .trim()
  .max(160)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), {
    message: 'Enter a valid e-mail address (or leave empty)',
  });

const phoneStr = z
  .string()
  .trim()
  .max(32)
  .refine((v) => {
    if (!v) return true;
    const d = v.replace(/[Oo]/g, '0').replace(/\D/g, '');
    return d.length >= 7 && d.length <= 15;
  }, {
    message: 'Enter a valid phone number (or leave empty)',
  });

const accountStr = z
  .string()
  .trim()
  .max(32)
  .refine((v) => {
    if (!v) return true;
    const d = v.replace(/\D/g, '');
    return d.length >= 6 && d.length <= 12;
  }, {
    message: 'Account numbers should be 6–12 digits (or leave empty)',
  });

export const orgInputSchema = z.object({
  sn: z
    .union([z.number().int().min(1).max(9_999_999), z.string().regex(/^\d+$/).transform((s) => parseInt(s, 10))])
    .optional()
    .nullable()
    .transform((v) => (v && v > 0 ? v : null)),
  name: z.string().trim().min(1, 'Organization name is required').max(200),
  ceo_name: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  phone: phoneStr.optional().nullable().transform((v) => (v ? v : null)),
  email: emailStr.optional().nullable().transform((v) => (v ? v : null)),
  bank: z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null)),
  account_number: accountStr.optional().nullable().transform((v) => (v ? v : null)),
  lga: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  state: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  project_type: z.string().trim().max(400).optional().nullable().transform((v) => (v ? v : null)),
  status: z.enum(ORG_STATUSES).optional().default('registered'),
  notes: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
  cycle: z.string().trim().max(80).optional().nullable().default('Project 1'),
});

export type OrgInput = z.infer<typeof orgInputSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(160).email('Enter a valid e-mail address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const setupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().min(3).max(160).email('Enter a valid e-mail address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200)
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
});

export const passwordChangeSchema = z.object({
  current: z.string().min(1),
  next: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(200)
    .regex(/[a-zA-Z]/, 'New password must contain a letter')
    .regex(/\d/, 'New password must contain a number'),
});

/* ------------------------- team (users) ------------------------- */

export const USER_ROLES = ['admin', 'editor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

const strongPassword = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .refine((v) => {
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(v)).length;
    return classes >= 3;
  }, 'Password needs at least 3 of: lowercase, uppercase, number, symbol');

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  email: z.string().trim().toLowerCase().min(3).max(160).email('Enter a valid e-mail address'),
  password: strongPassword,
  role: z.enum(USER_ROLES),
});

export const userUpdateSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  disabled: z.boolean().optional(),
});

/** Flatten a failed zod parse into { field: message } for API errors. */
export function zodFieldErrors(result: {
  error: { issues: { path: (string | number)[]; message: string }[] };
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
