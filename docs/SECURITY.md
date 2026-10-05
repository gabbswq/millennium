# Security

This document defines basic security rules for Millennium.

The current defensive scope, threat model, reviewed skill references and release
gates are recorded in [SECURITY_PROGRAM.md](SECURITY_PROGRAM.md). Local tests and
successful scanning do not certify the hosted payment system.

## Core rule

Never commit secrets.

Examples of secrets:

- API keys
- Stripe secrets
- Supabase service role keys
- OAuth client secrets
- JWT secrets
- passwords
- .env files

## Payments

Stripe webhook events must be verified with the Stripe-Signature header before processing.

Server-side payment writes must use SUPABASE_SERVICE_ROLE_KEY.

Client-provided user IDs must not be trusted.

## Access control

Paid content and product access must be validated server-side.

Frontend checks are not enough for paid access.

## Repository safety

Before making the repository public:

- scan for secrets
- verify .env files are ignored
- verify generated files are ignored
- review commit history
- confirm no private business notes are included

## Files that should not be committed

- .env
- .env.local
- .env.production
- node_modules
- .next
- .venv
- __pycache__
- build artifacts

## AI agent safety

Agents should not edit .env files.

Agents should not add API keys to source code.

Agents should plan before implementation and wait for approval before risky changes.
