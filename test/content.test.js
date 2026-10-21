'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { sandbox, writePost, fresh } = require('./helpers');

test('markdown：块级语法', () => {
  fresh();
  const { parse } = require('../src/content/markdown');
  const { meta, blocks } = parse('---\ntitle: 标题\nstatus: ready\ntags: [a, b]\n---\n\n段落一\n接着写\n\n## 小标题\n\n> 引用\n\n- 甲\n- 乙\n\n1. 一\n2. 二\n\n![图](images/x.png)\n\n::: tip 提示\n里面的话\n:::\n\n---\n');
  assert.deepStrictEqual(meta, { title: '标题', status: 'ready', tags: ['a', 'b'] });
  assert.deepStrictEqual(blocks.map((b) => b.type), ['p', 'h2', 'quote', 'ul', 'ol', 'img', 'box', 'hr']);
  assert.strictEqual(blocks[0].text, '段落一接着写');
  assert.strictEqual(blocks[6].title, '提示');
  assert.strictEqual(blocks[6].children[0].text, '里面的话');
});

test('render：行内样式、自动编号、转义、页脚', () => {
  fresh();
  const { parse } = require('../src/content/markdown');
  const { render } = require('../src/content/render');
  const { blocks } = parse('## 甲\n\n**重点** 和 ==高亮== <script>x</script>\n\n## 乙');
  const html = render(blocks, { footer: { follow: '关注我', disclaimer: '仅供参考' } });
  assert.ok(html.includes('>01</span>') && html.includes('>02</span>'));
  assert.ok(html.includes('<strong style='));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.indexOf('关注我') < html.indexOf('仅供参考'));
  assert.ok(!/class=/.test(html), '不能依赖 class，公众号会剥掉');
});

test('rules：该拦的拦，正常说法放过', () => {
  fresh();
  const { scan } = require('../src/content/rules');
  const errs = (s) => scan(s).filter((h) => h.level === 'error').map((h) => h.id);
  for (const s of ['能降血压', '提高免疫力', '三天见效', '专家推荐', '转发给朋友才能看', '治疗失眠', '养胃', '预防感冒', '全网第一'])
    assert.ok(errs(s).length, `应该拦：${s}`);
  for (const s of ['睡前最好别看手机', '第一步先开窗', '去药店买个体温计', '防止中暑要多喝水', '最后一步', '早点睡'])
    assert.deepStrictEqual(errs(s), [], `不该拦：${s}`);
});

test('lint：合格稿通过；标题、摘要里的违规也会被查', () => {
  const dir = sandbox();
  fresh();
  writePost(dir, 'a');
  writePost(dir, 'b', { meta: { title: '这样吃能降血糖' } });
  writePost(dir, 'c', { noCover: true });
  const posts = require('../src/content/posts');
  const ra = posts.lint(posts.load('a'));
  assert.deepStrictEqual(ra.errors, []);
  assert.ok(!posts.lint(posts.load('b')).ok);
  assert.ok(posts.lint(posts.load('c')).errors.some((e) => e.includes('封面')));
});

test('queue：只选 ready、到日期的；指定今天的优先', () => {
  const dir = sandbox();
  fresh();
  const { today, addDays } = require('../src/core/time');
  writePost(dir, '01-a');
  writePost(dir, '02-draft', { meta: { status: 'draft' } });
  writePost(dir, '03-future', { meta: { date: addDays(today(), 3) } });
  writePost(dir, '04-today', { meta: { date: today() } });
  const q = require('../src/core/queue');
  const { post, rest } = q.next();
  assert.strictEqual(post.slug, '04-today');
  assert.deepStrictEqual(rest.map((p) => p.slug), ['01-a']);
});
