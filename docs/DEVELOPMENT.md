# Development guide

## Prerequisites

- Node.js 20+
- npm
- Podman or Docker (optional, for container workflow)
- curl (proto download scripts)

## First-time setup

```bash
./hack/download-k8s-protos.sh
./hack/download-openshift-protos.sh

cd src && npm install
cd frontend && npm install
```

## Run backend only

```bash
cd src
export ETCD_HOSTS=http://127.0.0.1:2379   # optional default in UI
node server.js
```

Serve a built frontend from `src/frontend/build` or run the dev server separately.

## Run frontend dev server

```bash
cd src/frontend
npm start
```

Create `src/frontend/.env` if you need a proxy to the API:

```env
REACT_APP_API_URL=http://localhost:3001
```

## Production build

```bash
cd src/frontend && npm run build
cd .. && node server.js
```

Or use `./hack/run-local.sh` for install + build + start.

## Adding Kubernetes API groups

1. Add the group to `API_GROUPS` in `hack/download-k8s-protos.sh`.
2. Add `apiVersion` → directory mapping in `src/services/k8s-decoder.js` if not
   covered by the existing map.
3. Re-run the download script and rebuild the container.

## Adding OpenShift API groups

1. Confirm `generated.proto` exists under
   [openshift/api](https://github.com/openshift/api) for `group/version`.
2. Add the group to `API_GROUPS` in `hack/download-openshift-protos.sh`.
3. Re-run the script. Decoding uses `*.openshift.io/v1` apiVersions dynamically.

## Code layout

| Module | Responsibility |
|--------|----------------|
| `services/etcd-client.js` | `Etcd3` instances, TLS credentials, LRU cache |
| `services/value-decoder.js` | Binary detection, base64, invoke decoders |
| `services/k8s-decoder.js` | Kubernetes `runtime.Unknown` + typed decode |
| `services/openshift-decoder.js` | OpenShift API groups (same envelope) |
| `routes/api.js` | HTTP handlers, tree building |
| `frontend/src/App.tsx` | Connection UI, tree, value tabs |
| `frontend/src/index.css` | Viewport layout and panel scrolling |

## Security notes

- The browser backend holds etcd credentials from the server environment only
  (TLS files). User-selected endpoints use the same server-side TLS config.
- Do not expose this service untrusted on a network without authentication;
  it can read and write etcd keys allowed by the configured client certificate.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` in the container image relaxes TLS verification
  for lab use; tighten for production.

## Screenshots for README / quickstart

Example images live under `images/`:

- `etcd-connect.png` — connection form
- `etcd-browse.png` — key tree and value panel

Referenced from [README.md](../README.md) and [quickstart.md](quickstart.md).

## License check before release

```bash
cd src && npx license-checker --production --summary
cd src/frontend && npx license-checker --production --summary
```

See [LICENSE-COMPLIANCE.md](LICENSE-COMPLIANCE.md).
