BEGIN;

CREATE TABLE public.stripe_connected_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  stripe_account_id text UNIQUE CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  creation_state text NOT NULL DEFAULT 'RESERVED' CHECK (creation_state IN ('RESERVED', 'CREATING', 'UNCERTAIN', 'BOUND')),
  livemode boolean NOT NULL DEFAULT false CHECK (livemode = false),
  last_event_created bigint NOT NULL DEFAULT 0 CHECK (last_event_created >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((creation_state = 'BOUND') = (stripe_account_id IS NOT NULL))
);
ALTER TABLE public.stripe_connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connected_accounts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_connected_accounts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.stripe_connected_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stripe_connected_accounts TO service_role;
CREATE POLICY stripe_connected_accounts_read_own ON public.stripe_connected_accounts
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.protect_stripe_connection()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.user_id, NEW.request_id, NEW.livemode, NEW.created_at)
     IS DISTINCT FROM ROW(OLD.user_id, OLD.request_id, OLD.livemode, OLD.created_at)
     OR (OLD.stripe_account_id IS NOT NULL AND NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id)
     OR (OLD.creation_state = 'BOUND' AND NEW.creation_state <> 'BOUND')
     OR (OLD.creation_state <> 'RESERVED' AND NEW.creation_state = 'RESERVED')
     OR (OLD.creation_state = 'UNCERTAIN' AND NEW.creation_state NOT IN ('UNCERTAIN', 'BOUND')) THEN
    RAISE EXCEPTION 'Stripe connection identity is immutable' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER stripe_connected_accounts_protect BEFORE UPDATE ON public.stripe_connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.protect_stripe_connection();

CREATE FUNCTION public.reserve_stripe_connection(p_user_id uuid)
RETURNS SETOF public.stripe_connected_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user uuid := p_user_id;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(710030001);
  IF NOT EXISTS (SELECT 1 FROM public.stripe_connected_accounts WHERE user_id = v_user)
     AND (SELECT count(*) FROM public.stripe_connected_accounts WHERE created_at >= date_trunc('day', now())) >= 25 THEN
    RAISE EXCEPTION 'Daily onboarding limit reached' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.stripe_connected_accounts(user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;
  RETURN QUERY SELECT * FROM public.stripe_connected_accounts WHERE user_id = v_user;
END;
$$;

CREATE FUNCTION public.claim_stripe_connection(p_user_id uuid)
RETURNS SETOF public.stripe_connected_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user uuid := p_user_id;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY UPDATE public.stripe_connected_accounts SET creation_state = 'CREATING'
    WHERE user_id = v_user AND creation_state = 'RESERVED' RETURNING *;
END;
$$;

CREATE TABLE public.stripe_connect_events (
  id text PRIMARY KEY CHECK (id ~ '^evt_[A-Za-z0-9]+$'),
  stripe_account_id text NOT NULL REFERENCES public.stripe_connected_accounts(stripe_account_id) ON DELETE RESTRICT,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  event_created bigint NOT NULL CHECK (event_created > 0),
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_connect_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_connect_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.stripe_connect_events TO service_role;

CREATE FUNCTION public.protect_stripe_connect_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Stripe event receipts are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER stripe_connect_events_protect BEFORE UPDATE OR DELETE ON public.stripe_connect_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_stripe_connect_event();

CREATE FUNCTION public.record_stripe_connect_event(p_event_id text, p_account_id text, p_fingerprint text, p_created bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_hash text; v_inserted text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stripe_connected_accounts WHERE stripe_account_id = p_account_id) THEN
    RAISE EXCEPTION 'Stripe account is not bound yet' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.stripe_connect_events(id, stripe_account_id, fingerprint, event_created)
    VALUES (p_event_id, p_account_id, p_fingerprint, p_created)
    ON CONFLICT (id) DO NOTHING RETURNING id INTO v_inserted;
  SELECT fingerprint INTO v_hash FROM public.stripe_connect_events WHERE id = p_event_id;
  IF v_hash IS DISTINCT FROM p_fingerprint THEN
    RAISE EXCEPTION 'Event ID reused with different content' USING ERRCODE = '23514';
  END IF;
  IF v_inserted IS NOT NULL THEN
    UPDATE public.stripe_connected_accounts
      SET last_event_created = greatest(last_event_created, p_created)
      WHERE stripe_account_id = p_account_id;
  END IF;
  RETURN v_inserted IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_stripe_connection(), public.protect_stripe_connect_event(),
  public.reserve_stripe_connection(uuid), public.claim_stripe_connection(uuid),
  public.record_stripe_connect_event(text, text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stripe_connection(uuid), public.claim_stripe_connection(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_connect_event(text, text, text, bigint) TO service_role;

COMMIT;
