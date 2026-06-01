import yaml from 'js-yaml';

export interface ParsedJson {
  parsed: unknown;
  formatted: string;
}

/**
 * Returns parsed JSON when the text value is valid JSON (object, array, or primitive).
 */
export function parseJsonText(value: string): ParsedJson | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return {
      parsed,
      formatted: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return null;
  }
}

/** Convert a parsed JSON value to YAML for display. */
export function jsonToYaml(parsed: unknown): string {
  return yaml.dump(parsed, { lineWidth: -1, noRefs: true, sortKeys: false });
}
