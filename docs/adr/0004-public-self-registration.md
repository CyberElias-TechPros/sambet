# ADR-0004: Public self-registration with manual payment verification

**Status:** Accepted
**Date:** 2026-09-07

## Context

The registry is not maintained only by staff. Organizations in the public
participate by paying a registration fee (typically ₦1,000 for a fresh
organization, ₦1,500 in special cases, ₦500 to "balance up") by bank
transfer, then sending their details (phone, bank, account, name) together
with a picture of the proof of payment (POP). Previously this happened over
chat apps, which produced duplicates, lost records and no audit trail.

## Decision

The site itself accepts public submissions:

1. **Public form** (`/submit`, no login) — organization name, phone, state,
   the bank/account they paid *from*, amount paid, optional payment date /
   transfer reference / message, and a required POP image (JPG/PNG/WebP,
   ≤ 6 MB, stored in R2 under `submissions/<reference>/pop.<ext>`).
2. **Reference number** — each submission gets a human-friendly, unique
   `SAM-<year>-<id>` reference (e.g. `SAM-2026-00001`) shown immediately to
   the submitter.
3. **Public tracking** (`/track`) — anyone with a reference sees only a
   coarse status: pending / verified (+ organization name) / rejected (+
   reason). No other data is exposed.
4. **Staff queue** (`/submissions`, authenticated) — tabbed list
   (pending/verified/rejected) with search; the review dialog shows the
   submitted fields, the POP image (streamed through an authenticated
   endpoint, never a public URL), and **duplicate matches** against the
   registry (same phone > same account > same name+state).
5. **Admin verification** — an admin either
   - **Adds to registry** (the org is created with `source = 'public'`), or
   - **Links to an existing org** (when the organization is already
     registered — e.g. a top-up payment), or
   - **Rejects with a reason** (visible to the submitter via `/track`).

   Verification is **admin-only** (it touches money); editors can review
   but not act.

### Duplicate elimination

- At **submission time**, the API matches the incoming phone/account/name
  against the registry and returns the matches; the success screen warns
  the submitter if a record likely already exists.
- At **review time**, the same matches are shown to the admin.
- At **verify-time**, a hard guard returns `409` if the organization to be
  created has a phone or account number that already exists in the
  registry — forcing a deliberate link decision instead of a silent
  duplicate row.

### Money handling

Fees are **manual bank transfers** — there is no payment gateway. The
amount claimed by the submitter is recorded (`amount_paid`) and the admin
confirms it against the bank statement and the POP before verifying.
Analytics sum the claimed naira by status (pending / verified / 30-day
total), clearly excluding rejected submissions from "collected".

### Abuse protection (no account, no gateway)

- Per-IP rate limit: **8 submissions per hour** (separate bucket from
  login limits).
- Honeypot field (`website`) — bots that fill it get a generic 400.
- Strict validation of every field (zod), image type/size checks, and the
  POP image is only ever reachable through an authenticated staff endpoint.

## Consequences

- New table `submissions` + R2 keys `submissions/<ref>/pop.<ext>`; one new
  migration (0003).
- New public routes `/api/public/submit`, `/api/public/status/:ref` and
  staff routes `/api/submissions…` (all under the same Worker).
- The public pages are the site's front door: `/` is now a landing page
  with the registration CTA; staff entry is `/login`.
- Verification SLA is a process (admin checks bank + POP), not a system —
  the status page tells submitters "usually 1–3 days".
- The receiving bank account details are configured in
  `web/src/lib/constants.ts` (`PUBLIC_TRANSFER`); until set, the public
  page shows a "details being finalised" notice rather than guessed bank
  details.

## Alternatives considered

- **Payment gateway (Paystack/Flutterwave):** the program's fee structure
  (₦500 top-ups, "depending on the case") is informal and verified
  manually against statements; a gateway adds cost and complexity the
  business does not need yet.
- **Blocking duplicates at submission time:** the payment is real money
  even when a record exists (top-ups, corrections), so submissions are
  always accepted and surfaced to a human instead.
- **Public signed R2 URLs for POP images:** images contain personal data
  (bank details); an authenticated stream endpoint is simpler and
  safer.
