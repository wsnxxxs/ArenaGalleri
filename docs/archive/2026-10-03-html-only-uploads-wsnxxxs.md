# 2026-10-03 · 网页 / 三维作品只收单个 HTML · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Claude Opus 5.5

## 本轮目标

网页和三维作品原先可上传 ZIP 或单个 HTML。用户要求去掉 ZIP，只收 30 MB 以内的单个 .html，并保持前后端链路兼容。

## 改动

- site/categories.js：网页、三维的格式只剩 `static`（「单个 HTML 文件」），删去 `vite`；templatesOf 把旧题目存的 `vite` 归并为 `static` 并去重。
- site/submit.js：选择器只接受 .html / .htm，拒绝 .zip；网页类上限取 min(后端 uploadBytes, 30 MiB)，文本仍用后端上限；文件要求改为资源内联、不接受 ZIP、裸模块名需写 importmap；去掉格式下拉框的 Vite 文案。
- site/publish.js：发起网页 / 三维题时提交格式固定为 `["static"]`。

## 决策

- 只改前端。生产 bootstrap 中 3 道社区网页 / 三维题均为 `["static","vite"]`，没有只收 vite 的题；后端 uploadBytes 已为 31457280，compatibleTemplates 接受 `["static"]`，所以统一发 `template=static` 可兼容。
- 已有 ZIP 作品、馆藏 `*-zip` 作品与未过期 ZIP 草稿续传不受影响。
- 待定：后端仍接受直接调用 API 上传的 ZIP；如需服务端也禁止，需在后端 inspectUpload / createDraft 拒绝 ZIP，defaultTemplates 改为 `['static']`。

## 验证

- `npm run check`：48 文件 / 0 错；`npm test`：19/19。
- author-mock（site 叠加 dist）Browser 验证：上传页 accept 为 .html、无格式下拉框、显示「最大 30.0 MB」；.zip 被拒；30 MiB + 1 字节的 .html 提示超限；发起题目选「三维」后格式固定为单个 HTML（templates=static）。
- 未跑：`npm run build`、`CI=1 npm run check:intake` —— 原因：未改构建与数据。未联真实后端实际上传。

## 明确没做

- 未改后端，未部署。同轮数据仓提示词改动见数据仓归档。

## 遗留物

- HANDOFF.md 中他人未提交的章节保留在工作区，未随本轮提交。

## 下一步建议

- 视需要让后端同步禁止 ZIP 上传。
