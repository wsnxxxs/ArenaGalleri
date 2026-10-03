# 2026-10-03 · 去掉馆藏 / 社区概念，按发布者与三级权限重构 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Claude Opus 5.5（Gallery 前端）；后端由另一会话按本轮提示词完成（arenaofbias-server c4585a8）

## 本轮目标

用户先问审核界面是否该加全部题目的管理板块，随后要求去掉所有馆藏 / 社区概念，只区分管理员做的和普通用户做的，做一次完整重构；过程中追加三级权限（高级管理员、普通管理员、普通用户）。前端由本会话实现，后端写成提示词交给另一个 agent。

## 改动

- 后端提示词：`output/unify-authorship-20261003/backend-prompt.md`（忽略目录），定义 apiVersion 2 契约：`author:{role,name,avatar}` 取代 owner / curated / community / source；bootstrap 给全部公开题目与作品；数据包作品不带资源字段；题目新增 acceptsUploads、cover；覆盖层编辑 / 撤下 / 软删除；三级权限表。
- site/platform-api.js：只认 apiVersion 2；媒体字段有才解析，不再看 curated。
- site/platform.js：ROLE_LABELS、isStaff、isSenior、canDecide、byStaff；菜单按三级角色；去掉「已收录为馆藏」盲评状态。
- site/app.js：数据包（资源）与 API（公开范围与当前字段）合并题目和作品，对象跨刷新保持同一个，无 API 时按存档显示；`hosted`（同源托管）取代 curated / upload 判断沙盘、展厅、卡片模型、iframe sandbox、脚本注入；卡片、指南、侧栏统一「X 发布 / 发起」，管理员发布显示站点名与 Logo；投稿入口读 acceptsUploads。
- site/account.js：作品统一以 task/id 为键；普通管理员看不到题目审核与管理，本人作品只读，删除只给高级管理员；新增「管理 · 全部题目」（搜索、筛选、发布者、作品与盲评池统计、编辑含投稿开关与封面、撤下 / 恢复、无票可删）；审核弹窗改「发布者」，数据包作品用前端资源。
- site/submit.js：工作人员上传不显示内容审核阶段；关闭投稿的提示。site/featured.js：去掉 show1-005 写死封面，改读题目 cover。site/prompt-variants.js、site/arena.js 跟随；platform.css / studio.css 加全部题目工具栏与站点头像样式。
- test/frontend-api.test.mjs、scripts/integration-smoke.mjs 改为 v2 口径；docs PRODUCT / ARCHITECTURE / DESIGN 同步。

## 决策

- 保留数据包 + 数据库两种物理存储，只统一接口；存储分流留在后端内部。
- 公开页统一显示发布者，管理员（两级）发布的显示站点名；数据包内容视为管理员发布且已通过。
- 管理员对数据包内容的操作与数据库内容相同，删除数据包条目等于永久隐藏。
- 管理员发的作品跳过 AI 审查直接进核验；管理员发起的题目也进题目审核队列。
- 三级权限：高级管理员（运营）可做全部、可审自己的；普通管理员只做作品内容审核与核验，不能处理自己的作品，不能审核 / 编辑题目、删除、管理角色；现有管理员全部算高级。
- 前端推断（已告知用户）：普通管理员可编辑作品信息、撤下、开关盲评；核验数量包含自己的作品。

## 验证

- `npm run check` 51/0，`npm test` 19/19，`npm run build` 177 件 / 61 site 文件，`CI=1 npm run check:intake` 0 错 / 9 既有警告。
- 合成 v2 后端（scratchpad mock）与真实后端（`output/unify-authorship-20261003/harness.mjs`，临时库 + 3c82309f 数据包）在 Browser 核对题库、题目页、查看器、全部题目、核验队列、个人中心、关闭投稿、三种角色权限、批量核验 task/id 回传、普通管理员越权 403、apiVersion 1 时降级为静态存档。
- `SERVER_REPO_DIR=../arenaofbias-server node scripts/integration-smoke.mjs` 通过（API v2, pinned 3c82309f65ec）。
- 未测：手机宽度、浅色主题、Safari / Firefox、真实上传与试加载、沙盘 / 展厅实际渲染、生产迁移。

## 明确没做

未推送、未部署、未改生产或数据仓；后端源码不在本会话修改范围。

## 遗留物

- 本地 dist/ 已由本轮 build 覆盖。
- `.claude/launch.json`（本地忽略）新增 unify-v2-mock、unify-v2-real；harness 在忽略目录 output/unify-authorship-20261003。
- 工作区他轮未提交的 HANDOFF 段落与 docs/archive 文件未纳入本轮提交。

## 下一步建议

- 前后端须同版本发布 v2；上线后由高级管理员在「全部题目」为 show1-005 重新指定封面 gemini-4.x-high。
- 发布前补测手机宽度与浅色主题。
