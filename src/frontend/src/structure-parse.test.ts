import { collectContainerPaths, tryParseStructure } from './structure-parse';

describe('tryParseStructure', () => {
  it('parses JSON objects', () => {
    expect(tryParseStructure('{"a":1}', 'json')).toEqual({ a: 1 });
  });

  it('parses YAML maps', () => {
    expect(tryParseStructure('a: 1\nb: two', 'yaml')).toEqual({ a: 1, b: 'two' });
  });

  it('returns null for invalid input', () => {
    expect(tryParseStructure('{bad', 'json')).toBeNull();
    expect(tryParseStructure(':', 'yaml')).toBeNull();
  });
});

describe('collectContainerPaths', () => {
  it('lists container paths including root', () => {
    const paths = collectContainerPaths({ items: [{ x: 1 }] });
    expect(paths).toContain('$');
    expect(paths).toContain('$.items');
    expect(paths).toContain('$.items[0]');
    expect(paths).not.toContain('$.items[0].x');
  });
});
