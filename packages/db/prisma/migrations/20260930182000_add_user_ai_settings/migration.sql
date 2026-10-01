-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_provider" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_base_url" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_model" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_default_model" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_api_key_enc" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_api_key_prefix" TEXT;
