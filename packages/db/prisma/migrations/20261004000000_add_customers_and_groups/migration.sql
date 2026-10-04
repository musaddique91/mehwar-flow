-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mobile_number" TEXT NOT NULL,
    "whatsapp_number" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_group_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_organization_id_name_idx" ON "customers"("organization_id", "name");
CREATE INDEX "customers_organization_id_email_idx" ON "customers"("organization_id", "email");
CREATE INDEX "customers_organization_id_mobile_number_idx" ON "customers"("organization_id", "mobile_number");

-- CreateIndex
CREATE INDEX "customer_groups_organization_id_name_idx" ON "customer_groups"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_group_members_group_id_customer_id_key" ON "customer_group_members"("group_id", "customer_id");
CREATE INDEX "customer_group_members_group_id_idx" ON "customer_group_members"("group_id");
CREATE INDEX "customer_group_members_customer_id_idx" ON "customer_group_members"("customer_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row-Level Security
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customers" USING (app_rls_allows(organization_id)) WITH CHECK (app_rls_allows(organization_id));

ALTER TABLE "customer_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_groups" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_groups" USING (app_rls_allows(organization_id)) WITH CHECK (app_rls_allows(organization_id));

-- customer_group_members: inherits visibility from customer_groups
ALTER TABLE "customer_group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_group_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_group_members"
  USING (EXISTS (SELECT 1 FROM "customer_groups" g WHERE g.id = group_id))
  WITH CHECK (EXISTS (SELECT 1 FROM "customer_groups" g WHERE g.id = group_id));

-- Runtime role privileges
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mehwar_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "customers" TO mehwar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "customer_groups" TO mehwar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "customer_group_members" TO mehwar_app;
  END IF;
END
$$;
