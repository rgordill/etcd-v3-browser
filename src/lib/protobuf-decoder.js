/**
 * Generic protobuf wire-format decoder with Kubernetes-specific awareness.
 *
 * Kubernetes stores resources in etcd as:
 *   magic "k8s\x00" + protobuf(runtime.Unknown)
 *
 * runtime.Unknown layout:
 *   field 1 = TypeMeta  { field 1 = apiVersion, field 2 = kind }
 *   field 2 = raw bytes (the actual resource, also protobuf-encoded)
 *   field 3 = contentEncoding
 *   field 4 = contentType
 */

'use strict';

const K8S_MAGIC = Buffer.from([0x6b, 0x38, 0x73, 0x00]); // "k8s\x00"

function readVarint(buf, pos) {
  let value = 0;
  let shift = 0;
  while (pos < buf.length) {
    const byte = buf[pos++];
    value += (byte & 0x7f) * (2 ** shift);
    if ((byte & 0x80) === 0) return { value, pos };
    shift += 7;
    if (shift > 63) return null;
  }
  return null;
}

function isReadableString(buf) {
  if (buf.length === 0) return true;
  const str = buf.toString('utf-8');
  if (str.includes('\ufffd')) return false;
  let printable = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0x20 && code <= 0x7e) || code === 0x0a || code === 0x0d || code === 0x09) {
      printable++;
    } else if (code >= 0x80 && code !== 0xfffd) {
      printable++;
    }
  }
  return printable / str.length > 0.8;
}

/**
 * Try to decode a buffer as a protobuf message.
 * Returns an object with field numbers as keys, or null on failure.
 */
function tryDecodeFields(buf, start, end, depth) {
  if (depth > 10 || end - start === 0) return null;
  if (end - start > 10 * 1024 * 1024) return null;

  const fields = {};
  let pos = start;

  try {
    while (pos < end) {
      const keyRes = readVarint(buf, pos);
      if (!keyRes) return null;
      pos = keyRes.pos;

      const fieldNum = Math.floor(keyRes.value / 8);
      const wireType = keyRes.value % 8;

      if (fieldNum < 1 || fieldNum > 536870911) return null;

      let fieldValue;

      switch (wireType) {
        case 0: {
          const vr = readVarint(buf, pos);
          if (!vr) return null;
          pos = vr.pos;
          fieldValue = vr.value;
          break;
        }
        case 1: {
          if (pos + 8 > end) return null;
          const lo = buf.readUInt32LE(pos);
          const hi = buf.readUInt32LE(pos + 4);
          fieldValue = hi === 0 ? lo : lo + hi * 0x100000000;
          pos += 8;
          break;
        }
        case 2: {
          const lenRes = readVarint(buf, pos);
          if (!lenRes) return null;
          pos = lenRes.pos;
          const dataLen = lenRes.value;
          if (pos + dataLen > end) return null;

          const data = buf.slice(pos, pos + dataLen);
          pos += dataLen;

          if (dataLen === 0) {
            fieldValue = '';
          } else {
            const nested = tryDecodeFields(buf, pos - dataLen, pos, depth + 1);
            if (nested && Object.keys(nested).length > 0) {
              fieldValue = nested;
            } else if (isReadableString(data)) {
              fieldValue = data.toString('utf-8');
            } else {
              fieldValue = { _hex: data.toString('hex'), _size: dataLen };
            }
          }
          break;
        }
        case 5: {
          if (pos + 4 > end) return null;
          fieldValue = buf.readUInt32LE(pos);
          pos += 4;
          break;
        }
        default:
          return null;
      }

      const key = String(fieldNum);
      if (key in fields) {
        if (!Array.isArray(fields[key])) {
          fields[key] = [fields[key]];
        }
        fields[key].push(fieldValue);
      } else {
        fields[key] = fieldValue;
      }
    }

    return pos === end ? fields : null;
  } catch {
    return null;
  }
}

/**
 * Decode a binary etcd value.
 * Returns { isK8s, apiVersion?, kind?, decoded } or null.
 */
function decodeValue(buf) {
  if (!Buffer.isBuffer(buf)) return null;

  const isK8s = buf.length >= 4 && buf.slice(0, 4).equals(K8S_MAGIC);
  const protoStart = isK8s ? 4 : 0;
  const decoded = tryDecodeFields(buf, protoStart, buf.length, 0);

  if (!decoded) return null;

  if (isK8s) {
    let apiVersion = '';
    let kind = '';
    const typeMeta = decoded['1'];
    if (typeMeta && typeof typeMeta === 'object' && !Array.isArray(typeMeta) && !typeMeta._hex) {
      apiVersion = typeof typeMeta['1'] === 'string' ? typeMeta['1'] : '';
      kind = typeof typeMeta['2'] === 'string' ? typeMeta['2'] : '';
    }
    return { isK8s: true, apiVersion, kind, decoded };
  }

  return { isK8s: false, decoded };
}

module.exports = { decodeValue };
