#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC_DIR="${PROJECT_ROOT}/src"

export ETCD_HOSTS="${ETCD_HOSTS:-http://127.0.0.1:2379}"
export PORT="${PORT:-3001}"

echo "Installing backend dependencies..."
cd "${SRC_DIR}"
npm install

echo "Building frontend..."
cd "${SRC_DIR}/frontend"
npm install
npm run build

echo "Starting etcd-v3-browser server..."
echo "  ETCD_HOSTS=${ETCD_HOSTS}"
echo "  PORT=${PORT}"
echo "  Open http://localhost:${PORT} in your browser"
echo ""

cd "${SRC_DIR}"
exec node server.js
