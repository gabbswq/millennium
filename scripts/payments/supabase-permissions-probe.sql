-- Run only on the approved, empty Millennium test project. No external APIs.
-- Two synthetic identities and a catalog item are rolled back, never committed.
BEGIN;
SET LOCAL statement_timeout = '15s';
DO $guard$
BEGIN
  IF current_user <> 'postgres' OR EXISTS (SELECT 1 FROM auth.users)
    OR EXISTS (SELECT 1 FROM public.products)
    OR EXISTS (SELECT 1 FROM public.stripe_checkout_requests)
    OR EXISTS (SELECT 1 FROM public.stripe_connected_accounts) THEN
    RAISE EXCEPTION 'Probe requires the approved empty test project';
  END IF;
END;
$guard$;
SELECT set_config('millennium.check_a',gen_random_uuid()::text,true),
       set_config('millennium.check_b',gen_random_uuid()::text,true),
       set_config('millennium.check_price',gen_random_uuid()::text,true),
       set_config('millennium.check_request',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  (current_setting('millennium.check_a')::uuid,'probe-a@millennium.invalid','{"role":"admin"}'),
  (current_setting('millennium.check_b')::uuid,'probe-b@millennium.invalid','{}');
INSERT INTO public.products(id,title,slug,product_type,access_type) VALUES
  (current_setting('millennium.check_price')::uuid,'Transactional permission probe','transactional-permission-probe','course','one_time');
INSERT INTO public.prices(id,product_id,stripe_price_id,amount_cents,currency) VALUES
  (current_setting('millennium.check_price')::uuid,current_setting('millennium.check_price')::uuid,'price_transactionalPermissionProbe',1000,'brl');
SET LOCAL ROLE service_role;
SELECT public.reserve_stripe_connection(current_setting('millennium.check_a')::uuid);
SELECT public.reserve_stripe_checkout(current_setting('millennium.check_a')::uuid,
  current_setting('millennium.check_price')::uuid,current_setting('millennium.check_request')::uuid);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('millennium.check_a'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('millennium.check_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $probe$
BEGIN
  IF (SELECT count(*) FROM public.users) <> 1 OR
     NOT EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='user') OR
     (SELECT count(*) FROM public.stripe_checkout_requests) <> 1 OR
     (SELECT count(*) FROM public.stripe_connected_accounts) <> 1 OR public.is_admin() THEN
    RAISE EXCEPTION 'Owner access or metadata role boundary failed';
  END IF;
  UPDATE public.users SET display_name='Transactional probe' WHERE id=auth.uid();
  BEGIN
    UPDATE public.users SET role='admin' WHERE id=auth.uid();
    RAISE EXCEPTION 'Browser role escalation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM checkout_url FROM public.stripe_checkout_requests;
    RAISE EXCEPTION 'Private checkout URL was readable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.reserve_stripe_connection(auth.uid());
    RAISE EXCEPTION 'Browser seller reservation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE public.tags;
    RAISE EXCEPTION 'Browser truncate was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$probe$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('millennium.check_b'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('millennium.check_b'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $probe$
BEGIN
  IF (SELECT count(*) FROM public.users) <> 1 OR
     (SELECT count(*) FROM public.public_user_profiles) <> 1 OR
     (SELECT count(*) FROM public.authors) <> 0 OR
     (SELECT count(*) FROM public.stripe_checkout_requests) <> 0 OR
     (SELECT count(*) FROM public.stripe_connected_accounts) <> 0 OR
     EXISTS (SELECT 1 FROM public.users WHERE id<>auth.uid()) THEN
    RAISE EXCEPTION 'Cross-owner isolation failed';
  END IF;
  UPDATE public.users SET display_name='Forbidden' WHERE id=current_setting('millennium.check_a')::uuid;
  IF FOUND THEN RAISE EXCEPTION 'Cross-owner update was allowed'; END IF;
END;
$probe$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $probe$
BEGIN
  IF (SELECT count(*) FROM public.products) <> 1 OR (SELECT count(*) FROM public.prices) <> 1 OR public.is_admin() THEN
    RAISE EXCEPTION 'Public catalog or null identity failed';
  END IF;
  BEGIN
    PERFORM id FROM public.users;
    RAISE EXCEPTION 'Anonymous profile access was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM id FROM public.stripe_checkout_requests;
    RAISE EXCEPTION 'Anonymous checkout access was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$probe$;
RESET ROLE;
SELECT true AS owner_access, true AS cross_owner_isolation, true AS anonymous_denial,
       true AS browser_privileged_writes_denied, true AS role_metadata_ignored,
       true AS private_checkout_url_denied, 'ROLLBACK: no persistent users or payment records' AS cleanup;
ROLLBACK;
