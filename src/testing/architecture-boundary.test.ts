import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SOURCE_DIR = path.resolve(__dirname, '..');
const SELF_FILE = path.resolve(__filename);

interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  content: string;
}

function collectSourceFiles(rootDir: string): ScannedFile[] {
  const collected: ScannedFile[] = [];
  for (const entry of readdirSync(rootDir)) {
    const absolutePath = path.join(rootDir, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      collected.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (absolutePath === SELF_FILE) continue;
    if (!absolutePath.endsWith('.ts') && !absolutePath.endsWith('.tsx')) {
      continue;
    }
    if (
      absolutePath.endsWith('.test.ts') ||
      absolutePath.endsWith('.test.tsx')
    ) {
      continue;
    }
    collected.push({
      absolutePath,
      relativePath: path.relative(SOURCE_DIR, absolutePath),
      content: readFileSync(absolutePath, 'utf8'),
    });
  }
  return collected;
}

function isInsideLayer(relativePath: string, layerPrefix: string): boolean {
  return relativePath.split(path.sep)[0] === layerPrefix;
}

function isInsidePath(relativePath: string, parts: readonly string[]): boolean {
  const segments = relativePath.split(path.sep);
  return parts.every((part, index) => segments[index] === part);
}

function importsModule(content: string, moduleName: string): boolean {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:from|import)\\s+['"]${escaped}(?:/[^'"]*)?['"]`
  );
  return pattern.test(content);
}

function getImportSpecifiers(content: string): string[] {
  const pattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  const specifiers: string[] = [];

  for (const match of content.matchAll(pattern)) {
    specifiers.push(match[1] ?? match[2]);
  }

  return specifiers;
}

function toPosixPath(input: string): string {
  return input.split(path.sep).join('/');
}

function resolveInternalImport(
  file: ScannedFile,
  specifier: string
): string | null {
  if (specifier.startsWith('@/')) {
    return specifier.slice(2);
  }

  if (!specifier.startsWith('.')) {
    return null;
  }

  const absoluteImportPath = path.resolve(
    path.dirname(file.absolutePath),
    specifier
  );
  const relativeImportPath = path.relative(SOURCE_DIR, absoluteImportPath);

  if (relativeImportPath.startsWith('..')) {
    return null;
  }

  return toPosixPath(relativeImportPath);
}

function resolvedInternalImports(file: ScannedFile): string[] {
  return getImportSpecifiers(file.content)
    .map((specifier) => resolveInternalImport(file, specifier))
    .filter((specifier): specifier is string => specifier !== null);
}

function importsFromInternalLayer(
  file: ScannedFile,
  layerPrefix: string
): boolean {
  return resolvedInternalImports(file).some(
    (specifier) =>
      specifier === layerPrefix || specifier.startsWith(`${layerPrefix}/`)
  );
}

const ALL_SOURCE_FILES = collectSourceFiles(SOURCE_DIR);

describe('architecture boundary', () => {
  describe('tone import boundary', () => {
    const toneImporters = ALL_SOURCE_FILES.filter((file) =>
      importsModule(file.content, 'tone')
    );

    it('does not import tone from controllers/', () => {
      const offenders = toneImporters.filter((file) =>
        isInsideLayer(file.relativePath, 'controllers')
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });

    it('does not import tone from session/', () => {
      const offenders = toneImporters.filter((file) =>
        isInsideLayer(file.relativePath, 'session')
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });

    it('does not import tone from apps/', () => {
      const offenders = toneImporters.filter((file) =>
        isInsideLayer(file.relativePath, 'apps')
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });

    it('allows tone import only from audio-engine/tone/', () => {
      const offenders = toneImporters.filter(
        (file) => !isInsidePath(file.relativePath, ['audio-engine', 'tone'])
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });
  });

  describe('controllers use IAudioEngine interface only', () => {
    const controllerFiles = ALL_SOURCE_FILES.filter((file) =>
      isInsideLayer(file.relativePath, 'controllers')
    );

    function importsAudioEnginePath(
      file: ScannedFile,
      audioSubpath: string
    ): boolean {
      const target = `audio-engine/${audioSubpath}`;
      return resolvedInternalImports(file).some(
        (specifier) =>
          specifier === target || specifier.startsWith(`${target}/`)
      );
    }

    it('controllers do not import FakeAudioEngine', () => {
      const offenders = controllerFiles.filter((file) =>
        importsAudioEnginePath(file, 'fake-audio-engine')
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });

    it('controllers do not import from audio-engine/tone', () => {
      const offenders = controllerFiles.filter((file) =>
        importsAudioEnginePath(file, 'tone')
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });
  });

  describe('apps depend only on apps, controllers, composition, or testing', () => {
    const appsFiles = ALL_SOURCE_FILES.filter((file) =>
      isInsideLayer(file.relativePath, 'apps')
    );

    it('apps do not import from session directly', () => {
      const offenders = appsFiles.filter((file) =>
        importsFromInternalLayer(file, 'session')
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });

    it('apps do not import from audio-engine directly', () => {
      const offenders = appsFiles.filter((file) =>
        importsFromInternalLayer(file, 'audio-engine')
      );
      expect(offenders.map((file) => file.relativePath)).toEqual([]);
    });

    it('apps only import from allowed top-level modules', () => {
      const allowedLayers = new Set([
        'apps',
        'controllers',
        'composition',
        'testing',
      ]);
      const offenders: string[] = [];

      for (const file of appsFiles) {
        for (const specifier of resolvedInternalImports(file)) {
          const layer = specifier.split('/')[0];
          if (!allowedLayers.has(layer)) {
            offenders.push(`${file.relativePath} -> ${specifier}`);
          }
        }
      }

      expect(offenders).toEqual([]);
    });
  });
});
