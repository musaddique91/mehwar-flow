-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'ORDER_LEAD';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'COMMENT_ANALYSIS';

-- CreateEnum
CREATE TYPE "SchedulerType" AS ENUM ('CHANNEL_LIVENESS', 'COMMENT_ANALYSIS', 'ORDER_DETECTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SchedulerStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "InquiryPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "scheduler_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "type" "SchedulerType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "channel_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "options" JSONB DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "last_status" "SchedulerStatus" NOT NULL DEFAULT 'IDLE',
    "last_result_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduler_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "scheduler_config_id" UUID,
    "type" "SchedulerType" NOT NULL,
    "status" "SchedulerStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "details" JSONB DEFAULT '{}',
    "error_message" TEXT,

    CONSTRAINT "scheduler_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_inquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "channel_id" UUID,
    "platform" "Platform" NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_handle" TEXT,
    "author_avatar_url" TEXT,
    "comment_text" TEXT NOT NULL,
    "post_or_video_title" TEXT,
    "post_or_video_url" TEXT,
    "priority" "InquiryPriority" NOT NULL DEFAULT 'HIGH',
    "intent_category" TEXT NOT NULL DEFAULT 'purchase_intent',
    "ai_confidence" DOUBLE PRECISION,
    "ai_reasoning" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "contact_phone" TEXT,
    "notes" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduler_configs_organization_id_type_key" ON "scheduler_configs"("organization_id", "type");
CREATE INDEX "scheduler_configs_organization_id_enabled_idx" ON "scheduler_configs"("organization_id", "enabled");

-- CreateIndex
CREATE INDEX "scheduler_runs_organization_id_started_at_idx" ON "scheduler_runs"("organization_id", "started_at");
CREATE INDEX "scheduler_runs_organization_id_type_idx" ON "scheduler_runs"("organization_id", "type");

-- CreateIndex
CREATE INDEX "order_inquiries_organization_id_status_idx" ON "order_inquiries"("organization_id", "status");
CREATE INDEX "order_inquiries_organization_id_priority_idx" ON "order_inquiries"("organization_id", "priority");
CREATE INDEX "order_inquiries_organization_id_detected_at_idx" ON "order_inquiries"("organization_id", "detected_at");

-- AddForeignKey
ALTER TABLE "scheduler_configs" ADD CONSTRAINT "scheduler_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduler_runs" ADD CONSTRAINT "scheduler_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduler_runs" ADD CONSTRAINT "scheduler_runs_scheduler_config_id_fkey" FOREIGN KEY ("scheduler_config_id") REFERENCES "scheduler_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_inquiries" ADD CONSTRAINT "order_inquiries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_inquiries" ADD CONSTRAINT "order_inquiries_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable Row-Level Security
ALTER TABLE "scheduler_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduler_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduler_configs" USING (app_rls_allows(organization_id)) WITH CHECK (app_rls_allows(organization_id));

ALTER TABLE "scheduler_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduler_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduler_runs" USING (app_rls_allows(organization_id)) WITH CHECK (app_rls_allows(organization_id));

ALTER TABLE "order_inquiries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_inquiries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_inquiries" USING (app_rls_allows(organization_id)) WITH CHECK (app_rls_allows(organization_id));

-- Runtime role privileges
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mehwar_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "scheduler_configs" TO mehwar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "scheduler_runs" TO mehwar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "order_inquiries" TO mehwar_app;
  END IF;
END
$$;
