# 2026-10-03 · MiniMax 787 盲评加载修复 · wsnxxxs

- 人员与范围：Codex 主代理；Gallery 消费验证与独立后端修复，无子代理。

## 本轮目标与改动

用户要求修复此前排查的 MiniMax M3.1 Max 787 盲评加载失败。功能修改在独立后端：默认 CDN 加入 npmmirror，但 CSP、截图网络守卫和上传检查均只允许 Three.js 0.170.0 的固定路径；控件折叠保留错误重试区。Gallery 仅更新 HANDOFF 与本归档，未改功能源码或作品资源。

## 决策

保留原作和作品 origin 隔离；正常面板继续按既有规则折叠。独立后端功能按会话授权以一条英文提交保存。本仓无功能提交，不把原有交接或其他轮次文件夹带进提交。未 push/部署。

## 验证

- Gallery check52/0、test19/19、build176件/62site、严格intake0错/8既有提示；后端 check86/0、test261/261。
- Browser 本地实际内容 handler + 缓存原作 + 合成 m key：默认桌面下 npmmirror 正常渲染，普通面板折叠；模拟源被拦截时三个换源按钮可见，点击 unpkg 恢复。实际390×844宽度下验证错误按钮可见且无横向溢出、unpkg 恢复、默认 npmmirror 渲染。手机普通面板保留是既有面积保护行为。
- 手机默认源首次等待加载层隐藏曾超时，随后 DOM 确认 canvas390×844 / FPS135、错误层隐藏、加载层 display:none，截图目视渲染成功。未将该次等待描述为通过。
- 未测真机、Safari/Firefox、完整作品交互、生产对局、账号/投稿/投票或自动截图浏览器实跑。

## 明确没做与遗留物

未改 Gallery 或另一前端功能、原始作品、数据包、pin、数据库或线上配置。保留开工前其他轮次未提交/未跟踪材料。本轮 Gallery 构建覆盖 dist 生成物，不提交；临时验证服务与页面已关闭、浏览器尺寸恢复。截图在忽略目录 `output/boeing-cdn-repair-20261003/`。

## 下一步建议

发布独立后端修复；如生产显式配置 CONTENT_CDN_ALLOWLIST，同步加入 registry.npmmirror.com。无需更换作品数据包。
