'use strict';

jest.mock('../services/etcd-client', () => ({
  getClient: jest.fn(),
  storeTlsConfig: jest.fn(),
  startReaper: jest.fn(),
}));
jest.mock('../services/value-decoder', () => ({
  encodeValue: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../routes/api');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  return app;
}

describe('API routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe('GET /api/config', () => {
    it('returns the default endpoint from config', async () => {
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('defaultEndpoint');
    });
  });

  describe('GET /api/connect', () => {
    it('returns 400 when endpoint is missing', async () => {
      const res = await request(app).get('/api/connect');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('endpoint');
    });

    it('returns 502 when connection fails', async () => {
      const { getClient } = require('../services/etcd-client');
      getClient.mockReturnValue({
        maintenance: {
          status: jest.fn().mockRejectedValue(new Error('Connection refused')),
        },
      });

      const res = await request(app)
        .get('/api/connect')
        .query({ endpoint: 'http://badhost:2379' });

      expect(res.status).toBe(502);
      expect(res.body.connected).toBe(false);
      expect(res.body.error).toContain('Connection refused');
    });

    it('returns connection info on success', async () => {
      const { getClient } = require('../services/etcd-client');
      getClient.mockReturnValue({
        maintenance: {
          status: jest.fn().mockResolvedValue({
            version: '3.5.21',
            dbSize: BigInt(12345),
          }),
        },
      });

      const res = await request(app)
        .get('/api/connect')
        .query({ endpoint: 'http://localhost:2379' });

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.version).toBe('3.5.21');
    });
  });

  describe('GET /api/keys', () => {
    it('returns 400 without endpoint', async () => {
      const res = await request(app).get('/api/keys');
      expect(res.status).toBe(400);
    });

    it('returns tree structure for keys', async () => {
      const { getClient } = require('../services/etcd-client');
      const mockKeysResponse = {
        prefix: jest.fn().mockReturnThis(),
        keys: jest.fn().mockResolvedValue([
          '/registry/pods/default/pod1',
          '/registry/pods/default/pod2',
          '/registry/services/',
        ]),
      };
      getClient.mockReturnValue({
        getAll: jest.fn().mockReturnValue(mockKeysResponse),
      });

      const res = await request(app)
        .get('/api/keys')
        .query({ endpoint: 'http://localhost:2379', prefix: '/registry/' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/key', () => {
    it('returns 400 without key parameter', async () => {
      const res = await request(app)
        .get('/api/key')
        .query({ endpoint: 'http://localhost:2379' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('key');
    });

    it('returns encoded value for a key', async () => {
      const { getClient } = require('../services/etcd-client');
      const { encodeValue } = require('../services/value-decoder');

      getClient.mockReturnValue({
        get: jest.fn().mockReturnValue({
          buffer: jest.fn().mockResolvedValue(Buffer.from('test-value')),
        }),
      });
      encodeValue.mockResolvedValue({
        key: '/test',
        value: 'test-value',
        encoding: 'text',
        size: 10,
      });

      const res = await request(app)
        .get('/api/key')
        .query({ endpoint: 'http://localhost:2379', key: '/test' });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe('test-value');
    });
  });

  describe('PUT /api/key', () => {
    it('returns 400 without key in body', async () => {
      const res = await request(app)
        .put('/api/key')
        .query({ endpoint: 'http://localhost:2379' })
        .send({ value: 'test' });

      expect(res.status).toBe(400);
    });

    it('writes key and returns success', async () => {
      const { getClient } = require('../services/etcd-client');
      getClient.mockReturnValue({
        put: jest.fn().mockReturnValue({
          value: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const res = await request(app)
        .put('/api/key')
        .query({ endpoint: 'http://localhost:2379' })
        .send({ key: '/test/key', value: 'hello' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/key', () => {
    it('returns 400 without key parameter', async () => {
      const res = await request(app)
        .delete('/api/key')
        .query({ endpoint: 'http://localhost:2379' });

      expect(res.status).toBe(400);
    });

    it('deletes key and returns success', async () => {
      const { getClient } = require('../services/etcd-client');
      getClient.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          key: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const res = await request(app)
        .delete('/api/key')
        .query({ endpoint: 'http://localhost:2379', key: '/test/key' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
