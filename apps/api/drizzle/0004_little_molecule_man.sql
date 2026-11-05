CREATE TYPE "public"."assignment_status" AS ENUM('menunggu', 'dikonfirmasi', 'ditolak');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('terjadwal', 'selesai', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."swap_status" AS ENUM('menunggu_pengganti', 'menunggu_koordinator', 'disetujui', 'ditolak', 'dibatalkan');--> statement-breakpoint
CREATE TABLE "reminder_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"service_role_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'menunggu' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" text NOT NULL,
	"group_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"location" text,
	"theme" text,
	"preacher" text,
	"recurrence_id" uuid,
	"status" "service_status" DEFAULT 'terjadwal' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swap_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"proposed_member_id" uuid NOT NULL,
	"status" "swap_status" DEFAULT 'menunggu_pengganti' NOT NULL,
	"reason" text,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminder_templates" ADD CONSTRAINT "reminder_templates_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_service_role_id_service_roles_id_fk" FOREIGN KEY ("service_role_id") REFERENCES "public"."service_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_roles" ADD CONSTRAINT "service_roles_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_roles" ADD CONSTRAINT "service_roles_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_assignment_id_service_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."service_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requested_by_members_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_proposed_member_id_members_id_fk" FOREIGN KEY ("proposed_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminder_templates_church_id_idx" ON "reminder_templates" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "service_assignments_church_id_idx" ON "service_assignments" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "service_assignments_service_idx" ON "service_assignments" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "service_assignments_member_idx" ON "service_assignments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "service_roles_church_id_idx" ON "service_roles" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "services_church_id_idx" ON "services" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "services_church_date_idx" ON "services" USING btree ("church_id","date");--> statement-breakpoint
CREATE INDEX "swap_requests_church_id_idx" ON "swap_requests" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "swap_requests_assignment_idx" ON "swap_requests" USING btree ("assignment_id");
--> statement-breakpoint
-- Lapisan kedua isolasi tenant untuk tabel Fase 3.
ALTER TABLE "service_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "service_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "swap_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reminder_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "service_roles" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "services" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "service_assignments" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "swap_requests" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "reminder_templates" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
