# 2026-11-06 · 引导式盲评测试版 · wsnxxxs

- 负责人：wsnxxxs（GitHub ID 269096463，269096463+wsnxxxs@users.noreply.github.com）｜执行 AI：Claude Opus 5.5（Claude Code）。
- 范围：本仓起点 `7d14ebf`（origin/main）；配套后端 arenaofbias-server 同日同名归档。用户授权提交、推送、开 PR 合并并上线。
- 本文写于发布准备时点。测试页的构建、Nginx 与线上验收记在服务器 `/root/aob-guided-trial-20261106/`，不在此预填成功状态。

## 本轮目标

把已定的「停靠问题卡」做成只对管理员开放的测试版，用单独链接访问。正式站保持原样，测试票不计入任何榜单。

## 改动

- `scripts/assemble-site.mjs`：`GUIDED_VOTING=1` 时在 runtime-config 写入 `guidedVoting: true`。只接受 1、0 或空，其他值直接报错。`site/runtime-config.js` 补一行注释，默认不开。
- `site/arena.js`：开关打开时，抽题请求带 `guided: true`，投票栏换成停靠问题卡。
  - 建模题先问一道引导题（1/2），再问综合题（2/2）；其他题只问综合题。
  - 四个选项：A 更好、都很好、都不好、B 更好，快捷键 A/S/X/D。都很好、都不好以 tie 加 tieKind 提交。
  - 虚线关键词点开「看哪里」；「看不出，跳过这题」只跳过引导题；卡片可以收起成一行，收起状态记在本机 localStorage `arena-question-compact`。
  - 卡片头和揭晓行都写明「测试版，不计入榜单」。
  - 未登录或非管理员看到「引导式盲评测试版只对管理员开放」，不抽题，也不弹未登录计票说明。
  - 开关关闭时，投票栏、快捷键（S 为不分伯仲）和状态文案与改动前一致。
- `site/platform.css`：问题卡样式，全部挂在新类名下，不影响原投票栏。
- `site/i18n-experience.js`：问题卡与测试版提示的英文。题面在关键词前后分段，分段翻译。

## 决策

- 测试页是同一份源码的另一份构建，放在正式 Gallery 域名下的单独路径（`/guided-trial/`），不新增域名或 DNS。共用正式后端，由后端强制管理员身份。
- 正式构建不带开关，所以正式站不会出现问题卡；测试版的升降级只需重建或删除该目录。

## 验证

- `npm run check`：118 文件，0 错误。`npm test`：155/155。
- 用本地 `.demo/` 数据包（arenaofbias-data `origin/datapack` 3d2c3f8）分别构建开、关两种版本，配本地后端，在内置浏览器验证：
  - 开：未登录与普通成员被拦下，后端对普通成员返回 403；管理员两步作答后 trial 表写入 tie/good 与 extra_idea=a，votes 不变；卡片布局截图正常。
  - 关：仍是三个按钮，X 键无效，S 键投 tie，显示「已计入大众榜与精选榜」。
- 未跑：标准 `npm run build` 与 `CI=1 npm run check:intake` 用私有 pin 的版本——本机没有私有 datapack.json；测试页在服务器上用正式后端当前的数据包构建，结果记在 receipt。上一轮在本地包上跑 intake：176 件，170 个既有海报过期错误，与本轮无关。

## 明确没做

- 正式 Gallery 目录不重新发布，本轮也不改它的文件。
- 测试版没有新增管理员入口；链接由用户自行发给管理员。

## 遗留物

- 本机占位 `datapack.json`（已忽略）与工作区 `.demo/` 只供本地演示，可以删除。

## 下一步建议

- 试用结束后删除服务器上的测试目录和 Nginx location，再决定问题卡是否进入正式构建。
