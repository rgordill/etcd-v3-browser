'use strict';

const fs = require('node:fs');
const path = require('node:path');
const protobuf = require('protobufjs');
const yaml = require('js-yaml');
const { getUnknownType } = require('./k8s-decoder');

const PROTO_DIR = path.join(__dirname, '..', 'protos');
const K8S_MAGIC = Buffer.from([0x6b, 0x38, 0x73, 0x00]);
const OCP_API_PREFIX = 'openshift.io/api/';

const rootCache = new Map();

function packageName(group, version) {
  return `github.com.openshift.api.${group}.${version}`;
}

function makeRoot() {
  const root = new protobuf.Root();
  root.resolvePath = (_origin, target) => {
    if (target.startsWith('google/')) return target;
    if (target.startsWith('k8s.io/')) return path.join(PROTO_DIR, target);
    if (target.startsWith('github.com/openshift/api/')) {
      const rel = target.replace('github.com/openshift/api/', '');
      return path.join(PROTO_DIR, OCP_API_PREFIX, rel);
    }
    if (target.startsWith('openshift.io/api/')) {
      return path.join(PROTO_DIR, target);
    }
    return path.join(PROTO_DIR, target);
  };
  return root;
}

function protoPathForDir(dir) {
  return path.join(PROTO_DIR, OCP_API_PREFIX, dir, 'generated.proto');
}

function parseApiVersion(apiVersion) {
  const slash = apiVersion.indexOf('/');
  if (slash < 0) return null;

  const groupVersion = apiVersion.slice(0, slash);
  const version = apiVersion.slice(slash + 1);
  if (!groupVersion.endsWith('.openshift.io') || !version) return null;

  const group = groupVersion.slice(0, -'.openshift.io'.length);
  if (!group) return null;

  return { group, version, dir: `${group}/${version}` };
}

async function loadRoot(dir) {
  if (rootCache.has(dir)) return rootCache.get(dir);

  const protoFile = protoPathForDir(dir);
  if (!fs.existsSync(protoFile)) return null;

  const root = makeRoot();
  await root.load(`openshift.io/api/${dir}/generated.proto`, { keepCase: true });
  root.resolveAll();

  rootCache.set(dir, root);
  return root;
}

/**
 * Decode an OpenShift protobuf-encoded etcd value (same k8s envelope as Kubernetes).
 * Returns { apiVersion, kind, yaml, json } or null if not decodable.
 */
async function decode(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  if (!buf.slice(0, 4).equals(K8S_MAGIC)) return null;

  try {
    const UnknownType = await getUnknownType();
    const envelope = UnknownType.decode(buf.slice(4));
    const envelopeObj = UnknownType.toObject(envelope, { bytes: Buffer });

    const apiVersion = envelopeObj.typeMeta?.apiVersion || '';
    const kind = envelopeObj.typeMeta?.kind || '';
    const rawBytes = envelopeObj.raw;

    if (!apiVersion || !kind || !rawBytes || rawBytes.length === 0) return null;

    const parsed = parseApiVersion(apiVersion);
    if (!parsed) return null;

    const root = await loadRoot(parsed.dir);
    if (!root) return null;

    const typeName = `${packageName(parsed.group, parsed.version)}.${kind}`;
    const MessageType = root.lookupType(typeName);
    const resource = MessageType.decode(rawBytes);

    const obj = MessageType.toObject(resource, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: false,
    });

    const ordered = { apiVersion, kind, ...obj };
    return {
      apiVersion,
      kind,
      yaml: yaml.dump(ordered, { lineWidth: -1, noRefs: true, sortKeys: false }),
      json: ordered,
    };
  } catch {
    return null;
  }
}

module.exports = { decode };
