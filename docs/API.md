# API Reference

## Overview

The etcd v3 Browser exposes a REST API that proxies requests to etcd clusters. All
endpoints (except `/api/config` and `/readyz`) require an `endpoint` query parameter
specifying the target etcd cluster URL.

## Authentication

The API does not implement its own authentication. Access control should be handled
at the network level (firewall, ingress auth, service mesh) or via etcd TLS client
certificates configured server-side.

## Endpoints

### GET /api/config

Returns the server's default configuration.

**Response:**

```json
{
  "defaultEndpoint": "https://etcd.example.com:2379"
}
```

The `defaultEndpoint` value comes from the `ETCD_HOSTS` environment variable and may
be empty if not configured.

---

### GET|POST /api/connect

Test connectivity to an etcd endpoint and retrieve cluster metadata.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `endpoint` | Yes | URL-encoded etcd endpoint (e.g. `http://host:2379`) |

**POST Body (optional):**

```json
{
  "tls": {
    "skipTlsVerify": true,
    "serverCa": "-----BEGIN CERTIFICATE-----...",
    "clientAuth": true,
    "clientCert": "-----BEGIN CERTIFICATE-----...",
    "clientKey": "-----BEGIN PRIVATE KEY-----..."
  }
}
```

**Success Response (200):**

```json
{
  "connected": true,
  "endpoint": "http://host:2379",
  "version": "3.5.21",
  "dbSize": "12345678"
}
```

**Error Response (502):**

```json
{
  "connected": false,
  "endpoint": "http://host:2379",
  "error": "Connection refused"
}
```

---

### GET /api/keys

List keys under a prefix, returning one tree level of directories and leaves.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `endpoint` | Yes | etcd endpoint URL |
| `prefix` | No | Key prefix to list under (default: empty = root) |

**Response (200):**

```json
[
  { "key": "/registry/pods/", "name": "pods", "isLeaf": false },
  { "key": "/registry/configmap1", "name": "configmap1", "isLeaf": true }
]
```

Directories (non-leaf entries) are sorted before leaves. Within each group, items are
sorted alphabetically by name.

---

### GET /api/key

Retrieve the value of a single key.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `endpoint` | Yes | etcd endpoint URL |
| `key` | Yes | Full key path |

**Response (200):**

```json
{
  "key": "/registry/pods/default/my-pod",
  "value": "...",
  "encoding": "text",
  "size": 1234,
  "k8sResource": {
    "apiVersion": "v1",
    "kind": "Pod",
    "yaml": "apiVersion: v1\nkind: Pod\n...",
    "json": "{ ... }"
  }
}
```

- `encoding`: `"text"` for UTF-8 strings, `"binary"` for base64-encoded binary data
- `k8sResource`: Present only when binary data is successfully decoded as a Kubernetes
  or OpenShift protobuf resource

---

### PUT /api/key

Write a value to a key.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `endpoint` | Yes | etcd endpoint URL |

**Request Body:**

```json
{
  "key": "/my/key",
  "value": "my value"
}
```

**Response (200):**

```json
{ "success": true }
```

---

### DELETE /api/key

Delete a key.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `endpoint` | Yes | etcd endpoint URL |
| `key` | Yes | Full key path to delete |

**Response (200):**

```json
{ "success": true }
```

---

### GET /readyz

Health/readiness probe.

**Response (200):**

```json
{ "status": "ok" }
```

## Error Responses

All endpoints return errors in a consistent format:

```json
{ "error": "description of what went wrong" }
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| 400 | Missing required parameter (`endpoint`, `key`) |
| 500 | Internal server error (etcd communication failure) |
| 502 | Bad gateway (etcd endpoint unreachable) |
