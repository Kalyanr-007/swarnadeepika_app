# --- Stage 1: Build the React Frontend ---
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
# Empty REACT_APP_BACKEND_URL so the UI calls its own origin (SPA style)
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# --- Stage 2: Build the Python Backend & Bundle ---
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies (needed for bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY desktop/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY desktop/backend/app.py ./

# Copy the built frontend from Stage 1
COPY --from=build-frontend /app/frontend/build ./static

# Set environment variables
ENV SDB_HOST=0.0.0.0
ENV SDB_PORT=8756
ENV SDB_DATA_DIR=/app/data

# Create data directory
RUN mkdir -p /app/data

# Expose the app port
EXPOSE 8756

# Run the app
CMD ["python", "app.py"]
