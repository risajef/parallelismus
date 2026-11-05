# Parallelismus

Minimal proof-of-concept for the parallelismus project described in `Description.md`.

The backend is read-only by default. To enable writes, set `PARALLELISMUS_WRITE_TOKEN` to a private token before starting the server, then enter it in the backend UI's Write token field. The token is kept in session storage for this tab. Use HTTPS for any nonlocal deployment and share the token only with trusted editors; all holders have the same write permissions. `PARALLELISMUS_ORIGINS` is a comma-separated exact origin allowlist, defaulting to localhost and 127.0.0.1 on port 8000. Bind to localhost for local use.

Run backend:

```bash
python3 -m pip install -r backend/requirements.txt
python3 -m backend.seed  # creates database and seeds sample data
uvicorn backend.main:app --reload
```

Open `frontend/index.html` in a browser or serve it with a static server. The frontend will talk to `http://localhost:8000`.
