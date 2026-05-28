/**
 * Backup & Restore Module
 * Handles zip export (mcp.json + stats.db) and zip import with config reload.
 */

import { existsSync, copyFileSync, mkdirSync, writeFileSync, unlinkSync, rmSync, createReadStream, createWriteStream } from 'fs';
import { homedir } from 'os';
import { join, resolve, dirname } from 'path';
import { error as logError, log as logMessage } from './log.js';

const DATA_DIR = resolve(homedir(), '.mcp-center');
const CONFIG_FILE = join(DATA_DIR, 'mcp.json');
const STATS_FILE = join(DATA_DIR, 'stats.db');

/**
 * Generate a backup filename with timestamp
 * @returns {string}
 */
function getBackupFilename() {
  const now = new Date();
  const ts = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  return `mcp-center-backup-${ts}.zip`;
}

/**
 * Export backup as a zip stream (pipes to response)
 * Includes mcp.json and stats.db if they exist.
 * @param {import('http').ServerResponse} res
 */
export async function exportBackup(res) {
  // Lazy-load archiver (CJS module, use createRequire)
  const { createRequire } = await import('module');
  const archiver = createRequire(import.meta.url)('archiver');

  const filename = getBackupFilename();

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Write to a temp file first, then pipe to response
  const tmpFile = join(DATA_DIR, '.export-tmp.zip');
  const tmpStream = createWriteStream(tmpFile);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(tmpStream);

  // Add mcp.json
  if (existsSync(CONFIG_FILE)) {
    archive.file(CONFIG_FILE, { name: 'mcp.json' });
  }

  // Add stats.db
  if (existsSync(STATS_FILE)) {
    archive.file(STATS_FILE, { name: 'stats.db' });
  }

  archive.finalize();

  // Wait for write to finish, then stream to response
  await new Promise((resolve, reject) => {
    tmpStream.on('close', () => {
      const readStream = createReadStream(tmpFile);
      readStream.pipe(res);
      readStream.on('end', () => {
        try { unlinkSync(tmpFile); } catch (_) {}
        resolve();
      });
      readStream.on('error', reject);
    });
    tmpStream.on('error', reject);
    archive.on('error', reject);
  });

  logMessage(`[mcp-center] Backup exported: ${filename}`);
}

/**
 * Import a backup from a zip Buffer
 * Extracts mcp.json and stats.db, overwrites existing files, then triggers reload.
 * @param {Buffer} zipBuffer
 * @param {Function} reloadCallback - called after successful import to reload servers
 * @returns {Promise<{config: boolean, stats: boolean}>}
 */
export async function importBackup(zipBuffer, reloadCallback) {
  const tmpZip = join(DATA_DIR, '.import-temp.zip');
  const tmpDir = join(DATA_DIR, '.import-temp');

  try {
    // Ensure data dir exists
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    // Write uploaded zip to temp file
    writeFileSync(tmpZip, zipBuffer);

    // Extract using minimal ZIP parser (Buffer + zlib)
    const result = await extractZip(tmpZip, tmpDir);

    // Copy extracted files to actual locations
    let configRestored = false;
    let statsRestored = false;

    const extractedConfig = join(tmpDir, 'mcp.json');
    if (existsSync(extractedConfig)) {
      copyFileSync(extractedConfig, CONFIG_FILE);
      configRestored = true;
      logMessage('[mcp-center] Config restored from backup');
    }

    const extractedStats = join(tmpDir, 'stats.db');
    if (existsSync(extractedStats)) {
      copyFileSync(extractedStats, STATS_FILE);
      statsRestored = true;
      logMessage('[mcp-center] Stats database restored from backup');
    }

    if (!configRestored && !statsRestored) {
      throw new Error('Backup file contains neither mcp.json nor stats.db');
    }

    // Trigger reload if config was restored
    if (configRestored && reloadCallback) {
      reloadCallback();
    }

    return { config: configRestored, stats: statsRestored };
  } finally {
    // Cleanup temp files
    try {
      if (existsSync(tmpZip)) unlinkSync(tmpZip);
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
      // Best effort cleanup
    }
  }
}

/**
 * Minimal ZIP extraction using Buffer parsing
 * Supports STORED and DEFLATED entries (no encryption, no zip64 for simplicity)
 * @param {string} zipPath
 * @param {string} outDir
 * @returns {Promise<string[]>} list of extracted files
 */
export async function extractZip(zipPath, outDir) {
  const { readFileSync, writeFileSync: writeF, mkdirSync: mkDir, existsSync: ex } = await import('fs');
  const { join: j } = await import('path');
  const { inflateRawSync } = await import('zlib');

  const buf = readFileSync(zipPath);
  if (!ex(outDir)) mkDir(outDir, { recursive: true });

  // Parse ZIP local file headers
  const extracted = [];
  let offset = 0;

  // Helper: find the next PK signature starting from a given offset
  function findNextSignature(from) {
    const signatures = [
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),  // local header
      Buffer.from([0x50, 0x4B, 0x01, 0x02]),  // central dir
      Buffer.from([0x50, 0x4B, 0x05, 0x06]),  // EOCD
    ];
    let earliest = buf.length;
    for (const sig of signatures) {
      const idx = buf.indexOf(sig, from);
      if (idx !== -1 && idx < earliest) earliest = idx;
    }
    return earliest;
  }

  while (offset < buf.length - 4) {
    // Check for local file header signature: PK\x03\x04
    if (buf[offset] !== 0x50 || buf[offset + 1] !== 0x4B || buf[offset + 2] !== 0x03 || buf[offset + 3] !== 0x04) {
      break;
    }

    // Parse local file header (30 bytes + variable)
    const compressionMethod = buf.readUInt16LE(offset + 8);
    let compressedSize = buf.readUInt32LE(offset + 18);
    const fileNameLength = buf.readUInt16LE(offset + 26);
    const extraFieldLength = buf.readUInt16LE(offset + 28);

    const fileName = buf.toString('utf-8', offset + 30, offset + 30 + fileNameLength);
    const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

    // Handle data descriptors (compressedSize=0 in local header)
    let compressedData;
    if (compressedSize === 0) {
      // Look for data descriptor signature after the file data
      const dataDescSig = Buffer.from([0x50, 0x4B, 0x07, 0x08]);
      const dataDescPos = buf.indexOf(dataDescSig, dataOffset);
      if (dataDescPos !== -1) {
        // Data descriptor: sig(4) + crc32(4) + compressedSize(4) + uncompressedSize(4) = 16 bytes
        compressedSize = buf.readUInt32LE(dataDescPos + 8);
        compressedData = buf.subarray(dataOffset, dataDescPos);
        offset = dataDescPos + 16;
      } else {
        // Fallback: use gap to next known signature
        const nextSig = findNextSignature(dataOffset);
        compressedSize = nextSig - dataOffset;
        compressedData = buf.subarray(dataOffset, nextSig);
        offset = nextSig;
      }
    } else {
      compressedData = buf.subarray(dataOffset, dataOffset + compressedSize);
      offset = dataOffset + compressedSize;
    }

    // Skip directories, hidden files (macOS __MACOSX)
    if (fileName.endsWith('/') || fileName.startsWith('__MACOSX') || fileName.startsWith('.')) {
      continue;
    }

    // Decompress if DEFLATED, use raw if STORED
    let fileData;
    if (compressionMethod === 0) {
      // STORED
      fileData = compressedData;
    } else if (compressionMethod === 8) {
      // DEFLATED
      fileData = inflateRawSync(compressedData);
    } else {
      logError(`[mcp-center] Unsupported compression method ${compressionMethod} for ${fileName}, skipping`);
      continue;
    }

    const filePath = j(outDir, fileName);
    const fileDir = dirname(filePath);
    if (!ex(fileDir)) mkDir(fileDir, { recursive: true });

    writeF(filePath, fileData);
    extracted.push(fileName);
  }

  if (extracted.length === 0) {
    throw new Error('No valid files found in the ZIP archive');
  }

  return extracted;
}

/**
 * Parse a multipart form to extract the first file
 * Uses raw boundary parsing to avoid adding dependencies like formidable/multer
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{filename: string, data: Buffer}>}
 */
export function parseMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+?)(?:;|$)/);
    if (!boundaryMatch) {
      return reject(new Error('No boundary found in Content-Type'));
    }

    const boundary = '--' + boundaryMatch[1];
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const result = extractFileFromMultipart(body, boundary);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Extract the first file from a multipart body buffer
 * @param {Buffer} body
 * @param {string} boundary
 * @returns {{filename: string, data: Buffer}}
 */
function extractFileFromMultipart(body, boundary) {
  const bodyStr = body.toString('latin1'); // Preserve binary
  const boundaryBuffer = Buffer.from(boundary + '\r\n');
  const endBoundaryBuffer = Buffer.from(boundary + '--');

  let partStart = body.indexOf(boundaryBuffer);
  if (partStart === -1) throw new Error('Invalid multipart data');

  // Move past boundary
  partStart += boundaryBuffer.length;

  // Find the end of headers (blank line)
  const headerEnd = body.indexOf('\r\n\r\n', partStart);
  if (headerEnd === -1) throw new Error('Invalid multipart headers');

  const headerStr = body.toString('utf-8', partStart, headerEnd);

  // Extract filename from Content-Disposition
  const filenameMatch = headerStr.match(/filename="([^"]+)"/);
  if (!filenameMatch) throw new Error('No filename found in multipart data');
  const filename = filenameMatch[1];

  // File data starts after \r\n\r\n
  const dataStart = headerEnd + 4;

  // Find end boundary
  const endBoundary = body.indexOf(endBoundaryBuffer, dataStart);
  if (endBoundary === -1) throw new Error('No end boundary found');

  // Remove trailing \r\n before boundary
  const dataEnd = endBoundary - 2;

  const fileData = body.subarray(dataStart, dataEnd);

  return { filename, data: fileData };
}
