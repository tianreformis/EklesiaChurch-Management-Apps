-- Lapisan kedua isolasi tenant. Lapisan pertama adalah fasad `getTenantDb`
-- di aplikasi yang selalu menyaring `church_id` dari sesi server.
--
-- Setiap permintaan HTTP berjalan dalam satu transaksi yang menetapkan
-- `app.church_id`; koneksi aplikasi (`eklesia_app`) hanya melihat baris
-- milik gerejanya sendiri. Koneksi pemilik skema (migrasi/seed) tidak
-- terpengaruh RLS.
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "users"
  FOR ALL
  USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid)
  WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "auth_tokens"
  FOR ALL
  USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid)
  WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_logs"
  FOR ALL
  USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid)
  WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sessions"
  FOR ALL
  USING ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid)
  WITH CHECK ("church_id" = nullif(current_setting('app.church_id', true), '')::uuid);
