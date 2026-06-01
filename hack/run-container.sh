#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_NAME="${IMAGE_NAME:-localhost/etcd-v3-browser}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CONTAINER_NAME="${CONTAINER_NAME:-etcd-v3-browser}"
ETCD_HOSTS="${ETCD_HOSTS:-http://127.0.0.1:2379}"
PORT="${PORT:-3001}"

if command -v podman &> /dev/null; then
    BUILDER="podman"
elif command -v docker &> /dev/null; then
    BUILDER="docker"
else
    echo "Error: podman or docker required"
    exit 1
fi

echo "Building container image ${IMAGE_NAME}:${IMAGE_TAG}..."
${BUILDER} build \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    -f "${PROJECT_ROOT}/container/Containerfile" \
    "${PROJECT_ROOT}"

${BUILDER} rm -f "${CONTAINER_NAME}" 2>/dev/null || true

echo "Starting container ${CONTAINER_NAME}..."
${BUILDER} run -d \
    --name "${CONTAINER_NAME}" \
    --network host \
    -e "ETCD_HOSTS=${ETCD_HOSTS}" \
    -e "PORT=${PORT}" \
    "${IMAGE_NAME}:${IMAGE_TAG}"

echo ""
echo "Container '${CONTAINER_NAME}' started."
echo "  ETCD_HOSTS=${ETCD_HOSTS}"
echo "  Open http://localhost:${PORT} in your browser"
echo ""
echo "Useful commands:"
echo "  ${BUILDER} logs -f ${CONTAINER_NAME}"
echo "  ${BUILDER} stop ${CONTAINER_NAME}"
echo "  ${BUILDER} rm ${CONTAINER_NAME}"
