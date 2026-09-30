# HANDOFF.md · 当前状态

更新：2026-09-30。接手时先读本文件，再按任务查阅专题文档；已完成轮次保存在 `docs/archive/`。

## 当前状态

- 本仓只维护 Gallery 前端和消费端构建工具。另一前端、共享后台与私有作品数据分别维护；真实配置、数据版本及运维备份通过私有渠道管理，公开仓库仅保留占位示例。
- main 已包含提示词版本切换、同模型结果分组、双栏独立作品版本切换，以及跳过空题榜单读取的修正。维护整理开始时 main 与 origin/main 均为 `28eba10`；`codex/shared-question-intake` 的提交已全部合入。
- 已删除合并完成的远端 `codex/shared-question-intake` 分支，当前无开放 PR。本地同名分支仍由已有 worktree 使用，保留该 worktree 与本地分支。
- 最近一次已记录的正式部署是 `ccfd11d`（2026-09-30）：20 道题、83 件既有作品。SupernovAI 与云山巨城各有长短两份原文、当时各 0 件作品。原文与复制已验收，生产同模型长短结果配对仍无样本。这是当轮发布记录，本轮文档整理未重新部署或做线上验收。
- 正式站已记录安装 Gallery/API/作品域名私有文件规则和共享读取、模型包及并发限制。部署、回滚与验证边界见发布归档；备份具体路径及回滚步骤保留在独立后台运维交接。

## 待办与验证边界

- 没有待合并功能或待部署步骤。后续收录这两题作品时，在私有数据仓库填写实际 `promptVariant`；长短结果到位后再核对真实同模型卡片与双栏切换，不伪造生产样本。
- 最近发布未覆盖手机、全部原作、生产登录投票/投稿或付费审核。新增改动按影响范围验证，不能把构建成功或原文检查称为全部交互通过。
- 本轮文档整理通过 39 文件语法检查、14/14 合成数据测试、文档链接和差异检查；未运行完整 build、intake、跨仓联调或浏览器验收。本地私有配置、缓存及另一 worktree 保留，不纳入提交。

## 维护入口

- [长期约定](AGENTS.md) · [本地检查与授权构建](README.md)
- [架构](docs/ARCHITECTURE.md) · [产品行为](docs/PRODUCT.md) · [界面规范](docs/DESIGN.md)
- [收录流程](docs/intake-workflow.md) · [模型预览](docs/preview-loading.md) · [沙盘](docs/sandtable.md)

## 历史索引

历史记录描述各轮当时状态；后续合并、部署结论以较新的发布记录为准。

| 轮次 | 记录内容 |
| --- | --- |
| [repository-cleanup](docs/archive/2026-09-30-repository-cleanup-wsnxxxs.md) | 文档整理、已合并远端分支清理与本轮验证范围 |
| [shared-question-release](docs/archive/2026-09-30-shared-question-release-wsnxxxs.md) | 版本切换合并、20 题正式发布、空题榜单修正、验证边界 |
| [protection-deploy](docs/archive/2026-09-30-protection-deploy-wsnxxxs.md) | 独立 Gallery 部署、私有文件与共享限流验收、备份位置说明 |
| [shared-question-intake](docs/archive/2026-09-30-shared-question-intake-wsnxxxs.md) | 功能分支交付与本地验收；当时尚未合并，现已由 release 完成 |
| [clean-gallery-migration](docs/archive/2026-09-30-clean-gallery-migration-wsnxxxs.md) | 干净仓库迁移、公开/私有边界和初始验证 |
