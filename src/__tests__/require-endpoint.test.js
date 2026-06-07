'use strict';

const requireEndpoint = require('../middleware/require-endpoint');

describe('requireEndpoint middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('extracts endpoint from query parameter', () => {
    req.query.endpoint = 'http://localhost:2379';
    requireEndpoint(req, res, next);
    expect(req.etcdEndpoint).toBe('http://localhost:2379');
    expect(next).toHaveBeenCalled();
  });

  it('extracts endpoint from request body', () => {
    req.body = { endpoint: 'https://etcd.cluster:2379' };
    requireEndpoint(req, res, next);
    expect(req.etcdEndpoint).toBe('https://etcd.cluster:2379');
    expect(next).toHaveBeenCalled();
  });

  it('prefers query parameter over body', () => {
    req.query.endpoint = 'http://from-query:2379';
    req.body = { endpoint: 'http://from-body:2379' };
    requireEndpoint(req, res, next);
    expect(req.etcdEndpoint).toBe('http://from-query:2379');
  });

  it('returns 400 when endpoint is missing', () => {
    requireEndpoint(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('endpoint') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when body is undefined', () => {
    req.body = undefined;
    requireEndpoint(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
