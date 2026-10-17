# prelegal
Platform for drafting common legal agreements

> **🚧 Status: Work in progress**
>
> This project is under active development and is expected to be completed by **October 24, 2026** (in about one week). Features, documentation, and setup instructions will be added as development progresses.

## Running the app

Requires [Docker](https://www.docker.com/). The start script builds the image and runs it at http://localhost:8000; if a `.env` file exists in the project root it is passed to the container.

```bash
# Mac
scripts/start-mac.sh
scripts/stop-mac.sh

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows (PowerShell)
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

The SQLite database lives inside the container and is recreated on every start.

## Development

- `backend/` is a [uv](https://docs.astral.sh/uv/) project using FastAPI. Run the tests with `uv run pytest`.
- `frontend/` is a Next.js app built as a static export. Run the tests with `npm test`.

To run without Docker, build the frontend (`npm run build` in `frontend/`), then start the backend from `backend/` with `uv run uvicorn app.main:app --port 8000`. It serves `frontend/out` alongside the API.
