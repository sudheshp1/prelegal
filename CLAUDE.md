# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation drafts all 11 documents in the catalog via AI chat, with user accounts and saved documents (see Implementation Status below).

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your OpenAI skill to call the OpenAI API directly with the official `openai` Python SDK, using the `gpt-6-luna` model. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENAI_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`
- Muted Text: `#5c5c5c` (`brand-muted`: darker gray for small text and the disclaimer, meeting WCAG AA contrast)

## Implementation Status

### Completed (KAN-6)
- Next.js prototype: Mutual NDA form with live preview and PDF download

### Completed (KAN-7) - v1 technical foundation
- Docker multi-stage build (Node builds the static frontend, Python + uv runs the backend)
- FastAPI backend in `backend/app/` serving the API under `/api` and the static frontend at `/`
- SQLite database (stdlib `sqlite3`), deleted and recreated on every startup, with a `users` table
- Placeholder sign-in: login screen takes name + email, no password or session; the API upserts the user by email and the frontend keeps it in localStorage
- App header with the signed-in user and Sign out; the Mutual NDA creator is unchanged behind the login
- Brand colors available as Tailwind `brand-*` classes (see Color Scheme)
- Start/stop scripts for Mac, Linux, Windows
- Tests: `cd backend && uv run pytest`, `cd frontend && npm test` (Vitest + Testing Library)

### Completed (KAN-8) - AI chat for the Mutual NDA
- The manual NDA form is replaced by a freeform AI chat (left) next to the live preview (right)
- `POST /api/chat` is stateless: the client sends the whole conversation plus the current fields; the backend calls `gpt-6-luna` with Structured Outputs (`AiTurn` = reply + nullable field `updates`), merges the non-null updates and returns `{reply, nda, complete}`
- Field model, merge and the required-field check lived in `backend/app/nda.py` (generalised into `backend/app/documents.py` in KAN-9)
- The greeting is shown locally (no API call); Download PDF appears only once all required fields are filled
- Live OpenAI test: `cd backend && uv run --env-file ../.env pytest -k live` (skipped without a key)

### Completed (KAN-9) - all supported document types
- `documents.json` (project root) is the single source of truth for each document: id, catalog `filename`, title, party roles, optional intro/signing text, and curated fields (`key`, `label`, `description`, `kind` text/long/date, `required`, `default`). The backend reads it at runtime (descriptions joined from catalog.json); the frontend reads it at build time. Adding or changing a document is a documents.json edit.
- Chat is generic: the AI detects the document from the conversation (`documentType` in the structured output), offers the closest supported document for unsupported requests, and switching type starts the new document fresh. `backend/app/documents.py` holds the models, `merge()` and `missing_fields()`.
- Generic rendering: a generated Key Terms cover page + signature table, then the full standard terms parsed by `frontend/lib/templates.ts` (nested numbered clauses, header/link spans). `DocumentPreview`/`DocumentPdf` replace the NDA-specific components.

### Completed (KAN-10) - accounts, saved documents and polish
- Email/password accounts: passwords hashed with stdlib scrypt (per-user salt); server-side sessions in a `sessions` table, sent as an HttpOnly SameSite=Lax cookie (7 days). `current_user` (backend/app/auth.py) protects chat and document routes. Routes take `db: Db` (backend/app/db.py), which commits before the response is sent. The DB is still recreated on every start, which also ends all sessions.
- The server owns each conversation: `POST /api/chat {documentId?, message}` loads the user's saved document and history, calls the AI, and saves the result (a new document is created on the first message). `backend/app/saved_documents.py` holds the `documents` table access and the documents API.
- Frontend: `lib/auth.tsx` (AuthProvider/useAuth backed by `/api/auth/me`) replaces the localStorage session; any 401 from a protected route returns the user to sign-in (`setUnauthorizedHandler` in lib/api.ts). Split-screen AuthScreen (sign in / create account), AppShell with a sidebar of saved documents (open, delete, new), header user menu, and footer.
- Disclaimer (`DISCLAIMER` in frontend/lib/documents.ts): above the preview, in the app footer, on the sign-up screen, and in the footer of every PDF page (plus a DRAFT marker on the cover).

### Current API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/signup` - `{name, email, password}` (password 8+ chars); creates the account and signs in; 409 if the email exists
- `POST /api/auth/signin` - `{email, password}`; sets the session cookie; 401 "Incorrect email or password."
- `POST /api/auth/signout` - Ends the session
- `GET /api/auth/me` - Current user, or 401
- `GET /api/documents` - The user's documents as summaries `{id, title, companies, complete, updatedAt}`, newest first
- `GET /api/documents/{id}` - Summary plus `document` and `messages`; 404 for other users' documents
- `DELETE /api/documents/{id}` - Deletes the user's document
- `POST /api/chat` - `{documentId?, message}` -> `{documentId, reply, document, complete}`; 401 without a session, 502 if the AI call fails, 503 if no API key
