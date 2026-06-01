'use strict';

const { Router } = require('express');
const config = require('../config');
const { getClient } = require('../services/etcd-client');
const { encodeValue } = require('../services/value-decoder');
const requireEndpoint = require('../middleware/require-endpoint');

const router = Router();

router.get('/config', (_req, res) => {
  res.json({ defaultEndpoint: config.defaultEtcdEndpoint });
});

router.get('/connect', requireEndpoint, async (req, res) => {
  try {
    const client = getClient(req.etcdEndpoint);
    const status = await client.maintenance.status();
    res.json({
      connected: true,
      endpoint: req.etcdEndpoint,
      version: status.version,
      dbSize: status.dbSize.toString(),
    });
  } catch (err) {
    res.status(502).json({
      connected: false,
      endpoint: req.etcdEndpoint,
      error: err.message,
    });
  }
});

router.get('/keys', requireEndpoint, async (req, res) => {
  const prefix = req.query.prefix || '';
  try {
    const client = getClient(req.etcdEndpoint);
    const allKeys = await client.getAll().prefix(prefix).keys();
    res.json(buildTree(allKeys, prefix));
  } catch (err) {
    console.error('Error listing keys:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/key', requireEndpoint, async (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key is required' });

  try {
    const client = getClient(req.etcdEndpoint);
    const buf = await client.get(key).buffer();
    res.json(await encodeValue(key, buf));
  } catch (err) {
    console.error('Error getting key:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/key', requireEndpoint, async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });

  try {
    const client = getClient(req.etcdEndpoint);
    await client.put(key).value(value || '');
    res.json({ success: true });
  } catch (err) {
    console.error('Error putting key:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/key', requireEndpoint, async (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key is required' });

  try {
    const client = getClient(req.etcdEndpoint);
    await client.delete().key(key);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting key:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Parse a flat list of etcd keys into a one-level directory/leaf tree
 * suitable for the TreeView component's lazy-loading pattern.
 */
function buildTree(allKeys, prefix) {
  const dirs = new Set();
  const leaves = [];

  for (const key of allKeys) {
    let remainder = key.slice(prefix.length);
    if (!remainder) continue;

    if (!prefix && remainder.startsWith('/')) {
      remainder = remainder.slice(1);
      if (!remainder) continue;
    }

    const slashIndex = remainder.indexOf('/');
    if (slashIndex === -1) {
      leaves.push({ key, name: remainder, isLeaf: true });
    } else {
      dirs.add(remainder.slice(0, slashIndex + 1));
    }
  }

  const effectivePrefix =
    !prefix && allKeys.length > 0 && allKeys[0].startsWith('/') ? '/' : prefix;

  const results = [];
  for (const dirName of dirs) {
    results.push({
      key: effectivePrefix + dirName,
      name: dirName.replace(/\/$/, ''),
      isLeaf: false,
    });
  }
  results.push(...leaves);

  results.sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

module.exports = router;
