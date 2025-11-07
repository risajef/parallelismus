# Parallelismus

Minimal proof-of-concept for the parallelismus project described in `Description.md`.

Run backend:

```bash
python3 -m pip install -r backend/requirements.txt
python3 -m backend.seed  # creates database and seeds sample data
uvicorn backend.main:app --reload
```

Open `frontend/index.html` in a browser or serve it with a static server. The frontend will talk to `http://localhost:8000`.
