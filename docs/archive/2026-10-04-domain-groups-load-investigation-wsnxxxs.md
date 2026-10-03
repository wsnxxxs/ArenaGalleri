# 2026-10-04 · 审核页 domainGroups 加载失败排查 · wsnxxxs

- 负责人：wsnxxxs；执行 AI：Codex，两个 GPT-6.1 Sol / medium 子代理分别只读排查源码与构建缓存；其中源码代理另生成隔离复现脚本。
- 范围：Gallery 前端模块加载、公开静态 HTTP、忽略目录下的复现材料。保留开工前所有未提交和未跟踪文件。

## 本轮目标

调查用户截图中的 `The requested module './categories.js' does not provide an export named 'domainGroups'`。用户补充：提交作品后进入审核界面时出现。本轮授权是调查分析，不实施功能修复或部署。

## 改动

功能源码、配置、数据包、后端和生产数据均未修改。仅补根交接和本归档；隔离脚本、公开 HTTP 证据及浏览器截图保存在忽略目录 `output/category-module-investigation-20261004/`。未 commit/push。

## 决策与结论

当前源码、HEAD、本地 dist 和正式线上 `categories.js` 都有 `domainGroups`。唯一命名消费者是 `site/question-fields.js:3`，由 `account.js:7` 和 `publish.js:8` 静态引入；`#/review`、`#/me` 和 `#/new` 在 `app.js` 动态加载这些页面。`app.js:1611–1616` 在动态导入失败时显示截图中的原始错误。导出与消费者在同一个 `832179b` 提交引入，其父提交没有该导出。

最可能原因是旧标签页跨发布混用模块，已在隔离浏览器复现：

1. 旧页面启动时静态加载旧 `categories.js`，浏览器保留已解析的模块。
2. 发布后首次进入审核界面，旧 importmap 请求 `account.js?v=旧版本`，服务器却按同名路径返回当前内容。
3. 新 account 依赖新增的 `question-fields.js`；旧 importmap 没有它的映射，但其中 categories 的导入仍指向已加载的旧模块。
4. 新消费者要求旧模块没有的命名导出，动态导入失败。

现有 `cache-bust.mjs:32–43` 已为完整模块图生成统一版本参数，不能简单归因于忘加缓存参数。`assemble-site.mjs:58–66` 将各版资产写到相同根路径，没有保留按版本隔离的内容。公开 HTTP 实测旧 query 值仍返回当前模块，因此参数不能保证长时间打开的页面晚加载到同版资源。线上响应为 `Cache-Control: no-cache`，也不会重新链接当前文档已加载的模块。

这个机制与“提交后首次进入审核”相符；截图本身无法证明用户原标签页的版本、请求来源或是否经历过发布，故将其记为最可能原因，而非已取证到用户当时的完整网络轨迹。没有证据表明这是作品文件内容或当前源码遗漏导出。

## 验证

- 正式站匿名只读 HTTP：index、categories、question-fields、account、publish、submit、app 均 200；index 中相关映射使用同一正式资产版本。六个脚本统一 CRLF/LF 后与 `2c04b51` 源码一致；原始字节不同仅来自 Windows 构建的 CRLF，不视作源码漂移。
- 对 categories/account 使用不同于当前版本的 query 请求，仍返回当前正式源码。
- 新浏览器标签页打开正式 `#/review`，account 依赖链正常加载，显示管理员登录提示，无捕获 error/warn；未登录或读取审核队列。
- 隔离服务仅监听 `127.0.0.1:4428`，使用真实 `832179b^` categories 与 `2c04b51` question-fields/ui，app/account 为简化入口。模拟提交按钮仅改变本地页面；首次打开审核复现完全相同的命名导出错误。刷新整个页面后同一操作成功生成领域表单。没有模拟或执行真实提交 API。
- `npm run check`：56 文件 / 0 错；`npm test`：22/22。
- 未运行 build/intake：本轮只调查模块加载，不重新组装或覆盖另一轮正在使用的本地 `.datapack/` / `dist/`。未验证真实用户提交记录、生产登录、浏览器缓存来源、真机、Safari/Firefox或全部交互。

## 后续建议（未实施）

临时恢复：整页刷新，再核对作品状态。现有“回到首页”只是 hash 导航，不会清除文档中的模块；报错不能单独证明提交失败。

较小的产品修复是提供明确的整页刷新入口，并在懒加载页面前发现前端版本变化时提示刷新；若要求跨发布旧标签页仍可连续使用，需要按版本保留静态资产。版本检测有发布竞态，不能将它等同于版本隔离。无需再补一次已经存在的 `domainGroups` 导出。以上是候选修复方向，尚未获得本轮实施授权。

## 遗留物

本归档与根交接留本地。忽略目录含 `harness.mjs`、`public-evidence.mjs/json`、`request-evidence.json`、`reproduced.png`、`reloaded.png`、`live-review-fresh.png`；临时复现服务与本轮新建浏览器标签页收工关闭。原有其他轮次源码、文档、配置和生成物保留。
