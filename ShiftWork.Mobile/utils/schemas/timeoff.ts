import { z } from 'zod';

export const timeOffTypes = ['Vacation', 'Sick', 'PTO', 'Unpaid', 'Personal'] as const;
export type TimeOffType = (typeof timeOffTypes)[number];

export const timeOffSchema = z.object({
  type: z.enum(timeOffTypes),
  startDate: z.date(),
  endDate: z.date(),
  reason: z.string().optional(),
}).refine((d) => d.endDate >= d.startDate, { message: 'End date must be after start date', path: ['endDate'] });

export type TimeOffFormData = z.infer<typeof timeOffSchema>;
