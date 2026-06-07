# Architecture

## System Overview

The etcd v3 Browser is a full-stack web application composed of:

```text
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           React 19 + PatternFly 6 SPA                 │  │
│  │  - Connection form (protocol, host, port, TLS)        │  │
│  │  - Tree view (lazy-loaded key hierarchy)              │  │
│  │  - Value panel (JSON / YAML / Raw / Hex / K8s)        │  │
│  │  - Theme switcher (light / dark / system)             │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTP (fetch)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Node.js Express Server                      │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Static     │  │ /api/*      │  │ /readyz             │  │
│  │ (SPA)      │  │ REST routes │  │ Health probe        │  │
│  └────────────┘  └──────┬──────┘  └─────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │              etcd Client Pool (LRU)                   │   │
│  │  - Keyed by endpoint URL                             │   │
│  │  - TTL-based eviction (10 min idle)                  │   │
│  │  - Max 20 concurrent clients                         │   │
│  │  - TLS/mTLS support (server-side and per-request)    │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │              Value Decoder Pipeline                    │   │
│  │  - Text vs Binary detection                          │   │
│  │  - Kubernetes protobuf decoding (k8s\x00 envelope)   │   │
│  │  - OpenShift protobuf decoding                       │   │
│  │  - YAML/JSON serialization                           │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ gRPC (etcd3 client)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      etcd v3 Cluster                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │ Member  │  │ Member  │  │ Member  │                    │
│  └─────────┘  └─────────┘  └─────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React SPA)

| Component | File | Responsibility |
|-----------|------|----------------|
| `App` | `App.tsx` | Main layout, connection form, tree, value panel |
| `SyntaxCodeBlock` | `SyntaxCodeBlock.tsx` | Prism highlighting + collapsible tree |
| `CollapsibleStructure` | `CollapsibleStructure.tsx` | Expandable JSON/YAML tree viewer |
| `CopyButton` | `CopyButton.tsx` | Clipboard copy utility |
| `PemFileField` | `PemFileField.tsx` | Drag-and-drop PEM file upload |
| `useTheme` | `useTheme.ts` | Light/dark/system theme management |
| `value-format` | `value-format.ts` | JSON detection and YAML conversion |
| `structure-parse` | `structure-parse.ts` | Parse structure for tree rendering |

### Backend (Express)

| Module | File | Responsibility |
|--------|------|----------------|
| Server | `server.js` | Express setup, middleware, SPA fallback |
| Config | `config.js` | Environment-based configuration |
| API Routes | `routes/api.js` | REST handlers, tree building |
| Middleware | `middleware/require-endpoint.js` | Endpoint validation |
| Client Pool | `services/etcd-client.js` | LRU etcd3 connections, TLS |
| Value Decoder | `services/value-decoder.js` | Binary detection, encoding |
| K8s Decoder | `services/k8s-decoder.js` | Kubernetes protobuf schemas |
| OpenShift Decoder | `services/openshift-decoder.js` | OpenShift protobuf schemas |

### Protobuf Decoding Flow

```text
etcd binary value
       │
       ▼
┌──────────────────┐
│ Check k8s\x00    │──── No ──→ Return as base64
│ magic prefix     │
└────────┬─────────┘
         │ Yes
         ▼
┌──────────────────┐
│ Decode           │
│ runtime.Unknown  │
│ envelope         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Extract          │
│ TypeMeta from    │
│ raw bytes        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌─────────────────────┐
│ Load .proto      │────→│ protobufjs decode    │
│ for API group    │     │ to JSON + YAML       │
└──────────────────┘     └─────────────────────┘
```

## Deployment Topology

### Container (Standalone)

```text
┌────────────────────────────┐
│  Container (UBI 9 Minimal) │
│  ┌──────────────────────┐  │
│  │   Node.js 20         │  │
│  │   ┌──────────────┐   │  │
│  │   │ Express:3001 │   │  │
│  │   │ + SPA + API  │   │  │
│  │   └──────────────┘   │  │
│  └──────────────────────┘  │
│  Port: 3001                │
│  User: 1001 (non-root)    │
│  Health: /readyz           │
└────────────────────────────┘
```

### Kubernetes (Helm)

```text
┌─────────────────────────────────────────┐
│  Namespace                               │
│  ┌──────────┐  ┌──────────┐            │
│  │ Service  │──│ Pod      │            │
│  │ :80      │  │ :3001    │            │
│  └─────┬────┘  └──────────┘            │
│        │                                 │
│  ┌─────▼─────────────────┐             │
│  │ Ingress               │             │
│  │ (optional TLS)        │             │
│  └───────────────────────┘             │
│                                         │
│  ┌────────────────────────┐            │
│  │ Secret (optional)      │            │
│  │ etcd TLS certs mounted │            │
│  └────────────────────────┘            │
└─────────────────────────────────────────┘
```

## Data Flow

1. **User** enters endpoint in the UI and clicks Connect
2. **Frontend** sends `GET /api/connect?endpoint=...` to the server
3. **Server** creates or retrieves an `Etcd3` client from the LRU pool
4. **etcd3 library** connects via gRPC to the etcd cluster
5. **Server** returns version and db size to the frontend
6. **User** navigates the key tree; each expansion calls `GET /api/keys`
7. **User** clicks a leaf key; frontend calls `GET /api/key`
8. **Server** retrieves the raw value buffer from etcd
9. **Value decoder** determines text vs binary, attempts K8s/OpenShift decode
10. **Frontend** renders tabs based on encoding and decoded content

## Security Considerations

- No built-in authentication; relies on network-level access control
- TLS credentials stored server-side only (never sent to browser)
- Per-request TLS from UI PEM uploads is held in memory (not persisted)
- Container runs as non-root UID 1001
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is set in the container for lab convenience;
  override to `1` for production with proper CA trust
