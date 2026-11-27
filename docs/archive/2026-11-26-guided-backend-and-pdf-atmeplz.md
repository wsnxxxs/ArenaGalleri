# 2026-11-26 · 引导试运行后端区、排行榜分类统一与设计 PDF 支持 · Atmeplz

- 负责人：Atmeplz（`224206292+Atmeplz@users.noreply.github.com`）｜ 执行 AI：Antigravity（Gemini）

## 本轮目标

1. 在 `guided-trial` 题库新增「后端」闭卷分区，展示 4 道 AGB-Bench v4.1 题目名称、排名摘要与编程语言标签，不开放提示词、投稿或盲评。
2. 统一排行榜侧栏「大众榜」与「精选榜」的图标、名称与顺序，并新增「后端榜」（1:2:1:2 合成总榜 + 4 张分卷榜）。
3. 将「设计」下办公子分类（`Word`/`PPT`/`Excel`）合并为 `PDF`，投稿侧拒绝 HTML、接受 `.pdf` 并支持沙盒试加载预览。

## 改动

- 新增 `site/backend-board.js`：实现 1:2:1:2 后端合成总榜与 EZ/HD/IN/AT 四分卷排行榜、筛选搜索、不可靠标记过滤、缺卷参考区与分卷详情卡。
- 修改 `site/ui.js`、`site/categories.js`、`site/app.js`、`site/leaderboard.js`、`site/question-recommendations.js`、`site/question-fields.js`、`site/publish.js`、`site/submit.js`、`site/account.js`、`site/platform.css`、`site/studio.css`、`site/i18n-gallery.js`、`site/i18n-authoring.js`、`site/i18n-experience.js`：
  - 新增 `后端` 分类与 `benchmarkTask`/`votedTask`/`publishableCategories`/`pdfTask` 辅助判定。
  - 统一 `大众榜` 与 `精选榜` 侧栏分类为 `综合`、`语言`、`设计`、`三维`、`音乐` 及一致图标与排序；增加第三组 `后端榜`。
  - 合并 `Word`/`PPT`/`Excel` → `PDF`；投稿流程 `FILES.pdf` 显式拒绝 `.html`/`.htm` 并提示 `PDF 题目不接受 HTML 文件，请上传单个 .pdf 文件`；新建/重提/后台审核表单完整支持 `PDF` 子分类。
- 新增 `test/backend-and-pdf.test.mjs`，更新 `test/categories.test.mjs`。

## 决策

- 仅针对 `guided-trial`（`GUIDED_VOTING=1`）展示「后端」闭卷分区与 1:2:1:2 后端榜，不对正式站构建开放，亦不修改正式站部署目录。
- 既有被迁移为 `PDF` 的历史 HTML 作品维持可读状态，避免破坏线上历史展厅浏览；仅对后续新提交强制 `.pdf`。

## 验证

- `node scripts/check-syntax.mjs`：137/0 通过。
- 针对性单测（`categories`、`backend-and-pdf`、`curated-leaderboard`、`leaderboard-reads`、`publish-submit`、`publish-resubmit`、`question-sort`、`i18n`）：34/34 通过。（未更改的 `test/guided-order.test.mjs` 在 Windows 下因既有 CRLF 行尾差异失败，与基线一致。）
- 未跑：`npm run check:intake`（本轮在隔离工作树使用本地 `.datapack` 完成 `assemble-site.mjs` 合成构建）。
- 本地全栈真实 Chromium Playwright E2E QA（1440×900 与 390×844、中英文、亮暗主题）：题库分类/语言筛选、闭卷后端详情、排行榜统一与 1:2:1:2 过滤、新建 PDF 题、HTML 拒绝、真实 PDF 上传试加载 + 文本提取 + 提交详情页回放全通过，0 报错、0 横溢。

## 明确没做

- 未改动正式站分支与线上正式目录。
- 未展示任何 AGB-Bench v4.1 内部题库名称或受保护题面源码。

## 遗留物

- 无（改动独立提交在 `feat/guided-backend-leaderboard-pdf`，面向 `sync/vps-trial-20261123`）。

## 下一步建议

- 与后端分支 `feat/guided-backend-and-pdf` 配套上线至 `guided-trial` 并验证公网 HTTPS 行为。
