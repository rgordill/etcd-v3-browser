# etcd-v3-browser Helm chart

Deploys the etcd v3 Browser web application as a Kubernetes `Deployment` and
`Service`. The UI connects to etcd **from the browser session** via the backend
proxy; cluster networking must allow the pod to reach your etcd endpoints.

## Install

```bash
helm install my-browser ./chart/etcd-v3-browser \
  --set image.repository=your-registry/etcd-v3-browser \
  --set image.tag=1.0.0
```

## Common values

| Value | Default | Description |
|-------|---------|-------------|
| `replicaCount` | `1` | Number of replicas |
| `image.repository` | `localhost/etcd-v3-browser` | Container image |
| `image.tag` | `latest` | Image tag |
| `service.port` | `3001` | Service port |
| `etcd.hosts` | `""` | Optional `ETCD_HOSTS` pre-fill (empty = UI only) |
| `etcd.tls.enabled` | `false` | Mount client TLS secret for backend to etcd |
| `etcd.tls.secretName` | `""` | Secret with CA + client cert/key |
| `ingress.enabled` | `false` | Expose via Ingress |
| `ingress.className` | `openshift-default` | Ingress class (`nginx` on vanilla Kubernetes) |
| `ingress.annotations` | edge TLS + cert-manager | OpenShift edge termination via `route.openshift.io/termination` |
| `tmp.enabled` | `true` | Mount emptyDir at `/tmp` for snapshot uploads and Node.js temp files |
| `openshiftConsole.enabled` | `false` | Deploy ConsolePlugin and register with the OpenShift console |

## OpenShift (restricted-v2 SCC)

The chart is designed to run under the **restricted-v2** SCC with no
modifications:

- **No hardcoded UID/GID** — `runAsUser` and `fsGroup` are omitted so
  OpenShift assigns a random UID from the namespace's `MustRunAsRange`.
- **`readOnlyRootFilesystem: true`** — an emptyDir at `/tmp` provides
  writable storage for snapshot uploads and Node.js temp files.
- **All capabilities dropped**, `allowPrivilegeEscalation: false`,
  `seccompProfile: RuntimeDefault`.
- **`automountServiceAccountToken: false`** — the pod does not need the
  Kubernetes API.
- The container image uses `chmod g=u` so files are accessible by group 0,
  which OpenShift adds to the random UID.

```bash
helm upgrade my-browser ./chart/etcd-v3-browser \
  --set image.repository=your-registry/etcd-v3-browser \
  --set image.tag=1.0.0 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=etcd-browser.apps.ocp.sa-iberia.lab.eng.brq2.redhat.com \
  --set ingress.tls[0].hosts[0]=etcd-browser.apps.ocp.sa-iberia.lab.eng.brq2.redhat.com
```

Ingress uses `ingressClassName: openshift-default` with edge TLS termination
(`route.openshift.io/termination: edge`) and cert-manager (`lab-ca-issuer`).

### OpenShift console plugin

Enable the dynamic console plugin (adds a navigation entry under **Home** and
registers a `ConsolePlugin` with the cluster console operator):

```bash
helm upgrade my-browser ./chart/etcd-v3-browser \
  --set openshiftConsole.enabled=true
```

When enabled, the chart also:
- Creates a `ConsolePlugin` CR named `etcd-v3-browser`
- Adds an nginx HTTPS sidecar (port 9443) with an OpenShift serving certificate
- Runs a post-install Job to append the plugin to `consoles.operator.openshift.io/cluster`

The plugin name defaults to `etcd-v3-browser` and must match
`plugin-manifest.json`. The nginx sidecar serves plugin assets at `/` (mapping to
`/plugin` on the app) with `backendBasePath: /`; API calls are proxied via
`/api/proxy/plugin/etcd-v3-browser/backend`.

## Ingress (vanilla Kubernetes)

Override the ingress class and annotations for nginx or another controller:

```bash
helm upgrade my-browser ./chart/etcd-v3-browser \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set-json 'ingress.annotations={"cert-manager.io/cluster-issuer":"letsencrypt-prod","nginx.ingress.kubernetes.io/ssl-redirect":"true"}' \
  --set ingress.hosts[0].host=etcd-browser.example.com
```

## etcd mTLS

```bash
kubectl create secret generic etcd-client-tls \
  --from-file=ca.crt=./ca.crt \
  --from-file=tls.crt=./client.crt \
  --from-file=tls.key=./client.key

helm upgrade my-browser ./chart/etcd-v3-browser \
  --set etcd.hosts="https://etcd.example.svc:2379" \
  --set etcd.tls.enabled=true \
  --set etcd.tls.secretName=etcd-client-tls
```

## Probes

Liveness and readiness use `GET /readyz` on the HTTP port (no etcd check on probe;
etcd connectivity is validated per user session via `/api/connect`).

## Schema

`values.schema.json` is generated from `@schema` annotations in `values.yaml`:

```bash
helm-schema -n
```

## Uninstall

```bash
helm uninstall my-browser
```
