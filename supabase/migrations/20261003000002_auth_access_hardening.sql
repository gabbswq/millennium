BEGIN;

-- Policy helpers must run as the trusted migration owner, not recursively as
-- the caller. row_security=off fails closed if that owner loses its bypass.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;
ALTER FUNCTION public.is_author_or_admin() SET search_path = pg_catalog;
ALTER FUNCTION public.is_author_or_admin() SET row_security = off;
ALTER FUNCTION public.owns_article(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.owns_article(uuid) SET row_security = off;
REVOKE ALL ON FUNCTION public.is_admin(), public.is_author_or_admin(), public.owns_article(uuid)
  FROM PUBLIC, anon, authenticated;
-- Anonymous article/tag policies call is_admin(); NULL identity returns false.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_author_or_admin(), public.owns_article(uuid) TO authenticated, service_role;

DROP POLICY "users: authenticated can read own row" ON public.users;
CREATE POLICY "users: authenticated can read own row" ON public.users
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY "users: authenticated can update own profile" ON public.users;
CREATE POLICY "users: authenticated can update own profile" ON public.users
  FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- RLS cannot compare old/new fields. Column grants enforce that boundary even
-- when the caller has an admin profile. Roles and email remain server-owned.
REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL (id, email, display_name, avatar_url, role, metadata, created_at, updated_at)
  ON public.users FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (display_name, avatar_url, metadata) ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;

DROP POLICY "auth_providers: owner or admin can read" ON public.auth_providers;
CREATE POLICY "auth_providers: owner or admin can read" ON public.auth_providers
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY "auth_providers: owner can insert" ON public.auth_providers;
DROP POLICY "auth_providers: owner can delete" ON public.auth_providers;
REVOKE ALL ON public.auth_providers, public.password_reset_tokens FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.auth_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_providers TO service_role;
GRANT SELECT, INSERT, DELETE ON public.password_reset_tokens TO service_role;

-- These invoker views are private/owner-scoped, not a public user directory.
-- Granting anon the view never bypassed the underlying users restrictions.
REVOKE ALL ON public.public_user_profiles, public.authors FROM PUBLIC, anon;
GRANT SELECT ON public.public_user_profiles, public.authors TO authenticated, service_role;

-- Do not depend on permissive defaults from older Supabase projects.
REVOKE ALL ON public.products, public.prices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.products, public.prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products, public.prices TO authenticated, service_role;
-- Existing RLS still limits catalog writes to admin profiles.
REVOKE ALL ON public.stripe_customers, public.orders, public.subscriptions, public.payments
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL (raw_event) ON public.payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stripe_customers, public.orders, public.subscriptions TO authenticated;
GRANT SELECT (id, user_id, stripe_payment_intent_id, stripe_event_id, amount_cents, currency, status, created_at)
  ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stripe_customers, public.orders, public.subscriptions TO service_role;
GRANT SELECT, INSERT ON public.payments TO service_role;

ALTER FUNCTION public.handle_new_auth_user() SET search_path = pg_catalog;
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog;
ALTER FUNCTION public.has_active_subscription(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.has_purchased(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.can_access_product(uuid) SET search_path = pg_catalog;
REVOKE ALL ON FUNCTION public.handle_new_auth_user(), public.set_updated_at()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid), public.has_purchased(uuid), public.can_access_product(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid), public.has_purchased(uuid), public.can_access_product(uuid)
  TO authenticated, service_role;

-- Publishing/refresh jobs were described as server-only but relied on implicit
-- EXECUTE grants. In particular refresh_featured_articles was callable by PUBLIC.
ALTER FUNCTION public.refresh_featured_articles() SET search_path = pg_catalog;
ALTER FUNCTION public.publish_scheduled_articles() SET search_path = pg_catalog;
ALTER FUNCTION public.publish_article(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.unpublish_article(uuid) SET search_path = pg_catalog;
REVOKE ALL ON FUNCTION public.refresh_featured_articles(), public.publish_scheduled_articles(),
  public.publish_article(uuid), public.unpublish_article(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_featured_articles(), public.publish_scheduled_articles(),
  public.publish_article(uuid), public.unpublish_article(uuid) TO service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

COMMIT;
