# AGENTS.md

接手后先阅读 `HANDOFF.md`；轮次记录在 `docs/archive/`。

- 不过度设计防御或测试，只改本轮涉及的文件。
- 本仓库只维护 Gallery 前端及消费端构建工具，不合并另一前端、共享后端或数据仓库。
- 作品源码、提示词、截图、模型包、海报和注册表由独立私有数据仓库维护。前端仅消费已验证的数据包，不在 `site/` 提交作品资源副本。
- `datapack.json`、`integration.json` 是忽略的本地配置。公开仓库只保留占位示例，不能加入真实数据仓库地址、数据版本历史或凭据。
- 公开 CI 只检查源码及合成数据测试；禁止下载、缓存或上传私有包，不恢复 Pages 发布。
- `dist/`、`.datapack/`、`.integration/`、`output/`、`node_modules/`、日志和本地业务数据是生成物，不提交、不手改。禁止无差别清理。
- 他人未提交、未跟踪的文件不改、不删。做法或范围不清时先确认；不把文档中的候选想法当作任务。
- 未获用户授权不 commit 或 push。获准后每轮一条英文简单句提交，身份使用负责人的 GitHub 用户名和 noreply 邮箱。
- 修改后运行 `npm run check`、`npm test`；有数据读取权限时再运行 `npm run build`、`CI=1 npm run check:intake`，目视核对影响页面。如实记录未执行的验证，不把构建成功称为全部交互通过。
- 任务过程中只更新根目录 `HANDOFF.md`；完成、推送前按 `docs/archive/_TEMPLATE.md` 归档。长期约定集中于本文件，不创建决策日志。
