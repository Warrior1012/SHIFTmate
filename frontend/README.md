# SHIFTmate Frontend 2.0

This version keeps the original SHIFTmate dark operations-console visual language while replacing demo-only state with the FastAPI backend.

## Stack

- React 18
- Vite 6
- Tailwind CSS
- Lucide React
- Browser Web Speech API for STT
- FastAPI backend for Gemini/Qdrant/Rime

## Run

```powershell
cd frontend
npm install
npm run dev
```

Create `.env` from `.env.example`:

```env
VITE_API_BASE=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=
```

Chrome or Edge is recommended for browser speech recognition.

## Implemented

- Google Sign-In integration point + local operator fallback
- Real issue lifecycle
- Shift management
- Voice → Gemini/Qdrant → Rime flow
- Automatic issue extraction from operational voice/text reports
- Qdrant memory search and source attribution
- Machine profiles and recurring-issue signals
- Handover generation + quality score + missing-field checks
- Assignment and resolution actions
- Evidence upload
- Notifications
- Reports
- Service health
- Dark/light mode

## Important

No Gemini, Qdrant or Rime secret is placed in React. Google OAuth only exposes the client ID, which is public by design; the backend verifies the Google credential.
