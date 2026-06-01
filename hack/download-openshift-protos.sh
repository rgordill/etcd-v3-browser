#!/usr/bin/env bash
#
# Downloads OpenShift API .proto schema files for decoding openshift.io etcd values.
# Requires hack/download-k8s-protos.sh first (OpenShift protos import k8s.io schemas).
# See README.md and docs/DEVELOPMENT.md. Schemas are Apache-2.0 (openshift/api).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROTO_DIR="${SCRIPT_DIR}/../src/protos"
OCP_RELEASE="${1:-master}"

echo "Downloading OpenShift proto files (release: ${OCP_RELEASE})…"

BASE="https://raw.githubusercontent.com/openshift/api/${OCP_RELEASE}"

download() {
  local url="$1" dest="${PROTO_DIR}/openshift.io/api/$2"
  mkdir -p "$(dirname "$dest")"
  echo "  openshift.io/api/${2}"
  curl --fail -sS "$url" -o "$dest"
}

API_GROUPS=(
  apps/v1
  authorization/v1
  build/v1
  cloudnetwork/v1
  image/v1
  network/v1
  networkoperator/v1
  oauth/v1
  project/v1
  quota/v1
  route/v1
  samples/v1
  security/v1
  template/v1
  user/v1
)

for group in "${API_GROUPS[@]}"; do
  download "${BASE}/${group}/generated.proto" "${group}/generated.proto"
done

echo ""
echo "Done — OpenShift proto files saved to ${PROTO_DIR}/openshift.io/api/"
echo "API groups: ${#API_GROUPS[@]}"
