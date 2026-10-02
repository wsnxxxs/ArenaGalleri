# 2026-10-03 · Bitwarden 自动填充兼容 · wsnxxxs

- 负责人：wsnxxxs；执行：主代理与用户指定的 Astra medium 子代理。
- 目标与决策：只处理 Firefox / Bitwarden 密码管理器问题；用户中途明确暂缓账号与邮件问题，不修改认证接口或后端。
- 改动：site/auth-dialog.js、site/platform.css、site/platform.js。登录、注册和找回密码的原生模态 dialog 改为普通 DOM 弹层，保留键盘、关闭和嵌套焦点行为，避免把扩展注入节点设为 inert；补齐稳定字段标识和初始 autocomplete，隐藏注册字段在登录时 disabled；请求体仍使用 name/password。
- 依据：Bitwarden 官方仓 issue https://github.com/bitwarden/clients/issues/21388 描述 Firefox 原生 showModal 与内联填充菜单冲突。代码路径吻合，但未在用户扩展版本实测，不能把上游报告称为本机根因复现。
- 验证：npm run check 48/0，npm test 19/19；DATAPACK_LOCAL_DIR 指向有权读取的本地数据仓 dist，npm run build 181 件 / 59 site 文件；CI=1 npm run check:intake 0 错 / 10 条既有警告。隔离 Browser 合成 API 验证模拟扩展按钮在弹层外可点击、直接 DOM 赋值后登录请求成功、注册模式 autocomplete、Tab / Shift+Tab、Escape、遮罩关闭、嵌套找回关闭复焦、普通确认框仍为原生 modal；桌面登录 / 375px 注册目检通过，console 无 error / warn。
- 未做：真实 Firefox + Bitwarden、生产 Turnstile、真实账户/邮件、浅色主题验收；未推送、部署。普通填值测试不是密码管理器扩展实测。
- 遗留物：保留所有此前模型与审核改动，提交时按差异块排除。忽略目录 output/autofill-fix-20261003/ 保存本轮基线、合成验证服务、截图；本地构建产物不入库。后续上线后需用用户的 Firefox / Bitwarden 点击内联建议复测。
