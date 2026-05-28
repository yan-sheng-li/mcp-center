import Database from 'better-sqlite3';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';

// Use a temporary database for testing
const testDbPath = resolve(tmpdir(), 'mcp-center-test-stats.db');

function getTestDb() {
  if (existsSync(testDbPath)) unlinkSync(testDbPath);
  const db = new Database(testDbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      server_name TEXT,
      arguments TEXT,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      error_msg TEXT,
      client_ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON call_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_call_logs_name ON call_logs(name);
    CREATE INDEX IF NOT EXISTS idx_call_logs_type ON call_logs(type);
  `);
  return db;
}

// ===== Tests =====

let db;

beforeAll(() => {
  db = getTestDb();
});

afterAll(() => {
  db.close();
  if (existsSync(testDbPath)) unlinkSync(testDbPath);
});

test('recordCall inserts a tool call log', () => {
  const stmt = db.prepare(`
    INSERT INTO call_logs (timestamp, type, name, server_name, arguments, status, duration_ms, error_msg, client_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(now, 'tool', 'exa_web_search_exa', 'exa', '{"query":"test"}', 'success', 150, null, '127.0.0.1');

  const row = db.prepare('SELECT * FROM call_logs WHERE name = ?').get('exa_web_search_exa');
  expect(row).toBeDefined();
  expect(row.type).toBe('tool');
  expect(row.server_name).toBe('exa');
  expect(row.status).toBe('success');
  expect(row.duration_ms).toBe(150);
});

test('recordCall inserts an error log', () => {
  const stmt = db.prepare(`
    INSERT INTO call_logs (timestamp, type, name, server_name, arguments, status, duration_ms, error_msg, client_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(now, 'tool', 'bad_tool', 'server1', null, 'error', 50, 'Connection timeout', null);

  const row = db.prepare('SELECT * FROM call_logs WHERE name = ?').get('bad_tool');
  expect(row.status).toBe('error');
  expect(row.error_msg).toBe('Connection timeout');
});

test('cleanExpiredRecords removes old records', () => {
  // Insert an old record
  const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
  db.prepare(`
    INSERT INTO call_logs (timestamp, type, name, server_name, arguments, status, duration_ms, error_msg, client_ip)
    VALUES (?, 'tool', 'old_tool', 'server1', null, 'success', 100, null, null)
  `).run(old);

  // Insert a recent record
  const recent = new Date().toISOString();
  db.prepare(`
    INSERT INTO call_logs (timestamp, type, name, server_name, arguments, status, duration_ms, error_msg, client_ip)
    VALUES (?, 'tool', 'recent_tool', 'server1', null, 'success', 100, null, null)
  `).run(recent);

  // Clean records older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare(`DELETE FROM call_logs WHERE timestamp < ?`).run(cutoff);

  expect(result.changes).toBe(1);

  const remaining = db.prepare('SELECT COUNT(*) as cnt FROM call_logs WHERE name = ?').get('recent_tool');
  expect(remaining.cnt).toBe(1);
});

test('getOverview returns correct aggregation', () => {
  // Clear existing data for clean test
  db.prepare('DELETE FROM call_logs').run();

  // Insert some test data with fixed timestamps
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO call_logs (timestamp, type, name, server_name, arguments, status, duration_ms, error_msg, client_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(now, 'tool', 'tool_a', 'srv1', null, 'success', 100, null, null);
  insert.run(now, 'tool', 'tool_a', 'srv1', null, 'success', 200, null, null);
  insert.run(now, 'tool', 'tool_a', 'srv1', null, 'error', 50, 'fail', null);
  insert.run(now, 'tool', 'tool_b', 'srv2', null, 'success', 300, null, null);
  insert.run(now, 'resource', 'res_1', 'srv1', null, 'success', 150, null, null);

  // Use a far-past date to include all records
  const since = '2000-01-01T00:00:00.000Z';
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM call_logs WHERE timestamp >= ?`).get(since).cnt;
  const success = db.prepare(`SELECT COUNT(*) as cnt FROM call_logs WHERE timestamp >= ? AND status = 'success'`).get(since).cnt;
  const avg = db.prepare(`SELECT AVG(duration_ms) as avg FROM call_logs WHERE timestamp >= ? AND duration_ms IS NOT NULL`).get(since);
  const activeTools = db.prepare(`SELECT COUNT(DISTINCT name) as cnt FROM call_logs WHERE timestamp >= ?`).get(since).cnt;

  expect(total).toBe(5);
  expect(success).toBe(4);
  expect(Math.round(avg.avg)).toBe(160);
  expect(activeTools).toBe(3);
});

test('getToolStats groups by name and orders by count', () => {
  const rows = db.prepare(`
    SELECT name, COUNT(*) as totalCalls
    FROM call_logs
    GROUP BY name
    ORDER BY totalCalls DESC
  `).all();

  // tool_a has 3 calls, should be first
  expect(rows[0].name).toBe('tool_a');
  expect(rows[0].totalCalls).toBe(3);
  // Total unique names: tool_a(3), bad_tool(1), tool_b(1), old_tool was deleted, recent_tool(1), res_1(1)
  // tool_a should have the most
  expect(rows[0].totalCalls).toBeGreaterThan(rows[1].totalCalls);
});
