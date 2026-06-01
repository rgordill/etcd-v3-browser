'use strict';

const path = require('node:path');

module.exports = {
  port: Number(process.env.PORT) || 3001,
  defaultEtcdEndpoint: process.env.ETCD_HOSTS || '',

  tls: {
    caCert: process.env.ETCD_CA_CERT || '',
    clientCert: process.env.ETCD_CLIENT_CERT || '',
    clientKey: process.env.ETCD_CLIENT_KEY || '',
  },

  clientPool: {
    maxClients: 20,
    ttlMs: 10 * 60 * 1000,   // 10 minutes
    reapIntervalMs: 60_000,   // 1 minute
  },

  staticDir: path.join(__dirname, 'frontend', 'build'),
};
