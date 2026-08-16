'use strict';

// ANSI colour helpers (no extra dependency)
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const GREY   = '\x1b[90m';

function statusColor(code) {
  if (code >= 500) return RED;
  if (code >= 400) return YELLOW;
  if (code >= 300) return CYAN;
  return GREEN;
}

function methodColor(method) {
  const map = { GET: GREEN, POST: CYAN, PUT: YELLOW, PATCH: YELLOW, DELETE: RED };
  return map[method] || GREY;
}

/**
 * requestLogger – Express middleware
 * Logs: timestamp | method | path | status | duration | IP
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const ts    = new Date().toISOString();
  const ip    = req.ip || req.socket?.remoteAddress || 'unknown';

  // Hook into the response `finish` event so we capture the real status code
  res.on('finish', () => {
    const ms     = Date.now() - start;
    const code   = res.statusCode;
    const method = req.method;
    const url    = req.originalUrl;

    const line = [
      `${GREY}${ts}${RESET}`,
      `${BOLD}${methodColor(method)}${method.padEnd(7)}${RESET}`,
      `${CYAN}${url}${RESET}`,
      `${statusColor(code)}${code}${RESET}`,
      `${ms}ms`,
      `${GREY}[${ip}]${RESET}`,
    ].join('  ');

    console.log(line);
  });

  next();
}

/**
 * dbQueryLogger – thin wrapper used in initDB.js and future route handlers.
 * Call before every pool.query / pool.execute so all SQL is traceable.
 *
 * @param {string} sql   – The SQL statement being executed
 * @param {any[]}  [params] – Bound parameters (optional, not logged in prod)
 */
function dbQueryLogger(sql, params = []) {
  const ts = new Date().toISOString();
  const snippet = sql.replace(/\s+/g, ' ').trim().slice(0, 120);

  if (process.env.NODE_ENV === 'production') {
    // In production, log query type only (no raw SQL to avoid leaking data)
    const keyword = snippet.split(' ')[0].toUpperCase();
    console.log(`${GREY}${ts}${RESET}  ${YELLOW}[SQL]${RESET}  ${keyword} query executed`);
  } else {
    console.log(`${GREY}${ts}${RESET}  ${YELLOW}[SQL]${RESET}  ${snippet}`);
    if (params.length) {
      console.log(`${GREY}       params: ${JSON.stringify(params)}${RESET}`);
    }
  }
}

module.exports = { requestLogger, dbQueryLogger };
