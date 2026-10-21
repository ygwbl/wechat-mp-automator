'use strict';
// 微信公众平台官方接口（https://api.weixin.qq.com）。只用这几个：
//   stable_token               获取 access_token（缓存，提前 5 分钟刷新）
//   media/uploadimg            正文图片 → mmbiz URL
//   material/add_material      封面 → 永久素材 media_id
//   draft/add / draft/get / draft/batchget / draft/delete
//   freepublish/batchget       已发布列表（只含通过「发布」接口或后台发表的内容）
//
// 未认证的个人号也能用草稿箱接口；群发（推送给粉丝）没有接口，要在手机或后台点。
// 调用前必须在 公众号后台 → 设置与开发 → 基本配置 → IP 白名单 加上本机公网 IP。
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const { readJSON, writeJSON } = require('../core/files');
const { env } = require('../core/config');

const BASE = 'https://api.weixin.qq.com';

const HINTS = {
  40001: 'AppSecret 错误，或 access_token 失效',
  40013: 'AppID 不对',
  40125: 'AppSecret 不对',
  40164: '本机 IP 不在白名单：公众号后台 → 设置与开发 → 基本配置 → IP 白名单，加上本机公网 IP',
  61004: '本机 IP 不在白名单（同 40164）',
  41001: '缺少 access_token',
  42001: 'access_token 过期',
  45009: '接口今日调用次数用完了',
  48001: '这个号没有该接口权限（未认证账号部分接口不开放）',
  40007: 'media_id 无效（素材被删了？）',
  45002: '正文太长',
  45003: '标题太长',
  45004: '摘要太长',
  40113: '不支持的图片格式',
  40006: '图片太大',
  53404: '账号已被限制群发',
};

class WxError extends Error {
  constructor(code, msg, api) {
    super(`微信接口 ${api} 返回 ${code}：${HINTS[code] || msg}`);
    this.code = code;
    this.api = api;
  }
}

function makeClient({ fetch: fx = globalThis.fetch, appid, secret, tokenFile = paths.token(), now = () => Date.now() } = {}) {
  appid = appid || env('WECHAT_APPID', { required: true, hint: '公众号后台 → 设置与开发 → 基本配置' });
  secret = secret || env('WECHAT_SECRET', { required: true, hint: '同上，开发者密码 AppSecret' });

  async function call(api, opts = {}) {
    const { method = 'GET', query = {}, json, form, raw = false, auth = true, retried = false } = opts;
    const q = new URLSearchParams(query);
    if (auth) q.set('access_token', await token());
    const url = `${BASE}${api}?${q}`;
    const init = { method };
    if (json) {
      init.method = 'POST';
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(json);
    } else if (form) {
      init.method = 'POST';
      init.body = form;
    }
    const res = await fx(url, init);
    if (raw) return res;
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); } catch { throw new Error(`微信接口 ${api} 返回的不是 JSON：HTTP ${res.status}`); }
    if (j.errcode) {
      // token 失效：清缓存重拿一次（FormData 不能复用，表单请求不重试）
      if (auth && !retried && !form && (j.errcode === 40001 || j.errcode === 42001)) {
        clearToken();
        return call(api, { ...opts, retried: true });
      }
      throw new WxError(j.errcode, j.errmsg, api);
    }
    return j;
  }

  function clearToken() {
    try { fs.unlinkSync(tokenFile); } catch { /* 没有就算了 */ }
  }

  async function token() {
    const cached = readJSON(tokenFile, null);
    if (cached && cached.appid === appid && cached.expiresAt - 5 * 60000 > now()) return cached.token;
    const j = await call('/cgi-bin/stable_token', {
      auth: false,
      json: { grant_type: 'client_credential', appid, secret, force_refresh: false },
    });
    writeJSON(tokenFile, { appid, token: j.access_token, expiresAt: now() + j.expires_in * 1000 });
    return j.access_token;
  }

  function fileForm(file, field = 'media', extra = {}) {
    const fd = new FormData();
    const buf = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' }[ext];
    if (!type) throw new Error(`图片只支持 jpg/png/gif：${file}`);
    fd.append(field, new Blob([buf], { type }), path.basename(file));
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    return fd;
  }

  return {
    token,
    /** 正文图片：返回 url。限制 jpg/png、1MB 以内 */
    async uploadImage(file) {
      if (fs.statSync(file).size > 1024 * 1024) throw new Error(`正文图片超过 1MB（微信限制）：${file}`);
      const j = await call('/cgi-bin/media/uploadimg', { form: fileForm(file) });
      return j.url;
    },
    /** 封面：永久图片素材，返回 { media_id, url } */
    async addCover(file) {
      if (fs.statSync(file).size > 10 * 1024 * 1024) throw new Error(`封面超过 10MB：${file}`);
      return call('/cgi-bin/material/add_material', { query: { type: 'image' }, form: fileForm(file) });
    },
    /** 新建草稿，返回 media_id */
    async addDraft(article) {
      const j = await call('/cgi-bin/draft/add', { json: { articles: [article] } });
      return j.media_id;
    },
    async getDraft(mediaId) {
      return call('/cgi-bin/draft/get', { json: { media_id: mediaId } });
    },
    async listDrafts(offset = 0, count = 20) {
      return call('/cgi-bin/draft/batchget', { json: { offset, count, no_content: 1 } });
    },
    async deleteDraft(mediaId) {
      return call('/cgi-bin/draft/delete', { json: { media_id: mediaId } });
    },
    async listPublished(offset = 0, count = 20) {
      return call('/cgi-bin/freepublish/batchget', { json: { offset, count, no_content: 1 } });
    },
  };
}

module.exports = { makeClient, WxError, HINTS };
