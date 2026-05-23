import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const LAYERS_DIR = path.resolve(__dirname, '..');
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
    collected.push({
      absolutePath,
      relativePath: path.relative(LAYERS_DIR, absolutePath),
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

function importsFromInternalLayer(
  content: string,
  layerPrefix: string
): boolean {
  const aliasPattern = new RegExp(
    `(?:from|import)\\s+['"]@/layers/${layerPrefix}(?:/[^'"]*)?['"]`
  );
  const relativePattern = new RegExp(
    `(?:from|import)\\s+['"](?:\\.\\.?/)+layers/${layerPrefix}(?:/[^'"]*)?['"]`
  );
  return aliasPattern.test(content) || relativePattern.test(content);
}

function referencesIdentifier(content: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`);
  return pattern.test(content);
}

const ALL_SOURCE_FILES = collectSourceFiles(LAYERS_DIR);

describe('architecture boundary', () => {
  describe('tone import boundary', () => {
    const toneImporters = ALL_SOURCE_FILES.filter(file =>
      importsModule(file.content, 'tone')
    );

    it('does not import tone from controllers/', () => {
      const offenders = toneImporters.filter(file =>
        isInsideLayer(file.relativePath, 'controllers')
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });

    it('does not import tone from core/', () => {
      const offenders = toneImporters.filter(file =>
        isInsideLayer(file.relativePath, 'core')
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });

    it('does not import tone from apps/', () => {
      const offenders = toneImporters.filter(file =>
        isInsideLayer(file.relativePath, 'apps')
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });

    it('allows tone import only from audio/tone/', () => {
      const offenders = toneImporters.filter(
        file => !isInsidePath(file.relativePath, ['audio', 'tone'])
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });
  });

  describe('indexeddb access boundary', () => {
    const idbModuleImporters = ALL_SOURCE_FILES.filter(
      file =>
        importsModule(file.content, 'idb') ||
        importsModule(file.content, 'fake-indexeddb') ||
        importsModule(file.content, 'fake-indexeddb/auto')
    );

    const indexedDbReferences = ALL_SOURCE_FILES.filter(file =>
      referencesIdentifier(file.content, 'indexedDB')
    );

    it('does not reference indexedDB outside storage/indexeddb/', () => {
      const offenders = indexedDbReferences.filter(
        file => !isInsidePath(file.relativePath, ['storage', 'indexeddb'])
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });

    it('does not import idb or fake-indexeddb outside storage/indexeddb/', () => {
      const offenders = idbModuleImporters.filter(
        file => !isInsidePath(file.relativePath, ['storage', 'indexeddb'])
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });
  });

  describe('apps depend only on controllers and testing', () => {
    const appsFiles = ALL_SOURCE_FILES.filter(file =>
      isInsideLayer(file.relativePath, 'apps')
    );

    it('apps do not import from layers/core directly', () => {
      const offenders = appsFiles.filter(file =>
        importsFromInternalLayer(file.content, 'core')
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });

    it('apps do not import from layers/audio directly', () => {
      const offenders = appsFiles.filter(file =>
        importsFromInternalLayer(file.content, 'audio')
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });

    it('apps do not import from layers/storage directly', () => {
      const offenders = appsFiles.filter(file =>
        importsFromInternalLayer(file.content, 'storage')
      );
      expect(offenders.map(file => file.relativePath)).toEqual([]);
    });

    it('apps only import from layers/controllers or layers/testing', () => {
      const allowedLayers = new Set(['controllers', 'testing']);
      const layerImportPattern =
        /(?:from|import)\s+['"](?:@\/layers|(?:\.\.?\/)+layers)\/([^/'"]+)/g;
      const offenders: string[] = [];

      for (const file of appsFiles) {
        const matches = file.content.matchAll(layerImportPattern);
        for (const match of matches) {
          const layer = match[1];
          if (!allowedLayers.has(layer)) {
            offenders.push(`${file.relativePath} → layers/${layer}`);
          }
        }
      }

      expect(offenders).toEqual([]);
    });
  });
});
