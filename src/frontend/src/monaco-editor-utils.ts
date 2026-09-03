import type { editor } from 'monaco-editor';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { configureMonacoYaml } from 'monaco-yaml';

/** Default Monaco options aligned with OpenShift Console YAML editor. */
export const defaultEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  scrollBeyondLastLine: false,
  tabSize: 2,
  folding: true,
  foldingStrategy: 'auto',
  showFoldingControls: 'mouseover',
  fontSize: 14,
  minimap: { enabled: false },
  renderValidationDecorations: 'off',
  stickyScroll: { enabled: true },
};

let yamlLanguageRegistered = false;

/** Register monaco-yaml for syntax highlighting and folding ranges. */
export function registerYamlInMonaco(monaco: typeof Monaco): void {
  if (yamlLanguageRegistered) {
    return;
  }
  if (monaco.languages.getLanguages().filter((lang) => lang.id === 'yaml').length <= 1) {
    configureMonacoYaml(monaco, {
      validate: false,
      completion: false,
      hover: false,
    });
    yamlLanguageRegistered = true;
  }
}
