'use strict';

const fs = require('node:fs');
const path = require('node:path');
const protobuf = require('protobufjs');
const config = require('../config');
const { readBoltDBBucket } = require('../lib/boltdb-reader');

const BOLTDB_MAGIC = 0xED0CDAED;
const BOLTDB_MAGIC_OFFSET = 16;
const TOMBSTONE_SUFFIX = 0x74; // 't'

let snapshotCache = null;
let KeyValueType = null;

async function loadProto() {
  if (KeyValueType) return;
  const protoPath = path.join(__dirname, '..', 'protos', 'etcd.io', 'api', 'mvccpb', 'kv.proto');
  const root = await protobuf.load(protoPath);
  KeyValueType = root.lookupType('mvccpb.KeyValue');
}

/**
 * Validate that the file is a valid BoltDB/etcd snapshot by checking the magic number.
 */
function validateSnapshotMagic(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(20);
    const bytesRead = fs.readSync(fd, buf, 0, 20, 0);
    if (bytesRead < 20) {
      return { valid: false, error: 'File too small to be a valid etcd snapshot' };
    }

    const magic = buf.readUInt32LE(BOLTDB_MAGIC_OFFSET);
    if (magic !== BOLTDB_MAGIC) {
      return {
        valid: false,
        error: `Invalid snapshot file: expected BoltDB magic 0x${BOLTDB_MAGIC.toString(16).toUpperCase()} at offset ${BOLTDB_MAGIC_OFFSET}, got 0x${magic.toString(16).toUpperCase()}`,
      };
    }

    return { valid: true };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Validate snapshot file size against the configured maximum.
 */
function validateSnapshotSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > config.snapshot.maxSizeBytes) {
    const maxMB = (config.snapshot.maxSizeBytes / (1024 * 1024)).toFixed(0);
    const fileMB = (stats.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Snapshot file (${fileMB} MB) exceeds maximum allowed size (${maxMB} MB)`,
    };
  }
  return { valid: true, size: stats.size };
}

/**
 * Parse a 16-byte BoltDB key from the "key" bucket into a revision object.
 * etcd stores revisions as: main_revision (8 bytes big-endian) + sub_revision (8 bytes big-endian)
 * A 17th byte of 't' (0x74) indicates a tombstone (deletion).
 */
function parseRevisionKey(keyBuf) {
  if (keyBuf.length < 16) return null;

  const mainHi = keyBuf.readUInt32BE(0);
  const mainLo = keyBuf.readUInt32BE(4);
  const main = mainHi * 0x100000000 + mainLo;

  const subHi = keyBuf.readUInt32BE(8);
  const subLo = keyBuf.readUInt32BE(12);
  const sub = subHi * 0x100000000 + subLo;

  const isTombstone = keyBuf.length >= 17 && keyBuf[16] === TOMBSTONE_SUFFIX;

  return { main, sub, isTombstone };
}

/**
 * Unload any currently loaded snapshot and free memory.
 */
function unloadSnapshot() {
  snapshotCache = null;
}

/**
 * Load a snapshot file into memory. Parses the BoltDB structure,
 * decodes all mvccpb.KeyValue entries, and builds an in-memory index
 * of the latest revision for each user key.
 */
async function loadSnapshot(filePath, originalName) {
  unloadSnapshot();

  const sizeResult = validateSnapshotSize(filePath);
  if (!sizeResult.valid) {
    fs.rmSync(filePath, { force: true });
    throw new Error(sizeResult.error);
  }

  const magicResult = validateSnapshotMagic(filePath);
  if (!magicResult.valid) {
    fs.rmSync(filePath, { force: true });
    throw new Error(magicResult.error);
  }

  await loadProto();

  let rawEntries;
  try {
    rawEntries = readBoltDBBucket(filePath, 'key');
  } catch (err) {
    fs.rmSync(filePath, { force: true });
    throw new Error(`Failed to parse BoltDB snapshot: ${err.message}`);
  }

  // Build the index: for each user key, keep only the latest non-tombstoned revision
  const keyIndex = new Map();

  for (const entry of rawEntries) {
    const rev = parseRevisionKey(entry.key);
    if (!rev) continue;

    let kv;
    try {
      kv = KeyValueType.decode(entry.value);
    } catch {
      continue;
    }

    const userKey = Buffer.from(kv.key).toString('utf-8');

    if (rev.isTombstone) {
      // Tombstone: mark as deleted if this is the latest revision
      const existing = keyIndex.get(userKey);
      if (!existing || rev.main > existing.revision || (rev.main === existing.revision && rev.sub > existing.sub)) {
        keyIndex.set(userKey, { deleted: true, revision: rev.main, sub: rev.sub });
      }
      continue;
    }

    const existing = keyIndex.get(userKey);
    if (!existing || rev.main > existing.revision || (rev.main === existing.revision && rev.sub > existing.sub)) {
      keyIndex.set(userKey, {
        deleted: false,
        revision: rev.main,
        sub: rev.sub,
        value: Buffer.from(kv.value),
        createRevision: Number(kv.createRevision || kv.create_revision || 0),
        modRevision: Number(kv.modRevision || kv.mod_revision || 0),
        version: Number(kv.version || 0),
      });
    }
  }

  // Remove tombstoned entries
  for (const [key, entry] of keyIndex) {
    if (entry.deleted) keyIndex.delete(key);
  }

  // Clean up the uploaded file
  fs.rmSync(filePath, { force: true });

  snapshotCache = {
    name: originalName || path.basename(filePath),
    size: sizeResult.size,
    keyCount: keyIndex.size,
    keys: keyIndex,
  };

  return {
    snapshotName: snapshotCache.name,
    size: snapshotCache.size,
    keyCount: snapshotCache.keyCount,
  };
}

/**
 * List all keys matching a prefix (for the tree view).
 */
function listKeys(prefix) {
  if (!snapshotCache) return [];
  const results = [];
  for (const key of snapshotCache.keys.keys()) {
    if (key.startsWith(prefix)) {
      results.push(key);
    }
  }
  results.sort();
  return results;
}

/**
 * Get the raw value buffer for a key.
 */
function getValue(key) {
  if (!snapshotCache) return null;
  const entry = snapshotCache.keys.get(key);
  if (!entry) return null;
  return entry.value;
}

function getSnapshotStatus() {
  if (!snapshotCache) {
    return { loaded: false };
  }
  return {
    loaded: true,
    name: snapshotCache.name,
    size: snapshotCache.size,
    keyCount: snapshotCache.keyCount,
  };
}

function getMaxSnapshotSize() {
  return config.snapshot.maxSizeBytes;
}

function getSnapshotCache() {
  return snapshotCache;
}

module.exports = {
  loadSnapshot,
  unloadSnapshot,
  listKeys,
  getValue,
  getSnapshotStatus,
  getSnapshotCache,
  getMaxSnapshotSize,
  validateSnapshotMagic,
  validateSnapshotSize,
};
