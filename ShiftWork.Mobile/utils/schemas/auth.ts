import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const acceptInviteSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
export type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

export const registerStep1Schema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterStep1Data = z.infer<typeof registerStep1Schema>;

export const registerStep2Schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid company email'),
  companyPhone: z.string().optional(),
  timeZone: z.string().default('UTC'),
});
export type RegisterStep2Data = z.infer<typeof registerStep2Schema>;
