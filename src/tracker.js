/**
 * Usage Tracking Module
 * Records all tool/resource/prompt calls with SQLite, provides aggregated statistics.
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { error as logError } from './log.js';

let db = null;
let cleanTimer = null;

const DEFAULT_RETENTION_DAYS = 30;
const CLEAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CLEAN_BATCH_SIZE = 1000;

/**
 * Get the default database path
 * @returns {string}
 */
export function getDefaultDbPath() {
  return resolve(homedir(), '.mcp-center', 'stats.db');
}

/**
 * Initialize the stats database
 * @param {string} [dbPath] - Optional custom database path
 */
export function initTracker(dbPath) {
  const path = dbPath || getDefaultDbPath();
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(path);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp   TEXT NOT NULL,
      type        TEXT NOT NULL,
      name        TEXT NOT NULL,
      server_name TEXT,
      arguments   TEXT,
      status      TEXT NOT NULL,
      duration_ms INTEGER,
      error_msg   TEXT,
      client_ip   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON call_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_call_logs_name ON call_logs(name);
    CREATE INDEX IF NOT EXISTS idx_call_logs_type ON call_logs(type);
    CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
  `);

  logError(`[mcp-center] Stats tracker initialized at: ${path}`);

  // Start automatic cleanup
  startAutoClean();
}

/**
 * Start the automatic cleanup timer
 */
function startAutoClean() {
  if (cleanTimer) return;

  const interval = parseInt(process.env.STATS_CLEAN_INTERVAL_MS, 10) || CLEAN_INTERVAL_MS;
  cleanTimer = setInterval(() => {
    try {
      const deleted = cleanExpiredRecords();
      if (deleted > 0) {
        logError(`[mcp-center] Cleaned ${deleted} expired stats record(s)`);
      }
    } catch (error) {
      logError('[mcp-center] Auto-clean failed:', error);
    }
  }, interval);

  // Don't prevent process exit
  if (cleanTimer.unref) cleanTimer.unref();
}

/**
 * Stop the cleanup timer and close database
 */
export function closeTracker() {
  if (cleanTimer) {
    clearInterval(cleanTimer);
    cleanTimer = null;
  }
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Record a call log entry
 * @param {object} entry
 * @param {string} entry.type - 'tool' | 'resource' | 'prompt'
 * @param {string} entry.name - Full aggregated name
 * @param {string} [entry.serverName] - Child server name
 * @param {object} [entry.arguments] - Call arguments
 * @param {string} entry.status - 'success' | 'error'
 * @param {number} [entry.durationMs] - Duration in milliseconds
 * @param {string} [entry.errorMsg] - Error message if failed
 * @param {string} [entry.clientIp] - Caller IP address
 */
export function recordCall({ type, name, serverName, arguments: args, status, durationMs, errorMsg, clientIp }) {
  if (!db) return;

  try {
    const stmt = db.prepare(`
      INSERT INTO call_logs (timestamp, type, name, server_name, arguments, status, duration_ms, error_msg, client_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      new Date().toISOString(),
      type,
      name,
      serverName || null,
      args ? JSON.stringify(args) : null,
      status,
      durationMs || null,
      errorMsg || null,
      clientIp || null
    );
  } catch (error) {
    // Never let tracking errors affect the main flow
    logError('[mcp-center] Failed to record call log:', error);
  }
}

/**
 * Clean expired records based on retention days
 * @param {number} [retentionDays]
 * @returns {number} Number of deleted records
 */
export function cleanExpiredRecords(retentionDays) {
  if (!db) return 0;

  const days = retentionDays || parseInt(process.env.STATS_RETENTION_DAYS, 10) || DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const totalDeleted = db.prepare(`SELECT COUNT(*) as cnt FROM call_logs WHERE timestamp < ?`).get(cutoff).cnt;
  if (totalDeleted === 0) return 0;

  // Batch delete to avoid long locks
  let deleted = 0;
  const deleteStmt = db.prepare(`DELETE FROM call_logs WHERE id IN (
    SELECT id FROM call_logs WHERE timestamp < ? LIMIT ?
  )`);

  while (deleted < totalDeleted) {
    const result = deleteStmt.run(cutoff, CLEAN_BATCH_SIZE);
    deleted += result.changes;
    if (result.changes === 0) break;
  }

  return deleted;
}

// ===== Query Functions =====

/**
 * Parse period string to a start timestamp
 * @param {string} period - e.g. '1h', '6h', '24h', '7d', '30d'
 * @returns {string} ISO timestamp
 */
function parsePeriod(period) {
  const match = period.match(/^(\d+)([hdm])$/);
  if (!match) {
    // Default to 24h
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { h: 3600000, d: 86400000, m: 60000 };
  return new Date(Date.now() - value * (multipliers[unit] || 3600000)).toISOString();
}

/**
 * Parse granularity string to milliseconds
 * @param {string} granularity - e.g. '1m', '5m', '15m', '1h', '6h', '1d'
 * @returns {number} Milliseconds
 */
function parseGranularity(granularity) {
  const match = granularity.match(/^(\d+)([hdm])$/);
  if (!match) return 3600000; // default 1h
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { h: 3600000, d: 86400000, m: 60000 };
  return value * (multipliers[unit] || 3600000);
}

/**
 * Get overview statistics
 * @param {string} [period='24h']
 * @returns {object}
 */
export function getOverview(period = '24h') {
  if (!db) return { totalCalls: 0, successRate: 0, avgDuration: 0, activeTools: 0, activeServers: 0 };

  const since = parsePeriod(period);

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM call_logs WHERE timestamp >= ?`).get(since).cnt;
  const success = db.prepare(`SELECT COUNT(*) as cnt FROM call_logs WHERE timestamp >= ? AND status = 'success'`).get(since).cnt;
  const avgResult = db.prepare(`SELECT AVG(duration_ms) as avg FROM call_logs WHERE timestamp >= ? AND duration_ms IS NOT NULL`).get(since);
  const activeTools = db.prepare(`SELECT COUNT(DISTINCT name) as cnt FROM call_logs WHERE timestamp >= ?`).get(since).cnt;
  const activeServers = db.prepare(`SELECT COUNT(DISTINCT server_name) as cnt FROM call_logs WHERE timestamp >= ? AND server_name IS NOT NULL`).get(since).cnt;

  return {
    totalCalls: total,
    successRate: total > 0 ? Math.round((success / total) * 100) : 0,
    avgDuration: Math.round(avgResult?.avg || 0),
    activeTools,
    activeServers,
  };
}

/**
 * Get per-tool statistics ranked by call count
 * @param {string} [period='24h']
 * @returns {Array}
 */
export function getToolStats(period = '24h') {
  if (!db) return [];

  const since = parsePeriod(period);

  return db.prepare(`
    SELECT
      name,
      server_name as serverName,
      type,
      COUNT(*) as totalCalls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
      ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as successRate,
      ROUND(AVG(duration_ms)) as avgDuration
    FROM call_logs
    WHERE timestamp >= ?
    GROUP BY name
    ORDER BY totalCalls DESC
  `).all(since);
}

/**
 * Get timeline data for trend charts
 * @param {string} [period='7d']
 * @param {string} [granularity='1h']
 * @returns {Array}
 */
export function getTimeline(period = '7d', granularity = '1h') {
  if (!db) return [];

  const since = parsePeriod(period);
  const bucketMs = parseGranularity(granularity);

  const rows = db.prepare(`
    SELECT
      timestamp,
      status,
      duration_ms
    FROM call_logs
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `).all(since);

  if (rows.length === 0) return [];

  // Group into time buckets
  const startTime = new Date(since).getTime();
  const now = Date.now();
  const buckets = [];

  for (let t = startTime; t <= now; t += bucketMs) {
    buckets.push({
      timestamp: new Date(t).toISOString(),
      total: 0,
      success: 0,
      error: 0,
      avgDuration: 0,
    });
  }

  let durations = [];
  let bucketIdx = 0;

  for (const row of rows) {
    const rowTime = new Date(row.timestamp).getTime();
    // Advance bucket index
    while (bucketIdx < buckets.length - 1 && new Date(buckets[bucketIdx + 1].timestamp).getTime() <= rowTime) {
      // Finalize current bucket
      if (durations.length > 0) {
        buckets[bucketIdx].avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      }
      durations = [];
      bucketIdx++;
    }
    if (bucketIdx >= buckets.length) break;

    buckets[bucketIdx].total++;
    if (row.status === 'success') {
      buckets[bucketIdx].success++;
    } else {
      buckets[bucketIdx].error++;
    }
    if (row.duration_ms != null) {
      durations.push(row.duration_ms);
    }
  }

  // Finalize last bucket
  if (bucketIdx < buckets.length && durations.length > 0) {
    buckets[bucketIdx].avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  return buckets;
}

/**
 * Get recent call log entries
 * @param {number} [limit=50]
 * @returns {Array}
 */
export function getRecentCalls(limit = 50) {
  if (!db) return [];

  const capped = Math.min(limit, 500);

  return db.prepare(`
    SELECT
      id,
      timestamp,
      type,
      name,
      server_name as serverName,
      status,
      duration_ms as durationMs,
      error_msg as errorMsg,
      client_ip as clientIp
    FROM call_logs
    ORDER BY id DESC
    LIMIT ?
  `).all(capped);
}
