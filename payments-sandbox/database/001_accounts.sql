BEGIN;

-- Apply only to a dedicated homologation database with Supabase Auth roles.
-- This migration is not run by the local panel or by application startup.
CREATE SCHEMA millennium_payments;
REVOKE ALL ON SCHEMA millennium_payments FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA millennium_payments TO authenticated, service_role;

CREATE TABLE millennium_payments.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounts_owner_idx ON millennium_payments.accounts(owner_id);

CREATE TABLE millennium_payments.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES millennium_payments.accounts(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider = 'asaas'),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment = 'sandbox'),
  provider_account_ref text NOT NULL CHECK (provider_account_ref ~ '^[A-Za-z0-9_-]{1,100}$'),
  provider_customer_id text NOT NULL CHECK (provider_customer_id ~ '^cus_[A-Za-z0-9_-]{1,96}$'),
  provider_id text CHECK (provider_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 1 AND 1000000),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'CREATING' CHECK (status IN (
    'CREATING', 'UNCERTAIN', 'REJECTED', 'PENDING', 'CONFIRMED',
    'RECEIVED', 'OVERDUE', 'REFUNDED', 'CANCELED'
  )),
  warning text CHECK (char_length(warning) <= 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, request_key),
  UNIQUE (provider, environment, provider_account_ref, provider_id),
  UNIQUE (id, account_id, provider, environment, provider_account_ref)
);
CREATE INDEX charges_account_created_idx ON millennium_payments.charges(account_id, created_at DESC);
CREATE UNIQUE INDEX charges_unresolved_request_idx
  ON millennium_payments.charges(account_id, request_hash)
  WHERE status IN ('CREATING', 'UNCERTAIN');

CREATE TABLE millennium_payments.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES millennium_payments.accounts(id) ON DELETE RESTRICT,
  charge_id uuid,
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider = 'asaas'),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment = 'sandbox'),
  provider_account_ref text NOT NULL CHECK (provider_account_ref ~ '^[A-Za-z0-9_-]{1,100}$'),
  provider_event_id text NOT NULL CHECK (char_length(provider_event_id) BETWEEN 1 AND 150),
  event text NOT NULL CHECK (char_length(event) BETWEEN 1 AND 100),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  disposition text NOT NULL CHECK (disposition IN ('applied', 'stale', 'ignored')),
  received_at timestamptz NOT NULL DEFAULT now(),
  CHECK (charge_id IS NOT NULL OR disposition = 'ignored'),
  UNIQUE (provider, environment, provider_account_ref, provider_event_id),
  FOREIGN KEY (charge_id, account_id, provider, environment, provider_account_ref)
    REFERENCES millennium_payments.charges(id, account_id, provider, environment, provider_account_ref)
    ON DELETE RESTRICT
);
CREATE INDEX payment_events_account_time_idx ON millennium_payments.payment_events(account_id, received_at DESC);
CREATE INDEX payment_events_charge_idx ON millennium_payments.payment_events(charge_id);

CREATE FUNCTION millennium_payments.protect_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.id, NEW.owner_id, NEW.created_at) IS DISTINCT FROM ROW(OLD.id, OLD.owner_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Account ownership is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_protect_before_update BEFORE UPDATE ON millennium_payments.accounts
  FOR EACH ROW EXECUTE FUNCTION millennium_payments.protect_account();

CREATE FUNCTION millennium_payments.protect_charge()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.id, NEW.account_id, NEW.provider, NEW.environment, NEW.provider_account_ref, NEW.provider_customer_id,
         NEW.request_key, NEW.request_hash, NEW.description, NEW.amount_cents,
         NEW.currency, NEW.due_date, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.account_id, OLD.provider, OLD.environment, OLD.provider_account_ref, OLD.provider_customer_id,
         OLD.request_key, OLD.request_hash, OLD.description, OLD.amount_cents,
         OLD.currency, OLD.due_date, OLD.created_at)
     OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id) THEN
    RAISE EXCEPTION 'Charge identity and original request are immutable' USING ERRCODE = '23514';
  END IF;
  IF (OLD.status IN ('REFUNDED', 'CANCELED') AND NEW.status <> OLD.status)
     OR (OLD.status = 'RECEIVED' AND NEW.status NOT IN ('RECEIVED', 'REFUNDED'))
     OR (OLD.status = 'CONFIRMED' AND NEW.status IN ('PENDING', 'OVERDUE')) THEN
    RAISE EXCEPTION 'Charge status would regress' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER charges_protect_before_update BEFORE UPDATE ON millennium_payments.charges
  FOR EACH ROW EXECUTE FUNCTION millennium_payments.protect_charge();

CREATE FUNCTION millennium_payments.protect_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Payment events are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER payment_events_immutable BEFORE UPDATE OR DELETE ON millennium_payments.payment_events
  FOR EACH ROW EXECUTE FUNCTION millennium_payments.protect_event();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA millennium_payments FROM PUBLIC, anon, authenticated;

ALTER TABLE millennium_payments.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE millennium_payments.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE millennium_payments.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE millennium_payments.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE millennium_payments.charges FORCE ROW LEVEL SECURITY;
ALTER TABLE millennium_payments.payment_events FORCE ROW LEVEL SECURITY;

CREATE POLICY accounts_read_own ON millennium_payments.accounts
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY charges_read_own ON millennium_payments.charges
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM millennium_payments.accounts a
    WHERE a.id = account_id AND a.owner_id = (SELECT auth.uid())
  ));
CREATE POLICY events_read_own ON millennium_payments.payment_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM millennium_payments.accounts a
    WHERE a.id = account_id AND a.owner_id = (SELECT auth.uid())
  ));

REVOKE ALL ON ALL TABLES IN SCHEMA millennium_payments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON millennium_payments.accounts TO authenticated;
GRANT SELECT (id, account_id, description, amount_cents, currency, due_date, status,
  provider_id, warning, created_at, updated_at) ON millennium_payments.charges TO authenticated;
GRANT SELECT (id, account_id, charge_id, provider_event_id, event, disposition, received_at)
  ON millennium_payments.payment_events TO authenticated;

-- Supabase service_role bypasses RLS. It must remain exclusively in the backend.
GRANT SELECT, INSERT, UPDATE ON millennium_payments.accounts, millennium_payments.charges TO service_role;
GRANT SELECT, INSERT ON millennium_payments.payment_events TO service_role;

COMMIT;
