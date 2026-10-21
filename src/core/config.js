'use strict';
const fs = require('fs');
const paths = require('./paths');
const { readJSON } = require('./files');

const DEFAULTS = {
  author: '',
  theme: 'paper',
  // 每天推送草稿时，正文末尾自动加的固定段落（留空就不加）
  footer: {
    follow: '',
    disclaimer: '内容仅供日常生活参考，不能替代专业医疗意见。身体不适请及时就医。',
  },
  post: { minChars: 600, maxChars: 1600, titleMax: 30, digestMax: 54 },
  open_comment: true,
};

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    let v = line.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

let loaded = false;
function loadEnv() {
  if (loaded) return;
  loaded = true;
  const f = paths.env();
  if (!fs.existsSync(f)) return;
  for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(f, 'utf8')))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? deepMerge(base[k], v) : v;
  }
  return out;
}

function config() {
  loadEnv();
  return deepMerge(DEFAULTS, readJSON(paths.config(), {}));
}

function env(name, { required = false, hint = '' } = {}) {
  loadEnv();
  const v = process.env[name];
  if (required && !v) throw new Error(`缺少 ${name}，在 .env 里填上${hint ? `（${hint}）` : ''}`);
  return v || '';
}

module.exports = { config, env, parseEnv, DEFAULTS };
