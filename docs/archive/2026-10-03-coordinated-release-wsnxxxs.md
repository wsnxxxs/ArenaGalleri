# 2026-10-03 · 四仓协调发布 · wsnxxxs

- 负责人：wsnxxxs ｜ 执行 AI：GPT-6 / Codex desktop

## 本轮目标

按用户要求联调部署四仓现有改动，保留各主分支已上线功能。

## 改动

合入 origin/main 的审核娱乐收件箱勾选，保留贴纸、单 HTML、密码管理器、厂商/审核筛选和路由生命周期改动。已核验作品没有收件箱勾选框时，不发送 entertainment:false，避免重复核验改变已有分流。后端保留线上 CSP 与收件箱/双章迁移，配套切换同一不可变数据包。

## 验证

check 50/0、test 19/19；真实 Edge openReview 验证不勾/勾选分别发送 false/true。固定包构建、intake、真实接口联调与部署验收待执行，完成后追加实际结果。

## 明确没做

不提交私有数据源或真实本地配置，不复制原作进 site，不恢复公开 CI 私有包下载或 Pages。

## 遗留物

合并前工作树完整保存于 stash，其他工作树未改。output/dist 为生成物，保留。

## 下一步建议

固定数据包后构建并联调，备份生产后协调部署。

## 完成追加（2026-10-03）

e0e980b 已推送 origin/main，固定 LF 源码构建与不可变包 389199bd8f555b1115b1f0009532974a23eb2227 于 2026-10-02T19:00:25Z 协调上线。数据来源 d82a871，CI 37048464853 成功；后端 a280874，竞技场 48b0871。Gallery 公开仓没有加入真实数据配置或作品副本。

最终 check 50/0、test 19/19、构建 181 件 / 60 site 文件，严格 intake 0 错 / 10 条既有警告。固定源码 integration-smoke、真实后端隔离双站会话联调 8 项通过：登录 / 登出传播、API 主机 Cookie、评论和盲投隔离写入、focus / visibility / BFCache 不额外刷新、后台登录。公网版本 / 数据包一致、CORS、作品 framing、安全头、私有路径及双前端 / 后台桌面手机只读验收通过。实际点击首页→题库→黑洞题→Claude 查看器，canvas 渲染成功，桌面与 390px 无页面横向溢出；console 无 error，有作品 shader 和 iframe allow 的既有 warning。

更正准备阶段表述：已核验作品实际上没有核验按钮，未复现「重复核验改变分流」。首次合成探测误点不存在按钮超时，随后改为断言按钮不存在；未核验 false / true 请求与该断言均通过。字段存在性保护只在没有控件时省略字段。

真实 Firefox / Bitwarden、生产 Turnstile 登录、SMTP、外部审核和全部作品 / 全部交互未验收。备份 /root/aob-coordinated-release-20261003/backup；截图与 JSON 证据在后端 output/coordinated-release-20261003。来源功能每仓一条英文提交已推送，完成记录本地追加，不改写已发布历史或另建第二条提交。
