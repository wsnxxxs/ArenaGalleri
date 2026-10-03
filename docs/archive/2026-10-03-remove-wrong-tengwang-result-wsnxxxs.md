# 2026-10-03 · 移除误收的 Opus 滕王阁结果 · wsnxxxs

- 负责人：wsnxxxs｜执行 AI：Codex｜范围：相邻私有数据仓删除，Gallery 消费验证。

## 本轮目标与决策

用户确认「体素云岫寺」不是 Opus 5.5 的滕王阁结果，要求移除；随后更正截图，Sonnet「云栖古刹」保留。仅删除数据仓 `tengwang-pavilion/claude-opus-5.5-max-yunxiu`，不改 Gallery 功能源码和本地 pin。

## 改动

数据仓同步删除登记、受跟踪交付、截图 / 模型 / 海报及专属提取规则、lock 和海报索引，README 由脚本更新。本地包 176 件 / 20 题，滕王阁 3 件；生产公开 API 另有 2 件已核验投稿，合并页面 5 件 / 4 个模型。仅数据仓按约定一条英文简单句本地提交，Gallery 本轮仅本地交接和归档。

## 验证

- Gallery check 51 文件 / 0 错，test 19/19，本地包 build 176 件 / 61 site 文件，严格 intake 0 错 / 8 既有提示。
- 数据 check 33 文件 / 0 错，test 9/9，完整 build:data 176 件 / 20 题，严格 intake 0 错 / 8 既有提示。
- manifest 与 HEAD 比较仅少指定一条；Sonnet 源码和资源无差异。构建目录中被删原作 / 模型不存在，Sonnet 保留。
- Browser 通过临时本地预览代理读取公开生产 API，桌面目检 4 个模型 / 5 件作品、Opus 卡片消失、展开 Astra 后两件投稿均保留，无捕获的 console error。截图在 `output/remove-wrong-tengwang-20261003/tengwang-after.png`。
- 未重验作品交互、手机、登录或生产页面；本地「可盲评 6 件」仍来自生产旧包，正式更新需要前后端同步换包。

## 明确没做

未推送、发布新包、更新消费 pin、部署或写生产数据库；线上仍消费旧包。数据资产未复制到 site。

## 遗留物

两仓此前未提交 / 未跟踪的交接与归档保留。Gallery 本轮归档和混合 HANDOFF 留本地，生成物不提交。

## 下一步建议

获发布授权后统一更新两端数据包并核对线上作品列表及盲评池。
