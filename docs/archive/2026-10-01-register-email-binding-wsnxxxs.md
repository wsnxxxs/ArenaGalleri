# 2026-10-01 · 注册邮箱验证与两站联调 · wsnxxxs

- 负责人：wsnxxxs；执行 AI：Codex，配合 GPT-6.1 sol medium 子代理。
- 范围：Gallery 注册与参与门槛、邮件捕获 smoke、文档；Show1 在其独立仓库完成，本仓不合并另一前端或后台。

## 本轮目标

完成已修改的 Gallery 邮箱注册并跑通共享后端，补齐 Show1 注册和未绑定投票提示。完成本地提交，不推送或部署。

## 改动

- 本轮提交在 `register-email-binding`：注册发送邮箱验证码后提交用户名、密码、邮箱与验证码；Turnstile 前移到发码。绑定和换绑共用弹窗，旧账号发题、上传和表态需先绑定，未绑定的盲评不计票并提供入口；隐私正文和 PRODUCT 同步。
- 挑战配置加载失败停止发码；注册、登录和绑定先更新本地绑定状态，后续 bootstrap 暂时失败仍可正确识别账号资格。
- integration smoke 使用共享后端 `createPlatform` 注入测试 mailer，捕获进程内邮件。两个测试账号均按 send → register 创建，断言发码响应、会话与 emailBound；不暴露验证码读取接口。
- 配套提交：后端 `55e3288`，Show1 `f1a7d0e`。Show1 包含注册、未计票提示与绑定入口、表态资格和被拒同步项清理。

## 决策

用户确认同时补齐 Show1，只做本地提交。为避开共享 checkout 的并行会话，在独立 worktree 将注册分支快进到已有 main，再承接原七个任务文件。共享目录的分支、原文件和忽略配置均不改动。

## 验证

- `npm run check`：42 文件、0 错误；`npm test`：14/14。
- `npm run build`：121 件作品、56 个 site 文件，无路径碰撞。
- `SERVER_REPO_DIR=... node scripts/integration-smoke.mjs`：真实隔离后端通过，含双账号邮箱注册、发题、上传媒体、配对、揭晓、计票和过期版本检查。只在本 worktree 的忽略配置副本中将 integration data pin 对齐已缓存包的 sourceCommit。
- `CI=1 npm run check:intake`：121 错误均为现有缓存包的海报指纹过期，另有 4 条既有提示。未修改数据包或收录内容。
- 本地浏览器：注册发码、填写捕获码并提交成功；请求无注册 Turnstile token；旧账号上传前绑定成功；随后 bootstrap 返回 503 时上传入口仍恢复；挑战配置返回 503 时没有发码请求。注册页截图目检通过，截图在忽略的 `output/email-binding/`。
- Show1：typecheck、lint、build、邮箱资格校验脚本与已有表态队列校验通过；本地 API 桩的 Chromium 390px 注册通过、无页面错误或横向溢出。具体边界见其 HANDOFF。

## 明确没做

未推送、部署、修改生产账号、调用真实 SMTP/Cloudflare 或验证 Gallery 手机端。未修复与本轮无关的旧数据包海报指纹，不把本地构建成功视为发布门禁全通过。

## 遗留物

原共享目录 main 的七个任务文件仍保留未提交副本，独立分支已收录；原 `.claude/` 未动。本 worktree 的缓存、配置副本、测试数据库和截图均为忽略的本地生成物。未删除原目录文件或切换其分支。

## 下一步建议

发布前更新匹配当前渲染版本的数据包并复跑 intake，核对两站与共享后端后一起发布。推送、部署和原共享目录副本清理另按用户授权执行。
