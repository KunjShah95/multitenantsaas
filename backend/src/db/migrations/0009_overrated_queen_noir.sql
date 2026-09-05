CREATE TABLE "quote_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_id" uuid,
	"version_number" integer NOT NULL,
	"contact_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_shares_version_check" CHECK ("quote_shares"."version_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "quote_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"line_id" uuid,
	"version_number" integer,
	"author_contact_id" uuid,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"visibility" varchar(32) DEFAULT 'portal_visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_comments_body_check" CHECK (char_length("quote_comments"."body") > 0),
	CONSTRAINT "quote_comments_visibility_check" CHECK ("quote_comments"."visibility" IN ('portal_visible','internal'))
);
--> statement-breakpoint
CREATE TABLE "negotiation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"base_version_id" uuid,
	"base_version_number" integer NOT NULL,
	"contact_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"requested_changes" jsonb NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution_message" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"revision_created" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "negotiation_requests_version_check" CHECK ("negotiation_requests"."base_version_number" >= 1),
	CONSTRAINT "negotiation_requests_status_check" CHECK ("negotiation_requests"."status" IN ('pending','declined','clarification_requested','accepted_as_revision','superseded'))
);
--> statement-breakpoint
ALTER TABLE "quote_shares" ADD CONSTRAINT "quote_shares_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_shares" ADD CONSTRAINT "quote_shares_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_shares" ADD CONSTRAINT "quote_shares_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."quote_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_shares" ADD CONSTRAINT "quote_shares_contact_id_customer_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."customer_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_shares" ADD CONSTRAINT "quote_shares_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_shares" ADD CONSTRAINT "quote_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_shares" ADD CONSTRAINT "quote_shares_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_line_id_quote_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."quote_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_author_contact_id_customer_contacts_id_fk" FOREIGN KEY ("author_contact_id") REFERENCES "public"."customer_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_requests" ADD CONSTRAINT "negotiation_requests_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_requests" ADD CONSTRAINT "negotiation_requests_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_requests" ADD CONSTRAINT "negotiation_requests_base_version_id_quote_versions_id_fk" FOREIGN KEY ("base_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_requests" ADD CONSTRAINT "negotiation_requests_contact_id_customer_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."customer_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_requests" ADD CONSTRAINT "negotiation_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_requests" ADD CONSTRAINT "negotiation_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_shares_tenant_idx" ON "quote_shares" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quote_shares_quote_idx" ON "quote_shares" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_shares_contact_idx" ON "quote_shares" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "quote_shares_customer_idx" ON "quote_shares" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quote_shares_version_idx" ON "quote_shares" USING btree ("quote_id","version_number");--> statement-breakpoint
CREATE INDEX "quote_shares_expires_idx" ON "quote_shares" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_shares_quote_contact_version_unique" ON "quote_shares" USING btree ("quote_id","contact_id","version_number");--> statement-breakpoint
CREATE INDEX "quote_comments_tenant_idx" ON "quote_comments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quote_comments_quote_idx" ON "quote_comments" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_comments_line_idx" ON "quote_comments" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "quote_comments_contact_idx" ON "quote_comments" USING btree ("author_contact_id");--> statement-breakpoint
CREATE INDEX "quote_comments_created_idx" ON "quote_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "negotiation_requests_tenant_idx" ON "negotiation_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "negotiation_requests_quote_idx" ON "negotiation_requests" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "negotiation_requests_contact_idx" ON "negotiation_requests" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "negotiation_requests_status_idx" ON "negotiation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "negotiation_requests_created_idx" ON "negotiation_requests" USING btree ("created_at");--> statement-breakpoint
-- RLS for Phase 06 portal tables (tenant isolation)
ALTER TABLE "quote_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_shares" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_shares_tenant_isolation" ON "quote_shares";
CREATE POLICY "quote_shares_tenant_isolation" ON "quote_shares"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "quote_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_comments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_comments_tenant_isolation" ON "quote_comments";
CREATE POLICY "quote_comments_tenant_isolation" ON "quote_comments"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "negotiation_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "negotiation_requests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "negotiation_requests_tenant_isolation" ON "negotiation_requests";
CREATE POLICY "negotiation_requests_tenant_isolation" ON "negotiation_requests"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);