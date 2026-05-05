# Campus Nexus Demo Backend

Minimal Flask API for the local Campus Nexus demo. Data is held in memory and resets when the server restarts.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python backend\app.py
```

The frontend defaults to `http://127.0.0.1:5000`. Override with `CAMPUS_NEXUS_API_URL` for server-side page fetches and `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` for browser form submissions.
