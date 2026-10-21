'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw new Error(`${file} 不是合法 JSON：${e.message}`);
  }
}

/** 先写临时文件再改名：断电或被杀进程也不会留下写了一半的文件 */
function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

const writeJSON = (file, data) => writeAtomic(file, JSON.stringify(data, null, 2) + '\n');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fileHash = (file) => sha256(fs.readFileSync(file));

module.exports = { readJSON, writeJSON, writeAtomic, sha256, fileHash };
