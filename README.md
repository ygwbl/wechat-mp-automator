# 日升月落 · 公众号工具

用 Markdown 写稿，自检合规，每天早上自动把一篇推进公众号草稿箱，然后提醒你去手机上点「发表」。

2026-10-21 从零写的，没有用旧项目（`../养生公众号/`）的任何代码、样式、词表或数据。

## 每天怎么用

```
早上 8:00（定时任务自动跑）
  sync    看昨天的草稿发出去没有
  push    选今天的稿 → 自检 → 上传图片 → 进草稿箱 → 回读核对 → 给你发提醒
  report  生成复盘

你
  手机打开「订阅号助手」→ 草稿 → 发表（这一步要你点，群发通知也在这一步选）
  发完：gzh done <文章名>      （群发的文章微信接口查不到，需要手动标一下）
  有空时：gzh stat <文章名> 阅读=120 点赞=3 分享=5     （录数据，复盘用）
```

为什么不全自动：未认证个人号没有官方「群发」接口。接口能做的「发布」不会推送给粉丝，等于没发。模拟网页点按钮可以做，但网页一改版就坏，而且发表时本来就要管理员微信扫码确认，人总要在场。所以这一版把能稳定自动化的部分做完，最后一步留给你，一般不到 10 秒。

想以后也自动群发、自动采集阅读数，先跑 `gzh explore`，见下面「第二阶段」。

## 安装

1. 装 Node.js 18 以上（[nodejs.org](https://nodejs.org)）。
2. 公众号后台 → 设置与开发 → 基本配置：
   - 记下 **AppID**，生成 **AppSecret**
   - **IP 白名单** 加上这台电脑的公网 IP（百度搜「IP」能看到）。不加的话接口会报 40164
3. 在这个目录：
   ```powershell
   copy .env.example .env      # 填 WECHAT_APPID、WECHAT_SECRET，想要提醒就填 NOTIFY_*
   node bin/gzh.js check       # 自检现有文章
   node bin/gzh.js push --dry  # 看看今天会推哪篇，不调接口
   ```
4. 第一次真推：`node bin/gzh.js push <文章名>`，然后去后台草稿箱看排版对不对。
5. 没问题就装定时任务：`powershell -ExecutionPolicy Bypass -File scripts\schedule.ps1`

不需要 `npm install`。只有 `gzh explore` 要用浏览器，那时再 `npm install`。

## 写稿

```powershell
node bin/gzh.js new 2026-10-24-zaofan "早饭别只喝一碗粥"     # 新建空白稿
node bin/gzh.js ai 2026-10-24-zaofan "早饭怎么吃"           # 或者让 AI 起草（要配 GZH_LLM_*）
node bin/gzh.js cover 2026-10-24-zaofan                     # AI 生成封面（要配 GZH_IMAGE_*）
node bin/gzh.js preview 2026-10-24-zaofan                   # 生成手机宽度预览 dist/*.html
node bin/gzh.js check 2026-10-24-zaofan                     # 自检
```

文章放在 `content/posts/`，一篇一个 `.md`，封面放 `content/covers/`，正文配图放 `content/images/`。写法看 `content/posts/_示例.md`。

- 文件开头 `status: ready` 才会被推送。AI 起草的一律是 `draft`，你看过再改。
- `date: 2026-10-23` 表示那天才推（节气文章）。不写就按文件名顺序排队，所以文件名建议用日期开头。
- 一天只推一篇。推过的、发过的不会再推。

## 自检规则

`src/content/rules.js`，按《广告法》第 9、16、17、18、28 条、《食品安全法》第 73 条和平台运营规范重新整理。

| 级别 | 内容 | 结果 |
|---|---|---|
| 拦截 | 治疗/治愈、预防具体疾病、降血压血糖、抗癌、补肾护肝养胃这类脏器功效、增强免疫力/改善睡眠这类保健声称、几天见效、无副作用、国家级/顶级/特效、专家推荐、转发才能看 | 不让推 |
| 提醒 | 「最好」「第一名」、药方/服药、震惊/千万别 | 推，但让你看一眼 |

标题、摘要、正文都查。另外查：标题 ≤30 字、摘要 ≤54 字、正文 600 字以上、封面和配图文件存在。数值可在 `config.json` 里改（见下）。

## 配置（可选）

新建 `config.json`，只写要改的：

```json
{
  "author": "日升月落",
  "theme": "paper",
  "footer": {
    "follow": "关注「日升月落」，每天一个生活里的小习惯。",
    "disclaimer": "内容仅供日常生活参考，不能替代专业医疗意见。身体不适请及时就医。"
  },
  "post": { "minChars": 600, "maxChars": 1600, "titleMax": 30, "digestMax": 54 },
  "open_comment": true
}
```

主题：`paper`（暖白底、青绿编号小标题）、`plain`（黑白）。在 `src/content/themes.js` 里加。

## 第二阶段：自动群发、自动采集

```powershell
npm install                     # 装 playwright-core
node bin/gzh.js explore         # 打开浏览器，你扫码登录后正常操作一遍
```

操作内容：进草稿箱 → 点一篇的「发表」→ 走到确认那一步（可以取消）→ 再去「数据分析」看看图文数据。
工具只记录，不替你点。结果在 `data/explore/<时间>/`：每个页面的截图、可点击元素清单、后台接口的字段结构（不存数值，不存 token）。

把这个目录给我，我照着真实页面写自动群发和自动采集。

## 命令一览

`node bin/gzh.js help`

## 目录

```
bin/gzh.js          命令入口
src/core/           时间（北京时间）、配置、日志（自动打码密钥）、台账、选稿、提醒
src/content/        Markdown 解析、主题、渲染、合规规则、自检
src/wechat/         官方 API（token 缓存、上传、草稿、发布列表）、图片缓存
src/tasks/          push / sync / stats / report / explore
src/ai/             写稿、封面（OpenAI 兼容接口）
content/            文章、封面、配图          ← 进 git
data/               台账、数据表、缓存         ← 不进 git
scripts/schedule.ps1  定时任务
test/               18 项测试（npm test），微信接口用假服务器
```

---

## 🖥️ 进阶：桌面图形客户端 (GUI / EXE 专业版)

针对矩阵运营和自媒体工作室，本工具亦提供独立的 Windows 桌面客户端：

* **多账号独立环境防封**：每个公众号拥有专属指纹浏览器环境与 Cookie 隔离，免除频繁切号与关联风险；
* **高颜值排版模版库**：内置「新中式水墨风」、「莫兰迪杂志风」、「清单手账风」等多套精美自动化排版；
* **AI 自动化矩阵创作**：支持接入各大主流大模型（DeepSeek / Claude / OpenAI），一键起草、配图并推送到手机草稿箱；
* **广告法与合规拦截**：专为养生、健康、生活类赛道设计，自动过滤虚假医疗宣传与违规词汇。

