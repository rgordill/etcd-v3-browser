import React, { useMemo } from 'react';
import { Highlight, themes, Language } from 'prism-react-renderer';
import { CodeBlock, CodeBlockCode } from '@patternfly/react-core';
import { useEffectiveTheme } from './ThemeContext';
import { CollapsibleStructure } from './CollapsibleStructure';
import { tryParseStructure } from './structure-parse';

export type SyntaxLanguage = 'json' | 'yaml' | 'text';

const MONO: React.CSSProperties = {
  fontFamily: 'var(--pf-t--global--font--family--mono)',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
};

interface SyntaxCodeBlockProps {
  code: string;
  language: SyntaxLanguage;
}

/**
 * PatternFly CodeBlock with collapsible tree for JSON/YAML, or Prism highlighting as fallback.
 * Automatically picks a light or dark Prism theme to match the app theme.
 */
export function SyntaxCodeBlock({ code, language }: SyntaxCodeBlockProps) {
  const effectiveTheme = useEffectiveTheme();

  const parsedStructure = useMemo(() => {
    if (language === 'json' || language === 'yaml') {
      return tryParseStructure(code, language);
    }
    return null;
  }, [code, language]);

  if ((language === 'json' || language === 'yaml') && parsedStructure !== null) {
    return <CollapsibleStructure value={parsedStructure} variant={language} />;
  }

  if (language === 'text' || !code) {
    return (
      <CodeBlock>
        <CodeBlockCode style={MONO}>{code}</CodeBlockCode>
      </CodeBlock>
    );
  }

  const prismLang = language as Language;
  const prismTheme = effectiveTheme === 'dark' ? themes.vsDark : themes.github;

  return (
    <Highlight theme={prismTheme} code={code} language={prismLang}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <CodeBlock className="etcd-syntax-codeblock">
          <CodeBlockCode
            className={className}
            style={{
              ...style,
              ...MONO,
              background: 'var(--pf-t--global--background--color--secondary--default)',
              padding: 'var(--pf-t--global--spacer--sm)',
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, background: 'transparent' }}>
              {tokens.map((line, lineIndex) => (
                <div key={lineIndex} {...getLineProps({ line })}>
                  {line.map((token, tokenIndex) => (
                    <span key={tokenIndex} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          </CodeBlockCode>
        </CodeBlock>
      )}
    </Highlight>
  );
}
