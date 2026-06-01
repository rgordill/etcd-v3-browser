# License compliance (Apache-2.0)

This project is licensed under the [Apache License 2.0](../LICENSE). That license
allows combining the project’s own code with permissive third-party libraries and
with other Apache-2.0 works (including vendored Kubernetes and OpenShift `.proto`
files), provided attribution and license terms are preserved.

## Audit summary

Production dependencies were checked with `license-checker` (see commands below).
**No GPL, LGPL, or AGPL packages** appear in production trees.

| Area | Result |
|------|--------|
| Strong copyleft (GPL/LGPL/AGPL) | None found |
| Project license | Apache-2.0 (`LICENSE`, `NOTICE`) |
| Backend (`src/`) | MIT, ISC, BSD-3-Clause, Apache-2.0, Python-2.0 |
| Frontend (`src/frontend/`) | MIT, Apache-2.0, ISC, BSD, CC0-1.0, MPL-2.0 (one utility) |
| Vendored `.proto` files | Apache-2.0 (Kubernetes, OpenShift) |

## Apache-2.0 compatibility

These license families are **compatible** with distributing this project under
Apache-2.0:

- **MIT, ISC, BSD-2/3-Clause, 0BSD** — Permissive; retain copyright notices.
- **Apache-2.0** — Same license family (etcd3, gRPC, PatternFly).
- **CC0-1.0** — Public domain dedication.
- **Python-2.0** — PSF License (permissive); present only as a transitive
  metadata label on `argparse` in the backend tree.
- **MPL-2.0** — Weak (file-level) copyleft. This project uses `axe-core@4.x`
  only as a transitive dependency (accessibility tooling). MPL-2.0 does not
  “infect” the whole application when the MPL file is used unmodified from
  `node_modules`, which is the normal npm distribution model. No MPL source
  is merged into this repository’s source files.

**Not used:** GPL, LGPL, AGPL, SSPL, or proprietary SDKs.

## Vendored protobuf schemas

| Source | Path | License |
|--------|------|---------|
| [kubernetes/api](https://github.com/kubernetes/api) | `src/protos/k8s.io/api/` | Apache-2.0 |
| [kubernetes/apimachinery](https://github.com/kubernetes/apimachinery) | `src/protos/k8s.io/apimachinery/` | Apache-2.0 |
| [openshift/api](https://github.com/openshift/api) | `src/protos/openshift.io/api/` | Apache-2.0 |
| gogoproto stub (generated imports) | `src/protos/github.com/gogo/protobuf/gogoproto/` | BSD-3-Clause (typical gogo/protobuf) |

Download scripts: `hack/download-k8s-protos.sh`, `hack/download-openshift-protos.sh`.

## Reproduce the audit

```bash
# Backend production dependencies
cd src && npx license-checker --production --summary

# Frontend production dependencies
cd src/frontend && npx license-checker --production --summary

# Fail on disallowed licenses (adjust list as needed)
cd src/frontend && npx license-checker --production --onlyAllow \
  'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;CC0-1.0;Unlicense;0BSD;Python-2.0;BlueOak-1.0.0;MPL-2.0;(MIT OR CC0-1.0);(Apache-2.0 OR MPL-1.1);BSD;CC-BY-4.0'
```

The root package `etcd-v3-browser-frontend` is declared as `Apache-2.0` in
`src/frontend/package.json`; `license-checker` may still list it as `UNLICENSED`
if run before `npm install` refreshes metadata — the declared license is authoritative.

## Trademarks

Custom branding is used in the UI (not official etcd/CNCF artwork). See the
disclaimer in [README.md](../README.md).
