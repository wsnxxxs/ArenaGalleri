# 2026-10-02 · 补齐 Harness 与常用优先排序 · wsnxxxs

- 负责人：wsnxxxs｜执行 AI：Codex。范围为共用表单排序、产品说明及本轮记录；9 个注册项由独立数据仓维护，Gallery 通过正常本地数据包消费。

## 本轮目标

补齐 Cherry Studio、Chatbox、Open WebUI、LibreChat、LM Studio、AnythingLLM、Continue、Kiro、Amp，并按用户授权判断常用程度，把常用选项排在前面。

## 改动

- site/work-fields.js 的 Harness 候选保留数据注册表顺序，去掉按名称排序；投稿、作者编辑、内容审核和核验继续复用该表单。其他仍在末尾，历史已选未列出项保持兼容。
- 数据仓共 38 个登记项；前 14 项为 Claude Code、Codex、Cursor、Cherry Studio、官方网页 / App 对话、Gemini CLI、GitHub Copilot、Trae、OpenCode、Kimi Code、WorkBuddy、Qoder、Cline、Chatbox，其余工具排在后面。
- docs/PRODUCT.md 同步常用优先和新增选项。未在前端硬编码注册项或加入作品资源。
- 本轮一条英文简单句本地提交，提交号见 Git 历史；未推送。

## 决策

常用程度由用户授权人工判断，顺序统一由数据仓提供；无需新增使用统计、后端接口或数据库迁移。前后端正式发布时应消费同一新包。

## 验证

- check 45 文件 / 0 错、test 18/18、diff --check 通过。
- DATAPACK_LOCAL_DIR 消费新本地包，build 182 件 / 57 site 文件；严格 intake 0 错 / 10 既有数据提示。
- 数据仓 check 34/0、test 16/16、严格 intake 182 件 / 0 错 / 10 既有提示、assemble --data 182 件 / 20 题。
- 已提交后端基线 83e43fe 的独立导出 + 隔离合成数据库验证 9 个新增 ID 保存均返回 200，SQL 确认 harness_id 正确、harness_other 清空。
- Browser 管理员测试账号从「我的作品」选择 Cherry Studio 保存、重开正确回填；内容审核选择 Amp 点「只保存信息」，保存成功，SQL 落值正确。两种表单的全部 38 个登记项顺序一致、其他在末尾，桌面截图目检，console 无错误或警告。
- 当前后端工作区因他轮尚未完成的 login-security.mjs import 不能启动，未修改其源码，联调使用已提交版本。未重验完整上传、普通用户权限、手机、浅色、生产、自动审核、SMTP、截图服务或全部作品交互。

## 明确没做

未改真实业务数据库、作品来源或私有 pin，未推送、发布数据包或部署；本地包不作为线上已发布包。

## 遗留物

dist 和 .datapack 当前来自新本地包；普通构建仍按原私有 pin 消费已发布包。验收脚本、已提交后端导出、合成数据库、请求记录及截图保留于忽略 output/playwright/harness-catalog-20261002/，临时服务与页面已关闭。

## 下一步建议

正式发布新不可变包，让前后端同时消费，并部署本轮共用表单的顺序改动。
