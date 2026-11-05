# Review fix progress

Changes stay inside this subrepository. No parent website changes, publication, pushes, or parent submodule-pointer commits are included.

Each completed entry is committed separately. The commit containing an entry is its implementation commit (`git log -- FIX_PROGRESS.md`). Tests use isolated storage, never the application's SQLite database.

| Finding | Status | Validation |
| --- | --- | --- |
| 1 Atomic relation import | Complete | IndexedDB regression tests: invalid input, mid-write rollback, merge, explicit empty replace. |
| 2 Evidence verse selection | Complete | Word context overrides dropdown; mixed-verse selections rejected; evidence resolver tests. |
| 3 Backend access control | Complete | Default read-only, bearer token and exact origin checks; API authorization tests. |
| 4 Complete word usages | Pending | |
| 5 Relation validation and durable writes | Pending | |
| 6 Transactional corpus import | Pending | |
| 7 Current and repeatable seed | Pending | |
| 8 Stable corpus references and backups | Pending | |
| 9 Source navigation | Pending | |
| 10 Embedded links | Pending | |
| Shared UI and adapter contracts | Pending | |
| Atomic composition identity | Pending | |
| Repeated token preservation | Pending | |
| Lazy loading and relation queries | Pending | |
| HTTP errors and initialization recovery | Pending | |
| Embedded DOM and style isolation | Pending | |
| Safe HTML rendering | Pending | |
| Isolated tests, graph export, CI | Pending | |
