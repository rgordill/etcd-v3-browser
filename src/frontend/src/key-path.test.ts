import {
  parseKeyBreadcrumbs,
  getFolderPrefixesForKey,
  findTreeNodeById,
  treeNodeNeedsLoad,
  markTreePathExpanded,
} from './key-path';
import { TreeViewDataItem } from '@patternfly/react-core';

describe('parseKeyBreadcrumbs', () => {
  it('splits a nested key into segments', () => {
    expect(parseKeyBreadcrumbs('/registry/pods/default/pod1')).toEqual([
      { label: 'registry', path: '/registry/', isLeaf: false },
      { label: 'pods', path: '/registry/pods/', isLeaf: false },
      { label: 'default', path: '/registry/pods/default/', isLeaf: false },
      { label: 'pod1', path: '/registry/pods/default/pod1', isLeaf: true },
    ]);
  });

  it('handles a single-segment key', () => {
    expect(parseKeyBreadcrumbs('/foo')).toEqual([
      { label: 'foo', path: '/foo', isLeaf: true },
    ]);
  });
});

describe('getFolderPrefixesForKey', () => {
  it('returns parent folders for a leaf key', () => {
    expect(getFolderPrefixesForKey('/registry/pods/default/pod1')).toEqual([
      '/registry/',
      '/registry/pods/',
      '/registry/pods/default/',
    ]);
  });

  it('returns empty for a top-level leaf', () => {
    expect(getFolderPrefixesForKey('/foo')).toEqual([]);
  });
});

describe('findTreeNodeById', () => {
  const tree: TreeViewDataItem[] = [
    {
      id: '/registry/',
      name: 'registry',
      children: [{ id: '/registry/pods/', name: 'pods' }],
    },
  ];

  it('finds nested nodes', () => {
    expect(findTreeNodeById(tree, '/registry/pods/')?.name).toBe('pods');
  });

  it('returns null when missing', () => {
    expect(findTreeNodeById(tree, '/missing/')).toBeNull();
  });
});

describe('treeNodeNeedsLoad', () => {
  it('detects placeholder children', () => {
    expect(treeNodeNeedsLoad({
      id: '/a/',
      name: 'a',
      children: [{ id: '/a/__loading', name: 'loading' }],
    })).toBe(true);
  });

  it('returns false when children are loaded', () => {
    expect(treeNodeNeedsLoad({
      id: '/a/',
      name: 'a',
      children: [{ id: '/a/b', name: 'b' }],
    })).toBe(false);
  });
});

describe('markTreePathExpanded', () => {
  it('sets defaultExpanded on nodes in the path', () => {
    const tree: TreeViewDataItem[] = [
      {
        id: '/registry/',
        name: 'registry',
        children: [{ id: '/registry/pods/', name: 'pods' }],
      },
    ];
    const result = markTreePathExpanded(tree, new Set(['/registry/']));
    expect(result[0].defaultExpanded).toBe(true);
    expect(result[0].children?.[0].defaultExpanded).toBeUndefined();
  });
});
