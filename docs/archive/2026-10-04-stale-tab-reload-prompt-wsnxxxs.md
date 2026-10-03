# 2026-10-04 · 跨发布旧标签页的刷新提示 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Claude Opus 5.5（Claude Code）
- 范围：Gallery 前端 `scripts/cache-bust.mjs`、`site/app.js`、`test/cache-bust.test.mjs`、`docs/ARCHITECTURE.md`。部署侧由另一个 agent 在后端仓库 `docs/deploy.md` 完成（见该仓库 `docs/archive/2026-10-04-gallery-version-deploy-wsnxxxs.md`）。

## 本轮目标

承接同日 domainGroups 加载失败调查（该轮归档在本地，未随本提交）：标签页跨发布打开时，懒加载的新模块链接到已加载的旧模块而失败。用户要求加载失败时检查版本变化，确认有新版后提示「页面已更新」，提供保留当前地址的整页刷新，避免卡住；后端部分给提示词交另一个 agent。

## 改动

- 构建：`cacheBustSite` 末尾写出 `dist/version.json`，内容 `{"assets": "<与 ?v= 相同的版本>"}`。
- 前端：`app.js` 以自身 `import.meta.url` 的 `?v=` 为本标签页版本。平台页面、原作展厅、题目页榜单动态加载失败时，`no-store` 读取 version.json：版本不同显示「页面已更新」与唯一主按钮「刷新页面」（`location.reload()`，保留含 hash 的地址）；版本相同、读取失败或本地无 `?v=` 时显示原错误，加「刷新页面」并保留原返回链接。榜单此前无 catch，现在在榜单区内提示。
- 测试：cache-bust 测试断言 version.json 内容。
- 文档：ARCHITECTURE 补 version.json 的用途与发布顺序。
- 均在本轮同一提交中。

## 决策

- 只在加载失败后检测，不轮询、不预检；这是恢复入口，不是版本隔离。若要求旧标签页跨发布继续可用，需要按版本保留静态资产，本轮不做。
- 部署必须最后发布 version.json，且不能长缓存；无 version.json 的旧服务器上新前端退回「原错误 + 刷新」，上线顺序不受限制。

## 验证

- `npm run check`：56 文件 / 0 错；`npm test`：22/22。
- 浏览器：临时叠加服务（`site/` 当前源码 + 现有 dist 数据，未写 dist）模拟旧标签页。页面加载后令 exhibition.js 产生同类命名导出错误并改 version.json，hash 进入 `#/chinese-architecture/exhibition` 显示「页面已更新」；点击刷新后地址不变、导航类型为 reload、展厅正常打开。版本未变时显示原错误、刷新与「返回作品」。
- 未跑：`npm run build`、`CI=1 npm run check:intake` —— 原因：当前 `.datapack/` / `dist/` 是参考图一轮用 `DATAPACK_LOCAL_DIR` 生成的本地包，避免覆盖。平台页面与榜单分支需要后端，未在浏览器验证；截图因预览窗口不绘制超时，以页面文本核对。

## 明确没做

- 未部署、未推送。未处理展厅卡片「重新打开」误触整页刷新的既有问题（已另开任务）。

## 遗留物

- 提交只含本轮改动片段；`site/app.js`、`HANDOFF.md`、`docs/ARCHITECTURE.md` 中参考图等其他轮次未提交的改动仍留在工作区。临时服务与 launch 条目已移除。

## 下一步建议

- 发布时按后端仓库 deploy.md 最后上传 version.json，并用 `curl -I` 核对 200 与 no-cache。
- `exhibition.js` 的 `data-reload="<id>"` 会命中 `app.js` 全局整页刷新处理，建议改名。
