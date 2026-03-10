import { z } from 'zod';

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export const pinChangeSchema = z.object({
  currentPin: z.string().min(4, 'PIN required').max(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be 4 digits'),
  newPin: z.string().min(4, 'PIN required').max(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be 4 digits'),
  confirmPin: z.string().min(1, 'Please confirm your PIN'),
}).refine((d) => d.newPin === d.confirmPin, { message: 'PINs do not match', path: ['confirmPin'] });

export type PinChangeFormData = z.infer<typeof pinChangeSchema>;
