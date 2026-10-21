'use strict';
// 图片上传缓存：同一张图（按内容哈希）只传一次。data/media.json = { <sha256>: { url, media_id?, at } }
const paths = require('../core/paths');
const { readJSON, writeJSON, fileHash } = require('../core/files');
const { now } = require('../core/time');

function cache() {
  return readJSON(paths.media(), {});
}

async function remember(kind, file, upload) {
  const key = `${kind}:${fileHash(file)}`;
  const c = cache();
  if (c[key]) return c[key];
  const r = await upload(file);
  const entry = { ...r, at: now() };
  const fresh = cache();
  fresh[key] = entry;
  writeJSON(paths.media(), fresh);
  return entry;
}

/** 正文图 → { url } */
const bodyImage = (client, file) => remember('img', file, async (f) => ({ url: await client.uploadImage(f) }));
/** 封面 → { media_id, url } */
const cover = (client, file) => remember('cover', file, (f) => client.addCover(f));

module.exports = { bodyImage, cover };
