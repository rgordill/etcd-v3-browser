#!/usr/bin/env bash
#
# Downloads Kubernetes .proto schema files needed to decode etcd protobuf values.
# Re-run when targeting a different Kubernetes release or after clone.
# See README.md and docs/DEVELOPMENT.md. Schemas are Apache-2.0 (kubernetes/api).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROTO_DIR="${SCRIPT_DIR}/../src/protos"
K8S_RELEASE="${1:-master}"

echo "Downloading Kubernetes proto files (release: ${K8S_RELEASE})…"

BASE="https://raw.githubusercontent.com/kubernetes"
API_BASE="${BASE}/api/${K8S_RELEASE}"
MACHINERY_BASE="${BASE}/apimachinery/${K8S_RELEASE}"

download() {
  local url="$1" dest="${PROTO_DIR}/$2"
  mkdir -p "$(dirname "$dest")"
  echo "  ${2}"
  curl --fail -sS "$url" -o "$dest"
}

# --- apimachinery foundations ---
download "${MACHINERY_BASE}/pkg/api/resource/generated.proto" \
  "k8s.io/apimachinery/pkg/api/resource/generated.proto"
download "${MACHINERY_BASE}/pkg/apis/meta/v1/generated.proto" \
  "k8s.io/apimachinery/pkg/apis/meta/v1/generated.proto"
download "${MACHINERY_BASE}/pkg/runtime/generated.proto" \
  "k8s.io/apimachinery/pkg/runtime/generated.proto"
download "${MACHINERY_BASE}/pkg/runtime/schema/generated.proto" \
  "k8s.io/apimachinery/pkg/runtime/schema/generated.proto"
download "${MACHINERY_BASE}/pkg/util/intstr/generated.proto" \
  "k8s.io/apimachinery/pkg/util/intstr/generated.proto"

# --- common API groups ---
API_GROUPS=(
  core/v1
  apps/v1
  batch/v1
  autoscaling/v1
  autoscaling/v2
  policy/v1
  networking/v1
  rbac/v1
  storage/v1
  coordination/v1
  certificates/v1
  events/v1
  discovery/v1
  admissionregistration/v1
  flowcontrol/v1
  node/v1
  scheduling/v1
  resource/v1
)

for group in "${API_GROUPS[@]}"; do
  download "${API_BASE}/${group}/generated.proto" \
    "k8s.io/api/${group}/generated.proto"
done

# --- gogoproto stub (required by k8s proto imports) ---
GOGO_DIR="${PROTO_DIR}/github.com/gogo/protobuf/gogoproto"
mkdir -p "$GOGO_DIR"
cat > "${GOGO_DIR}/gogo.proto" << 'PROTO'
syntax = "proto2";
package gogoproto;
import "google/protobuf/descriptor.proto";
option go_package = "github.com/gogo/protobuf/gogoproto";
extend google.protobuf.EnumOptions          { optional bool goproto_enum_prefix = 62001; optional bool enum_stringer = 62021; }
extend google.protobuf.EnumValueOptions     { optional string enumvalue_customname = 66001; }
extend google.protobuf.FileOptions          { optional bool goproto_getters_all = 63001; optional bool marshaler_all = 63017; optional bool unmarshaler_all = 63019; optional bool sizer_all = 63020; optional bool goproto_enum_prefix_all = 63002; optional bool goproto_stringer_all = 63003; optional bool stringer_all = 63004; optional bool gostring_all = 63006; optional bool equal_all = 63013; optional bool verbose_equal_all = 63014; optional bool goproto_unrecognized_all = 63026; optional bool goproto_unkeyed_all = 63034; optional bool goproto_sizecache_all = 63035; }
extend google.protobuf.MessageOptions       { optional bool goproto_stringer = 64003; optional bool verbose_equal = 64004; optional bool stringer = 64005; optional bool gostring = 64006; optional bool equal = 64013; optional bool marshaler = 64017; optional bool unmarshaler = 64019; optional bool sizer = 64020; optional bool goproto_unrecognized = 64026; optional bool goproto_unkeyed = 64034; optional bool goproto_sizecache = 64035; }
extend google.protobuf.FieldOptions         { optional bool nullable = 65001; optional bool embed = 65002; optional string customtype = 65003; optional string casttype = 65007; optional string castkey = 65008; optional string castvalue = 65009; optional string customname = 65004; optional bool stdtime = 65010; optional bool stdduration = 65011; }
PROTO

echo ""
echo "Done — proto files saved to ${PROTO_DIR}/"
echo "API groups: ${#API_GROUPS[@]}"
