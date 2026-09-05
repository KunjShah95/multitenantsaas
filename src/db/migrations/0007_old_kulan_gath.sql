CREATE TABLE "quote_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_id" uuid,
	"version_number" integer NOT NULL,
	"sequence" integer NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_approvals_sequence_check" CHECK ("quote_approvals"."sequence" >= 1),
	CONSTRAINT "quote_approvals_role_check" CHECK ("quote_approvals"."role" IN ('manager','finance','admin','ops')),
	CONSTRAINT "quote_approvals_status_check" CHECK ("quote_approvals"."status" IN ('pending','approved','rejected','returned','invalidated','auto_approved')),
	CONSTRAINT "quote_approvals_decision_check" CHECK ("quote_approvals"."decision" IS NULL OR "quote_approvals"."decision" IN ('approve','reject','returnForRevision','invalidated'))
);
--> statement-breakpoint
ALTER TABLE "quote_approvals" ADD CONSTRAINT "quote_approvals_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_approvals" ADD CONSTRAINT "quote_approvals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_approvals" ADD CONSTRAINT "quote_approvals_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."quote_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_approvals" ADD CONSTRAINT "quote_approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_approvals_quote_version_seq_unique" ON "quote_approvals" USING btree ("quote_id","version_number","sequence");--> statement-breakpoint
CREATE INDEX "quote_approvals_tenant_idx" ON "quote_approvals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quote_approvals_quote_idx" ON "quote_approvals" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_approvals_quote_version_idx" ON "quote_approvals" USING btree ("quote_id","version_number");--> statement-breakpoint
CREATE INDEX "quote_approvals_pending_idx" ON "quote_approvals" USING btree ("status");
--> statement-breakpoint
-- RLS for quote_approvals
ALTER TABLE "quote_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_approvals" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_approvals_tenant_isolation" ON "quote_approvals";
CREATE POLICY "quote_approvals_tenant_isolation" ON "quote_approvals"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);