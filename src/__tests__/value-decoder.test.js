'use strict';

const { isBinary, encodeValue } = require('../services/value-decoder');

jest.mock('../services/k8s-decoder', () => ({
  decode: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/openshift-decoder', () => ({
  decode: jest.fn().mockResolvedValue(null),
}));

describe('isBinary', () => {
  it('returns false for plain ASCII text', () => {
    const buf = Buffer.from('hello world');
    expect(isBinary(buf)).toBe(false);
  });

  it('returns false for text with tabs and newlines', () => {
    const buf = Buffer.from('line1\nline2\ttab\r\n');
    expect(isBinary(buf)).toBe(false);
  });

  it('returns true for buffer containing null bytes', () => {
    const buf = Buffer.from([0x68, 0x65, 0x00, 0x6c, 0x6c]);
    expect(isBinary(buf)).toBe(true);
  });

  it('returns true for buffer with control characters', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03]);
    expect(isBinary(buf)).toBe(true);
  });

  it('returns false for empty buffer', () => {
    const buf = Buffer.from([]);
    expect(isBinary(buf)).toBe(false);
  });

  it('returns false for UTF-8 text', () => {
    const buf = Buffer.from('{"apiVersion":"v1","kind":"Pod"}');
    expect(isBinary(buf)).toBe(false);
  });
});

describe('encodeValue', () => {
  it('returns null value for null buffer', async () => {
    const result = await encodeValue('/test/key', null);
    expect(result).toEqual({
      key: '/test/key',
      value: null,
      encoding: 'text',
      size: 0,
    });
  });

  it('returns text encoding for plain text', async () => {
    const buf = Buffer.from('hello world');
    const result = await encodeValue('/key', buf);
    expect(result.encoding).toBe('text');
    expect(result.value).toBe('hello world');
    expect(result.size).toBe(11);
  });

  it('returns binary encoding with base64 for binary data', async () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const result = await encodeValue('/key', buf);
    expect(result.encoding).toBe('binary');
    expect(result.value).toBe(buf.toString('base64'));
    expect(result.size).toBe(4);
  });

  it('returns JSON text as-is without base64', async () => {
    const json = '{"apiVersion":"v1","kind":"ConfigMap"}';
    const buf = Buffer.from(json);
    const result = await encodeValue('/registry/configmaps/test', buf);
    expect(result.encoding).toBe('text');
    expect(result.value).toBe(json);
  });
});
