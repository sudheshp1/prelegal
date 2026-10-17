# Stage 1: build the Next.js frontend as static files.
FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# The frontend reads the document specs and agreement text from the repo root at build time.
COPY templates /app/templates
COPY documents.json catalog.json /app/
COPY frontend ./
RUN npm run build

# Stage 2: FastAPI backend, which also serves the static frontend.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/backend/.venv/bin:$PATH" \
    PRELEGAL_STATIC_DIR=/app/static \
    PRELEGAL_DB_PATH=/app/data/prelegal.db
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
# The backend reads the document specs from the repo root (/app).
COPY documents.json catalog.json /app/
COPY --from=frontend /app/frontend/out /app/static

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
