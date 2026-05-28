/**
 * Tests for backup extractZip functionality
 * Creates test zip files using a temporary CJS helper script
 */

import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { extractZip } from '../src/backup.js';

const __filename = fileURLToPath(import.meta.url);
const TEST_DIR = resolve(tmpdir(), 'mcp-center-backup-test-' + Date.now());

beforeAll(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
});

/**
 * Create a ZIP file using a temporary CJS helper script with archiver
 */
function createTestZip(files, zipPath) {
  // Write a CJS helper script to the project dir (where node_modules/archiver exists)
  const projectDir = resolve(__filename, '..', '..');
  const helperPath = join(projectDir, '_test_zip_helper.cjs');
  const filesJson = JSON.stringify(files);

  writeFileSync(helperPath, `
const archiver = require('archiver');
const fs = require('fs');
const path = process.argv[2];
const files = JSON.parse(process.argv[3]);

const output = fs.createWriteStream(path);
const archive = archiver('zip', { zlib: { level: 0 } });
archive.pipe(output);

for (const f of files) {
  archive.append(Buffer.from(f.content, 'utf-8'), { name: f.name });
}

archive.finalize();
archive.on('close', () => process.exit(0));
archive.on('error', () => process.exit(1));
`, 'utf-8');

  execFileSync('node', [helperPath, zipPath, filesJson], { stdio: 'pipe', timeout: 5000 });

  // Verify file was created
  if (!existsSync(zipPath)) {
    throw new Error('Failed to create test zip file');
  }
}

describe('extractZip', () => {
  test('extracts files from a real zip', async () => {
    const outDir = join(TEST_DIR, 'test1');
    const zipPath = join(TEST_DIR, 'test1.zip');

    createTestZip([
      { name: 'mcp.json', content: '{"servers":[{"name":"test"}]}' },
      { name: 'stats.db', content: 'SQLite format 3' },
    ], zipPath);

    const extracted = await extractZip(zipPath, outDir);
    expect(extracted.sort()).toEqual(['mcp.json', 'stats.db'].sort());
    expect(readFileSync(join(outDir, 'mcp.json'), 'utf-8')).toBe('{"servers":[{"name":"test"}]}');
    expect(existsSync(join(outDir, 'stats.db'))).toBe(true);
  });

  test('extracts a single config file', async () => {
    const outDir = join(TEST_DIR, 'test2');
    const zipPath = join(TEST_DIR, 'test2.zip');

    createTestZip([
      { name: 'mcp.json', content: '{"servers":[],"profiles":[{"name":"dev","servers":["s1"]}]}' },
    ], zipPath);

    const extracted = await extractZip(zipPath, outDir);
    expect(extracted).toEqual(['mcp.json']);
    expect(readFileSync(join(outDir, 'mcp.json'), 'utf-8')).toContain('"profiles"');
  });

  test('skips __MACOSX and hidden entries', async () => {
    const outDir = join(TEST_DIR, 'test3');
    const zipPath = join(TEST_DIR, 'test3.zip');

    createTestZip([
      { name: '__MACOSX/._mcp.json', content: 'junk data' },
      { name: '.DS_Store', content: 'junk' },
      { name: 'mcp.json', content: '{"servers":[]}' },
    ], zipPath);

    const extracted = await extractZip(zipPath, outDir);
    expect(extracted).toEqual(['mcp.json']);
    expect(existsSync(join(outDir, '__MACOSX'))).toBe(false);
  });

  test('throws on zip with no regular files', async () => {
    const outDir = join(TEST_DIR, 'test4');
    const zipPath = join(TEST_DIR, 'test4.zip');

    createTestZip([
      { name: 'somedir/', content: '' },
    ], zipPath);

    await expect(extractZip(zipPath, outDir)).rejects.toThrow('No valid files found');
  });

  test('throws on invalid file (not a zip)', async () => {
    const outDir = join(TEST_DIR, 'test5');
    const zipPath = join(TEST_DIR, 'not-a-zip.txt');

    writeFileSync(zipPath, 'this is not a zip file at all');

    await expect(extractZip(zipPath, outDir)).rejects.toThrow();
  });
});
