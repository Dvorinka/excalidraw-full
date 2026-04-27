# ===================================================================
# Excalidraw FULL - Production Dockerfile
# ===================================================================
# Builds the new React frontend (not the old excalidraw submodule)
# and embeds it into the Go binary.
#
# Usage:
#   docker build -f excalidraw-full.Dockerfile -t excalidraw-full .
#   docker run -p 3002:3002 -v $(pwd)/.env:/root/.env excalidraw-full
# ===================================================================

# -------------------------------------------------------------------
# Stage 1: Frontend build
# -------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# -------------------------------------------------------------------
# Stage 2: Backend build
# -------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM golang:1.26.2-alpine AS backend-builder
RUN apk add --no-cache git ca-certificates
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Replace frontend source with built dist so only production assets are embedded
RUN rm -rf ./frontend && mkdir -p ./frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o excalidraw-full .

# -------------------------------------------------------------------
# Stage 3: Final runtime
# -------------------------------------------------------------------
FROM alpine:latest
RUN apk --no-cache add ca-certificates wget
WORKDIR /root/
COPY --from=backend-builder /app/excalidraw-full .
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 -O- http://localhost:3002/api/health || exit 1
CMD ["./excalidraw-full"]
