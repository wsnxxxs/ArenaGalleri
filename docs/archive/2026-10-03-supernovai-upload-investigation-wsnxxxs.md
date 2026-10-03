# 2026-10-03 · SupernovAI 单 HTML 上传报错调查 · wsnxxxs

- 负责人：wsnxxxs｜执行 AI：Codex 主代理及用户指定的 3 个 GPT-6.1 Sol / high 子代理。
- 范围：四仓相关上传、校验、构建与既有作品链路只读检查；实际样本为 Downloads 中的 `SupernovAI.html`。仅 Gallery 交接和本轮归档有文档新增。

## 本轮目标

调查用户截图中「入口页面引用的脚本或样式不存在：mock-engine.js」的原因，区分作品文件问题、校验误报与单 HTML 上传改动回归。用户本轮要求调查，未要求修复或上线。

## 改动

仅追加 HANDOFF.md 与本归档，未提交。未修改原 HTML、功能源码、数据包或生产配置。初始已存在的 HANDOFF.md 与 coordinated-release 归档修改保留，不纳入任何提交。

## 决策与证据

- 样本第 1731 行是活动 `<script src="mock-engine.js"></script>`，并非注释或 JS 字符串。同目录没有该脚本。紧接着 1732–2450 行已完整内联模拟引擎，1740 行定义 `window.SNMock`，2481 行交互层调用它。外链是多余引用；像合并成单文件时的残留，但原始生成日志缺失，具体生成工具无法确定。
- Gallery `site/submit.js:344–348` 只做大小 / 扩展名检查，再将原始 File 上传；365–369 行只有成功拿到草稿才启动试加载，错误则显示后端返回文案。因此该失败发生在草稿创建前的静态预检，尚未进入试加载或截图。
- 后端 `server/app.mjs:303–311` 接收文件，`server/library.mjs:680` 调用预检。`server/inspect.mjs:177` 将单 HTML 映射为仅含 index.html 的文件集合，139–148 行识别关键脚本引用，211–215 行发现缺失后返回 400。`docs/api-contract.md:342` 已明确此规则。
- 关键脚本检查与文案在后端初始提交 `2ce9690`（2026-09-27）已存在；前端单 HTML 提交 `d5b07c4` 没有改文件发送或错误回显逻辑。没有发现此处校验回归，也没有发现平台注入 mock-engine.js 的逻辑。
- 相关提示词只要求本地模拟，并未指定 mock-engine.js；既有两件 SupernovAI 作品的标题 / 模拟器与本样本不一致。不能把本样本归因到现有作品的构建或下载工具。
- 最小处理建议：在作品中删除这一条冗余外链，保留后面的内联引擎。无需放宽后端缺依赖检查、制造空脚本或改变单 HTML 投稿约定。此建议本轮未落盘至原作品。

## 验证

| 验证输入 | 结果 |
| --- | --- |
| 原始 HTML，149285 bytes | 真实 inspectUpload 返回 400，文案与截图一致 |
| 仅在内存删除唯一外链标签，149247 bytes | kind=html，entry=index.html，仅一个文件；format / entry / local / external 全 ok，readme=info |
| 原始 HTML 在隔离本地 HTTP 页面打开 | 请求 /original/mock-engine.js，返回 404；后续内联引擎仍能渲染模型矩阵 |
| 内存变体在隔离本地 HTTP 页面打开 | 不再请求 mock-engine.js；六行模型矩阵正常，非流式聊天输出完成；API Lab 模拟聊天返回 200 OK、simulated=true、页内引擎 |

- 浏览器使用 Browser 技能控制 Codex 内置浏览器，临时 HTTP 服务只监听 127.0.0.1。所有 `/v1/*` 故意返回 404，使作品使用已有内联 fallback；没有生产账号或生产写操作。服务和临时页收工时关闭。
- 另发现作品自身问题：2307–2312 行 `/v1/models` 返回项缺少 name，2748 行却读取 m.name，模型下拉框显示 undefined。原文件与变体都存在，和上传报错无关。
- HTTP 环境下 2467–2481 行先尝试同源 `/v1/*`，仅 404 或网络失败时回落内联引擎；本地通过不能证明所有部署环境无网络请求，也不能证明平台内全部交互通过。
- 未运行 `npm run check`、`npm test`、`npm run build`、`CI=1 npm run check:intake`：本轮没有功能源码或构建改动，已直接运行实际上传检查函数与针对样本的浏览器对照。未验证生产上传、流式聊天、其余 API 端点、手机或其他浏览器。
- 原 HTML 收工前 SHA-256 与初始一致：`71a894266866595852fb91abea9ded2e4ab263fd05defc6da4788b7bf7f0b9e6`。

## 明确没做

没有修改或另存可投稿 HTML，没有放宽检查、恢复 ZIP、修改数据仓作品、提交、推送、部署或写入生产数据。检查器对注释 / JS 字符串也会扫描的通用局限不是本样本的原因，本轮未扩展修复范围。

## 遗留物

- 忽略目录 `output/supernovai-investigation-20261003/api-demo.png` 保存内存变体的本地 API Lab 验证截图。
- 本轮新增交接 / 归档保持未提交；此前已存在的交接和 coordinated-release 归档修改保留原样内容。

## 下一步建议

若用户继续要求修复作品，删除上述外链标签并另存 HTML；如同时修作品交互，可让内联模型响应携带 name 或由界面按 id 回退。投稿前再验证平台内预览与聊天，不据本地结果宣布全部交互通过。

## 2026-10-03 后续复查

- 用户告知已修改；检查到后端新提交 `57a6cc9`（Warn instead of rejecting missing local references in single HTML uploads.）。它同步修改 inspect.mjs、API 契约和一个针对格式差异的测试；本代理未修改该提交或相邻源码。
- 原 Downloads HTML 仍为 149285 bytes，保留 mock-engine.js 外链。直接重跑当前真实 inspectUpload 已接受原文件，local 检查为 warn「有 1 个引用的文件不存在：mock-engine.js」。
- 范围是所有单 HTML 的缺失本地引用均降为 warn，包括关键脚本和样式；ZIP 缺关键脚本 / 样式仍返回 400。原始作品得以保留，能否运行交由后续试加载判断。
- 本代理执行 `node --test --test-name-pattern='a missing script warns' test/platform.test.mjs`，新增对照用例通过。没有重复整套测试或构建，因为没有新增功能改动；没有实际平台上传、试加载或生产部署验证。
- 前文删除冗余标签是调查时的作品侧建议；用户现已采用平台侧宽松预检策略，本地预检结论以上述最新复测为准。交接和本补充未提交、未推送。

## 2026-10-03 发布完成追加

用户随后授权提交、推送并部署。共享后端现有英文提交 `57a6cc93f5dc7ba1cbdc77ad9cb2a0dfd9ebeb18` 已推送 origin/main，Brisbane 12:49:37 部署；Windows / Linux check 88/0、test 252/252。正式检查器接受原始 HTML，缺失 mock-engine.js 仅为 warn。公网版本、双站首页、CORS、内置作品 CSP 和未登录草稿 401 通过；切换前后 71 个运行文件分别匹配对应基线，数据包、数据库版本和 Nginx 配置保持。

只部署共享后端的三文件差异，不重建前端或数据包，不改原始作品。后端归档为 `arenaofbias-server/docs/archive/2026-10-03-html-upload-warning-release-wsnxxxs.md`；服务器备份 `/root/aob-html-warning-release-20261003-57a6cc9/backup`。本仓调查交接 / 归档仍作为本地记录，未混入后端功能提交；真实账号上传、平台内实际试加载及正式作品提交尚未验收。
