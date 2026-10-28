-- DRAFT for review. Not applied to any database.
-- Source: read-only Supabase advisors and catalog queries on thaimora-production (2026-10-23).
--
-- Included:
--   1. member_self policy: auth.uid() wrapped in a select so it is evaluated once per statement.
--   2. Indexes for foreign keys that the advisor reports without a covering index (14 of 17).
--
-- Deliberately not included:
--   * is_admin() / is_owner() EXECUTE from anon. Every policy that calls them is TO authenticated, and no
--     view or other function calls them, so the revoke is safe for RLS. But tests/integration/
--     trigger-acl.sql (predicate loop) requires anon and authenticated EXECUTE on both, so the revoke fails
--     that test until the test is changed in the same review. Optional block at the end of this file.
--   * content_is_public, property_is_public, property_image_is_public, public_content_meta,
--     public_content_snapshot: anon EXECUTE is required. anon RLS policies (pois_public, events_public,
--     properties_public, property_images_public) call the first three, and the public snapshot RPC calls the last two.
--     Accepted as intended public API.
--   * pg_net in schema public: extrelocatable = false, so ALTER EXTENSION ... SET SCHEMA is not possible.
--     Moving it means dropping and recreating the extension, which the content scheduler depends on. Separate reviewed change.
--   * multiple permissive policies (admin_all FOR ALL plus public SELECT for authenticated, on 7 tables, and
--     member_self plus members_owner): merging them changes policy semantics for admins. Separate reviewed change.
--   * unused indexes: the usage window is too short to justify dropping them.
--   * private.outreach_attempts(message_id), private.outreach_campaigns(created_by), private.outreach_contacts(created_by):
--     these tables exist in production but have no CREATE TABLE in supabase/migrations/. Their indexes must follow
--     a migration that captures the table definitions first.
--   * private schema tables with RLS and no policy: deny-by-default. Confirm private is not in the exposed API schemas.

-- 1. Evaluate auth.uid() once per statement instead of once per row.
drop policy member_self on public.admin_memberships;
create policy member_self on public.admin_memberships for select to authenticated
  using (user_id = (select auth.uid()));

-- 2. Index the foreign keys the advisor reported without a covering index.
create index if not exists broker_payment_events_user_id_idx on private.broker_payment_events (user_id);
create index if not exists broker_profiles_approved_by_idx on private.broker_profiles (approved_by);
create index if not exists contact_outbox_recipient_user_id_idx on private.contact_outbox (recipient_user_id);
create index if not exists content_sources_active_run_id_idx on private.content_sources (active_run_id);
create index if not exists line_account_links_user_id_idx on private.line_account_links (user_id);
create index if not exists property_contact_recipients_assigned_by_idx on private.property_contact_recipients (assigned_by);
create index if not exists property_contact_recipients_recipient_user_id_idx on private.property_contact_recipients (recipient_user_id);
create index if not exists daily_property_stats_property_id_idx on public.daily_property_stats (property_id);
create index if not exists events_zone_id_idx on public.events (zone_id);
create index if not exists import_errors_job_id_idx on public.import_errors (job_id);
create index if not exists import_jobs_created_by_idx on public.import_jobs (created_by);
create index if not exists inquiries_property_id_idx on public.inquiries (property_id);
create index if not exists pois_zone_id_idx on public.pois (zone_id);
create index if not exists property_images_property_id_idx on public.property_images (property_id);

-- Optional (not in the draft). Requires changing trigger-acl.sql in the same review, because that test
-- currently asserts anon and authenticated EXECUTE on is_admin() and is_owner().
-- revoke execute on function public.is_admin() from public, anon;
-- grant execute on function public.is_admin() to authenticated, service_role;
-- revoke execute on function public.is_owner() from public, anon;
-- grant execute on function public.is_owner() to authenticated, service_role;

-- Rollback (manual, only if needed):
--   drop policy member_self on public.admin_memberships;
--   create policy member_self on public.admin_memberships for select to authenticated using (user_id = auth.uid());
--   drop index if exists <each index above>;
