# SHIFTmate Backend 2.0

FastAPI service for the original SHIFTmate UI, extended with structured operational state while preserving the existing Gemini → Qdrant → Rime flow.

## Run

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Copy `.env.example` to `.env` and fill:

- `GEMINI_API_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `RIME_API_KEY`
- optional `GOOGLE_CLIENT_ID`
- optional `CORS_ORIGINS`

## Main APIs

- `POST /ask`
- `POST /ask/voice`
- `POST /issues`
- `GET /issues`
- `GET /issues/{id}`
- `PATCH /issues/{id}`
- `POST /issues/{id}/assign`
- `POST /issues/{id}/resolve`
- `POST /issues/extract`
- `POST /memory/search`
- `POST /handover`
- `POST /handover/generate`
- `GET /handover/latest`
- `POST /shifts/start`
- `POST /shifts/{id}/end`
- `GET /shifts/current/{user_id}`
- `GET /machines`
- `GET /notifications`
- `POST /attachments`
- `POST /auth/dev`
- `POST /auth/google`
- `GET /health`

## Security changes

Generated audio is served only from `backend/audio/`, uploads only from `backend/uploads/`. The previous `StaticFiles(directory=".")` design is intentionally removed. Voice output uses a unique UUID filename for every request instead of overwriting one shared `response.wav`.

SQLite is used for structured state; Qdrant remains the semantic memory layer.
