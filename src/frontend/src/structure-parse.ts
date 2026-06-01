import yaml from 'js-yaml';

/** Parse JSON or YAML text into a JS value for the collapsible tree viewer. */
export function tryParseStructure(code: string, language: 'json' | 'yaml'): unknown | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  try {
    if (language === 'json') {
      return JSON.parse(trimmed);
    }
    const result = yaml.load(trimmed);
    if (result === undefined) return null;
    return result;
  } catch {
    return null;
  }
}

/** Collect paths of all object/array nodes (for collapse-all). */
export function collectContainerPaths(value: unknown, path = '$'): string[] {
  if (value === null || typeof value !== 'object') {
    return [];
  }

  const paths: string[] = [path];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectContainerPaths(item, `${path}[${index}]`));
    });
  } else {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      paths.push(...collectContainerPaths(child, `${path}.${key}`));
    });
  }

  return paths;
}
