'use strict';

const fs = require('node:fs');

const PAGE_FLAG_BRANCH = 0x01;
const PAGE_FLAG_LEAF = 0x02;
const PAGE_FLAG_META = 0x04;

const BUCKET_LEAF_FLAG = 0x01;
const BOLTDB_MAGIC = 0xED0CDAED;
const PAGE_HEADER_SIZE = 16;
const BRANCH_ELEMENT_SIZE = 16;
const LEAF_ELEMENT_SIZE = 16;

// Bucket header is stored inline at the start of the value for bucket leaf entries.
// Layout: root(8) + sequence(8) = 16 bytes
const BUCKET_HEADER_SIZE = 16;

/**
 * Read a BoltDB file and extract all key-value pairs from a named bucket.
 * Returns an array of { key: Buffer, value: Buffer } entries.
 */
function readBoltDBBucket(filePath, bucketName) {
  const fileBuffer = fs.readFileSync(filePath);
  const meta = readMeta(fileBuffer);
  const pageSize = meta.pageSize;

  const rootPageId = meta.rootBucket.root;
  if (rootPageId === 0 && meta.rootBucket.root === 0) {
    // Possibly inline root with no pages allocated yet
    return [];
  }

  const targetBucketInfo = findBucket(fileBuffer, pageSize, rootPageId, bucketName);
  if (!targetBucketInfo) {
    return [];
  }

  if (targetBucketInfo.inline) {
    return readInlineLeafEntries(targetBucketInfo.data);
  }

  return collectAllLeafEntries(fileBuffer, pageSize, targetBucketInfo.root);
}

/**
 * Parse a meta page and return page size + root bucket info.
 * Tries page 0 first, falls back to page 1.
 */
function readMeta(buf) {
  const meta0 = tryParseMeta(buf, 0);
  const meta1 = tryParseMeta(buf, 1);

  if (!meta0 && !meta1) {
    throw new Error('No valid meta page found in BoltDB file');
  }

  // Use the meta with the higher txid (more recent)
  if (meta0 && meta1) {
    return meta0.txid >= meta1.txid ? meta0 : meta1;
  }
  return meta0 || meta1;
}

function tryParseMeta(buf, pageIndex) {
  // Meta is at pages 0 and 1. On the first pass we don't know pageSize yet,
  // so we try the common OS page size of 4096 to locate the second meta page.
  // The first meta page is always at offset 0.
  // After reading the first meta, we know the actual page size.

  // For page 0, offset is always PAGE_HEADER_SIZE (meta data starts after the page header)
  // But we need the page size to find page 1.
  // Strategy: read page 0's meta first (always at file offset 16) to get pageSize.

  let offset;
  if (pageIndex === 0) {
    offset = PAGE_HEADER_SIZE;
  } else {
    // We need the page size from page 0 to locate page 1
    const page0Meta = tryParseMeta(buf, 0);
    if (!page0Meta) return null;
    offset = page0Meta.pageSize + PAGE_HEADER_SIZE;
  }

  if (offset + 72 > buf.length) return null;

  const magic = buf.readUInt32LE(offset);
  if (magic !== BOLTDB_MAGIC) return null;

  const version = buf.readUInt32LE(offset + 4);
  if (version !== 2) return null;

  const pageSize = buf.readUInt32LE(offset + 8);
  if (pageSize < 1024 || pageSize > 65536) return null;

  // Skip: flags(4) at offset+12
  // Root bucket starts at offset + 16
  // Bucket header: root pgid (8 bytes) + sequence (8 bytes) = 16 bytes
  const rootBucketRoot = readUInt64LE(buf, offset + 16);

  // freelist pgid at offset + 32
  // pgid (high water mark) at offset + 40
  const txid = readUInt64LE(buf, offset + 48);

  return {
    pageSize,
    rootBucket: { root: rootBucketRoot },
    txid,
  };
}

/**
 * Find a named bucket within the root bucket's B+ tree.
 * Returns { root, inline, data } or null.
 */
function findBucket(buf, pageSize, rootPageId, bucketName) {
  const targetKey = Buffer.from(bucketName);
  const entries = collectLeafEntriesForPage(buf, pageSize, rootPageId);

  for (const entry of entries) {
    if ((entry.flags & BUCKET_LEAF_FLAG) !== 0 && entry.key.equals(targetKey)) {
      // This is a bucket entry. The value contains the bucket header.
      if (entry.value.length === BUCKET_HEADER_SIZE) {
        // Non-inline bucket: value is just the header (root pgid + sequence)
        const root = readUInt64LE(entry.value, 0);
        return { root, inline: false, data: null };
      } else if (entry.value.length > BUCKET_HEADER_SIZE) {
        // Inline bucket: header followed by inline page data
        const root = readUInt64LE(entry.value, 0);
        if (root === 0) {
          const inlineData = entry.value.slice(BUCKET_HEADER_SIZE);
          return { root: 0, inline: true, data: inlineData };
        }
        return { root, inline: false, data: null };
      }
      return null;
    }
  }
  return null;
}

/**
 * Recursively collect all leaf key-value entries from a B+ tree rooted at pageId.
 */
function collectAllLeafEntries(buf, pageSize, pageId) {
  const results = [];
  collectLeafEntriesRecursive(buf, pageSize, pageId, results);
  return results;
}

function collectLeafEntriesRecursive(buf, pageSize, pageId, results) {
  const pageOffset = pageId * pageSize;
  if (pageOffset + PAGE_HEADER_SIZE > buf.length) return;

  const flags = buf.readUInt16LE(pageOffset + 8);
  const count = buf.readUInt16LE(pageOffset + 10);
  const overflow = buf.readUInt32LE(pageOffset + 12);

  if (flags === PAGE_FLAG_LEAF) {
    const entries = parseLeafPage(buf, pageOffset, count, pageSize, overflow);
    for (const entry of entries) {
      if ((entry.flags & BUCKET_LEAF_FLAG) === 0) {
        results.push({ key: entry.key, value: entry.value });
      }
    }
  } else if (flags === PAGE_FLAG_BRANCH) {
    const childPageIds = parseBranchPage(buf, pageOffset, count);
    for (const childId of childPageIds) {
      collectLeafEntriesRecursive(buf, pageSize, childId, results);
    }
  }
}

/**
 * Collect all leaf entries (including bucket entries) from a page tree.
 * Used for finding buckets in the root bucket.
 */
function collectLeafEntriesForPage(buf, pageSize, pageId) {
  const results = [];
  collectAllEntriesRecursive(buf, pageSize, pageId, results);
  return results;
}

function collectAllEntriesRecursive(buf, pageSize, pageId, results) {
  const pageOffset = pageId * pageSize;
  if (pageOffset + PAGE_HEADER_SIZE > buf.length) return;

  const flags = buf.readUInt16LE(pageOffset + 8);
  const count = buf.readUInt16LE(pageOffset + 10);
  const overflow = buf.readUInt32LE(pageOffset + 12);

  if (flags === PAGE_FLAG_LEAF) {
    const entries = parseLeafPage(buf, pageOffset, count, pageSize, overflow);
    results.push(...entries);
  } else if (flags === PAGE_FLAG_BRANCH) {
    const childPageIds = parseBranchPage(buf, pageOffset, count);
    for (const childId of childPageIds) {
      collectAllEntriesRecursive(buf, pageSize, childId, results);
    }
  }
}

/**
 * Parse leaf page elements.
 * Leaf element layout: flags(4) + pos(4) + ksize(4) + vsize(4) = 16 bytes
 * Keys and values are stored after the element array, at offset relative to the element.
 */
function parseLeafPage(buf, pageOffset, count, pageSize, overflow) {
  const entries = [];
  const dataStart = pageOffset + PAGE_HEADER_SIZE;
  const pageEnd = pageOffset + pageSize * (1 + overflow);

  for (let i = 0; i < count; i++) {
    const elemOffset = dataStart + i * LEAF_ELEMENT_SIZE;
    if (elemOffset + LEAF_ELEMENT_SIZE > buf.length) break;

    const elemFlags = buf.readUInt32LE(elemOffset);
    const pos = buf.readUInt32LE(elemOffset + 4);
    const ksize = buf.readUInt32LE(elemOffset + 8);
    const vsize = buf.readUInt32LE(elemOffset + 12);

    const keyStart = elemOffset + pos;
    const valueStart = keyStart + ksize;

    if (keyStart + ksize > pageEnd || valueStart + vsize > buf.length) break;

    const key = buf.slice(keyStart, keyStart + ksize);
    const value = buf.slice(valueStart, valueStart + vsize);

    entries.push({ flags: elemFlags, key, value });
  }

  return entries;
}

/**
 * Parse branch page elements and return child page IDs.
 * Branch element layout: pos(4) + ksize(4) + pgid(8) = 16 bytes
 */
function parseBranchPage(buf, pageOffset, count) {
  const pageIds = [];
  const dataStart = pageOffset + PAGE_HEADER_SIZE;

  for (let i = 0; i < count; i++) {
    const elemOffset = dataStart + i * BRANCH_ELEMENT_SIZE;
    if (elemOffset + BRANCH_ELEMENT_SIZE > buf.length) break;

    // pos(4) + ksize(4) + pgid(8)
    const pgid = readUInt64LE(buf, elemOffset + 8);
    pageIds.push(pgid);
  }

  return pageIds;
}

/**
 * Read entries from an inline leaf page (page data embedded in the bucket value).
 * Inline pages don't have a page header—the data starts immediately.
 * Actually, inline pages DO have a pseudo-page structure: the bucket value after
 * the 16-byte bucket header IS a page (with a page header).
 */
function readInlineLeafEntries(data) {
  if (data.length < PAGE_HEADER_SIZE) return [];

  const flags = data.readUInt16LE(8);
  const count = data.readUInt16LE(10);

  if (flags !== PAGE_FLAG_LEAF) return [];

  const entries = [];
  const dataStart = PAGE_HEADER_SIZE;

  for (let i = 0; i < count; i++) {
    const elemOffset = dataStart + i * LEAF_ELEMENT_SIZE;
    if (elemOffset + LEAF_ELEMENT_SIZE > data.length) break;

    const elemFlags = data.readUInt32LE(elemOffset);
    const pos = data.readUInt32LE(elemOffset + 4);
    const ksize = data.readUInt32LE(elemOffset + 8);
    const vsize = data.readUInt32LE(elemOffset + 12);

    const keyStart = elemOffset + pos;
    const valueStart = keyStart + ksize;

    if (valueStart + vsize > data.length) break;

    const key = data.slice(keyStart, keyStart + ksize);
    const value = data.slice(valueStart, valueStart + vsize);

    if ((elemFlags & BUCKET_LEAF_FLAG) === 0) {
      entries.push({ key, value });
    }
  }

  return entries;
}

/**
 * Read a uint64 from a buffer at a given offset (little-endian).
 * JavaScript can handle up to 2^53 safely, which covers all realistic page IDs and txids.
 */
function readUInt64LE(buf, offset) {
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readUInt32LE(offset + 4);
  return lo + hi * 0x100000000;
}

module.exports = { readBoltDBBucket, readMeta };
