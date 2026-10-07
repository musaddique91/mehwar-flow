export type SchedulerType =
  | 'CHANNEL_LIVENESS'
  | 'COMMENT_ANALYSIS'
  | 'ORDER_DETECTION'
  | 'CUSTOM';

export type SchedulerStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export type InquiryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type InquiryStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED' | 'ARCHIVED';

export interface SchedulerConfigDto {
  id: string;
  type: SchedulerType;
  name: string;
  description: string | null;
  enabled: boolean;
  intervalMinutes: number;
  channelIds: string[];
  options: Record<string, any>;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: SchedulerStatus;
  lastResultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSchedulerConfigDto {
  enabled?: boolean;
  intervalMinutes?: number;
  channelIds?: string[];
  options?: Record<string, any>;
  name?: string;
  description?: string;
}

export interface SchedulerRunDto {
  id: string;
  schedulerConfigId: string | null;
  type: SchedulerType;
  status: SchedulerStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  itemsProcessed: number;
  summary: string | null;
  details: any;
  errorMessage: string | null;
}

export interface OrderInquiryDto {
  id: string;
  channelId: string | null;
  channelName?: string;
  platform: string;
  authorName: string;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  commentText: string;
  postOrVideoTitle: string | null;
  postOrVideoUrl: string | null;
  priority: InquiryPriority;
  intentCategory: string;
  aiConfidence: number | null;
  aiReasoning: string | null;
  status: InquiryStatus;
  contactPhone: string | null;
  notes: string | null;
  detectedAt: string;
  createdAt: string;
}

export interface UpdateOrderInquiryDto {
  status?: InquiryStatus;
  contactPhone?: string;
  notes?: string;
  priority?: InquiryPriority;
}

export interface AutomationOverviewDto {
  totalSchedulers: number;
  activeSchedulers: number;
  totalRuns: number;
  totalLeads: number;
  newLeads: number;
  channelHealth: {
    total: number;
    healthy: number;
    needsReconnect: number;
  };
}
