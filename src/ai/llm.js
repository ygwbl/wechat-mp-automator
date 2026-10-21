'use strict';
// OpenAI 兼容接口（chat/completions、images/generations）。key 只从 .env 读。
const { env } = require('../core/config');

async function post(base, key, route, body, { fetch: fx = globalThis.fetch, timeoutMs = 180000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fx(`${base.replace(/\/+$/, '')}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${route} HTTP ${res.status}：${text.slice(0, 200)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

async function chat(messages, opts = {}) {
  const base = env('GZH_LLM_BASE_URL', { required: true });
  const key = env('GZH_LLM_KEY', { required: true });
  const model = env('GZH_LLM_MODEL', { required: true });
  const j = await post(base, key, '/chat/completions', { model, messages, temperature: opts.temperature ?? 0.7 }, opts);
  const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!c) throw new Error('模型没有返回内容');
  return c;
}

/** 返回图片 Buffer */
async function image(prompt, opts = {}) {
  const base = env('GZH_IMAGE_BASE_URL', { required: true });
  const key = env('GZH_IMAGE_KEY', { required: true });
  const model = env('GZH_IMAGE_MODEL', { required: true });
  const j = await post(base, key, '/images/generations', { model, prompt, n: 1, size: opts.size || '1536x1024' }, opts);
  const d = j.data && j.data[0];
  if (!d) throw new Error('生图接口没有返回图片');
  if (d.b64_json) return Buffer.from(d.b64_json, 'base64');
  const fx = opts.fetch || globalThis.fetch;
  const r = await fx(d.url);
  if (!r.ok) throw new Error(`下载生成的图片失败 HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

module.exports = { chat, image };
