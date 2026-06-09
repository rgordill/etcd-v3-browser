import React from 'react';
import { Breadcrumb, BreadcrumbItem, Button } from '@patternfly/react-core';
import { parseKeyBreadcrumbs } from './key-path';

export interface KeyBreadcrumbProps {
  keyPath: string;
  onNavigate: (path: string) => void;
}

export function KeyBreadcrumb({ keyPath, onNavigate }: KeyBreadcrumbProps) {
  const segments = parseKeyBreadcrumbs(keyPath);
  if (segments.length === 0) return null;

  return (
    <Breadcrumb aria-label="Key path" className="etcd-key-breadcrumb">
      {segments.map((segment, index) => {
        const isActive = index === segments.length - 1;
        return (
          <BreadcrumbItem key={segment.path} isActive={isActive}>
            {isActive ? (
              segment.label
            ) : (
              <Button
                variant="link"
                isInline
                className="etcd-key-breadcrumb__link"
                onClick={() => onNavigate(segment.path)}
              >
                {segment.label}
              </Button>
            )}
          </BreadcrumbItem>
        );
      })}
    </Breadcrumb>
  );
}
