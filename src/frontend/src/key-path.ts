import { TreeViewDataItem } from '@patternfly/react-core';

export interface KeyBreadcrumbSegment {
  label: string;
  path: string;
  isLeaf: boolean;
}

/**
 * Split an etcd key into breadcrumb segments.
 * Folder paths use a trailing slash; the leaf uses the full key.
 */
export function parseKeyBreadcrumbs(key: string): KeyBreadcrumbSegment[] {
  if (!key) return [];

  const parts = key.split('/').filter(Boolean);
  if (parts.length === 0) {
    return [{ label: key, path: key, isLeaf: true }];
  }

  const segments: KeyBreadcrumbSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const path = isLast
      ? key
      : `/${parts.slice(0, i + 1).join('/')}/`;
    segments.push({ label: parts[i], path, isLeaf: isLast });
  }
  return segments;
}

/** Folder prefixes that must be loaded/expanded to reveal a key in the tree. */
export function getFolderPrefixesForKey(key: string): string[] {
  if (!key) return [];

  const parts = key.split('/').filter(Boolean);
  if (parts.length === 0) return [];

  if (key.endsWith('/')) {
    return parts.map((_, i) => `/${parts.slice(0, i + 1).join('/')}/`);
  }

  if (parts.length === 1) return [];
  return parts.slice(0, -1).map((_, i) => `/${parts.slice(0, i + 1).join('/')}/`);
}

export function findTreeNodeById(
  nodes: TreeViewDataItem[],
  id: string,
): TreeViewDataItem | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findTreeNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function treeNodeNeedsLoad(node: TreeViewDataItem | null): boolean {
  if (!node?.children) return false;
  return node.children.length === 1 && Boolean(node.children[0].id?.endsWith('__loading'));
}

export function markTreePathExpanded(
  nodes: TreeViewDataItem[],
  expandedIds: Set<string>,
): TreeViewDataItem[] {
  return nodes.map((node) => {
    const children = node.children
      ? markTreePathExpanded(node.children, expandedIds)
      : undefined;
    const onPath = Boolean(node.id && expandedIds.has(node.id));
    if (onPath) {
      return { ...node, children, defaultExpanded: true };
    }
    if (children !== node.children) {
      return { ...node, children };
    }
    return node;
  });
}
