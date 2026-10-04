BEGIN;

-- RLS does not protect TRUNCATE, REFERENCES, TRIGGER or MAINTAIN privileges.
REVOKE ALL ON public.articles, public.pages, public.tags, public.article_tags,
  public.article_assets FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.articles, public.pages, public.tags, public.article_tags,
  public.article_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles, public.pages, public.tags,
  public.article_tags, public.article_assets TO authenticated, service_role;

REVOKE ALL ON public.public_articles, public.featured_articles
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.public_articles, public.featured_articles
  TO anon, authenticated, service_role;
REVOKE ALL ON public.public_user_profiles, public.authors
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.public_user_profiles, public.authors TO authenticated, service_role;

-- Keep extension objects outside the exposed application schema.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;
ALTER FUNCTION public.slugify(text) SET search_path = pg_catalog, extensions;
ALTER FUNCTION public.calculate_read_time() SET search_path = pg_catalog;
ALTER FUNCTION public.guard_published_at() SET search_path = pg_catalog;
ALTER FUNCTION public.check_price_interval_matches_product() SET search_path = pg_catalog;
REVOKE ALL ON FUNCTION public.calculate_read_time(), public.guard_published_at(),
  public.check_price_interval_matches_product() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slugify(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slugify(text) TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- New application objects need explicit grants; no automatic browser writes.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
