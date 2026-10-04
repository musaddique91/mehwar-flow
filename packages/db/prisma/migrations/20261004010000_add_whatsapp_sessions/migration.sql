-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "phone_number" TEXT,
    "pushname" TEXT,
    "platform" TEXT DEFAULT 'WhatsApp Web',
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_organization_id_key" ON "whatsapp_sessions"("organization_id");

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row-Level Security
ALTER TABLE "whatsapp_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_sessions" USING (app_rls_allows(organization_id)) WITH CHECK (app_rls_allows(organization_id));

-- Runtime role privileges
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mehwar_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "whatsapp_sessions" TO mehwar_app;
  END IF;
END
$$;
