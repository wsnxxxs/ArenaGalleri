# 2026-10-01 · 服务商二值与隔离联调 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Codex desktop；GPT-6.1 Sol（medium）子代理复核前端契约

## 本轮目标

提交现有三处前端服务商修改，验证上传、编辑、管理员核验与非官方榜单筛选，补齐交接和归档，按用户授权推送。

## 改动

- site/work-fields.js、site/account.js、site/app.js 固定服务商选项为未注明 / 官方 / 非官方，仅发送 providerId；旧平台 ID 或名称显示为非官方。移除服务商自由文本、相似名称提示和对 bootstrap.providers 的依赖，保留 Harness 功能。
- site/leaderboard.js 修正旧说明：服务商未填写才为未注明，Harness 的其他及未保存来源的旧投票沿用未注明规则。两侧来源都符合才计票的规则保持。
- PRODUCT、DESIGN、HANDOFF 同步。收尾基线 main@af1f63b，保留他轮已提交的启动与媒体缓存改动；本轮一条英文提交，身份 wsnxxxs，提交号见 Git 历史。

## 决策

前后端配套发布，后端先完成 v25 迁移再启用前端写入。生产固定包不变；本轮仅提交与推送，没有部署授权。公开源码 CI 不读取私有包。

## 验证

- 当前源码 npm run check：43 文件 / 0 错；npm test：14/14；固定包 npm run build：121 件 / 57 site 文件。
- 固定包 CI=1 npm run check:intake：121 个过期海报指纹错误 / 4 条既有提示，未通过；本轮没有修改海报渲染代码或生产 pin。
- 用现有工具在忽略目录创建隔离 Gallery 和独立后端数据库，匹配的本地包构建 182 件 / 57 site 文件，严格 intake 0 错 / 9 条既有提示；真实跨仓 integration smoke 通过。本地开发包不作为正式发布包。
- Browser 实际操作：选择 HTML、试加载 iframe 内按钮、非官方上传；作者编辑改官方、清空、再改非官方；管理员核验把官方改非官方并通过，刷新列表显示非官方。
- 上述五次写请求均 200，字段不含 providerOther/providerName。非官方榜单请求成功，filters 回显 unofficial，样本票为 1 票 / 1 人 / 2 配置；bootstrap 两项 providers 及作品二值/null、无 providerName 通过断言。
- 编辑、核验与榜单截图目检通过，捕获 console error 0；git diff --check 通过。推送后的源码门禁由现有 GitHub Actions 执行，最终结果见 Actions。

## 明确没做

未部署、改消费者 pin、发布前端站点、写生产库；未验证真实 SMTP、Turnstile、外部内容审核/截图服务、手机或真机性能。本轮浏览器验收使用隔离账号、样本作品与票。

## 遗留物

隔离环境及请求证据、截图保留于忽略的 output/provider-binary-20261001-4d06e23b/，不提交。原数据缓存与本地配置保留；没有修改或删除他人未提交文件。

## 下一步建议

发布前按后端迁移顺序部署，并为当前渲染代码选择已验证的不可变数据包后更新消费者 pin、重跑发布门禁。
