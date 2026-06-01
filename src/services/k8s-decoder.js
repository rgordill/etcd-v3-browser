'use strict';

const protobuf = require('protobufjs');
const yaml = require('js-yaml');
const path = require('node:path');

const PROTO_DIR = path.join(__dirname, '..', 'protos');
const K8S_MAGIC = Buffer.from([0x6b, 0x38, 0x73, 0x00]);

const API_VERSION_MAP = {
  'v1':                                     { dir: 'core/v1' },
  'apps/v1':                                { dir: 'apps/v1' },
  'batch/v1':                               { dir: 'batch/v1' },
  'autoscaling/v1':                         { dir: 'autoscaling/v1' },
  'autoscaling/v2':                         { dir: 'autoscaling/v2' },
  'policy/v1':                              { dir: 'policy/v1' },
  'networking.k8s.io/v1':                   { dir: 'networking/v1' },
  'rbac.authorization.k8s.io/v1':           { dir: 'rbac/v1' },
  'storage.k8s.io/v1':                      { dir: 'storage/v1' },
  'coordination.k8s.io/v1':                 { dir: 'coordination/v1' },
  'certificates.k8s.io/v1':                 { dir: 'certificates/v1' },
  'events.k8s.io/v1':                       { dir: 'events/v1' },
  'discovery.k8s.io/v1':                    { dir: 'discovery/v1' },
  'admissionregistration.k8s.io/v1':        { dir: 'admissionregistration/v1' },
  'flowcontrol.apiserver.k8s.io/v1':        { dir: 'flowcontrol/v1' },
  'node.k8s.io/v1':                         { dir: 'node/v1' },
  'scheduling.k8s.io/v1':                   { dir: 'scheduling/v1' },
  'resource.k8s.io/v1':                     { dir: 'resource/v1' },
};

const rootCache = new Map();

function packageName(dir) {
  return `k8s.io.api.${dir.replace(/\//g, '.')}`;
}

function makeRoot() {
  const root = new protobuf.Root();
  root.resolvePath = (_origin, target) => {
    if (target.startsWith('google/')) return target;
    return path.join(PROTO_DIR, target);
  };
  return root;
}

async function loadRoot(dir) {
  if (rootCache.has(dir)) return rootCache.get(dir);

  const root = makeRoot();
  await root.load(`k8s.io/api/${dir}/generated.proto`, { keepCase: true });
  root.resolveAll();

  rootCache.set(dir, root);
  return root;
}

let unknownRoot = null;

async function getUnknownType() {
  if (unknownRoot) return unknownRoot;

  const root = makeRoot();
  await root.load('k8s.io/apimachinery/pkg/runtime/generated.proto', { keepCase: true });
  root.resolveAll();
  unknownRoot = root.lookupType('k8s.io.apimachinery.pkg.runtime.Unknown');
  return unknownRoot;
}

/**
 * Attempt to decode a k8s protobuf-encoded etcd value into a YAML string.
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

    const mapping = API_VERSION_MAP[apiVersion];
    if (!mapping) return null;

    const root = await loadRoot(mapping.dir);
    const typeName = `${packageName(mapping.dir)}.${kind}`;
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

module.exports = { decode, getUnknownType };
