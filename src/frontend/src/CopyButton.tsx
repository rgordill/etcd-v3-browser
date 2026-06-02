import React, { useCallback, useState } from 'react';
import { Button, Tooltip } from '@patternfly/react-core';
import { CheckIcon, CopyIcon } from '@patternfly/react-icons';

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await writeClipboard(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [text]);

  const label = copied ? 'Copied' : 'Copy';
  const tooltip = copied ? 'Copied to clipboard' : 'Copy current format to clipboard';

  return (
    <Tooltip content={tooltip}>
      <Button
        variant="secondary"
        size="sm"
        icon={copied ? <CheckIcon /> : <CopyIcon />}
        onClick={handleCopy}
        isDisabled={!text}
        aria-label={label}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
