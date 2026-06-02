'use strict';

const fs = require('node:fs');
const { AsyncLocalStorage } = require('node:async_hooks');
const grpc = require('@grpc/grpc-js');
const { Etcd3 } = require('etcd3');
const config = require('../config');

let globalCredentials;

function loadGlobalCredentials() {
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

globalCredentials = loadGlobalCredentials();

const cache = new Map();
const tlsConfigs = new Map();
const tlsContext = new AsyncLocalStorage();

/**
 * etcd3 calls grpc.credentials.createSsl without verifyOptions, so
 * NODE_TLS_REJECT_UNAUTHORIZED does not disable gRPC cert checks.
 * Inject rejectUnauthorized: false when the UI requests skip TLS verify.
 */
function installGrpcTlsPatch() {
  if (installGrpcTlsPatch.installed) return;
  installGrpcTlsPatch.installed = true;

  const createSsl = grpc.credentials.createSsl.bind(grpc.credentials);
  grpc.credentials.createSsl = (rootCerts, privateKey, certChain, verifyOptions) => {
    const ctx = tlsContext.getStore();
    if (ctx?.skipTlsVerify) {
      verifyOptions = { ...(verifyOptions || {}), rejectUnauthorized: false };
    } else if (ctx?.serverCa && !rootCerts) {
      rootCerts = Buffer.from(ctx.serverCa);
    }
    return createSsl(rootCerts, privateKey, certChain, verifyOptions);
  };
}

installGrpcTlsPatch();

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

function getTlsRuntimeContext(endpoint) {
  const tlsConfig = tlsConfigs.get(endpoint);
  if (!tlsConfig) return {};
  return {
    skipTlsVerify: Boolean(tlsConfig.skipTlsVerify),
    serverCa: tlsConfig.serverCa || '',
  };
}

function storeTlsConfig(endpoint, tlsConfig) {
  const cached = cache.get(endpoint);
  if (cached) {
    cached.client.close();
    cache.delete(endpoint);
  }

  if (tlsConfig) {
    tlsConfigs.set(endpoint, tlsConfig);
  } else {
    tlsConfigs.delete(endpoint);
  }
}

function buildCredentials(endpoint) {
  const tlsConfig = tlsConfigs.get(endpoint);
  if (!tlsConfig) return globalCredentials;

  const { skipTlsVerify, serverCa, clientAuth, clientCert, clientKey } = tlsConfig;
  const creds = {};
  let hasCreds = false;

  if (!skipTlsVerify && serverCa) {
    creds.rootCertificate = Buffer.from(serverCa);
    hasCreds = true;
  }

  if (clientAuth && clientCert && clientKey) {
    creds.certChain = Buffer.from(clientCert);
    creds.privateKey = Buffer.from(clientKey);
    hasCreds = true;
  }

  return hasCreds ? creds : undefined;
}

function createEtcdClient(endpoint) {
  const opts = { hosts: endpoint.split(',') };
  const creds = buildCredentials(endpoint);
  if (creds) opts.credentials = creds;

  return tlsContext.run(getTlsRuntimeContext(endpoint), () => new Etcd3(opts));
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

  const client = createEtcdClient(endpoint);
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

module.exports = { getClient, startReaper, storeTlsConfig };
