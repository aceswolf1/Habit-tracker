#!/usr/bin/env bash
#
# Build multi-arch PixelPaladin images and push them to a registry, so the NAS
# can pull prebuilt images (TrueNAS Apps UI / Portainer) instead of building.
#
# Multi-arch matters: a Mac (arm64) building single-arch would produce images an
# amd64 NAS can't run ("exec format error"). buildx targets both by default.
#
# Usage:
#   IMAGE_PREFIX=ghcr.io/yourname ./scripts/build-and-push.sh [tag]
#
#   IMAGE_PREFIX   registry namespace (required), e.g. ghcr.io/yourname
#                  or docker.io/yourdockerhubuser
#   tag            optional image tag (default: latest)
#   PLATFORMS      optional, default: linux/amd64,linux/arm64
#
# Prerequisites:
#   - docker login <registry>   (e.g. `docker login ghcr.io`)
#   - Docker Desktop / buildx (bundled with modern Docker)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${IMAGE_PREFIX:?Set IMAGE_PREFIX, e.g. IMAGE_PREFIX=ghcr.io/yourname}"
TAG="${1:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

BACKEND_IMAGE="${IMAGE_PREFIX}/pixelpaladin-backend:${TAG}"
FRONTEND_IMAGE="${IMAGE_PREFIX}/pixelpaladin-frontend:${TAG}"

echo "==> Registry prefix : ${IMAGE_PREFIX}"
echo "==> Tag             : ${TAG}"
echo "==> Platforms       : ${PLATFORMS}"
echo "==> Backend image   : ${BACKEND_IMAGE}"
echo "==> Frontend image  : ${FRONTEND_IMAGE}"
echo

# Ensure a buildx builder that supports multi-platform exists.
if ! docker buildx inspect pixelpaladin-builder >/dev/null 2>&1; then
  echo "==> Creating buildx builder 'pixelpaladin-builder'"
  docker buildx create --name pixelpaladin-builder --use >/dev/null
else
  docker buildx use pixelpaladin-builder
fi

echo "==> Building & pushing backend"
docker buildx build \
  --platform "${PLATFORMS}" \
  --tag "${BACKEND_IMAGE}" \
  --push \
  ./backend

echo "==> Building & pushing frontend"
docker buildx build \
  --platform "${PLATFORMS}" \
  --tag "${FRONTEND_IMAGE}" \
  --push \
  ./frontend

echo
echo "Done. On the NAS, deploy with docker-compose.registry.yml and set:"
echo "  IMAGE_PREFIX=${IMAGE_PREFIX}"
echo "  IMAGE_TAG=${TAG}"
