# 2026-10-03 · MiniMax 787 盲评加载失败排查 · wsnxxxs

- 人员与范围：主代理；Gallery、独立后端内容服务、缓存原作及生产公开只读 HTTP。未使用子代理。

## 本轮目标与改动

用户要求排查截图中的 Three.js 加载失败。只更新 HANDOFF 与本归档，没有功能源码、作品、数据或生产配置改动，未提交。

## 决策

根因为原作默认 CDN 与隔离作品域 CSP 不匹配。`boeing-787/minimax-m3.1-max` 原作第 2899 行默认 `registry.npmmirror.com/three/0.170.0/files/`；第 2925–2927 行只选择保存的一个源，未自动遍历其他源；第 223 行固定写「所有 CDN 源均无法访问」。后端 `server/config.mjs` 第 32 行默认白名单及生产 bootstrap `site.cdn` 不含 registry.npmmirror.com，`server/content.mjs` 第 43 行按该名单生成 script-src。

生产公开作品域 HEAD 的 CSP 也确认未放行该域；Gallery 原作直链返回 200、正文与本地消费原作相同，CSP 仅为 `frame-ancestors 'self'`，浏览器实际正常渲染。因此直链能打开、盲评却失败是两个入口执行策略不同。

附带问题：`server/fold.js` 控件识别将错误层 `.cdns` 标为 `data-sp-fold-ui`，盲评默认隐藏后三个换源按钮均不可见。原作将加载失败笼统归为网络失败；每组盲评使用新的独立 origin，已有其他 origin 的 CDN 选择不会继承。

建议在独立后端补齐所需 CDN 白名单，并保留错误重试区域。此为排查建议，未实施，也没有更改全站 CSP。

## 验证

- 生产只读：bootstrap 白名单；公开作品域 HEAD 的实际 CSP；目标 Gallery 原作 GET 为 200 且正文与缓存完全相同；npmmirror 的 Three.js 文件直接请求为 200。
- 浏览器：生产 Gallery 原作直链实际渲染；临时本地服务调用现有 `createContentHandler`，注入从生产 bootstrap 只读取得的白名单，读取缓存原作并使用合成内容 key，未连接业务数据库。默认 npmmirror 精确复现「（脚本加载失败）（模块执行失败）」；点击原作 unpkg 按钮后 canvas 1280×720、错误层与加载层均隐藏、FPS 更新，截图目视飞机正常渲染；合成盲评 m origin 的错误文本及隐藏的三个换源按钮均与截图对应。
- 未直接进入用户截图中的既有生产对局，未创建生产对局、投票、登录或写业务数据；未测全部作品交互、真机或其他浏览器。
- 未跑 `npm run check`、`npm test`、`npm run build`、`CI=1 npm run check:intake`：纯排查，无功能源码或数据变化。构建检查不能验证作品域对该 CDN 的 CSP 许可。

## 明确没做与遗留物

未修改后端、原作、数据包、消费 pin 或线上配置，未 commit/push/部署。保留开工时 Gallery 和后端其他轮次的未提交内容。本轮临时服务已关闭；生成截图在 Gallery 忽略目录 `output/boeing-cdn-investigation-20261003/`：`blind-npmmirror-failed.png` 与 `unpkg-rendered.png`。
