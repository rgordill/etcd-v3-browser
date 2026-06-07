'use strict';

/**
 * Unit tests for the buildTree function (extracted for testing).
 * Since buildTree is not exported directly, we test it via the API route behavior.
 * Here we replicate the logic for direct unit testing.
 */

function buildTree(allKeys, prefix) {
  const dirs = new Set();
  const leaves = [];

  for (const key of allKeys) {
    let remainder = key.slice(prefix.length);
    if (!remainder) continue;

    if (!prefix && remainder.startsWith('/')) {
      remainder = remainder.slice(1);
      if (!remainder) continue;
    }

    const slashIndex = remainder.indexOf('/');
    if (slashIndex === -1) {
      leaves.push({ key, name: remainder, isLeaf: true });
    } else {
      dirs.add(remainder.slice(0, slashIndex + 1));
    }
  }

  const effectivePrefix =
    !prefix && allKeys.length > 0 && allKeys[0].startsWith('/') ? '/' : prefix;

  const results = [];
  for (const dirName of dirs) {
    results.push({
      key: effectivePrefix + dirName,
      name: dirName.replace(/\/$/, ''),
      isLeaf: false,
    });
  }
  results.push(...leaves);

  results.sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

describe('buildTree', () => {
  it('returns empty array for no keys', () => {
    expect(buildTree([], '')).toEqual([]);
  });

  it('separates directories and leaves under a prefix', () => {
    const keys = [
      '/registry/pods/default/pod1',
      '/registry/pods/default/pod2',
      '/registry/services/default/svc1',
      '/registry/configmaps/kube-system/cm1',
    ];
    const result = buildTree(keys, '/registry/');

    const dirs = result.filter(r => !r.isLeaf);
    const leaves = result.filter(r => r.isLeaf);

    expect(dirs.length).toBe(3);
    expect(leaves.length).toBe(0);
    expect(dirs.map(d => d.name).sort()).toEqual(['configmaps', 'pods', 'services']);
  });

  it('shows leaves for final-level keys', () => {
    const keys = [
      '/registry/pods/default/pod1',
      '/registry/pods/default/pod2',
    ];
    const result = buildTree(keys, '/registry/pods/default/');

    expect(result.length).toBe(2);
    expect(result.every(r => r.isLeaf)).toBe(true);
    expect(result.map(r => r.name).sort()).toEqual(['pod1', 'pod2']);
  });

  it('directories sort before leaves', () => {
    const keys = [
      '/registry/alpha-leaf',
      '/registry/beta/child',
    ];
    const result = buildTree(keys, '/registry/');

    expect(result[0].isLeaf).toBe(false);
    expect(result[0].name).toBe('beta');
    expect(result[1].isLeaf).toBe(true);
    expect(result[1].name).toBe('alpha-leaf');
  });

  it('handles root prefix with leading slashes', () => {
    const keys = ['/registry/pods/default/pod1', '/registry/services/kube/svc1'];
    const result = buildTree(keys, '');

    const dirs = result.filter(r => !r.isLeaf);
    expect(dirs.length).toBe(1);
    expect(dirs[0].name).toBe('registry');
    expect(dirs[0].key).toBe('/registry/');
  });

  it('preserves the full key path for leaves', () => {
    const keys = ['/a/b/leaf1', '/a/b/leaf2'];
    const result = buildTree(keys, '/a/b/');

    expect(result[0].key).toBe('/a/b/leaf1');
    expect(result[1].key).toBe('/a/b/leaf2');
  });
});
