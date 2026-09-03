// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';

window.matchMedia = window.matchMedia || function matchMedia(query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };
};

jest.mock('@patternfly/react-code-editor', () => {
  const React = require('react');
  return {
    Language: {
      json: 'json',
      yaml: 'yaml',
      plaintext: 'plaintext',
    },
    CodeEditor: ({ code, language }: { code?: string; language?: string }) =>
      React.createElement('pre', { 'data-testid': 'monaco-code-editor', 'data-language': language }, code),
  };
});

jest.mock('@monaco-editor/react', () => ({
  loader: { config: jest.fn() },
}));
