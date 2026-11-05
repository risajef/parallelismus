# Parallelismus

Minimal proof-of-concept for the parallelismus project described in `Description.md`.

The backend is read-only by default. To enable writes, set `PARALLELISMUS_WRITE_TOKEN` to a private token before starting the server, then enter it in the backend UI's Write token field. The token is kept in session storage for this tab. Use HTTPS for any nonlocal deployment and share the token only with trusted editors; all holders have the same write permissions. `PARALLELISMUS_ORIGINS` is a comma-separated exact origin allowlist, defaulting to localhost and 127.0.0.1 on port 8000. Bind to localhost for local use.

Run backend:

```bash
python3 -m pip install -r backend/requirements.txt
python3 -m backend.seed  # creates database and seeds sample data
uvicorn backend.main:app --reload
```

Open `http://localhost:8000/` for the backend UI. To load the complete corpus instead of the sample, run `python3 -m backend.import_strong` from this directory. Both import and seed can be rerun safely.

For the independent browser-only version, run `npm ci`, `npm run build`, then `npm run serve`. Open the printed HTTP URL; opening HTML via `file://` is not supported.

## Review fixes and verification

Progress and implementation boundaries are tracked in `FIX_PROGRESS.md`. Each review repair has its own commit in this repository. These changes do not publish or update the parent website.

Use Node 24 or newer and Python 3.11 for the checked configurations:

```bash
npm ci
npm test
npm run build
python -m pip install -r backend/requirements-dev.txt -r tools/requirements.txt
python -m pytest
npm run build:css
CHROME_BIN=/path/to/chrome PYTHON_BIN=python npm run test:browser
```

Tests use temporary databases. `PARALLELISMUS_DATABASE_URL` overrides the backend database location. Back up an existing SQLite database before upgrading; startup adds the new composition and token-position columns without deleting annotations. Rerun the corpus importer to populate repeated token occurrences in an existing database.

Browser backups now include a format version, corpus identity, and canonical source-verse keys. Existing browser annotations are migrated atomically using the frozen mapping from the original corpus. Old array backups are accepted using that mapping; incompatible or missing evidence references cause an error before replacement. Import merges by default, and replacement requires an explicit choice.

The graph PNG tool has separate dependencies in `tools/requirements.txt` and preserves parallel relation types. The backend remains a trusted-editor service: the configured token grants all write permissions; separate users and per-user authorization are outside the current personal-tool deployment.
