'use strict';

const fs = require('node:fs');
const { Etcd3 } = require('etcd3');
const config = require('../config');

let credentials;

function loadCredentials() {
  const { caCert, clientCert, clientKey } = config.tls;

  if (caCert && fs.existsSync(caCert)) {
    const creds = { rootCertificate: fs.readFileSync(caCert) };
    if (clientCert && fs.existsSync(clientCert) &&
        clientKey && fs.existsSync(clientKey)) {
      creds.certChain = fs.readFileSync(clientCert);
      creds.privateKey = fs.readFileSync(clientKey);
    }
    return creds;
  }
  return undefined;
}

credentials = loadCredentials();

const cache = new Map();

function evictOldest() {
  let oldest = null;
  for (const [key, entry] of cache) {
    if (!oldest || entry.lastUsed < oldest.lastUsed) {
      oldest = { key, ...entry };
    }
  }
  if (oldest) {
    oldest.client.close();
    cache.delete(oldest.key);
  }
}

function getClient(endpoint) {
  const cached = cache.get(endpoint);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.client;
  }

  if (cache.size >= config.clientPool.maxClients) {
    evictOldest();
  }

  const opts = { hosts: endpoint.split(',') };
  if (credentials) opts.credentials = credentials;

  const client = new Etcd3(opts);
  cache.set(endpoint, { client, lastUsed: Date.now() });
  return client;
}

function startReaper() {
  return setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.lastUsed > config.clientPool.ttlMs) {
        entry.client.close();
        cache.delete(key);
      }
    }
  }, config.clientPool.reapIntervalMs);
}

module.exports = { getClient, startReaper };
