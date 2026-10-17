# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation is the v1 technical foundation (see Implementation Status below); AI chat and the full document catalog are still to come.

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

### Not yet implemented
- AI chat, other document types, real authentication, document persistence

### Current API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/signin` - Placeholder sign-in `{name, email}`; returns `{id, name, email}`
