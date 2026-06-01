import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CodeBlock, CodeBlockCode, Button, Flex, FlexItem } from '@patternfly/react-core';
import { AngleRightIcon, AngleDownIcon } from '@patternfly/react-icons';
import { collectContainerPaths } from './structure-parse';
const MONO: React.CSSProperties = {
  fontFamily: 'var(--pf-t--global--font--family--mono)',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
};

export type StructureVariant = 'json' | 'yaml';

interface CollapsibleStructureProps {
  value: unknown;
  variant: StructureVariant;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function yamlKeyLabel(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ? key : JSON.stringify(key);
}

interface NodeProps {
  value: unknown;
  path: string;
  variant: StructureVariant;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  /** Object property key or array index label */
  label?: string;
  isLast?: boolean;
  /** YAML list item (leading `-`) */
  isYamlListItem?: boolean;
}

function CollapseToggle({
  path,
  collapsed,
  onToggle,
  hidden,
}: {
  path: string;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  hidden?: boolean;
}) {
  if (hidden) {
    return <span className="etcd-structure__toggle etcd-structure__toggle--placeholder" aria-hidden />;
  }

  const isCollapsed = collapsed.has(path);
  return (
    <button
      type="button"
      className="etcd-structure__toggle"
      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
      aria-expanded={!isCollapsed}
      onClick={() => onToggle(path)}
    >
      {isCollapsed ? <AngleRightIcon /> : <AngleDownIcon />}
    </button>
  );
}

function PrimitiveSpan({ value }: { value: unknown }) {
  const text = formatPrimitive(value);
  let className = 'etcd-structure__primitive';
  if (value === null) className += ' etcd-structure__null';
  else if (typeof value === 'string') className += ' etcd-structure__string';
  else if (typeof value === 'number') className += ' etcd-structure__number';
  else if (typeof value === 'boolean') className += ' etcd-structure__boolean';

  return <span className={className}>{text}</span>;
}

function CollapsedSummary({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    const n = value.length;
    return (
      <span className="etcd-structure__ellipsis">
        {`[ … ${n} item${n === 1 ? '' : 's'} ]`}
      </span>
    );
  }
  if (isPlainObject(value)) {
    const n = Object.keys(value).length;
    return (
      <span className="etcd-structure__ellipsis">
        {`{ … ${n} key${n === 1 ? '' : 's'} }`}
      </span>
    );
  }
  return <PrimitiveSpan value={value} />;
}

function StructureNode({
  value,
  path,
  variant,
  depth,
  collapsed,
  onToggle,
  label,
  isLast = true,
  isYamlListItem = false,
}: NodeProps) {
  const isCollapsed = collapsed.has(path);
  const isContainer = value !== null && typeof value === 'object';
  const indent = depth * 16;

  if (!isContainer) {
    return (
      <div className="etcd-structure__line" style={{ paddingLeft: indent }}>
        <CollapseToggle path={path} collapsed={collapsed} onToggle={onToggle} hidden />
        {isYamlListItem && <span className="etcd-structure__yaml-dash">- </span>}
        {label !== undefined && (
          <span className="etcd-structure__key">
            {variant === 'json' ? JSON.stringify(label) : yamlKeyLabel(label)}
            {variant === 'json' ? ': ' : ': '}
          </span>
        )}
        <PrimitiveSpan value={value} />
        {variant === 'json' && !isLast && <span className="etcd-structure__comma">,</span>}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: { key: string; val: unknown; index: number }[] = isArray
    ? value.map((val, index) => ({ key: String(index), val, index }))
    : Object.entries(value).map(([key, val], index) => ({ key, val, index }));

  const open = variant === 'json' ? (isArray ? '[' : '{') : '';
  const close = variant === 'json' ? (isArray ? ']' : '}') : '';

  if (isCollapsed) {
    return (
      <div className="etcd-structure__line" style={{ paddingLeft: indent }}>
        <CollapseToggle path={path} collapsed={collapsed} onToggle={onToggle} />
        {isYamlListItem && <span className="etcd-structure__yaml-dash">- </span>}
        {label !== undefined && (
          <span className="etcd-structure__key">
            {variant === 'json' ? JSON.stringify(label) : yamlKeyLabel(label)}
            {variant === 'json' ? ': ' : ': '}
          </span>
        )}
        {variant === 'json' && <span className="etcd-structure__punct">{open}</span>}
        <CollapsedSummary value={value} />
        {variant === 'json' && <span className="etcd-structure__punct">{close}</span>}
        {variant === 'json' && !isLast && <span className="etcd-structure__comma">,</span>}
      </div>
    );
  }

  return (
    <div className="etcd-structure__block">
      <div className="etcd-structure__line" style={{ paddingLeft: indent }}>
        <CollapseToggle path={path} collapsed={collapsed} onToggle={onToggle} />
        {isYamlListItem && <span className="etcd-structure__yaml-dash">- </span>}
        {label !== undefined && (
          <span className="etcd-structure__key">
            {variant === 'json' ? JSON.stringify(label) : yamlKeyLabel(label)}
            {variant === 'json' ? ': ' : ': '}
          </span>
        )}
        {variant === 'json' && <span className="etcd-structure__punct">{open}</span>}
        {entries.length === 0 && variant === 'json' && (
          <span className="etcd-structure__punct">{close}</span>
        )}
        {entries.length === 0 && variant === 'json' && !isLast && (
          <span className="etcd-structure__comma">,</span>
        )}
      </div>
      {entries.map(({ key, val, index }, i) => {
        const childPath = isArray ? `${path}[${index}]` : `${path}.${key}`;
        const last = i === entries.length - 1;
        return (
          <StructureNode
            key={childPath}
            value={val}
            path={childPath}
            variant={variant}
            depth={depth + 1}
            collapsed={collapsed}
            onToggle={onToggle}
            label={isArray ? undefined : key}
            isLast={last}
            isYamlListItem={variant === 'yaml' && isArray}
          />
        );
      })}
      {entries.length > 0 && variant === 'json' && (
        <div className="etcd-structure__line" style={{ paddingLeft: indent }}>
          <CollapseToggle path={path} collapsed={collapsed} onToggle={onToggle} hidden />
          <span className="etcd-structure__punct">{close}</span>
          {!isLast && <span className="etcd-structure__comma">,</span>}
        </div>
      )}
    </div>
  );
}

export function CollapsibleStructure({ value, variant }: CollapsibleStructureProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCollapsed(new Set());
  }, [value, variant]);

  const allContainerPaths = useMemo(() => collectContainerPaths(value), [value]);

  const onToggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    setCollapsed(new Set(allContainerPaths.filter((p) => p !== '$')));
  }, [allContainerPaths]);

  const rootIsContainer = value !== null && typeof value === 'object';

  return (
    <CodeBlock className="etcd-syntax-codeblock etcd-structure">
      <Flex
        className="etcd-structure__toolbar"
        gap={{ default: 'gapXs' }}
        style={{ padding: 'var(--pf-t--global--spacer--xs) var(--pf-t--global--spacer--sm) 0' }}
      >
        <FlexItem>
          <Button variant="link" isInline size="sm" onClick={expandAll}>
            Expand all
          </Button>
        </FlexItem>
        <FlexItem>
          <Button variant="link" isInline size="sm" onClick={collapseAll} isDisabled={!rootIsContainer}>
            Collapse all
          </Button>
        </FlexItem>
      </Flex>
      <CodeBlockCode
        style={{
          ...MONO,
          background: 'var(--pf-t--global--background--color--secondary--default)',
          padding: 'var(--pf-t--global--spacer--sm)',
          overflow: 'auto',
        }}
      >
        {rootIsContainer ? (
          <StructureNode
            value={value}
            path="$"
            variant={variant}
            depth={0}
            collapsed={collapsed}
            onToggle={onToggle}
            isLast
          />
        ) : (
          <div className="etcd-structure__line">
            <CollapseToggle path="$" collapsed={collapsed} onToggle={onToggle} hidden />
            <PrimitiveSpan value={value} />
          </div>
        )}
      </CodeBlockCode>
    </CodeBlock>
  );
}
