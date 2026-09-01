# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy frontend dependency manifests
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code and build production bundle
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python Backend & Production Image
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# System optimizations and defaults
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    PORT=8000 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/frontend/dist

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app ./app

# Copy built frontend assets from frontend-builder
COPY --from=frontend-builder /build/dist ./frontend/dist

# Create persistent data volume directory
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8000

# Start FastAPI server with Uvicorn (reads PORT and HOST from environment/.env)
CMD ["sh", "-c", "uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000}"]
