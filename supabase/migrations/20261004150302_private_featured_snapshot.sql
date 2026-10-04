BEGIN;

-- A cached snapshot cannot enforce current article visibility via RLS.
-- Public readers use the live security-invoker public_articles view instead.
REVOKE ALL ON public.featured_articles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.featured_articles TO service_role;

COMMIT;
