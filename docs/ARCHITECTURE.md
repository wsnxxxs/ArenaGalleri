# Gallery 架构

`site/` 是原生 ES Module 与 CSS 前端。构建工具消费独立私有数据包，后台 API 提供动态功能；本仓库不包含后台实现或另一前端。

## 构建

本地 `datapack.json` 固定包版本 → 认证下载及校验 → 忽略的 `.datapack/` → 叠加 `site/` → 忽略的 `dist/`。

`scripts/fetch-datapack.mjs` 使用 GitHub CLI 认证下载，复用 vendored 客户端的解包与安装校验。同版本缓存先验证再复用。`scripts/datapack.mjs` 校验模型、路径、截图与海报；原作收录和生成工具在私有数据仓库维护。

`scripts/public-catalog.mjs` 明确列出公开字段并排除内部文件。`assemble-site.mjs` 只复制可发布资源，再写入展示目录，原始包不改动。输入与站点出现路径碰撞时失败。

`cache-bust.mjs` 根据前端 commit 和资产内容生成统一版本，覆盖主站 import map、入口与 CSS。修改 API 配置也会改变资产版本。海报指纹只覆盖渲染相关文件；修改这些文件须在数据仓库重新生成海报。

## 模块

| 模块 | 职责 |
| --- | --- |
| `app.js` / `home.js` | 路由、馆藏、提示词、首页与对比 |
| `platform-api.js` / `platform.js` | API 地址、凭据请求、版本协议、会话与公共界面 |
| `arena.js` / `leaderboard.js` | Gallery 内的盲评和榜单界面，调用独立后台 |
| `publish.js` / `submit.js` / `account.js` | 题目、投稿、个人中心与审核界面 |
| `question-preview.js` / `result-previews.js` | 代表作品选择和卡片模型展示 |
| `prompt-variants.js` | 提示词版本、同模型结果分组与当前版本选择 |
| `preview-model.js` / `scene-resources.js` | 模型读取与资源回收 |
| `sandtable*.js` / `exhibition.js` | 三维沙盘及原作展厅 |
| `turnstile.js` | 按后台配置展示注册验证 |
| `ui.js` / CSS | 公共组件、布局、主题与偏好 |

`site/arena.js` 是画廊原有界面模块，不是另一前端的合并副本。

平台页模块的 `mount(root, ctx)` 返回 `{ ready, onPlatformChange, destroy }`。`ready` 是首批数据画完的 Promise；已经从记忆画好时为 null，也可以省略。点链接切换页面是一次 View Transition：在回调里拆掉旧页、画新页，等 `ready` 完成，最多等 300ms（`HOLD`），然后交叉淡入。等待期间旧画面保持不动。顶栏（`#app > .topbar`）和侧栏（`.app-sidebar`）有各自的 `view-transition-name`，内容相同的话过渡时看不出变化。浏览器不支持 View Transition、标签页在后台，或者是首屏、同页重画时，直接绘制。数据超过 HOLD 才到的页面先显示自己的载入状态，到了再原地补上。返回上一页时，等 `ready` 后再恢复一次滚动位置；如果读者在等待期间自己滚动过，就不再恢复。

页面进入时读取的数据（`me`、`auth/me`、`review`、`admin/questions`、各榜单）用 `platform.js` 的 `apiRemembered` 读取，按账号记住上一次的结果。回到页面时先用 `recall` 画出上次的内容，后台刷新；结果有变化才重画。同页操作或平台状态变化引起的刷新一律重画。

启动时并行读取本地展示目录和后台 bootstrap，bootstrap 8 秒没有响应就按静态档案运行。数据版本仍用于写请求兼容，API 契约不可用时保留静态浏览。后台地址由 `runtime-config.js` 或构建环境变量配置，服务端密钥不得进入前端。

题库只对有解答的题读取代表作品榜单，空题直接显示等待首份答案，避免无用请求触发共享读取限制。同题长短版本保持题目 ID，卡片按模型、推理档位与来源分组；每份作品保留独立 ID，并排预览两栏各自选择已收录版本。

## 验证与部署

公开 CI 只运行语法检查和合成数据测试。完整构建、数据完整性、跨仓联调和浏览器验收在受信任环境执行，配置与数据缓存不能放入公开 Actions 缓存或 artifact。

Nginx 私有文件规则见 `deploy/nginx/gallery-private-files.conf`，须覆盖 Gallery、API 和作品域名；只配置 Gallery 不能封住后台数据包资源的构建说明。频率与并发控制由共享后台的部署配置配套提供；仅更新前端代码不会启用这些服务器规则。正常浏览、限流响应及版本一致性需要在正式部署时核对。当前部署状态、备份位置说明与实际验证范围见 `HANDOFF.md` 及其发布归档。
