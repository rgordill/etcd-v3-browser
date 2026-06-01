# Quick start

Get **etcd v3 Browser** running in a few minutes and browse your first keys.
For architecture, API details, and deployment options, see the [main README](../README.md).

> **Disclaimer:** This project is not official or affiliated with etcd, CNCF, Kubernetes,
> or OpenShift.

## What you will do

1. Start the web application (locally or in a container).
2. Open the UI and **connect** to your etcd server.
3. **Browse** the key tree and inspect a value.

## Prerequisites

- **Node.js 20+** and npm (for local run), *or* Podman/Docker (for container run).
- Network access from the browser host to your etcd endpoint (for example port `2379`).
- For **TLS / mTLS**, certificate files on the server (see [TLS](#optional-tls) below).

You do not need to install etcd on the same machine unless you want the optional
[local test cluster](#optional-try-with-a-local-test-etcd).

## Step 1 — Start the application

### Option A: Run locally (recommended for first try)

From the repository root:

```bash
./hack/run-local.sh
```

This installs dependencies, builds the frontend, and starts the server on port **3001**
(default). To pre-fill the connection form:

```bash
ETCD_HOSTS=http://127.0.0.1:2379 ./hack/run-local.sh
```

### Option B: Run in a container

```bash
ETCD_HOSTS=http://127.0.0.1:2379 ./hack/run-container.sh
```

Then open the URL printed in the script output (default http://localhost:3001).

### First-time clone (container image builds only)

If you build the container image yourself and need Kubernetes/OpenShift protobuf
decoding in the image, download schemas once before building:

```bash
./hack/download-k8s-protos.sh
./hack/download-openshift-protos.sh
```

Local `./hack/run-local.sh` uses the same schemas under `src/protos/` when present.

## Step 2 — Connect to etcd

Open **http://localhost:3001** in your browser.

1. Choose **http://** or **https://** from the protocol dropdown.
2. Enter the etcd **host** (IP or DNS name).
3. Enter the **port** (usually `2379`).
4. Click **Connect**.

![Connect to an etcd endpoint](images/etcd-connect.png)

If the connection succeeds, the masthead shows a green badge with your endpoint and
the etcd version. If it fails, check the error message, firewall rules, TLS settings,
and that etcd is listening on the address you entered.

**Tips**

- Recent endpoints are remembered in the browser for the next session.
- The server can pre-fill the form when started with `ETCD_HOSTS` (optional).
- Use the **settings** (gear) menu in the masthead to switch **light**, **dark**, or
  **system** theme.

## Step 3 — Browse keys and values

After connecting, the **Key Browser** panel lists top-level prefixes. Click a folder
to expand it (or click the folder name to toggle expand/collapse). Use the search box
to filter keys, or the refresh button to reload the tree.

Select a **key** (leaf node) to load its value in the right-hand **Value** panel.

![Browse etcd keys and inspect values](../images/etcd-browse.png)

### Reading values

| Value type | What you see |
|------------|----------------|
| **Plain text** | Raw text, or **YAML** / **JSON** / **Raw** tabs if the text is valid JSON |
| **Binary** | **Hex dump** and **Base64** tabs |
| **Kubernetes / OpenShift** (protobuf) | **YAML** and **JSON** tabs with decoded resources when schemas are available |

Clusters that store API objects under `kubernetes.io` or `openshift.io` often show
decoded YAML for binary etcd values.

### Disconnect

Click the **×** next to the connection badge in the masthead to return to the
connect screen.

## Optional: try with a local test etcd

If you do not have a cluster handy, start a sample etcd and seed demo keys:

```bash
./hack/seed-etcd.sh start
ETCD_HOSTS=http://127.0.0.1:2379 ./hack/run-local.sh
```

Connect to `http://127.0.0.1:2379` in the UI. Sample keys appear under `/app/`,
`/services/`, and `/cluster/`.

Stop when finished:

```bash
./hack/seed-etcd.sh stop
```

## Optional: TLS

When etcd requires TLS or mTLS, set these environment variables **before** starting
the server (paths must be readable inside the container if you use Podman/Docker):

| Variable | Description |
|----------|-------------|
| `ETCD_CA_CERT` | CA certificate file |
| `ETCD_CLIENT_CERT` | Client certificate (mTLS) |
| `ETCD_CLIENT_KEY` | Client private key (mTLS) |

In Kubernetes, mount certificates via the Helm chart — see
[chart/etcd-v3-browser/README.md](../chart/etcd-v3-browser/README.md).

## Verify the server is up

```bash
curl -s http://localhost:3001/readyz
# {"status":"ok"}
```

## Next steps

- [README](../README.md) — full feature list, API reference, Helm, container build
- [DEVELOPMENT.md](DEVELOPMENT.md) — hacking on the codebase
- [LICENSE-COMPLIANCE.md](LICENSE-COMPLIANCE.md) — dependency licenses

## Troubleshooting

| Problem | Things to check |
|---------|------------------|
| Connection fails | Correct host/port; `https` vs `http`; TLS env vars; etcd health |
| Empty tree | Connected endpoint is correct; cluster may have no keys at root |
| Binary value not decoded as YAML | Proto schemas missing — run download scripts and rebuild |
| Page does not load | Server running on `PORT` (default 3001); firewall |
