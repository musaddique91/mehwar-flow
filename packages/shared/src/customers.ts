import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  mobileNumber: z.string().trim().min(3, 'Mobile number is required').max(40),
  whatsappNumber: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Invalid email address').max(255).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(150),
  description: z.string().trim().max(500).nullish(),
  customerIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(150).optional(),
  description: z.string().trim().max(500).nullish(),
  customerIds: z.array(z.string().uuid()).optional(),
});

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const shareChannelSchema = z.enum(['EMAIL', 'WHATSAPP']);
export type ShareChannel = z.infer<typeof shareChannelSchema>;

export const sharePostSchema = z.object({
  postId: z.string().uuid(),
  customerIds: z.array(z.string().uuid()).optional().default([]),
  groupIds: z.array(z.string().uuid()).optional().default([]),
  channels: z.array(shareChannelSchema).min(1, 'Select at least one delivery channel (Email or WhatsApp)'),
  customMessage: z.string().trim().max(2000).nullish(),
});

export type SharePostInput = z.infer<typeof sharePostSchema>;

// ---------- DTOs ----------

export interface CustomerGroupSummaryDto {
  id: string;
  name: string;
}

export interface CustomerDto {
  id: string;
  name: string;
  mobileNumber: string;
  whatsappNumber: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  groups?: CustomerGroupSummaryDto[];
}

export interface CustomerGroupDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  members?: {
    id: string;
    customerId: string;
    customer: {
      id: string;
      name: string;
      email: string | null;
      mobileNumber: string;
      whatsappNumber: string;
    };
  }[];
}

export interface WhatsAppFallbackLink {
  customerId: string;
  customerName: string;
  phone: string;
  url: string;
}

export interface SharePostResultDto {
  success: boolean;
  recipientCount: number;
  emailsSent: number;
  emailsFailed: number;
  whatsappSent: number;
  whatsappFailed: number;
  whatsappFallbackLinks?: WhatsAppFallbackLink[];
  message: string;
}

export interface WhatsAppStatusDto {
  status: 'DISCONNECTED' | 'SCAN_QR_CODE' | 'CONNECTED';
  qrCodeDataUrl?: string | null;
  phone?: string | null;
  pushName?: string | null;
  platform?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  savedInDb?: boolean;
}
