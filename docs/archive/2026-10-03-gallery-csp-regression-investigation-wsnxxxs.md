# 2026-10-03 · Gallery 内置作品 CSP 回退调查 · wsnxxxs

- 负责人：wsnxxxs；执行 AI：Codex。范围：Gallery 前端、线上只读 HTTP / 浏览器检查、后端本地配置与正式 Nginx 文件只读核对。
- 目标：调查 `https://gallery.arenaofbias.icu/#/show1-007/claude-opus-5.5-max` 再次出现「拒绝了我们的连接请求」的原因。

## 结论

作品本身返回 HTTP 200；响应头误带 Gallery 外壳的完整 CSP，其中 `frame-ancestors 'none'` 禁止任何页面嵌入该作品。Chrome 原标签与新标签均复现。前端 iframe 地址正确，馆藏没有额外 sandbox 属性。

此前验收通过的 `/results/show1-007/gemini-4.x-high/`、`/_sandtable/grok-4.6/?sandtable=1`、`/_scenes/classical-fountain/claude-opus-5.5-max/` 现在也返回完整外壳 CSP，而非预期的 `frame-ancestors 'self'`。

只读 SSH 检查正式 `/www/wwwroot/arenaofbias-server/deploy/nginx/read-zones.conf`，发现原 `map $host $aob_frontend_csp` 已恢复，之前新增的作品路径例外缺失。当前 SHA-256 为 `e1e5258fcb2efbb16a81adcb8b1b6d59fe068beaaf846d200effbaf42dc1ee01`；后端交接记录中的修复上线哈希为 `cdadd621eae3c127e5548bd547b4c11338a9f20e44b9c4a06bb4eddbe8e74b22`。当前文件 mtime 为 2026-10-02 22:48:18 +0800（Brisbane 10-03 00:48:18），晚于之前成功上线的 Brisbane 10-02 21:31:48。

线上配置中的修复已丢失。后端本地修复仍是未提交改动，从不含此修复的版本再次部署存在覆盖风险；尚未查明执行覆盖的具体操作，不能归因给某一次发布或某个人。

## 改动与决定

仅新增本归档、追加根 HANDOFF。未改前端功能、作品内容或相邻仓库。修复应在后端仓库持久保存作品路径的同源放行例外，再部署并验收。本轮用户要求为调查，未执行配置写入或 reload。

## 验证与边界

- 已执行：公网作品 GET / HEAD、两个辅助路径 HEAD、Chrome 原标签与新标签复现、正式 Nginx 文件内容 / 哈希 / mtime 只读核对、本地未提交 diff 核对。
- 未运行 check、test、build、intake：无功能或构建修改，仅调查文档。
- 未执行 nginx -t、reload、部署、commit、push；未写生产业务数据，未测试全部作品交互。
- 保留开始前全部他人未提交与未跟踪文件；本轮调查文档未提交。

## 2026-10-03 用户要求修复后的追加

- 后端独立工作区基于当前 origin/main 保存修复，cefe842 已推送 main；正式只同步该提交的 read-zones.conf，nginx -t / reload 通过，其他 12 份 Nginx 配置哈希不变。备份 /root/aob-gallery-csp-repair-20261002T172548Z。
- 公网四个作品/辅助路径均恢复 frame-ancestors 'self'；Gallery 首页、主域、game、api 的状态及 CSP 不变。Chrome 目标 Claude 黑洞渲染成功，控制面板折叠可用；0 console error / 1 条作品 shader warning。
- 独立后端候选 check 87/0、test 247/247。Gallery 源码和数据未修改，无需重新构建；未逐件或手机验收。证据在 output/gallery-csp-repair-20261003/。
