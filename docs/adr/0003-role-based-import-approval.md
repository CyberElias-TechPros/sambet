# ADR-0003: Role-based import approval (admin applies directly, editor submits for review)

**Status:** accepted (2026-09)

## Context

The registry is maintained by a small team, and workbook uploads come from more than
just the data owner. Applying an unreviewed 2,000-row file straight into the live
registry is how spreadsheets get corrupted. But a blanket "everyone queues, admin
approves everything" adds a pointless self-approval step for the admin, who is the
trusted data owner and whose uploads the whole queue exists to police.

## Decision

Two roles (a `users.role` column, already in the schema):

| | admin | editor (staff) |
|---|---|---|
| Browse registry, dashboard, audit | ✓ | ✓ |
| Add / edit / soft-delete records | ✓ | ✓ (every change is audited with the actor's e-mail) |
| Upload workbook → **preview report** | ✓ | ✓ |
| **Apply an import immediately** | ✓ | ✗ (403) |
| **Submit an import for approval** | ✓ | ✓ |
| **Approve / reject** pending imports | ✓ | ✗ (403) |
| Team management (add, role, disable, reset password) | ✓ | ✗ (403) |

The approval queue:

1. An editor's `POST /api/imports/submit` moves the preview's R2 payload out of the
   1-hour `uploads/` area into the permanent `imports/<id>/` area (payload JSON +
   original file) and creates an `imports` row with `status = 'pending'`.
   **No organization data is touched.**
2. An admin reviews on the Import page: the full preview report (row counts, errors,
   warnings, unmapped columns), the archived file, and a strategy choice
   (**update/skip can be changed at approval time** — it is honored at apply time, not
   locked at submit time).
3. `approve` **re-runs duplicate matching against the current registry** (rows may have
   been added, edited or deleted between submission and approval) and then applies.
   `reject` records a reason visible in the history.
4. Pending submissions **expire after 7 days** (lazy check — no cron; an approval
   attempt on an expired row auto-rejects it with an `expired` reason).

Team management is in-app now (Team page): create members with a one-time temporary
password, change role, disable/re-enable (disabling kills the user's sessions
immediately), reset password (one-time temp password, existing sessions dropped).
Guardrails: an admin cannot disable or demote themselves, and the last active admin
cannot be disabled/demoted.

## Consequences

- The admin's own workflow is unchanged (preview → apply), so the primary migration and
  per-cycle imports stay frictionless.
- Editors can do data entry (add/edit records) without a gate — single-record edits are
  soft-deletable and audited; the gate exists for *bulk* changes, which are the
  corruption risk.
- Every approval/reject/submit is in the audit log (`import.submitted`,
  `import.approved`, `import.rejected`) with actor + details.
- The pending state is data (a row + two R2 objects), not infrastructure — no Queues,
  no Durable Objects, no cron. The "review queue" is just a filtered list of imports.
