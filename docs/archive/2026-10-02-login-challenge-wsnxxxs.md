# 2026-10-02 · 登录人机验证 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：Codex 主会话、GPT-6.1 Sol / high 前端子代理

## 本轮目标

配套共享后端的登录前Turnstile校验，阻止脚本直接暴破，保持现有注册验证码流程。

## 改动

登录也初始化现有验证组件；登录请求提交一次性turnstileToken，失败后重置，配置或脚本失败不发请求。未配置siteKey时保持本地兼容。只改platform.js相关登录段落及turnstile.js注释，不改数据消费pin、资源或其他界面。

## 决策

后端所有账号统一在密码验证前校验，避免按管理员用户名分流；与管理端和game共同发布。

## 验证

check45/0、test18/18；build182件/57站点文件，严格intake0错/8既有提示。三个登录入口×配置有/无、配置down、脚本down共12项生产编译隔离浏览器场景通过，每入口覆盖401/503后token不可重放。页头与候选CSP一致，无意外CSP或产品JS错误；仅mock本地API与挑战脚本。Gallery hash路由可用真实文件404兜底。

## 明确没做

未push/部署、修改私有pin/作品源码、生产数据库写入或调用真实SMTP/Cloudflare用户挑战；不声称全部作品交互已验。

## 遗留物

产物在忽略dist，验证证据位于共享后端output/playwright/redteam-login-results.json与其CLI归档。初始工作区干净；无其他源码改动。

## 下一步建议

用户授权push后配套上线三个登录入口与共享后端、Nginx候选，保留现有数据包。
