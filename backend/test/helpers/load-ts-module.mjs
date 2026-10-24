import ts from 'typescript';
import { readFileSync } from 'node:fs';

const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

/** Load the real TS services with a supplied persistence boundary; no database/credentials. */
export function moduleUrl(file, aliases = new Map(), cache = new Map()) {
  const key = file.href;
  if (cache.has(key)) return cache.get(key);
  let output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  output = output.replace(/from\s+['"]([^'"]+)['"]/g, (_, specifier) => {
    const alias = aliases.get(specifier) ?? aliases.get(new URL(specifier, file).href);
    if (alias) return `from '${alias}'`;
    if (specifier.startsWith('.')) return `from '${moduleUrl(new URL(specifier.replace(/\.js$/, '.ts'), file), aliases, cache)}'`;
    throw new Error(`Unmocked dependency: ${specifier}`);
  });
  const url = dataUrl(output + `
//# sourceURL=${file.href}`);
  cache.set(key, url);
  return url;
}

export { dataUrl };
