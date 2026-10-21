'use strict';
// 一律按北京时间算「今天」，不受电脑时区和 UTC 影响。

function shanghai(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const o = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}:${o.second}` };
}

const today = (d) => shanghai(d).date;
const now = (d) => { const s = shanghai(d); return `${s.date} ${s.time}`; };

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00+08:00`);
  return today(new Date(d.getTime() + n * 86400000));
}

/** 两个时间点相差几小时；参数是 "YYYY-MM-DD HH:mm[:ss]" 或 "YYYY-MM-DD"（北京时间） */
function hoursBetween(a, b) {
  const t = (s) => new Date(`${s.length === 10 ? `${s} 00:00` : s}`.replace(' ', 'T') + '+08:00').getTime();
  return (t(b) - t(a)) / 3600000;
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));

module.exports = { today, now, addDays, hoursBetween, isDate };
