# 2026-10-02 · 题目「形式 + 领域」两轴与领域排行榜 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Claude Code

## 本轮目标

题目分类只有文学 / 静态网页 / 建模三项，数学、化学这类内容放不进去。拆成「作答形式」与「所属领域」两条轴，题库、发起、审核、盲评大厅和排行榜一起支持；配套后台（arenaofbias-server）与数据仓（arenaofbias-data）同轮完成。

## 改动

均在本条提交内。

- site/categories.js：形式加显示名（文本 / 网页 / 三维，存储值不变）；领域默认词表、`domainsOf`、`domainsIn`、`domainList`（优先 bootstrap `domains`）。
- 题库（site/app.js）：侧栏「领域」胶囊，与形式叠加，网址 `#/questions/<形式>/<领域>`；卡片「形式 + 领域 + 标签」；题目页领域链接回题库。
- 发起题目（site/publish.js）：领域必选 1–2 个；审核弹窗（site/account.js）通过时可修正形式与领域。
- 盲评大厅（site/arena.js）显示与搜索领域；排行榜（site/leaderboard.js）领域下拉、`#/leaderboard/[<形式>/]<领域>`、样本不足提示（少于 2 题或 50 次有效比较）、计分说明补领域与计入口径。
- scripts/public-catalog.mjs 透传 `domains`，合成数据测试补断言；docs/PRODUCT.md、HANDOFF.md 同步；site/studio.css 领域样式。

## 决策

- 形式只改显示名不改存储值，链接、投票与后台不用迁移。
- 领域只用于浏览与排行榜范围，不决定提交格式；榜单仍以形式分组，领域榜与形式榜同法重新拟合，一题两领域时两边都完整计入。
- 「有效比较」只数实际计分的比较（后台改动）。
- 待拍板：标签是否保留（用户已提出改为匹配提示词关键词，另轮处理）。

## 验证

- `npm run check` 44/0、`npm test` 16/16、`npm run build` 182 件 / 57 site 文件、`CI=1 npm run check:intake` 0 错 / 9 既有提示。
- Browser（scratchpad 注入领域的静态服务与 mock API，未改 dist）：题库叠加筛选、深链、手机 375 宽无横向滚动；排行榜天文样本不足、三维 · 建筑请求与题目下拉、取消领域；发起题目领域上限锁定；真实数据（无 domains）降级正常；console 0 错。
- 未跑：管理员审核弹窗与真实后台联调 —— mock 无管理员会话，未连接生产。

## 明确没做

未推送、未部署、未改 datapack pin；文本作品公式渲染、评判要点、首页领域入口未做。

## 遗留物

另一会话的返回与层级改动（site/app.js、site/studio.css、site/sandtable.css、site/platform.css、site/account.js 部分）仍在工作区，未纳入本提交。

## 下一步建议

按 HANDOFF 顺序发布数据包、改 pin、部署后台与 Gallery；已上线社区题目的领域由管理员补齐。
