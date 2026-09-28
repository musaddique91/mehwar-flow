import { z } from 'zod';
import { isValidTimeZone } from './time';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200, 'Password is too long');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  name: z.string().trim().min(1).max(100),
  timezone: z.string().refine(isValidTimeZone, 'Unknown time zone').default('UTC'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    timezone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
    xPremium: z.boolean(),
    brandVoice: z.string().max(1000).nullable(),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  timezone: string;
  xPremium: boolean;
  brandVoice: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}
