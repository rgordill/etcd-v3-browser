'use strict';

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const config = require('./config');
const apiRoutes = require('./routes/api');
const { startReaper } = require('./services/etcd-client');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(config.staticDir));

app.use('/api', apiRoutes);

app.get('/readyz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(config.staticDir, 'index.html'));
});

startReaper();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`etcd-v3-browser server listening on port ${config.port}`);
  if (config.defaultEtcdEndpoint) {
    console.log(`Default etcd endpoint: ${config.defaultEtcdEndpoint}`);
  }
});
