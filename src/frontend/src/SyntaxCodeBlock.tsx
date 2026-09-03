import React, { useCallback, useMemo } from 'react';
import { loader } from '@monaco-editor/react';
import { CodeEditor, Language, EditorDidMount } from '@patternfly/react-code-editor';
import * as monaco from 'monaco-editor';
import { useEffectiveTheme } from './ThemeContext';
import { defaultEditorOptions, registerYamlInMonaco } from './monaco-editor-utils';

loader.config({ monaco });

export type SyntaxLanguage = 'json' | 'yaml' | 'text';

const LANGUAGE_MAP: Record<SyntaxLanguage, Language> = {
  json: Language.json,
  yaml: Language.yaml,
  text: Language.plaintext,
};

interface SyntaxCodeBlockProps {
  code: string;
  language: SyntaxLanguage;
}

/**
 * Read-only PatternFly CodeEditor with Monaco, matching OpenShift Console 4.22:
 * monaco-yaml syntax highlighting, folding ranges, and line numbers.
 */
export function SyntaxCodeBlock({ code, language }: SyntaxCodeBlockProps) {
  const effectiveTheme = useEffectiveTheme();

  const editorOptions = useMemo(
    () => ({
      ...defaultEditorOptions,
      readOnly: true,
    }),
    [],
  );

  const onEditorDidMount: EditorDidMount = useCallback(
    (editor, monacoInstance) => {
      editor.getModel()?.updateOptions({ tabSize: 2 });
      if (language === 'yaml') {
        registerYamlInMonaco(monacoInstance);
      }
      if (language === 'json') {
        editor.getAction('editor.action.formatDocument')?.run();
      }
      editor.layout();
    },
    [language],
  );

  return (
    <CodeEditor
      className="etcd-syntax-codeblock"
      code={code}
      language={LANGUAGE_MAP[language]}
      isReadOnly
      isLineNumbersVisible
      isDarkTheme={effectiveTheme === 'dark'}
      isHeaderPlain
      isLanguageLabelVisible={false}
      height="sizeToFit"
      options={editorOptions}
      onEditorDidMount={onEditorDidMount}
    />
  );
}
