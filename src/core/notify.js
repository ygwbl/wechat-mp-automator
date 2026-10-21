'use strict';
// 提醒：企业微信群机器人 / Server酱。没配就只打日志。
const { env } = require('./config');
const log = require('./log');

async function send(title, body = '', { fetch: fx = globalThis.fetch } = {}) {
  const type = env('NOTIFY_TYPE');
  try {
    if (type === 'wecom') {
      const url = env('NOTIFY_WEBHOOK', { required: true });
      await fx(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msgtype: 'markdown', markdown: { content: `**${title}**\n${body}` } }) });
    } else if (type === 'serverchan') {
      const key = env('SERVERCHAN_KEY', { required: true });
      await fx(`https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ title, desp: body }),
      });
    } else {
      return false;
    }
    return true;
  } catch (e) {
    log.warn(`通知发送失败：${e.message}`);
    return false;
  }
}

module.exports = { send };
