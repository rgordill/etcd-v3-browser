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
| `etcd.tls.enabled` | `false` | Mount client TLS secret for backend → etcd |
| `etcd.tls.secretName` | `""` | Secret with CA + client cert/key |
| `ingress.enabled` | `false` | Expose via Ingress |

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

## Ingress

```bash
helm upgrade my-browser ./chart/etcd-v3-browser \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=etcd-browser.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

## Probes

Liveness and readiness use `GET /readyz` on the HTTP port (no etcd check on probe;
etcd connectivity is validated per user session via `/api/connect`).

## Uninstall

```bash
helm uninstall my-browser
```
