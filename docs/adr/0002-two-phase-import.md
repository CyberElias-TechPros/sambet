# ADR-0002: Two-phase import (preview → execute) with R2-held payload

**Status:** accepted (2026-09)

## Context

The registry is being migrated from a manually maintained 2,000-row spreadsheet, and
future project cycles will repeat bulk imports. Direct "upload = write" is unsafe for
two reasons:

1. A 1,669-row file with 3 hidden problems shouldn't abort after 1,400 rows are in —
   the reviewer must see **all** problems first (validation errors, near-duplicates,
   unmapped columns) and consciously confirm.
2. A single request that both parses and writes a large file approaches Worker request
   limits and makes retry semantics murky.

## Decision

Import is two endpoints:

1. `POST /api/imports/preview` (multipart file + `strategy`)
   - Parses, normalizes, validates every row; matches each row against existing records
     (order: `sn` → name+phone → name+account → unique name+state).
   - Persists the parsed payload to R2 `uploads/<uploadId>.json` (+ original `.file`)
     with a **1-hour TTL**.
   - Returns counts + up to 50 error/warning samples + unmapped headers. **Writes nothing
     to D1.**
2. `POST /api/imports/execute` (JSON `{uploadId, strategy}`)
   - Reads the payload back from R2, upserts in D1 batches of 100, archives the original
     file to `imports/<id>/<name>`, writes the `imports` row + audit entry.
   - **Idempotent per uploadId** — a second execute returns 410, so a reviewer's double
     click or retry can never double-apply.

The `strategy` (update vs skip-on-duplicate) is sent on **both** calls; execute honors
the strategy given at execute time, so the reviewer can flip it without re-uploading.

## Consequences

- Reviewers can close the tab after preview and execute up to an hour later (R2 TTL).
- The execute request is small (2 JSON fields) and fast — parsing cost is paid once.
- R2 is a required dependency (not optional) for imports; there is no KV/queue fallback.
- Pathological workbooks must be handled at parse time: the legacy file declared a
  `A1:XEZ2012` sheet range (16,380 cols) that made SheetJS materialize ~33M empty cells
  (~20 s, ~1 GB heap, crashed the isolate on the next request). `clipSheetRange()`
  clips to actually-present cells (≤100 cols / 100k rows) before parsing — the same file
  now parses in ~0.5 s / ~160 MB.
