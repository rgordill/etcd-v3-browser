'use strict';

/**
 * Express middleware that extracts the etcd endpoint from the request.
 * Sets req.etcdEndpoint for downstream handlers.
 */
function requireEndpoint(req, res, next) {
  const endpoint = req.query.endpoint || req.body?.endpoint;
  if (!endpoint) {
    return res.status(400).json({
      error: 'endpoint query parameter is required (e.g. ?endpoint=http://host:2379)',
    });
  }
  req.etcdEndpoint = endpoint;
  next();
}

module.exports = requireEndpoint;
