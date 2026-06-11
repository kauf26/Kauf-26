# Legacy database artifacts

**Do not use for new code.**

| Path | Status |
|------|--------|
| `shared/schema.ts` | **Source of truth** — used by `drizzle.config.ts`, server, and web |
| `migrations/` (repo root) | Active Drizzle migrations generated from `shared/schema.ts` |
| `server/db/schema.ts` | Deprecated re-export only — kept for backwards compatibility |
| `server/db/0000_*.sql`, `0001_*.sql` | Old Replit-era SQL snapshots — **not** applied by current `npm run db:migrate` |
| `server/db/meta/` | Legacy Drizzle meta for the old schema |

When changing the database, edit `shared/schema.ts` and run:

```bash
npm run db:push    # dev
npm run db:migrate # production migrations
```
