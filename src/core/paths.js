'use strict';
const path = require('path');

// GZH_ROOT 只给测试用，正常运行就是项目根目录
function root() {
  return process.env.GZH_ROOT ? path.resolve(process.env.GZH_ROOT) : path.resolve(__dirname, '..', '..');
}

function p(...parts) {
  return path.join(root(), ...parts);
}

module.exports = {
  root,
  posts: () => p('content', 'posts'),
  covers: () => p('content', 'covers'),
  images: () => p('content', 'images'),
  data: () => p('data'),
  ledger: () => p('data', 'ledger.json'),
  media: () => p('data', 'media.json'),
  token: () => p('data', 'token.json'),
  stats: () => p('data', 'stats.csv'),
  explore: () => p('data', 'explore'),
  reports: () => p('reports'),
  dist: () => p('dist'),
  logs: () => p('logs'),
  profile: () => p('.auth'),
  env: () => p('.env'),
  config: () => p('config.json'),
};
