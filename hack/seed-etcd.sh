#!/bin/bash
set -euo pipefail

ETCD_ENDPOINT="${ETCD_ENDPOINT:-http://127.0.0.1:2379}"
CONTAINER_NAME="${ETCD_CONTAINER_NAME:-test-etcd}"
ETCD_IMAGE="${ETCD_IMAGE:-quay.io/coreos/etcd:v3.5.21}"

if command -v podman &> /dev/null; then
    RUNTIME="podman"
elif command -v docker &> /dev/null; then
    RUNTIME="docker"
else
    echo "Error: podman or docker required"
    exit 1
fi

start_etcd() {
    if ${RUNTIME} ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "etcd container '${CONTAINER_NAME}' is already running."
        return
    fi

    ${RUNTIME} rm -f "${CONTAINER_NAME}" 2>/dev/null || true

    echo "Starting etcd container '${CONTAINER_NAME}'..."
    ${RUNTIME} run -d \
        --name "${CONTAINER_NAME}" \
        -p 2379:2379 \
        "${ETCD_IMAGE}" \
        /usr/local/bin/etcd \
        --advertise-client-urls http://0.0.0.0:2379 \
        --listen-client-urls http://0.0.0.0:2379

    sleep 2
    echo "etcd is running at ${ETCD_ENDPOINT}"
}

seed_data() {
    echo "Seeding test data..."

    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /app/config/database '{"host":"postgres.local","port":5432,"name":"myapp","pool_size":10}'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /app/config/cache '{"host":"redis.local","port":6379,"ttl":3600}'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /app/config/logging '{"level":"info","format":"json"}'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /app/version '2.1.0'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /app/feature-flags/dark-mode 'true'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /app/feature-flags/beta-api 'false'

    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /services/api-gateway/endpoint 'https://api.example.com'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /services/api-gateway/replicas '3'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /services/auth/endpoint 'https://auth.example.com'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /services/auth/jwt-secret 'change-me-in-production'

    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /cluster/nodes/node-1 '{"ip":"10.0.1.10","role":"leader","status":"healthy"}'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /cluster/nodes/node-2 '{"ip":"10.0.1.11","role":"follower","status":"healthy"}'
    ${RUNTIME} exec "${CONTAINER_NAME}" etcdctl put /cluster/nodes/node-3 '{"ip":"10.0.1.12","role":"follower","status":"healthy"}'

    echo "Seeded $(${RUNTIME} exec "${CONTAINER_NAME}" etcdctl get --prefix / --keys-only | grep -c .) keys."
}

stop_etcd() {
    echo "Stopping etcd container '${CONTAINER_NAME}'..."
    ${RUNTIME} stop "${CONTAINER_NAME}" 2>/dev/null || true
    ${RUNTIME} rm "${CONTAINER_NAME}" 2>/dev/null || true
    echo "Done."
}

case "${1:-start}" in
    start)
        start_etcd
        seed_data
        ;;
    stop)
        stop_etcd
        ;;
    seed)
        seed_data
        ;;
    *)
        echo "Usage: $0 {start|stop|seed}"
        echo ""
        echo "  start  Start a local etcd container and seed test data (default)"
        echo "  stop   Stop and remove the local etcd container"
        echo "  seed   Seed test data into an already-running etcd"
        exit 1
        ;;
esac
