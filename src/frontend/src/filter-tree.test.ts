/**
 * Tests for the filterTree logic used in the key browser.
 * Validates that filtering produces correct results and that
 * defaultExpanded is only set during filtering (not leaked back).
 */

export {};

interface TreeItem {
  id: string;
  name: string;
  children?: TreeItem[];
  defaultExpanded?: boolean;
}

function filterTree(items: TreeItem[], filter: string): TreeItem[] {
  if (!filter) return items;
  const lowerFilter = filter.toLowerCase();
  return items
    .map((item) => {
      const nameStr = typeof item.name === 'string' ? item.name : '';
      const nameMatch = nameStr.toLowerCase().includes(lowerFilter);
      if (item.children) {
        const filteredChildren = filterTree(item.children, filter);
        if (nameMatch || filteredChildren.length > 0) {
          return { ...item, children: filteredChildren, defaultExpanded: true };
        }
        return null;
      }
      return nameMatch ? item : null;
    })
    .filter(Boolean) as TreeItem[];
}

describe('filterTree', () => {
  const sampleTree: TreeItem[] = [
    {
      id: '/registry/',
      name: 'registry',
      children: [
        { id: '/registry/__loading', name: 'loading...' },
      ],
    },
    {
      id: '/config/',
      name: 'config',
      children: [
        { id: '/config/__loading', name: 'loading...' },
      ],
    },
    { id: '/standalone-key', name: 'standalone-key' },
  ];

  it('returns original items when filter is empty', () => {
    const result = filterTree(sampleTree, '');
    expect(result).toBe(sampleTree);
  });

  it('filters folders by name match', () => {
    const result = filterTree(sampleTree, 'registry');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('/registry/');
    expect(result[0].defaultExpanded).toBe(true);
  });

  it('filters leaves by name match', () => {
    const result = filterTree(sampleTree, 'standalone');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('/standalone-key');
    expect(result[0].defaultExpanded).toBeUndefined();
  });

  it('does not modify the original tree data', () => {
    filterTree(sampleTree, 'registry');
    expect(sampleTree[0].defaultExpanded).toBeUndefined();
    expect(sampleTree[1].defaultExpanded).toBeUndefined();
  });

  it('shows parent folders when children match', () => {
    const treeWithLoadedChildren: TreeItem[] = [
      {
        id: '/registry/',
        name: 'registry',
        children: [
          {
            id: '/registry/pods/',
            name: 'pods',
            children: [
              { id: '/registry/pods/my-pod', name: 'my-pod' },
            ],
          },
          {
            id: '/registry/services/',
            name: 'services',
            children: [
              { id: '/registry/services/my-svc', name: 'my-svc' },
            ],
          },
        ],
      },
    ];

    const result = filterTree(treeWithLoadedChildren, 'my-pod');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('/registry/');
    expect(result[0].defaultExpanded).toBe(true);
    expect(result[0].children!.length).toBe(1);
    expect(result[0].children![0].id).toBe('/registry/pods/');
    expect(result[0].children![0].defaultExpanded).toBe(true);
  });

  it('returns empty when nothing matches', () => {
    const result = filterTree(sampleTree, 'zzz-nonexistent');
    expect(result.length).toBe(0);
  });

  it('case-insensitive match', () => {
    const result = filterTree(sampleTree, 'REGISTRY');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('/registry/');
  });

  it('placeholder children do not prevent folder from appearing when folder name matches', () => {
    const result = filterTree(sampleTree, 'config');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('/config/');
    expect(result[0].defaultExpanded).toBe(true);
  });
});
