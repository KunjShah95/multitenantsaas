CREATE TABLE "portal_magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_magic_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "portal_magic_links" ADD CONSTRAINT "portal_magic_links_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_magic_links" ADD CONSTRAINT "portal_magic_links_contact_id_customer_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."customer_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_contact_id_customer_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."customer_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_magic_links_tenant_idx" ON "portal_magic_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "portal_magic_links_contact_idx" ON "portal_magic_links" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "portal_sessions_tenant_idx" ON "portal_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "portal_sessions_contact_idx" ON "portal_sessions" USING btree ("contact_id");--> statement-breakpoint
-- RLS for portal tables (same tenant isolation pattern, with nullif handling)
ALTER TABLE "portal_magic_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_magic_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_magic_links_tenant_isolation" ON "portal_magic_links"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "portal_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_sessions_tenant_isolation" ON "portal_sessions"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
