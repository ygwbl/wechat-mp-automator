'use strict';
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const { today, now } = require('./time');

// 日志里不许出现密钥：access_token、AppSecret、Bearer、sk-xxx 一律打码
function redact(s) {
  return String(s)
    .replace(/(access_token=)[^&\s"']+/gi, '$1***')
    .replace(/("access_token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/(secret=)[^&\s"']+/gi, '$1***')
    .replace(/(Bearer\s+)\S+/gi, '$1***')
    .replace(/\bsk-[A-Za-z0-9_-]{6,}/g, 'sk-***');
}

function emit(level, parts) {
  const text = redact(parts.map((x) => (x instanceof Error ? x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  const line = `${now()} ${level} ${text}`;
  (level === 'ERR' ? console.error : console.log)(level === 'INF' ? text : `${level === 'ERR' ? '✖' : '!'} ${text}`);
  if (process.env.GZH_NO_LOGFILE) return;
  try {
    fs.mkdirSync(paths.logs(), { recursive: true });
    fs.appendFileSync(path.join(paths.logs(), `${today()}.log`), line + '\n');
  } catch { /* 写日志失败不影响主流程 */ }
}

module.exports = {
  redact,
  info: (...a) => emit('INF', a),
  warn: (...a) => emit('WRN', a),
  error: (...a) => emit('ERR', a),
};
