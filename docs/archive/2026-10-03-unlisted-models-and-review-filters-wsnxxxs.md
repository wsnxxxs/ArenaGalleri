# 2026-10-03 · 未收录模型厂商推断、上传自定义厂商与审核筛选 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：多轮会话完成实现，Claude Opus 5.5 收尾提交

## 本轮目标

把 10-02 至 10-03 期间几轮已在本地完成、尚未提交的工作合并提交，并补齐文档：

1. 上传表单补回自定义模型的厂商输入。
2. 未收录模型不再一律显示「厂商未知」：可以推断厂商，并在界面上标明。
3. 审核页「已处理」新增「机审拒绝」「疑似注入」筛选，所有筛选显示数量。

## 改动

- site/models.js（新增）：`modelResolver`。登记模型直接返回注册表条目。未收录模型优先使用投稿者填写的厂商，其次按名称开头的系列词推断；同一系列对应多家厂商时不推断。名称或别名与登记模型相同（忽略大小写、空格、-、_）时直接归入登记模型。结果带 `unlisted: declared | inferred | unknown`。
- scripts/public-catalog.mjs：模型字段输出 aliases。
- site/app.js：`modelOf` 改用 resolver；新增 `registeredOf` 与 `exhibitedModels`。模型索引、题库侧栏和首页的「X 家厂商 · Y 个模型」只统计有已验证作品的登记模型。按模型筛选和模型计数改按登记 id 匹配。
- site/ui.js：新增 `vendorLine`；`brandMark` 对推断不出厂商的模型改用虚线。site/style.css、site/studio.css 增加对应样式。
- site/leaderboard.js、site/arena.js、site/account.js、site/home.js：榜单、盲评揭晓、我的作品 / 审核行和首页统计都改走 `ctx.modelOf` 或 `exhibitedModels`。
- site/work-fields.js：名称不匹配登记模型时显示选填「模型厂商」，并预填推断的厂商，不覆盖用户手填的值。请求随 `modelName` 发送 `vendor`。
- site/platform.js：新增 `riskLabels`、`autoRejected`、`injected`。site/account.js：已处理新增 machine / injection 筛选，筛选带数量，风险类别显示中文。
- test/models.test.mjs（新增，合成数据）。
- docs/PRODUCT.md：投稿厂商与审核筛选。docs/DESIGN.md：未收录模型标识。
- 以上改动与本归档同一提交。

## 决策

- 「未收录」和「厂商未知」是两回事：已推断或已声明的厂商照常显示，只附加「未收录」标记。
- 模型数量只统计有已验证作品的登记模型（用户决定）。
- 筛选数量由 `/api/review` 的作品列表统计；以后需要在标签上提醒时，可以改读 bootstrap.review 的 autoRejected / injected。

## 验证

- `npm run check`：49 文件 / 0 错；`npm test`：19/19（提交前重跑）。
- 实现期间：`npm run build` 181 件 / 58 site 文件，严格 intake 0 错 / 10 条既有警告。在 mock 与生产公开数据回放中用 Browser 核对了榜单的 6 种厂商情况、题库筛选、编辑弹窗预填，以及 13 件自定义名称投稿的归类，详见当时的 HANDOFF 记录。
- 未跑：管理员审核详情目检、浅色主题、手机宽度、真实后端联调 —— 原因：当轮没有对应环境。审核筛选没有做浏览器目检。

## 明确没做

- 未推送、未部署。后端恢复保存 vendor、在榜单行返回声明的厂商、9 件同名投稿迁移到登记 id，都由后端仓库负责。

## 遗留物

- output/backend-model-registry-prompt.md（忽略目录，交给后端的说明）。scratchpad 下的 mock / replay 脚本。

## 下一步建议

- 后端完成 vendor 列与同名迁移后，用回放再核对一次榜单计分。
- 数据仓统一 ByteDance / ByteDance Seed、Z.ai / Zhipu AI 的写法。
