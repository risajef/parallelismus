# Review fix progress

Changes stay inside this subrepository. No parent website changes, publication, pushes, or parent submodule-pointer commits are included.

Each completed entry is committed separately. The commit containing an entry is its implementation commit (`git log -- FIX_PROGRESS.md`). Tests use isolated storage, never the application's SQLite database.

| Finding | Status | Validation |
| --- | --- | --- |
| 1 Atomic relation import | Complete | IndexedDB regression tests: invalid input, mid-write rollback, merge, explicit empty replace. |
| 2 Evidence verse selection | Complete | Word context overrides dropdown; mixed-verse selections rejected; evidence resolver tests. |
| 3 Backend access control | Complete | Default read-only, bearer token and exact origin checks; API authorization tests. |
| 4 Complete word usages | Complete | Sharded reverse index; cold detail and cache regression tests. |
| 5 Relation validation and durable writes | Complete | Validated API command and browser boundary, FK enforcement, duplicate and transaction-abort tests. |
| 6 Transactional corpus import | Complete | One book transaction, idempotent upserts; interruption rollback and retry regression. |
| 7 Current and repeatable seed | Complete | Current importer and Strong keys; repeatable seed regression; setup instructions corrected. |
| 8 Stable corpus references and backups | Complete | Canonical evidence keys, atomic legacy browser migration, versioned backups and incompatible-corpus regression. |
| 9 Source navigation | Complete | Await requested verse rendering and synchronize book/chapter/route; timer removed. Browser regression included in final smoke suite. |
| 10 Embedded links | Complete | Shared base-aware page URL builder for dynamic links and keyboard opening; embedded URL regression. |
| Shared UI and adapter contracts | Complete | Shared page controllers and transliteration; stale TypeScript removed; adapter contract regression. |
| Atomic composition identity | Complete | Group IDs, transactional creation/deletion in both adapters; rollback and whole-group deletion tests. |
| Repeated token preservation | Complete | Preserve each token and position in browser corpus and SQLite; repeated-Strong retry regression. |
| Lazy loading and relation queries | Complete | In-flight chapter promises, retries, indexed relation queries and one chapter badge refresh; concurrency/self-edge tests. |
| HTTP errors and initialization recovery | Complete | Checked JSON HTTP adapter, retryable initialization, blocked-upgrade/version-change handling; error and retry regressions. |
| Embedded DOM and style isolation | Complete | Root-scoped CSS, IDs, selection and keyboard handlers; disposable global listeners; no parent loader changes. |
| Safe HTML rendering | Complete | Variant text rendered with DOM text nodes; error text safe; adjacent-character escaping regression. |
| Isolated tests, graph export, CI | Pending | |
