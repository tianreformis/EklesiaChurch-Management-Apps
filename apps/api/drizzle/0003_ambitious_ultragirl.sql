CREATE TYPE "public"."gender" AS ENUM('laki_laki', 'perempuan');--> statement-breakpoint
CREATE TYPE "public"."group_type" AS ENUM('komisi', 'tim_pelayanan');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('aktif', 'pindah', 'meninggal', 'tidak_aktif');--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" text NOT NULL,
	"head_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role_in_group" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "group_type" DEFAULT 'komisi' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"family_id" uuid,
	"region_id" uuid,
	"full_name" text NOT NULL,
	"nickname" text,
	"gender" "gender",
	"birth_date" date,
	"phone" text,
	"email" text,
	"address" text,
	"status" "member_status" DEFAULT 'aktif' NOT NULL,
	"baptism_date" date,
	"sidi_date" date,
	"marriage_date" date,
	"photo_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "families_church_id_idx" ON "families" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "group_members_church_id_idx" ON "group_members" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "group_members_group_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_member_idx" ON "group_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "groups_church_id_idx" ON "groups" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "members_church_id_idx" ON "members" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "members_church_name_idx" ON "members" USING btree ("church_id","full_name");--> statement-breakpoint
CREATE INDEX "members_church_phone_idx" ON "members" USING btree ("church_id","phone");--> statement-breakpoint
CREATE INDEX "regions_church_id_idx" ON "regions" USING btree ("church_id");
--> statement-breakpoint
-- Lapisan kedua isolasi tenant untuk tabel Fase 2.
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "families" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "regions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "members" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "families" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "regions" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "groups" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "group_members" FOR ALL USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid) WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);