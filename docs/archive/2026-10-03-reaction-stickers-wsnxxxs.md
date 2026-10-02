# 2026-10-03 · 表情互动换成原创动图贴纸 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Claude Opus 5.5

## 本轮目标

用户提供本机 QQ 表情预览包，选定 339/387/424/405/478/321/351/476/479，要求学习后重绘以规避版权，替换现有 emoji 表情互动，做好动图与交互动画，已有互动可全部清除。

## 改动

- 新增 site/stickers.js：9 个原创 SVG 贴纸（lick 舔屏 / lol 太好笑 / press 按一下 / luck 好运来 / yes 同意 / drool 馋了 / knock 敲敲 / stare 盯 / no 不行），共享渐变首次渲染时注入 body。
- site/platform.js：表情条、选择器改用贴纸；新贴上时弹跳、播放一次并飘出放大副本。
- site/account.js：作品摘要与「获得的表情」改用贴纸，摘要只显示白名单 id。
- site/platform.css：reactions 段重写，加入贴纸动画（默认停首帧，悬停 / 聚焦 / 刚贴上时播放，prefers-reduced-motion 关闭）。site/studio.css：「获得的表情」可换行，手机 5 列。
- 配套后端 arenaofbias-server 同日提交（EMOJIS 改 id、迁移清空 reactions、个人中心只计白名单）。

## 决策

- 只参考原表情的动作与情绪，造型、配色、线条全部重画，不使用原图像素。用户确认两轮预览：「太好笑」整圈 360° 翻滚，「按一下」连续狂拍。
- 前后端一起改，贴纸用英文 id 作为接口值；用户确认清空全部互动，包括 Show1 的 👍/👀/🤯 表态。
- 混有他人未提交改动的文件只提交本轮表情相关部分。

## 验证

- `npm run check`：49 文件 / 0 错；`npm test`：19/19。
- `npm run build`：有读取权限的数据仓构建 182 件 / 60 site 文件，含 stickers.js。
- `CI=1 npm run check:intake`：0 错 / 10 条既有警告。
- 合成接口 output/reactions-20261003/harness.mjs + Edge 无头：选择器、贴上 / 高亮 / 撤回、计数、飘出副本自动移除、锁定作品禁用、桌面与 375px 无横向滚动、减少动态效果均符合预期，console 无业务错误。
- 未跑：真实后端联调、生产迁移、浅色 / 暗色主题逐一目检、Safari / Firefox —— 原因：本轮未部署，无对应环境。

## 明确没做

- 未推送、未部署，生产数据未动。未改 Show1 前端。

## 遗留物

- output/stickers-preview*.html、output/reactions-20261003/（忽略目录，验证脚本与截图）。.claude/launch.json 增加 reactions-fixture（本地忽略文件）。
- 工作区其他未提交改动（模型 / 审核 / vendor 等）属他人轮次，未纳入本次提交。

## 下一步建议

- 前后端同版本上线；上线后在真实页面目检两种主题与手机端动画。
