# 2026-10-03 · 作品控件显隐开关 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Codex 父代理，3 个 GPT-6.1 Sol / high 子代理。
- 范围：Gallery 盲评和并排查看器、相邻后端的折叠脚本与内容分发。本轮每仓一条英文提交，未推送、未部署。

## 本轮目标

为默认隐藏的作品控件提供可操作的开关，并让并排比较也消费已有 fold.js；保留原作 DOM、状态与正常单栏体验。

## 改动与决策

- site/arena.js 接收当前 iframe 的 sp-fold 计数，计数大于零才显示开关；发送 sp-arena 同时切换两侧，换组重置、单侧重载保留选择，销毁清理监听。
- site/app.js 与 site/work-controls.js 实现并排开关。投稿 URL 追加 aob=fold，保留参数 / 片段；馆藏同源 /results/ iframe 加载完成后读取 GET /api/fold.js 并注入，直接消费后端同一份脚本。替换窗格、退出并排与销毁清理跟踪；单栏和新窗口不启用折叠。
- API 域名已在 Gallery CSP 中，内容域名不在 connect-src，所以脚本通过 API 获取。没有增加脚本副本或放宽安全策略；API 不可用时馆藏原控件保持可见。
- 配套后端按 aob=fold 注入公开 / 预览作品，支持 aob=bridge&aob=fold；后加载脚本立即扫描，检测规则、6 块 / 40% 保护和后续扫描保持。
- docs/PRODUCT.md、docs/ARCHITECTURE.md 和后端 docs/api-contract.md 记录消费行为与协议。无待拍板事项。

## 验证

- Gallery npm run check：51 文件 / 0 错；npm test：19/19。
- npm run build：181 件作品 / 61 site 文件，无碰撞；CI=1 npm run check:intake：0 错 / 10 条既有提示。
- 后端 npm run check：88/0；npm test：254/254。新增回归覆盖公开 opt-in、无参数脚本资源、bridge/fold 并用、脚本原字节 / CORS / HEAD、后加载即时扫描。
- Browser 使用真实 Gallery 模块和真实内容 handler、合成作品 / 对局接口：双侧显隐、亮度 / 风扇状态保留、单侧重载、无控件新组不显示按钮、8 悬浮按键不折叠、投稿参数保留、退出并排恢复单栏通过。
- 实际数据包作品：GLM 台灯亮度变为 100%、选择暖光后折叠 / 展开保持；Sol 台灯控件可显示；Sol 787 启动双发风扇后折叠 / 展开仍为运行状态。台灯与 787 截图目检。390px 盲评切栏与并排开关通过，页面 scrollWidth=390，无 console error。

## 明确没做

未 push / 部署；未修改另一前端、数据仓、原作 / 数据包、数据库或部署配置。未验收生产登录 / 上传 / 投票、全部作品、Safari / Firefox、手机真机或全部交互。

## 遗留物

output/fold-controls-20261003 下为忽略的验证 harness、合成 HTML 和截图。dist / .datapack 为本地构建产物。本轮开始前已有 HANDOFF 与协调发布记录改动、两份调查 / 审查归档保持原样，不纳入本轮提交。

## 下一步建议

若用户要求上线，先同步本轮 Gallery 与后端，再验收生产 API 脚本与上传 / 馆藏对比。
