# 2026-11-25 · 试运行站全站画廊质感统一与悬浮胶囊顶栏 · Atmeplz

- 负责人：Atmeplz ｜ 执行 AI：Antigravity

## 本轮目标

1. 在不改变各页既有排版结构的前提下，把试运行站（`guided-trial`）题库、首页、题目详情、排行榜、盲评等页面的底色与卡片质感统一到 `#/team` 团队页的展馆语言（浅色画廊纯白底 + 克制亚克力细边卡片；深色暖炭黑底 + 顶部微弱漫射光晕）。
2. 参考浏览器扩展 BewlyBewly 的顶栏设计语言重构常规页 `<header class="topbar">`：去掉整宽背景条与底分隔线，改为左右分置的磨砂玻璃悬浮胶囊岛、独立圆形头像章、船坞右端朱红微发光「`+ 发起题目`」主入口胶囊，以及向下滚动自动收起、向上回滚即刻浮现的交互。
3. 以独立分支 + PR 方式推送至 `wsnxxxs/ArenaGalleri`（目标分支 `sync/vps-trial-20261123`，不覆盖他人工作、不改 `main`），并从已推送提交完整构建上线到 VPS `guided-trial`。

## 改动

以下改动均在本轮分支 `feat/guided-bewly-topbar-texture`（基于 `sync/vps-trial-20261123` `34c6ea4`）提交：

- 全站色彩与亚克力卡片质感（`site/style.css`、`site/studio.css`、`site/platform.css`）：
  - 浅色底色由暖米灰 `#f5f4f0` 统一为画廊纯白 `#ffffff`（次级底 `#f5f5f3`），深色统一为 `#111110` 暖炭黑并在 `body` 增加极淡顶部暖色径向漫射光晕；移除 `#/team` 原本单独覆写的局部底色补丁，全站共享同一套底色与明暗变量。
  - 新增 `--card-border`、`--card-border-hover`、`--card-highlight`、`--card-shadow`、`--card-shadow-hover` 变量，赋能 `.task-card`、`.result`、`.task-act`、`.home-blind`、`.home-card`、`.model-group` 等卡片与控件细边、顶部内高光、微底沿及柔和漫射投影，悬停微抬 `1.5px`。
  - `.app-sidebar` 改为清透画布承载，仅保留精细右分隔线，通过 `--topbar-live` 随顶栏收放平滑贴顶。
- BewlyBewly 风格悬浮胶囊顶栏（`site/app.js`、`site/platform.js`、`site/studio.css`、`site/platform.css`）：
  - `appTopbar` 重构为透明外框 + 左右磨砂亚克力胶囊岛（`46px` 高，手机 `38px`，`border-radius: 999px`，`backdrop-filter: blur(20px) saturate(180%)`）：左侧 `.topbar-left-capsule` 收纳品牌标识与面包屑 / `backLink`；右侧依次为独立圆形账户头像章（已登录 `40px` 正圆头像直达个人中心，未登录 `36px` 人像圆章展开菜单）与 `.topbar-dock` 主功能船坞（`题库 · 盲评 · 排行榜` | 双语胶囊 · 主题圆钮 · 右端朱红微发光 `+ 发起题目` 胶囊）。
  - 向下滚动超过 `72px`（单次增量 `>= 8px`）时为 `<html>` 切换 `.is-topbar-hidden` 平滑上收顶栏；向上回滚（`<= -6px`）、滚回顶部、鼠标移入视口顶部 `22px` 热区或切换路由时即刻浮现；悬停、键盘聚焦、账户菜单展开、灯箱/查看器/提示词弹窗打开时不隐藏。全屏查看器、盲评对战与沙盘顶栏（`.viewer-bar`、`.sandtable-page .topbar`）保持常驻不隐藏。
  - 窄屏（`<=950px` / `<=760px`）自动收拢次要导航至菜单，保留双语、主题切换与紧凑 `+` 出题胶囊。
- 文档同步：`docs/DESIGN.md` 更新色彩 Token 表、卡片质感说明、朱红出题入口与悬浮胶囊顶栏规范；`HANDOFF.md` 增补本轮记录。

## 决策

- **浅色画布与卡片层次**：用户确认采用纯白 `#ffffff` 画布搭配「克制细边 + 内高光 + 柔光投影」卡片，既与 `#/team` 工牌质感同源，又不会在密集题库网格中产生双层套框杂乱感。
- **深色模式统一**：同步对齐 `#/team` 深色炭黑 `#111110` 与微弱顶部暖光晕，卡片采用半透明白细边。
- **顶栏布局保留肌肉记忆**：不设顶栏全局搜索框（避免与题库/作品/榜单页内既有搜索重复），保持左品牌面包屑、右圆形头像章 + 功能船坞的左右分岛布局，船坞末端以朱红微发光「`+ 发起题目`」收口。
- **分支与上线策略**：为避免覆盖任何协作者在 `main` 或 `sync/vps-trial-20261123` 上的提交，本轮新建分支 `feat/guided-bewly-topbar-texture` 并发起指向 `sync/vps-trial-20261123` 的 PR；试运行站严格按 `AGENTS.md` 从已推送提交 `git archive` + 后端当前数据包完整构建部署，不动正式站。

## 验证

- 部署前现场漂移检查：运行后端仓库 `scripts/live-drift.mjs` 对比 `root@114.66.27.88:/www/wwwroot/gallery-guided-trial/guided-trial` 与 `origin/sync/vps-trial-20261123`（`34c6ea4`），`same: 109, differs: 0, onlyGit: 0`（`onlyLive: 19` 为 17 个私有成员头像/赞赏码、`.nojekyll` 与 `sandtable-bridge.js`）。
- `npm run check`：135 个文件，0 错误。
- 单元测试：`node --test --test-timeout=60000 test/*.test.mjs` 共 206 项，198 通过、7 失败、1 超时取消——与基线 `34c6ea4`（见 `2026-11-23-site-redesign-wsnxxxs.md`）失败项完全一致，0 新增失败（其中 `home-refresh` 与 `guided-order` 共 10 项全绿）。
- 本地浏览器只读预览验收：通过本地只读代理连接线上试运行数据，在无头 Chrome 1440×900 与 390×844 下逐页截图核对首页、题库、题目详情、排行榜、`#/team`、`#/team/kme7`、深浅色、英文界面、已登录圆头像态、访客菜单展开态、滚动磨砂透底态与下滚自动隐藏态，`pageerror` 为 0，横向溢出为 0。
- 未在本地跑：`npm run build`、`CI=1 npm run check:intake` —— 原因：本机无私有数据包配置，完整构建与线上核验在推送后于 VPS 使用后端当前数据包执行，结果记入 `/root/deploy-log.tsv` 与父工作区 `HANDOFF.md`。

## 明确没做

- 未修改或合并 `main` 分支，未触碰正式站 `/www/wwwroot/gallery`（`5e93473d809a8e84d9a0ca63`）、后端服务、SQLite 数据库或 Nginx 配置。
- 未改动本地主检出 `d:\webarenabias\ArenaGalleri` 中既有的未提交文件（全程在独立 git worktree 中完成）。
- 未将 16 张团队成员照片与赞赏码提交入公开仓库（部署时继续由 VPS `/root/private-assets/gallery-guided-trial/assets` 覆盖）。

## 遗留物

- 父工作区 `.local/guided-gallery-texture-20261125/`：本地只读预览代理、阶段副本与验收截图，可随时清理。

## 下一步建议

- 待团队在试运行站体验确认后，可将 PR 合并入 `sync/vps-trial-20261123` 作为试运行站新基线。
