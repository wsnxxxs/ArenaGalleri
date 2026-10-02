# 2026-10-02 · 模型名称单一输入与 Harness 选项 · wsnxxxs

- 负责人：wsnxxxs｜执行 AI：Codex。
- 范围：Gallery 共用作品表单和本轮记录；用户追加的 Harness 注册项在独立数据仓维护，本仓只消费新本地数据包，后端源码未改。

## 本轮目标

去掉「模型 / 其他模型」与「模型名称」重复的填写步骤。用户补充：优先选已登记模型，找不到可自定义。另给 Harness 增加 WorkBuddy 与 MiniMaxcode。

## 改动

- `site/work-fields.js`：一个「模型名称」输入框带已登记候选，名称和厂商不再拆成独立输入；精确匹配候选时发送 `modelId`，其他名称发送 trim 后的 `modelName`。已登记与自定义作品直接回填名称，空白名称不可完整提交。
- 模型候选从同一表单里的 datalist 解析，支持管理员批量核验所用的未挂载表单；投稿、作者编辑、内容审核和核验继续共用。
- 数据仓注册 `workbuddy` / WorkBuddy 和 `minimax-code` / MiniMax Code。Gallery 正常消费其本地组装包，前端未硬编码 Harness，未修改私有生产 pin。
- `docs/PRODUCT.md` 与 `HANDOFF.md` 记录产品行为和验证范围。以上改动纳入本轮一条英文简单句提交，提交号见 Git 历史。

## 决策

- 模型名的选择与自定义共用同一个输入；自定义仅作为作品声明保存，不自动加入权威模型注册表。登记模型的厂商由后端对应。
- 上轮截图里的 Custom Max 是隔离测试输入，用于验收自定义档位，不是内置候选或业务数据。本轮截图使用 GPT-6.1 Sol / High。
- Harness 注册表归数据仓；两个消费方正式发布时应使用同一新数据包。没有待拍板事项；本轮不推送、发布或部署。

## 验证

- Gallery `npm run check`：45/0；`npm test`：18/18。
- `npm run build`：先用既有固定包验证模型输入，再使用 DATAPACK_LOCAL_DIR 消费含新 Harness 的本地包；均为 182 件 / 57 site 文件。
- `CI=1 npm run check:intake`：既有固定包 0 错 / 8 提示；新本地包 0 错 / 10 条既有数据资源提示。差异来自数据仓已有最新模型资源，不由本轮注册项产生。
- 当前真实后端 + 隔离合成数据库：作者空白模型名被阻止且未发送写请求；登记模型保存为 `modelId` 并回填规范名称与厂商；自定义名称保存为 `modelName`，去掉首尾空格。管理员分别保存自定义与登记模型，SQL 确认 `model_id` / `model_other` 正确，关闭重开回填正确；批量通过核验成功。
- 新数据包同时供前端与后端读取：作者选择 WorkBuddy、管理员选择 MiniMax Code，API 200，SQL 确认对应 `harness_id`，`harness_other` 清空，重新打开仍为选中登记项。
- Browser 桌面 / 375px 截图目检：仅一个模型名称输入、无其他模型入口、无横向溢出，console 无警告或错误。证据位于忽略的 `output/playwright/model-name-20261002/` 与 `output/playwright/harness-options-20261002/`。
- `git diff --check`：通过。

## 明确没做

未修改后端或业务数据库、未迁移数据、未更改私有 pin。未重跑完整上传文件交互、浅色主题、真实自动审核、SMTP、截图服务或全部作品交互。未推送、发布或部署，不把本地包称为线上包。

## 遗留物

保留自建验收脚本、合成数据库、请求记录与截图，全部位于忽略目录；临时服务与浏览器已关闭。Gallery 生成缓存和 dist 当前来自新本地数据包，重新普通构建会按既有固定 pin 消费发布包。没有清理他人文件。

## 下一步建议

正式发布新 Harness 时，让 Gallery 与后端消费同一已发布数据包，并重新核对生产选项及保存。
