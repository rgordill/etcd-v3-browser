'use strict';

const k8sDecoder = require('./k8s-decoder');
const openshiftDecoder = require('./openshift-decoder');

function isBinary(buf) {
  for (const b of buf) {
    if (b === 0) return true;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) return true;
  }
  return false;
}

/**
 * Encode a raw etcd buffer into a JSON-safe response payload.
 *
 * Text values are returned as UTF-8 strings.
 * Binary values are returned as base64 with optional Kubernetes/OpenShift protobuf decoding.
 */
async function encodeValue(key, buf) {
  if (buf === null) {
    return { key, value: null, encoding: 'text', size: 0 };
  }

  const binary = isBinary(buf);
  const result = {
    key,
    value: binary ? buf.toString('base64') : buf.toString('utf-8'),
    encoding: binary ? 'binary' : 'text',
    size: buf.length,
  };

  if (binary) {
    const decoded = (await k8sDecoder.decode(buf)) || (await openshiftDecoder.decode(buf));
    if (decoded) {
      result.k8sResource = {
        apiVersion: decoded.apiVersion,
        kind: decoded.kind,
        yaml: decoded.yaml,
        json: JSON.stringify(decoded.json, null, 2),
      };
    }
  }

  return result;
}

module.exports = { encodeValue, isBinary };
