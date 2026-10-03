BEGIN;

CREATE TABLE public.stripe_checkout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  price_id uuid NOT NULL REFERENCES public.prices(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  stripe_price_id text NOT NULL CHECK (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 1 AND 1000000),
  currency text NOT NULL CHECK (currency = 'brl'),
  creation_state text NOT NULL DEFAULT 'RESERVED' CHECK (creation_state IN ('RESERVED', 'CREATING', 'UNCERTAIN', 'BOUND')),
  stripe_session_id text UNIQUE CHECK (stripe_session_id ~ '^cs_test_[A-Za-z0-9]+$'),
  checkout_url text,
  expires_at bigint CHECK (expires_at > 0),
  payment_state text NOT NULL DEFAULT 'pending' CHECK (payment_state IN ('pending', 'paid', 'expired', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id),
  CHECK ((creation_state = 'BOUND') = (stripe_session_id IS NOT NULL AND checkout_url IS NOT NULL AND expires_at IS NOT NULL)),
  CHECK (creation_state = 'BOUND' OR (stripe_session_id IS NULL AND checkout_url IS NULL AND expires_at IS NULL))
);
CREATE UNIQUE INDEX stripe_checkout_one_pending_price ON public.stripe_checkout_requests(user_id, price_id) WHERE payment_state = 'pending';
ALTER TABLE public.stripe_checkout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_checkout_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_checkout_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (id, user_id, price_id, amount_cents, currency, creation_state, payment_state, created_at, updated_at)
  ON public.stripe_checkout_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stripe_checkout_requests TO service_role;
CREATE POLICY stripe_checkout_read_own ON public.stripe_checkout_requests FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.protect_stripe_checkout()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.id, NEW.user_id, NEW.price_id, NEW.request_id, NEW.stripe_price_id, NEW.amount_cents, NEW.currency, NEW.created_at)
     IS DISTINCT FROM ROW(OLD.id, OLD.user_id, OLD.price_id, OLD.request_id, OLD.stripe_price_id, OLD.amount_cents, OLD.currency, OLD.created_at)
     OR (OLD.creation_state = 'BOUND' AND ROW(NEW.creation_state, NEW.stripe_session_id, NEW.checkout_url, NEW.expires_at)
       IS DISTINCT FROM ROW(OLD.creation_state, OLD.stripe_session_id, OLD.checkout_url, OLD.expires_at))
     OR (OLD.creation_state <> 'RESERVED' AND NEW.creation_state = 'RESERVED')
     OR (OLD.creation_state = 'UNCERTAIN' AND NEW.creation_state NOT IN ('UNCERTAIN', 'BOUND'))
     OR (OLD.payment_state = 'paid' AND NEW.payment_state <> 'paid') THEN
    RAISE EXCEPTION 'Checkout identity or terminal state is immutable' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER stripe_checkout_protect BEFORE UPDATE ON public.stripe_checkout_requests FOR EACH ROW EXECUTE FUNCTION public.protect_stripe_checkout();

CREATE FUNCTION public.reserve_stripe_checkout(p_user_id uuid, p_price_id uuid, p_request_id uuid)
RETURNS SETOF public.stripe_checkout_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_existing public.stripe_checkout_requests; v_price public.prices;
BEGIN
  IF p_user_id IS NULL OR p_price_id IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Missing identity' USING ERRCODE = '23514'; END IF;
  PERFORM pg_advisory_xact_lock(710030002);
  SELECT * INTO v_existing FROM public.stripe_checkout_requests WHERE user_id = p_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.price_id <> p_price_id THEN RAISE EXCEPTION 'Request key reused' USING ERRCODE = '23514'; END IF;
    RETURN NEXT v_existing; RETURN;
  END IF;
  SELECT * INTO v_existing FROM public.stripe_checkout_requests WHERE user_id = p_user_id AND price_id = p_price_id AND payment_state = 'pending';
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;
  IF (SELECT count(*) FROM public.stripe_checkout_requests WHERE created_at >= date_trunc('day', now())) >= 100
    OR (SELECT count(*) FROM public.stripe_checkout_requests WHERE user_id = p_user_id AND created_at >= date_trunc('day', now())) >= 5 THEN
    RAISE EXCEPTION 'Daily checkout limit reached' USING ERRCODE = 'P0001';
  END IF;
  SELECT pr.* INTO v_price FROM public.prices pr JOIN public.products p ON p.id = pr.product_id
    WHERE pr.id = p_price_id AND pr.active AND p.active AND pr.interval IS NULL AND pr.currency = 'brl'
      AND pr.amount_cents BETWEEN 1 AND 1000000 AND pr.stripe_price_id ~ '^price_[A-Za-z0-9]+$';
  IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable one-time BRL price' USING ERRCODE = 'P0002'; END IF;
  RETURN QUERY INSERT INTO public.stripe_checkout_requests(user_id, price_id, request_id, stripe_price_id, amount_cents, currency)
    VALUES (p_user_id, p_price_id, p_request_id, v_price.stripe_price_id, v_price.amount_cents, v_price.currency) RETURNING *;
END;
$$;

CREATE FUNCTION public.claim_stripe_checkout(p_user_id uuid, p_id uuid)
RETURNS SETOF public.stripe_checkout_requests LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  UPDATE public.stripe_checkout_requests SET creation_state = 'CREATING'
    WHERE user_id = p_user_id AND id = p_id AND creation_state = 'RESERVED' RETURNING *;
$$;

CREATE TABLE public.stripe_checkout_events (
  id text PRIMARY KEY CHECK (id ~ '^evt_[A-Za-z0-9]+$'),
  checkout_id uuid NOT NULL REFERENCES public.stripe_checkout_requests(id) ON DELETE RESTRICT,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_checkout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_checkout_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_checkout_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.stripe_checkout_events TO service_role;
CREATE TRIGGER stripe_checkout_events_protect BEFORE UPDATE OR DELETE ON public.stripe_checkout_events FOR EACH ROW EXECUTE FUNCTION public.protect_stripe_connect_event();

CREATE FUNCTION public.record_stripe_checkout_event(p_event_id text, p_fingerprint text, p_checkout_id uuid, p_user_id uuid,
  p_session_id text, p_amount integer, p_currency text, p_state text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_order public.stripe_checkout_requests; v_event public.stripe_checkout_events; v_inserted text;
BEGIN
  SELECT * INTO v_order FROM public.stripe_checkout_requests WHERE id = p_checkout_id FOR UPDATE;
  IF NOT FOUND OR v_order.creation_state <> 'BOUND' THEN RAISE EXCEPTION 'Checkout not bound' USING ERRCODE = 'P0002'; END IF;
  IF v_order.user_id IS DISTINCT FROM p_user_id OR v_order.stripe_session_id IS DISTINCT FROM p_session_id
    OR v_order.amount_cents IS DISTINCT FROM p_amount OR v_order.currency IS DISTINCT FROM p_currency
    OR p_state IS NULL OR p_state NOT IN ('pending', 'paid', 'expired', 'failed') THEN
    RAISE EXCEPTION 'Checkout facts mismatch' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.stripe_checkout_events(id, checkout_id, fingerprint) VALUES (p_event_id, p_checkout_id, p_fingerprint)
    ON CONFLICT (id) DO NOTHING RETURNING id INTO v_inserted;
  SELECT * INTO v_event FROM public.stripe_checkout_events WHERE id = p_event_id;
  IF v_event.fingerprint IS DISTINCT FROM p_fingerprint OR v_event.checkout_id IS DISTINCT FROM p_checkout_id THEN
    RAISE EXCEPTION 'Event identity reused' USING ERRCODE = '23514';
  END IF;
  IF v_inserted IS NOT NULL AND v_order.payment_state <> 'paid' AND (p_state = 'paid' OR v_order.payment_state = 'pending') THEN
    UPDATE public.stripe_checkout_requests SET payment_state = p_state WHERE id = p_checkout_id;
  END IF;
  RETURN v_inserted IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_stripe_checkout(), public.reserve_stripe_checkout(uuid, uuid, uuid),
  public.claim_stripe_checkout(uuid, uuid), public.record_stripe_checkout_event(text, text, uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stripe_checkout(uuid, uuid, uuid), public.claim_stripe_checkout(uuid, uuid),
  public.record_stripe_checkout_event(text, text, uuid, uuid, text, integer, text, text) TO service_role;
COMMIT;
