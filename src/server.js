'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const config = require('./config');
const apiRoutes = require('./routes/api');
const { startReaper } = require('./services/etcd-client');

fs.mkdirSync(config.snapshot.uploadDir, { recursive: true });

const upload = multer({
  dest: config.snapshot.uploadDir,
  limits: { fileSize: config.snapshot.maxSizeBytes },
});

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/snapshot/upload', upload.single('snapshot'));

app.use(express.static(config.staticDir));
app.use('/plugin', express.static(config.pluginDir));

app.use('/api', apiRoutes);

app.get('/readyz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(config.staticDir, 'index.html'));
});

startReaper();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`etcd-v3-browser server listening on port ${config.port}`);
  if (config.defaultEtcdEndpoint) {
    console.log(`Default etcd endpoint: ${config.defaultEtcdEndpoint}`);
  }
  console.log(`Snapshot max size: ${(config.snapshot.maxSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`);
});
