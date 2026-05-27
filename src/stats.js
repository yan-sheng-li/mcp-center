/**
 * Stats API Routes
 * Provides /api/stats/* endpoints for usage analytics.
 */

import {
  getOverview,
  getToolStats,
  getTimeline,
  getRecentCalls,
  cleanExpiredRecords,
} from './tracker.js';

/**
 * Register stats API routes on the HTTP server
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} pathname
 * @returns {boolean} true if the route was handled
 */
export function handleStatsRoute(req, res, pathname) {
  // GET /api/stats/overview
  if (pathname === '/api/stats/overview' && req.method === 'GET') {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const period = params.get('period') || '24h';
    const overview = getOverview(period);
    respondJson(res, 200, overview);
    return true;
  }

  // GET /api/stats/tools
  if (pathname === '/api/stats/tools' && req.method === 'GET') {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const period = params.get('period') || '24h';
    const tools = getToolStats(period);
    respondJson(res, 200, tools);
    return true;
  }

  // GET /api/stats/timeline
  if (pathname === '/api/stats/timeline' && req.method === 'GET') {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const period = params.get('period') || '7d';
    const granularity = params.get('granularity') || '1h';
    const timeline = getTimeline(period, granularity);
    respondJson(res, 200, timeline);
    return true;
  }

  // GET /api/stats/recent
  if (pathname === '/api/stats/recent' && req.method === 'GET') {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const limit = parseInt(params.get('limit') || '50', 10);
    const recent = getRecentCalls(limit);
    respondJson(res, 200, recent);
    return true;
  }

  // DELETE /api/stats/clean
  if (pathname === '/api/stats/clean' && req.method === 'DELETE') {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const before = params.get('before');
    const retentionDays = before ? parseRetentionToDays(before) : undefined;
    const deleted = cleanExpiredRecords(retentionDays);
    respondJson(res, 200, { deleted });
    return true;
  }

  return false;
}

/**
 * Parse a human-readable duration to retention days
 * @param {string} value - e.g. '7d', '30d', '90d'
 * @returns {number|undefined}
 */
function parseRetentionToDays(value) {
  const match = value.match(/^(\d+)([d])$/i);
  if (!match) return undefined;
  return parseInt(match[1], 10);
}

/**
 * Send a JSON response
 * @param {import('http').ServerResponse} res
 * @param {number} statusCode
 * @param {*} data
 */
function respondJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}
