# 2026-10-01 · 去掉页脚版本诊断 · wsnxxxs

- 负责人：wsnxxxs｜执行 AI：Codex。
- 范围：Gallery 页脚和界面规范，以及本轮交接记录。用户授权提交现有修改。

## 本轮目标

提交页脚「版本」删除，更新 HANDOFF.md 并归档。

## 改动

- site/app.js 删除 buildVersion、shortSha 和页脚调用，链接在「联系我们」后结束。
- site/style.css 删除 .build-info 样式；docs/DESIGN.md 删除版本诊断说明。
- 本轮改动和记录合为一条本地提交，提交号见 Git 历史。

## 决策

DATA.buildInfo 保留供写请求版本校验使用；platform.serverVersion 仍赋值但不显示。platform.js 有他人未提交改动，未清理。仅提交本轮差异，无待拍板事项。

## 验证

- 重新运行 npm run check：42 个文件、0 错误。
- 重新运行 npm test：14/14 通过。
- 未运行 build、intake，未做浏览器目检：本轮仅核对和提交现有修改，保留原有验证边界。

## 明确没做

未推送、部署，未修改其他功能或数据仓库；未验证页面交互。

## 遗留物

注册邮箱绑定相关源码和 HANDOFF.md 中该轮记录继续留在工作区，未纳入本轮提交；未跟踪的 .claude/ 保留。

## 下一步建议

发布前按范围补充构建、intake 和浏览器目检。
