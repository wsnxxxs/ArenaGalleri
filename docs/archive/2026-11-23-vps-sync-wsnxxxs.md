# 2026-11-23 · 服务器现场补录入库 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Claude Opus 5.5（Claude Code 桌面版，子代理 Opus 重建）

## 本轮目标

用户要求整理服务器上未经仓库提交的更新并规范开发。正式站 `/www/wwwroot/gallery` 与管理员试运行站 `/www/wwwroot/gallery-guided-trial/guided-trial` 都含只在服务器上的文件，来自 10-27 至 11-22 直接改线上或在 `/root/aob-*` 暂存后覆盖的多轮发布；试运行站另含本地未推送的 `lb/integration`。本轮补录入库，不部署、不改服务器。

## 改动

- `sync/vps-formal-20261123`（基于 `origin/main` 02fd3db）：正式站现场四轮——任务页优先展示大厂新作品（`work-boost.js`）、Bing/Google/百度站点验证文件、Sub2API 登录页（取线上版本，不是本地未跟踪副本）、音乐类 MP3 作品且不进盲评。音乐轮为测试 vm 桩补 `votedTask`。另在 `AGENTS.md` 写明只从提交上线（本提交）。
- `sync/vps-trial-20261123`（基于正式分支，未合并 main）：`lb/integration` 31 个提交按原信息摘入，再按时间补录 11-17 至 11-22 的 37 轮试运行改动（维度与测评点、音乐、解题状态与筛选、预览缩放、子分类、其他领域、团队页与成员照片、提示词弹窗、维度雷达、精选开关、首页轮播与赞赏卡、11-22 renew 第一阶段）。renew 第二阶段 11-22 21:19 上线、21:27 已回退，不在线上，未纳入。每轮按服务器作业目录修改前后副本三方合并，统一 LF。

## 验证

- `scripts/live-drift.mjs`（后端仓库）对生产比对，排除 `index.html` 等构建生成文件：
  - 正式分支：80 个文件一致，15 个只差 CRLF；`app.js`、`arena.js`、`platform.css` 的差异逐行全部来自 `origin/main` 上从未部署到正式站的 a5517ee、02fd3db、29a8821、534b095；`dimensions.js` 同理只在 git。
  - 试运行分支：119 个文件一致，只有 `app.js` 差正式站独有的 work-boost 三行，另有正式站独有的验证文件和 Sub2API 页只在 git。
- `index.html` 未逐字节一致：线上入口是原地重新打版本号生成的（缩进、import map 顺序、预加载列表、CSP 哈希不同），源文件与 `origin/main` 一致，试运行版多 `catalog?guided=1`。
- 正式分支 `npm run check` 122/0、`npm test` 159/159。试运行分支 check 135/0；测试 198 通过、8 失败、1 取消，且普通 `npm test` 会卡住（`platform-catalog` 一项无限等待），需加 `--test-timeout`。失败均来自线上试运行代码（音乐的 `?guided=1` 请求、子分类多出请求字段、提示词弹窗、雷达测试桩缺 `isStaff`），`origin/main` 与 `lb/integration` 上不存在；未改测试，保持反映线上。
- 未用数据包完整构建，未做浏览器目视核对。

## 决策

- 试运行分支不能直接合并 `main`：除维度、测评点、问题卡、雷达外，多数试运行改动没有用 `guidedVoting` 门控。合并后会进入正式站：
  - 音乐变为可投票，并始终请求 `?guided=1`。
  - 解题状态与筛选、预览缩放、子分类与分类改名、其他领域、团队页、提示词弹窗、首页轮播与赞赏卡、renew 全站样式都会生效。
  - 精选开关只门控了勾选框。
  
  试运行站继续从已推送的试运行分支部署。功能要进正式站，需另做门控或逐项移植。
- 待用户确认：试运行分支含个人微信赞赏码 `assets/support-qr.jpg` 和团队成员照片与自我介绍，本仓库公开，推送前需决定是否入库。

## 遗留物

- 工作树 `.wt/sync-gallery-20261123`（试运行分支）、`.wt/gallery-live-rule-20261123`（正式分支）。本地 `main` 的他人未提交改动和未跟踪文件未动。服务器 `.nojekyll` 只在线上。
