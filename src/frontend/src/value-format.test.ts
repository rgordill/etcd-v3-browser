import { parseJsonText, jsonToYaml } from './value-format';

describe('parseJsonText', () => {
  it('parses a valid JSON object', () => {
    const result = parseJsonText('{"name":"test","count":42}');
    expect(result).not.toBeNull();
    expect(result!.parsed).toEqual({ name: 'test', count: 42 });
    expect(result!.formatted).toBe(JSON.stringify({ name: 'test', count: 42 }, null, 2));
  });

  it('parses a JSON array', () => {
    const result = parseJsonText('[1, 2, 3]');
    expect(result).not.toBeNull();
    expect(result!.parsed).toEqual([1, 2, 3]);
  });

  it('parses JSON primitives', () => {
    expect(parseJsonText('42')!.parsed).toBe(42);
    expect(parseJsonText('"hello"')!.parsed).toBe('hello');
    expect(parseJsonText('true')!.parsed).toBe(true);
    expect(parseJsonText('null')!.parsed).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseJsonText('')).toBeNull();
    expect(parseJsonText('   ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseJsonText('{invalid}')).toBeNull();
    expect(parseJsonText('not json')).toBeNull();
    expect(parseJsonText('{key: value}')).toBeNull();
  });

  it('trims whitespace before parsing', () => {
    const result = parseJsonText('  {"a": 1}  ');
    expect(result).not.toBeNull();
    expect(result!.parsed).toEqual({ a: 1 });
  });
});

describe('jsonToYaml', () => {
  it('converts a simple object to YAML', () => {
    const yaml = jsonToYaml({ name: 'test', version: '1.0' });
    expect(yaml).toContain('name: test');
    expect(yaml).toContain('version: \'1.0\'');
  });

  it('converts an array to YAML', () => {
    const yaml = jsonToYaml(['a', 'b', 'c']);
    expect(yaml).toContain('- a');
    expect(yaml).toContain('- b');
    expect(yaml).toContain('- c');
  });

  it('handles nested structures', () => {
    const yaml = jsonToYaml({ metadata: { name: 'pod1', namespace: 'default' } });
    expect(yaml).toContain('metadata:');
    expect(yaml).toContain('name: pod1');
    expect(yaml).toContain('namespace: default');
  });

  it('handles null values', () => {
    const yaml = jsonToYaml({ key: null });
    expect(yaml).toContain('key: null');
  });
});
