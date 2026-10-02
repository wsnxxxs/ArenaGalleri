# HANDOFF.md · 当前状态

## 去掉题目标签，搜索改为匹配提示词（2026-10-02，本地提交，未推送）

- 用户决定：技术栈等本来写在提示词里，不再单设标签。发起题目去掉标签输入与建议；题库卡片、题目页侧栏、我的题目、审核列表不再显示标签；public-catalog 不再输出 `tags`。数据仓 task.json 与后台的 `tags` 字段保留不动（后台仍接受，前端不再发送）。
- 搜索：categories.js 新增 `searchMatch` / `matchesQuery`，题库与盲评大厅共用，匹配标题、简述、形式名、领域和全部版本的提示词原文，空格分隔的每个词都须出现；字母小写并忽略空格、点、连字符、下划线（threejs → Three.js）。题库里标题等已含全部词的排前，仅提示词命中的排后并在卡片显示命中片段（「提示词」+ 前 18 / 后 36 字，命中词高亮，两行截断），组内保持所选排序；排序下拉改为走同一套 filter。盲评大厅只用匹配，不排序不显示片段。搜索框改为「搜索题目或提示词」，提示词输入框下说明不另设标签。删去标签编辑器的样式。
- check 45/0、test 18/18（新增 categories.test 覆盖折叠、分层与片段，public-catalog 断言不输出 tags）、build 182 件 / 57 site 文件、`CI=1 check:intake` 0 错 / 9 既有提示。Browser（scratchpad mock，注入领域）：OrbitControls 只命中黑洞并显示片段，「threejs」16 题中 7 道自身命中在前、9 道提示词命中在后带片段，「瀑布」3 题均为自身命中，卡片只剩形式与领域，发起题目无标签输入，console 0 错。注意关键词也会命中提示词正文，例如「化学」命中火箭（提示词提到推进剂化学），按领域找题以领域筛选为准。


## 题目分类改为「形式 + 领域」两轴，排行榜支持领域范围（2026-10-02，三仓本地提交，未推送）

- 形式沿用 category 存储值（文学 / 静态网页 / 建模），界面显示「文本 / 网页 / 三维」，网址、投票与后台不变。新增领域 `domains`（每题 1–2 个，词表：数学、物理、化学、生物、天文、建筑、自然景观、交通与机械、产品与品牌、文学艺术、游戏娱乐；优先取 bootstrap `domains`）。
- 题库：侧栏「领域」胶囊，与形式叠加，网址 `#/questions/<形式>/<领域>`；卡片「形式 + 领域 + 标签」；题目页领域可点回题库。盲评大厅显示并可搜索领域。发起题目必选领域（最多 2 个），管理员通过时可修正形式与领域。public-catalog 透传 `domains`。
- 排行榜：领域是形式之外的范围，`#/leaderboard/<领域>`（综合 · 领域）或 `#/leaderboard/<形式 slug>/<领域>`；工具栏「领域」下拉只列当前范围内有题的领域，形式下的题目下拉随领域收窄。领域榜少于 2 题或 50 次有效比较（后台 `totals.tasks` / `totals.votes`）时提示「样本不足」；旧后台没有回显 `domain` 时提示不支持。计分说明补「领域」与「同一单位两件作品的票不计入」。领域只读当前网址，不改 app.js 路由。
- 计算（后台）：领域榜与形式榜同法，只取含该领域的题目的票重新拟合 Bradley–Terry，可与形式叠加，一题两领域时两边都完整计入；`totals` 改为只数实际计分的比较（修正 HANDOFF 旧记录「按模型」时有效比较偏多），新增 `totals.tasks`。
- 验证：check 44/0、test 16/16、build 182 件 / 57 site 文件、`CI=1 check:intake` 0 错 / 9 既有提示。Browser 用 scratchpad 注入领域的静态服务与 mock API（未改 dist）核对：题库叠加筛选、深链、手机 375 宽；排行榜天文（样本不足）、三维 · 建筑（请求带 category+domain、题目下拉 6 题）、取消领域回到三维；发起题目 11 个领域、选满 2 个其余锁定；console 0 错。未验收：管理员审核弹窗（mock 无管理员登录）、真实后台联调与真实投票数据。
- 期间另一会话在本仓修改 site/app.js、site/studio.css、site/sandtable.css（返回与层级），已与本轮改动并存，未覆盖；提交时注意分开。
- 上线顺序（均未执行，需用户授权）：① 数据仓提交并发布含 `domains` 的数据包；② 后台与 Gallery 的 `datapack.json` 改 pin 到新包；③ 后台部署后自动执行 v29 迁移（只加列、幂等，社区题旧数据为 `[]`）；④ Gallery 构建发布。前端对缺 `domains` 的包和旧后台都能降级（不显示领域分组、领域榜提示后端不支持），所以 ③④ 顺序可以互换。
- 已上线社区题目没有领域，需管理员在后台补（通过时可修正领域）；或另行写一次性脚本，本轮未做。


## 审核流程统一与按面核验（2026-10-02，本地提交，未推送）

- 使用三名 GPT-6.1 Sol / medium 子代理分别负责 Gallery 合入、后端按面记录与浏览器验收；保留其他会话的未提交改动。审核分为题目、内容、核验，只有待处理标签计数，新增已拒绝与未展示；馆藏不进入审核队列，示例内容可在题目卡片就地处理。
- 核验先保存修改的登记信息，再只提交 status / reason / show_gallery；通过核验会开启展览馆，存疑只要求原因，撤下只关闭 show_gallery 并保留核验状态。下一件只在相同队列中选取。缺当前面 reviewed 时间时先进入核验，展示开关原本开启也不能跳过；审核页加载后按三个当前队列更新前端本地待办数，不改后端 bootstrap 计数契约。
- check 44/0、test 16/16；暂存源码独立导出 check 44/0、test 16/16。有效固定包 build 182 件 / 57 site 文件；CI=1 check:intake 0 错 / 9 条既有提示。隔离真实后端 + 合成数据浏览器核对题目示例、内容接续、必填、存疑、meta 先于决定、拒绝删除、撤下、按面核验和 375 宽；Gallery console 0。后端暂存源码独立测试 207/207，当前混合工作区 215/215。
- 浏览器使用当前工作区源码，含既有形式/领域与后端改动；未验收生产、真实账号、自动审核、SMTP、截图服务或全部作品执行。管理台作品 iframe 的验收路由返回资源 404，无页面 JS 异常。临时验收服务与浏览器已关闭，证据在 output/playwright/review-redesign-current/。
- 仅本地提交审核功能、既有配套样式与本轮记录；形式/领域、返回层级等改动仍留在工作区。后端另仓提交 v29 领域迁移作为 v30 的顺序依赖，其余领域功能未纳入。未推送、部署或修改私有 pin。归档：[review-pipeline](docs/archive/2026-10-02-review-pipeline-wsnxxxs.md)。

## 作品代表作折叠、题库封面与生成信息精简（2026-10-02，本地提交，未推送）

- 新增 site/featured.js：题目页每个模型（跨档位）一件代表作、其余折叠；封面优先后台 `featured`，否则 Opus 5.5 Max → GPT-6 Astra Max → 灰色占位。首页不再逐题请求 leaderboard 选封面，删除 question-preview.js。
- 多轮或有人工介入作品显示「多轮」「人工介入」标签；数量文案改为「X 个模型 · Y 件作品」，盲评大厅改为「可盲评 N 件」。投稿表单去掉模型版本、生成日期、过程记录链接；public-catalog 不再透传这三项。
- 折叠按钮为模型名一行右侧的「+N 件」胶囊，展开的同组卡片左侧共用强调色边线；后台票选的代表作带「代表作」标记（注入模拟 featured 已核对）。
- 依赖后端：bootstrap 新增 `featured: { [task]: { cover, models: { [modelKey]: workId } } }`；缺省时前端走兜底。后端提示词另行交给其他 agent。
- check 44/0、test 16/16；以数据仓本地新产物构建 182 件 / 57 site 文件。Browser（无后台）核对题库 20 张封面、Boeing 折叠展开与手机宽度无横向滚动；未接入真实后台验收 featured、投稿与盲评。

## 截图回退与模型适配消费（2026-10-02，本地实现并提交）

- public-catalog 透传 previewMode；首页、题目卡片和作品卡片对 screenshot 直接展示 captures.first、contain，跳过模型/海报。11 件回退验收通过，模式切换保持截图。
- 数据仓配套修复 29 个模型包/海报和 9 张首屏；182 包桌面/手机渲染 0 错/0 出画。Gallery 渲染器不变；非目标 153 张渲染逐像素未变。
- check 43/0、test 14/14；当前包严格 CI intake 0 错/8 既有提示，隔离构建 182 件+57 site 文件、无冲突。Browser 核对题目卡片及桌面/手机荷塘模型/截图，diff --check 通过。未重新验收所有交互或真机性能。
- 仅本地提交本轮五个功能文件和记录，不纳入其他会话已提交的修改；未推送、部署、改私有 pin 或真实 .datapack。证据在相邻数据仓 output/preview-repair-20261001/；[归档](docs/archive/2026-10-02-preview-adaptation-repair-wsnxxxs.md)。

## 排行榜计分单位核查（2026-10-02，仅检查）

- 「按配置」与「按模型」均真实生效。前端请求分别带 by=config / model；后端按模型 ID + 归一化推理档位 / 模型 ID 分组，并重新拟合 Bradley–Terry，缓存键包含 by。Harness、服务商是来源筛选，不属于配置分组键。
- 线上只读核对：综合与建模榜 308 票 / 3 人，63 配置 → 46 模型；中国古典建筑单题榜 207 票，54 配置 → 44 模型；官方来源 21 票，8 配置 → 7 模型。综合榜 Claude Sonnet 5.5 的 High（1273 分、10 场）、Max（1243 分、5 场）合成 1378 分、15 场、3 件作品的一行，证明评分不是简单平均。
- 发现统计口径差异：按模型时同模型不同档位的互相比票不参与评分，但 totals.votes 仍含这些票。当前综合显示 308 次「有效比较」，模型行 games 总和 610，对应实际计分 305 次；配置行 games 总和 616，对应 308 次。切换正常，顶部有效比较文案需后续统一口径，本轮未改前后端。
- Browser 实测综合 / 建模 / 单题按钮、切回配置恢复各档位、刷新保留模型模式，console error 0。当前后端算法三票合成样本：配置三行、模型两行，同模型互比被排除，断言通过。check 43/0、test 14/14；仅诊断未运行 build / intake，未重新验收手机、投稿或真实投票。
- 原有五个未提交文件保留，不纳入本轮；仅本地提交检查记录，未推送或部署。截图 output/leaderboard-unit-audit-20261002/；[归档](docs/archive/2026-10-02-leaderboard-unit-audit-wsnxxxs.md)。

## 简化投稿选项并补齐必填校验（2026-10-01，本地实现并提交）

- site/work-fields.js 移除 Harness optgroup，平铺按名称排序。生成方式仅一轮 / 多轮。推理档位必填，Default 为明确选择，不作为缺省；其他档位必填文本。服务商必填，仅官方 / 非官方。作者编辑共用表单；管理员核验补相同必填提示。更新文档和现有联调请求 fixture。
- check 43/0、test 14/14；本地扩充数据包 build 182 件 / 57 site 文件，CI=1 intake 0 错 / 9 既有提示。真实隔离后端 integration smoke 通过。Browser 运行实际 work-fields 模块的本地验收页：空档位、空手填档位、空服务商逐项阻止；填完整成功；Harness 0 个 optgroup、27 选项；模型 45 项、Qwen 全归 Alibaba、六个品牌图均有 naturalWidth，console error 0。截图 output/submission-options/form.png。未通过实际上传页重新做 ZIP、SMTP、付费审核或真机验证。
- 其它会话正在修改 scripts/public-catalog.mjs、site/app.js、site/home.js、site/studio.css、site/style.css；未操作或纳入本轮提交。私有 pin 未改，忽略的 .datapack 为通过安装器加载的本地开发包。
- 本轮未推送、部署或切换生产 pin；详见 [本轮归档](docs/archive/2026-10-01-submission-options-wsnxxxs.md)。


## 注册验证码粘贴问题分析（2026-10-01，仅检查）

- 用户要求检查 Gallery 与 Show1 的注册验证码粘贴报格式错误原因；本轮未修改功能、相邻仓库、配置或生产。
- 两端验证码框均先受 6 字符 maxlength 限制。Show1 随后用非数字过滤并截取 6 位，且 pattern 要求六位 ASCII 数字；Gallery 仅在提交时 trim。共享后端及 Show1 旧邮件模板均在验证码前放四个空格，复制整行可能造成先截断、后清理，从而丢失数字；该链路是最可能原因，未取得用户实际剪贴板内容，不能确认具体复制了什么。Gallery 还会保留 trim 不处理的零宽字符。
- Browser 本地合成试验中纯六位数字有效、零宽字符不能被 trim 清除；工具粘贴绕过了原生 maxlength，原生逐键输入又受本机输入法影响，因此未完成真实浏览器截断复现，不把合成结果当成线上验收。临时页面与服务已关闭，未发真实邮件或提交注册。
- 建议后续修复在粘贴截断前清理空白等字符、保持六位数字校验，并移除邮件数字行缩进。仅为建议，本轮未实施。记录：[code-paste-analysis](docs/archive/2026-10-01-code-paste-analysis-wsnxxxs.md)。
- 收尾检查：check 43 文件 / 0 错，test 14/14；仅诊断与文档记录，未运行 build / intake。按用户每轮修改后提交的指示，仅本地提交本轮两份记录，不推送。

## 四仓最新功能发布准备（2026-10-01，已授权提交、推送和部署）

- 用户明确授权将现有上传与审核流程改版、去掉 Harness 版本的 11 个未提交文件一并提交和部署。负责人 wsnxxxs；本轮功能与文档使用一条英文提交，私有配置、缓存和生成物不入库。
- fetch 前后 main 与 origin/main 均为 a1ab4f2；远端仅 main、没有开放 PR，旧 PR #1 已关闭。邮箱注册分支已完整合入，干净的历史 worktree 及其依赖保留，本轮没有删除遗留文件或改写远端有效修改。
- 正式构建改用四仓一致的已验证固定包（182 件作品）；真实 pin 仅更新忽略的 datapack.json，不写入公开文档。此前旧包的 121 个海报指纹错误不再适用于新固定包。
- 线上未提交过场预览已由 main 的 2e178cd 保存：入口遮罩、首屏图片和字体等待、失败重试与返回入口均保留。生产 entry-boot.js 与 main 的 LF 内容逐字一致，工作区哈希差异仅为 CRLF。
- 本轮工作区 check 43/0、test 14/14。已提交备用版本的干净 LF 构建为 182 件 / 57 site 文件，严格 intake 0 错 / 9 条既有提示，对后端当前已提交源码的真实隔离 integration smoke 通过。最终功能提交后再从真实 SHA 导出、构建及验收，结果由共享后端本轮发布记录统一确认。
- 本仓准备产物，不操作生产。实际发布与公网验收以共享后端 docs/archive/2026-10-01-latest-release-wsnxxxs.md 为准；此前上传改版的浏览器联调仍见下节，本轮未重新执行真实付费审核、SMTP、真机或全部作品交互。归档：[latest-release-preparation](docs/archive/2026-10-01-latest-release-preparation-wsnxxxs.md)。

## 上传与审核流程改版、去掉 Harness 版本（2026-10-01，本轮授权提交、推送和部署）

- 投稿页（`site/submit.js`）：拖拽区下只留一行关键文件要求，其余折叠；上传中改为带「取消」的进度卡；试加载 30 秒无载入信号时可在新窗口确认后继续；作品信息必填项在外、选填收进「补充信息」（`site/work-fields.js`，编辑弹窗共用）；提交按钮显示「提交中…」。侧栏和提交完成页共用阶段条 `stageTrack`（`.timeline` 改为按状态着色，新增横排 `.is-row`），完成页每 15 秒轮询 `GET /api/me`（最多 10 分钟）跟进审核结果，分别显示审核中 / 待人工复核 / 未通过及原因 / 已公开。发起题目（`site/publish.js`）的完成页同时显示题目人工审核与示例结果内容审核。
- 审核（`site/account.js`）：新增「内容复核」标签，处理 `moderation` 为 review / pending / rejected 的上传，可通过并公开（理由选填，空时发送「人工复核通过」）、拒绝（理由必填）或重新自动审核；「未验证」只列内容已放行且题目已公开的作品（待审题目的示例结果在题目通过后才进入），修复了内容未放行时点「通过验证」后作品仍不公开的问题；示例结果待复核时题目审核行提供「去复核内容」。「我的作品」在有作品自动审核中时同样轮询，等待核验计数排除内容未放行的作品。
- 去掉 Harness 版本：投稿、编辑、管理员核验表单与展示（`app.js` 来源行与信息栏、`prompt-variants.js` 分组键）不再使用 `harnessVersion`。
- 顺带修复：发起题目附带示例时，提交过程中的 `refreshPlatform('question')` 会让上传流程重绘已被消费的草稿预览并报 410；现在提交中跳过重绘。
- 依赖的后端契约（缺失时均有兜底，可与当前后端共存）：`site.autoModeration`、`review.content`、`reviewContent` 通过理由选填、内容未放行时禁止 verified、作者端只返回必要审核字段、截图失败后恢复。给后端的提示词在忽略目录 `output/backend-upload-moderation-prompt.md`。
- 验证：check 43/0、test 14/14、固定包 build 121 件 / 57 site 文件。隔离联调（`output/upload-review-redesign/harness.mjs`：当前后端代码 + 本地假 6 Luna 按标题给结论 + 借用 Gallery Playwright 的测试截图器）用真实浏览器跑通：静态作品从审核中自动跟进到未验证、待复核与被拒作品进入内容复核、管理员不填理由通过后进入未验证、文学 .md 作品走截图与审核、带示例的新题目完成页、编辑与核验表单无 Harness 版本、手机宽度投稿页；修复后 console error 0。截图在 `output/upload-review-redesign/shots/`。未验证：真实 6 Luna、生产截图服务、Vite ZIP、真机。
- 与后端本轮未提交改动（`site.autoModeration`、`review.content`、作者端审核字段裁剪、核验 409、人工通过理由选填）联调：同一套浏览器流程全部通过，console error 0；API 核对管理员计数 unverified 4 / content 0 / questions 1，作者只收到 status / at（被拒时含 reason），内容未放行时核验返回 409「请先完成内容审核」。截图在 `output/upload-review-redesign/shots-new-backend/`。示例结果筛选另行验证：题目待审时「未验证」为空，通过题目后出现该示例，console error 0。后端 `review.unverified` 计数仍包含待审题目的示例，侧栏待办数会比列表多，需后端同步。
- 发现：后端检出目录没有安装 `playwright` 时截图失败，作品一律以 `capture_incomplete` 转人工；生产需确认已安装。联调时「我的作品」缩略图不显示，是因为 `api('me')` 返回的媒体路径没有按 API 地址解析，跨端口才出现，与本轮无关，未改。

## 服务商二值与后端联调（2026-10-01，提交与推送收尾，未部署）

- 用户授权提交现有服务商修改、完成隔离后端联调、更新文档并推送。投稿、作者编辑和管理员核验只提交 `providerId`（official / unofficial / 空）；服务商固定为未注明 / 官方 / 非官方，不再有手填名称。题目页、作品信息与排行榜统一显示和筛选，旧平台 ID 或名称按非官方显示；Harness 原有手填、提示和版本保持。榜单说明同步修正，产品与设计文档已更新。
- 本地真实 API 联调通过：HTML 试加载及按钮交互、非官方上传、作者编辑为官方 / 清空 / 非官方、管理员把官方改为非官方并通过验证、非官方榜单筛选。五次作品写请求均 200，只发送 providerId；筛选返回 filters.provider=unofficial、1 票 / 1 人 / 2 配置。bootstrap 仅两项 providers，作品 provider 二值/null 且无 providerName。截图目检通过，捕获的 console error 为 0。
- 收尾在保留他轮已提交启动与缓存修改的当前 main 上运行 check 43/0、test 14/14、固定包 build 121 件 / 57 site 文件。固定包严格 CI intake 仍为 121 个过期海报指纹错误 / 4 条提示；与匹配渲染版本的本地包隔离构建为 182 件 / 57 site 文件，严格 intake 0 错 / 9 条既有提示，跨仓 integration smoke 通过。
- 以 wsnxxxs 的 GitHub noreply 身份提交并推送 origin/main，提交号与远端源码 CI 见 Git / Actions。后端和前端需配套发布，后端先完成 v25 迁移；本轮没有部署、改消费者 pin 或操作生产库。归档：[provider-binary-integration](docs/archive/2026-10-01-provider-binary-integration-wsnxxxs.md)。隔离数据库、请求证据和截图保留在忽略的 output/provider-binary-20261001-4d06e23b/。

## 验证码垃圾邮件提示（2026-10-01，仅提交与推送）

- 用户授权提交两个前端的现有提示修改并推送。Gallery 的 `site/platform.js` 在共用 `codeSender` 发送成功提示末尾追加「没收到请检查垃圾邮件箱。」，覆盖注册、账号绑定和找回密码；本仓记录仅包含 Gallery 改动。
- 本轮重跑 check 42/0、test 14/14、build 121 件 / 56 site 文件，均通过。严格 CI intake 仍为当前固定包的 121 个海报指纹过期错误 / 4 条提示，未通过。
- 本轮仅提交文案，未做浏览器发码效果、真实 SMTP / Turnstile 或生产交互验证，未部署、未修改数据包 pin。归档：[email-spam-hint](docs/archive/2026-10-01-email-spam-hint-wsnxxxs.md)。

## 本轮完成：统一返回入口与联系邮箱（2026-10-01，提交与推送收尾，未部署）

- 新用户不清楚怎么返回上级：原来有侧栏 `.back-link`、预览 `.vback`（只显示题目名）、沙盘只在手机显示的箭头等多种入口，而且返回目标固定指向上级页面。现在各子页面（题目、作品预览、展厅/沙盘、上传、盲评）只在顶栏保留一个「返回 X」（`app.js` 的 `backLink`），普通页位于品牌后，预览与盲评对局位于左端；X 是读者来自的页面。直接打开链接或从下级页面返回时，退回上级页面；窄屏只显示「返回」。删掉了侧栏 `.back-link`、`sand-task-back` 和原来只给个人中心用的 `origin`。
- `app.js` 的 `retrace` 按历史条目保存本标签页的访问记录和来源关系，每个条目在 `history.state.visit` 里带递增编号；离开页面时记下滚动位置，浏览器后退、前进或点「返回」时恢复。返回紧邻的上一条目时实际调用 `history.back()`。各处 `replaceState` 保留 `history.state`。题库分类写入地址 `#/questions/<分类>`。
- 手机端作品预览：「返回」文字挤占了作品选择框，≤640px 隐藏选择框内的模型图标；「AI 生成」标识保留。题目页内标签切换仍用 `replaceState`，没有改动。
- 用户授权同步最新修改、修复检查中发现的问题、更新文档并提交推送。联系邮箱更新为 `arenagallari@outlook.com`；GPT-6.1 Sol / medium 子 agent 修复后退时删除前进记录、重复访问时删除旧记录的问题，同时保留历史状态其他字段、尊重 Alt 点击，返回文案统一为「盲评」。父 agent 补齐普通顶栏窄屏隐藏返回目标的样式。
- 本轮重跑 check 42/0、test 14/14、固定包 build 121 件 / 56 site 文件。严格 CI intake 为 121 个海报指纹过期错误、4 条提示；海报渲染相关源码本轮未修改，当前固定包与既有渲染版本不匹配，不将构建通过视为发布门禁通过。
- 原实现轮次已验证：首页/题库/排行榜/个人中心 → 题目的返回文字、预览 → 题目、展示模式切换、直接打开预览链接及分类地址。收尾重新构建后，Browser 在 1280×800 与 375×812 下核对题目、预览、沙盘和展厅，目检截图通过；连续后退两次、前进两次保留返回来源，作品列表恢复 320px，题库返回恢复 650px；手机仅显示「返回」，新邮箱链接一致，无横向溢出或捕获的控制台错误。静态服务无后端，上传与盲评对局顶栏、生产账号交互未验收；未重新运行跨仓 integration smoke。
- 按用户授权以一条英文提交收尾并推送 `origin/main`，身份为 wsnxxxs 的 GitHub noreply；提交号见 Git 历史。未部署、未修改私有配置或消费者 pin。归档：[navigation-return](docs/archive/2026-10-01-navigation-return-wsnxxxs.md)。

## 四仓整理收尾（2026-10-01，仅推送，不部署）

- 用户授权整理四仓、合并完成分支、提交和推送，并清理无用的独立工作树；本轮没有部署、生产写操作或生产 pin 升级。`main` 已合入邮箱注册 `f9aef92`、配对预览 `6773f69` 和盲评 UI `974b2cc`，旧共享题库分支此前已完整合入。
- 主目录七个未提交邮箱文件是邮箱分支的旧副本；完整恢复补丁保存在忽略的 `output/repository-housekeeping-20261001/superseded-email-edits.patch`，采用邮箱分支已有联调修复，避免覆盖为旧实现。原 `.claude/launch.json` 保留，通过本地 Git exclude 忽略，不发布个人启动配置。
- 浏览器验收发现盲评分支仍从 `leaderboard.js` 引用已迁移的 `tracksOf`，现改为 `categories.js`；重新载入作品后即时刷新投票门槛，规则同步说明绑定邮箱的计票条件。题目分类、邮箱门槛、页脚版本删除与配对预览均保留。
- 现有源码 check 42/0、test 14/14；使用合并后的本地数据包 build 182 件 / 56 个 site 文件、严格 CI intake 0 错 / 9 条既有提示，跨仓真实隔离 integration smoke 通过。之前 121 张海报过期的缓存错误在匹配当前数据包后消失。
- 本轮本地真实 API 的盲评大厅加载、文学筛选、搜索空状态和 1280px / 390px 截图目检通过，无横向溢出或控制台错误；浏览器使用独立空数据库，没有验证真实作品对战、投票、SMTP / Cloudflare 或生产交互。截图和测试数据库在忽略的 housekeeping 输出目录。
- Gallery 功能源码 `4fd619e` 已推送且 GitHub CI 成功。已删除 UI、oct01 预览、旧共享题库三个工作树及对应已合并本地分支；邮箱工作树及分支干净且已进入 main，但自动审批以 `blocked by policy` 拒绝依赖 junction 删除，因此保留，主目录依赖未受影响。
- 四个工作树的配置、截图、邮箱测试 SQLite/WAL/SHM 和预览本地数据包已逐文件校验归档。生产固定包未变，未来部署前仍需先升级消费者 pin 并重新按发布流程验收。当前归档：[repository-housekeeping](docs/archive/2026-10-01-repository-housekeeping-wsnxxxs.md)。下面“未合并 / 未推送 / 待确认”均为历史轮次状态。

## 本轮：去掉页脚「版本」诊断（2026-10-01，已本地提交，未推送、未部署）

- 访客用不到页脚右侧的「版本」折叠项，它还会暴露部署信息，所以删掉了：`site/app.js` 的 `buildVersion`/`shortSha` 和调用、`site/style.css` 的 `.build-info`、`docs/DESIGN.md` 的对应条目。`DATA.buildInfo` 保留，写请求版本校验仍在用。`platform.serverVersion` 不再显示；`platform.js` 有他人未提交改动，这次没动。
- 本轮重新运行 check：42 个文件、0 错误；test：14/14 通过。提交范围仅含三处删除及本轮记录，其他未提交改动保留。未运行 build、intake，未做浏览器目检，本轮仅核对和提交现有修改。归档：[footer-version-removal](docs/archive/2026-10-01-footer-version-removal-wsnxxxs.md)。

## 本轮：注册时强制绑定邮箱（2026-10-01，分支 `register-email-binding`，已本地提交，未推送、未部署）

- 前端：注册表单增加邮箱和验证码。Turnstile 前移到「发送验证码」(`purpose: 'register'`)，注册请求改为发送 `{ name, password, email, code }`，不再携带 turnstileToken。绑定弹窗移到 `platform.js` 的 `openBindEmail`，个人中心用它换绑（标题和按钮按「更换」区分）。
- 门槛：`requireUser` 遇到 `user.emailBound === false` 的旧账号，先弹出绑定，绑定后才继续发起题目、上传或贴表情。上传第一步对未绑定账号显示绑定提示；双盲提示「未绑定邮箱不计入」，新增 `reason: 'unbound'` 文案。浏览不需要登录，这点不变。隐私政策同步写明注册收集邮箱，日期改为 10-01。
- 收尾修复：发码前挑战配置加载失败时停止发送；注册、登录和绑定成功先更新本地绑定状态，避免后续 bootstrap 刷新失败让旧账号继续卡在绑定门槛。PRODUCT 同步产品行为。
- 依赖共享后端本地提交 `55e3288`：register 发码与事务注册、会话 `emailBound`、旧账号写操作 403 `email_required`、投票 `unbound`；Show1 两个兼容接口也已限制。Show1 前端本地提交 `f1a7d0e` 已补齐注册、未计票绑定入口、表态门禁与被拒队列清理。两站与后端需配套发布，新注册前端不能搭配旧后端。
- `scripts/integration-smoke.mjs` 注入仅在进程内捕获邮件的测试 mailer，两账号均先发码再注册，并断言发码响应、会话 cookie 与 bootstrap `emailBound: true`；不增加公开读取验证码的接口。原共享目录的忽略配置 pin 与缓存 sourceCommit 不一致，已在独立 worktree 的配置副本中对齐；原配置与原目录七个未提交文件均保留。
- 验证：check 42/0、test 14/14、`npm run build` 121 件 + 56 site 文件通过；对后端 `55e3288` 的完整 integration smoke 通过。CI intake 仍为 121 个海报指纹过期错误 / 4 条既有提示，属于现有缓存包与渲染版本不一致，发布前需升级对应数据包。
- 本地真实浏览器通过注册发码与提交（无注册 Turnstile token）、旧账号上传前绑定、绑定后 bootstrap 503 时恢复上传入口、挑战配置 503 时不发送验证码；注册页截图目检通过。未验证 Gallery 手机端、真实 SMTP/Cloudflare 或生产写操作。归档：[register-email-binding](docs/archive/2026-10-01-register-email-binding-wsnxxxs.md)。
- 本轮在独立 worktree 完成，共享目录仍在 main，未切分支、清理原未提交文件或改动 `.claude/`。用户只授权本地提交，未推送、未部署。

## 本轮：题目分类与按分类的提交格式（2026-10-01，已本地提交，未推送、未部署）

- 联调后修复：审核对话框保存成功即刷新列表；后端 `e81cb4e` 去掉文本投稿的 README 检查项，均已复测。上线顺序：Gallery 与后端（`14a0dbf`、`e81cb4e`）、数据仓（`a2f8f95`）推送 → 发布数据包并升级两端 pin → 前后端一起部署，均待用户授权。
- 联调完成（后端 `14a0dbf`、数据仓 `a2f8f95`，均未推送）：隔离后端上走通文学题 + Markdown 示例、建模题无示例、审核改分类与审计、题库 / 排行榜 / 我的题目分类显示、小红帽按分类推断文本格式。联调中补了 `submit.js` 文本题的文件要求说明。见 [question-categories-2](docs/archive/2026-10-01-question-categories-wsnxxxs-2.md)。后端文本草稿仍显示 README 检查项，建议后端隐藏。
- 题库侧栏由标签筛选改为 全部题目 / 文学 / 静态网页 / 建模 / 模型索引，与排行榜题型同源（新增 `site/categories.js`，`tracksOf` 移入）。卡片和题目页先显示分类，与分类同名的标签隐藏；标签改为选填补充。
- 发起题目新增必选分类（三张单选卡片），提交格式随分类：文学固定纯文本 / Markdown（新 `text` 格式，上传 .txt/.md），静态网页与建模为 static / vite。审核通过对话框可设置分类。手机侧栏被不换行导航撑宽的问题一并修复。
- 依赖后端：`category` 字段与校验、`template=text` 文本渲染、审核改分类、各列表返回分类；任务提示词在忽略的 `output/backend-question-category-prompt.md`，需前后端一起发布。check 42/0、test 14/14、build 121 件；intake 121 错均为当前 pin 旧数据包的海报指纹过期，与本轮无关。真实后端联调、text 上传、手机端发起题目未验证。归档：[question-categories](docs/archive/2026-10-01-question-categories-wsnxxxs.md)。

## 本轮：发起题目示例结果选填（2026-10-01，已本地提交，未推送、未部署）

- `publish.js` 题目表单改为「提交题目」（只发 `POST /api/questions` 题目字段）与「附上示例结果（选填）」（沿用 `uploadFlow`）两个按钮；完成页兼容无作品。`submit.js` 文件要求改为 node_modules / .git 自动忽略但计入压缩包大小、密钥文件拒绝；`account.js` 两处文案改为“有示例结果时”。`docs/PRODUCT.md` 同步。
- 提交 `f06dbf3`；联调发现脚本替换把 `$$` 写成 `$`，导致「提交题目」报 `buttons.forEach is not a function`，已修复并随本轮收尾提交。check 41/0、test 14/14、本地 build 通过。
- 依赖后端 `5f2320c` 起的无作品建题与上传忽略目录，必须与后端一起发布。本地联调（隔离后端 + 本地 API 构建）：无示例 / 附示例建题、带 node_modules 的 Vite ZIP、`.env` 拒绝、我的题目、后台题目审核均通过。浏览器面板未渲染，交互由页面脚本触发；未做截图目检、移动端或生产验证。归档：[question-sample-optional](docs/archive/2026-10-01-question-sample-optional-wsnxxxs.md)。
- 同时提交了此前未提交的首页海报四轮改动（`f98836f`）及数据仓重烘海报（arenaofbias-data `f340aa9`）。数据包尚未发布、消费者 pin 未升级，线上海报不会因此变化；下方各轮“未提交”指当时状态。

## 盲评界面收尾（2026-10-01，分支已整理待合并）

- 用户已授权统一整理、提交、合并和推送，明确不部署。本工作树只整理 `arena-ui-harmony`：盲评大厅加入题型筛选、题目搜索和折叠规则；对战载入状态、手机切换栏及空状态与既有界面统一，导航统一称「盲评」。归档：[arena-ui](docs/archive/2026-10-01-arena-ui-wsnxxxs.md)。
- 收尾复跑 `npm run check`：41/0；`npm test`：14/14；`npm run build`：121 件、55 个 site 文件。`CI=1 npm run check:intake`：121 错/4 提示，错误均为既有固定数据包的 stale preview poster，原轮次归档已记录相同结果；不能视为完整门禁通过。
- 本轮未新增浏览器验收，原轮次目检与真实 iframe、投票、揭晓及浅色主题的未验收范围保留。由主工作树负责合并其他分支和推送，本分支没有推送或部署。
- 合并后清理 worktree 前先核对并保留忽略的 `datapack.json`、`integration.json` 与 `.datapack/`；`dist/` 可重建。合并冲突需同时保留主分支的对战逻辑修复与本分支手机重新载入的当前侧选择。

## 最新调整：按可见模型控制首页留白（2026-10-01，待用户确认）

- 用户反馈除飞机外又显空。上一轮固定了图片盒子，建筑海报内部透明空白仍重复叠加。本轮 `home.js` 加载海报后读取一次 alpha > 8 的外框并缓存，按可见外框等比缩放、居中；`studio.css` 使用计算后的宽高和偏移，可见外框占窗口宽或高的 84%，四边至少 8%。完整保留模型，同一作品仍只有一张海报，无新字段、依赖或图片请求。
- 五类首页模型 × 三档窗口与最近收录截图、测量通过，卡片高度与提示词间距不变、无横向溢出或 console error。147 个显示样本结合海报 alpha 数据计算，外框最大方向占比均 0.84、中心误差小于 1e-15、最小边距约 0.08。前端 check 41/0、test 14/14、build 121 件、CI intake 0 错/4 既有提示。
- 本轮未改共用渲染、数据仓或海报，无需重烘；题目与作品卡片淡入沿用首轮验证，未做真机性能或限速首载。未提交、推送或部署。归档：[home-poster-sizing-4](docs/archive/2026-10-01-home-poster-sizing-wsnxxxs-4.md)；12 组前后对比及补充截图在忽略的 `output/poster-visible-margin/comparison.html`。
- 本轮本地预览保留在 `http://127.0.0.1:5181/`（本轮 Vite preview，进程 13828，终端 session 5265）供用户复核，viewport 已恢复。以下各轮留白规则均为历史记录，以本节可见外框规则为准。

## 上一轮调整：首页海报固定比例留白（2026-10-01）

- 用户要求留白固定比例。`studio.css` 统一采用 `inset: 8%; width: 84%; height: 84%`，完整居中 contain；删除 `home.js` 中自然宽高比补偿及 load 回调。首页牌堆和最近收录使用同一规则，图片加载前后不改变显示区域。模型形状和海报自身透明边距仍可能增加某一方向的空白。
- 前端 check 41/0、test 14/14、build 121 件、CI intake 0 错/4 既有提示。首次 build 遇到 Windows 缓存 rename EPERM，重试通过。三类模型 × 三档窗口和最近收录均截图、测量；显示区域宽高均为容器的 84%，卡片等高、提示词无遮挡，无横向溢出或 console error。
- 未修改共用渲染或数据仓，无需重新烘焙；题目、作品卡片切换沿用首轮验证。未提交、推送或部署。归档：[home-poster-sizing-3](docs/archive/2026-10-01-home-poster-sizing-wsnxxxs-3.md)；12 组前后截图在忽略的 `output/poster-fixed-margin/comparison.html`。以下为前两轮记录，动态补偿已由本轮固定留白替代。

## 上一轮调整：首页海报视觉留白（2026-10-01）

- 用户反馈上一版偏大；仅在 `studio.css` 将首页海报的最终 scale 乘以 0.84，保留原有比例补偿。首页牌堆和最近收录同步增加周围留白，固定卡片尺寸和取景修正保留。下面上一轮“最大 1.06”是补偿因子；当前实际 scale 为 0.84–0.8904。
- 前端 check 41/0、test 14/14、build 121 件、CI intake 0 错/4 既有提示；三类模型 × 三档窗口目检及最近收录通过，无遮挡、横向溢出或 console error。未修改数据仓或重烘海报，未重复验证两类实时卡片，沿用前轮结果。
- 未提交、推送或部署。归档：[home-poster-sizing-2](docs/archive/2026-10-01-home-poster-sizing-wsnxxxs-2.md)；12 组本地截图对比在忽略的 `output/poster-balance/comparison.html`。

## 本轮完成：首页海报尺寸与模型取景（2026-10-01，待用户确认提交）

- 保留现有首页动画、海报和提示词位置改动，在 `home.js` / `studio.css` 上固定 16:10 图片容器，图片绝对定位，去掉 padding；读取图片自然比例进行面积补偿，最大缩放 1.06，不增加字段或请求。
- `result-previews.js` 对非建筑模型按可见网格顶点的实际二维投影取景，修正世界轴外框角点产生的空白；海报和实时画面共用。数据仓最终重烘 66 张（飞机 18、键盘 19、铁路 28、汽车 1），55 张原图保留，全部指纹更新。四件指定 Boeing 外框占比约 0.20–0.22 → 0.86；没有新增海报副本或固定比例海报。
- 前端 check 41/0、test 14/14、本地新包 build 121 件、CI intake 0 错/4 既有提示；数据仓 check 28/0、test 16/16、build:data 和 intake 通过。1280×720、1440×900、375×812 三类模型首页卡片等高、提示词无遮挡；最近收录等高；两种卡片的 18 项海报/实时 alpha 外框差异最大 1px，console error 0。没有真机、生产或全量交互验证。
- 未 commit、push、发布数据包、更新 pin 或部署；本地缓存为 local 数据包，原有 `.claude/` 未动。确认提交后还需发布数据包、升级消费者 pin，线上才生效。归档：[home-poster-sizing](docs/archive/2026-10-01-home-poster-sizing-wsnxxxs.md)；截图索引在忽略的 `output/poster-sizing/comparison.html`。

## 提示词版本卡片适配（2026-10-01，独立分支）

- 分支 `codex/intake-oct01-variants` 修复题目页配对卡片的模型加载：只给预览器传当前显示的作品版本，避免找不到未显示版本的卡片节点。普通卡片与来源过滤沿用现有行为。
- `npm run check` 41 文件 / 0 错误，`npm test` 14/14；本地数据包构建成功。两个配对题目的长短按钮、详情入口、桌面/手机截图对照已在浏览器验证，390px 页面无横向溢出。完整检查见 [本轮归档](docs/archive/2026-10-01-prompt-variant-preview-wsnxxxs.md)。
- 本轮只处理当前收录需要的前端兼容，未推送、未合并、未部署；原 checkout 的他人未提交改动保留。私有数据、本地 pin 和生成物不进入本仓提交。
## 本轮补充：用户授权先上线检查、不提交（2026-10-01）

- 用户确认正式仓库为 wsnxxxs/ArenaGalleri、自己有协作者权限，并明确要求先上线、不 commit。fetch 看到 origin/main=4e5ee04 的其他未上线功能；本轮只将现网功能基线加过场补丁发布，未合并/捎带这些其他变更，工作区源码与 HEAD 保留。
- 在服务器独立预览目录对固定现网作品包正常复制构建（本 checkout 缺配置仍保持不变），check 42/0、test 14/14、assemble 121 件/56 site 文件、CI intake 0 错/4 已知提示。公开 data.json 除预览 buildInfo 外与切换前逐字段一致。先前构建限制在这次服务器暂存构建中已解除；未升级作品包或修改数据库/后端。
- 发布 ID portal-preview-20261001T073255Z，buildInfo 用该标记辨识未提交预览。Gallery 本轮 4 文件变化：app.js、index.html、entry-boot.js、data.json（仅构建信息）；1556 文件完整哈希/集合核对通过，删除 0。旧目录保存在 /www/wwwroot/gallery.prev-portal-preview-20261001T073255Z；发布审计在 /root/portal-preview-20261001T073255Z，子站先切、总入口后启用，Nginx/后端均未改。
- 公网实际浏览器 1440px 从总入口点击进入、390px 带入口标记到达均就绪揭幕，零 pageerror/HTTP 错误，无横向溢出，首页截图目检通过；没有注册、投稿或盲评写入。本地证据在 Show1 output/portal-release-preview/live。两仓本轮没有 commit/push，用户正在检查预览。

## 本轮：总入口到达过场（2026-10-01，本地未提交/部署）

- 用户授权跨三个页面接通总入口色块过场。`site/index.html` head 在 ?entry=portal 时以 #121211 首帧盖住；新增 `site/entry-boot.js` 与 Show1 public 同名源文件逐字相同。初次 app 初始化 await route 后等待首屏图片、字体与布局，随后揭幕；数据异常、脚本/样式资源失败或 25 秒超时显示加载失败和重试/返回 arenaofbias.icu，失败后迟到就绪不能揭幕。成功移除 query 标记；直接打开不插入过场。默认 Gallery 主题与数据协议保持。
- 总入口源在 Show1 `portal/`，竞技场到达接入和 80% 整站缩放在 Show1，本仓没有缩放修改。三个入口须配套发布，不能仅上线入口动画。
- npm check 42 文件/0 错，npm test 14/14。npm build 因缺 datapack.json 配置无法完成，CI intake 因缺 .datapack/vendor/three.module.js 无法完成，未创建或改动私有配置。
- Show1 `scripts/validate-portal-entry.mjs` 用实际 site 源和合成档案/图片在独立 Gallery origin 验证桌面/手机/2048、正常/减少动态效果 6 组慢图保持遮罩、就绪揭幕与返回清理；5 类失败及重试通过。两站合计 12 组成功、10 组失败；不是正式数据包、真实平台业务或生产验收。截图在 Show1 忽略目录 output/portal-entry。未提交、推送、部署。

## 四仓统一发布完成（2026-10-01 Brisbane）

- 用户已确认两站、共享后端与数据仓同属本轮，授权一起提交、推送和部署，包含新增 38 件作品。此前只发布两仓、保留旧数据的范围已撤回；下方早期记录是当时状态。
- 2026-09-30T17:19:05Z（Brisbane 2026-10-01 03:19:05）已切换，Gallery 实际上线源码 `a68c94cb4c050202f240a64a9b3e5c69d0025d6e`，包含未公开题作品标题修复 `f956504` 及此前本地配套功能提交。共享后端题目人审/v22 和 Show1 法律、头像、账号文案一起上线。四仓功能源码已推送；后续文档提交不代表重新部署。
- 用户确认将并行会话首页精简一并推送、部署后，2026-09-30T17:40:14Z（Brisbane 03:40:14）当前 Gallery 更新为 `4717910e115413941586f170e808a32a05c1d258`。只替换 4 文件 / 0 删除，完整文件校验通过；固定作品包、后端和 Show1 不变。公网精简文案与 121 件统计正确，1280px 首屏目检正常，无横向溢出、console error 0；旧 a68c94c 静态目录保留。原本只本地提交的授权现已覆盖，见 [首页精简](docs/archive/2026-10-01-home-hero-copy-wsnxxxs.md) 与四仓发布归档。
- 实际消费经成功 main CI 发布的固定不可变包：20 题、121 件（新增 38 件）、37 个展示模型、sourceDirty false。API 与 Gallery 的内容版本和 catalogDigest 一致；私有 pin 不写入公开仓库。完整 1555 文件逐项 SHA-256 和精确集合校验通过，旧静态目录保留供回滚。
- 本轮 check 41 文件 / 0 错、test 14/14，干净已提交源码 npm ci / build 成功（121 件、55 个 site 文件），intake 0 错 / 4 已知提示。公网首页、新 Seed 工地作品预览和 AI 标识正常，console error 0。viewport override 未生效，实际仍为 1270/1280px，本轮未完成 Gallery 窄屏验收；未做生产注册/投稿、真实外部审核/截图、新增 38 件全量交互或真机测试。
- 用户确认清理的四道测试题已在部署、数据库备份和逐题零作品零票核对后，经管理员 API 全部软删除，审计完整；公开、作者、管理员列表均不再显示。备份位置与数据库回滚步骤只记录在共享后端运维交接。旧 PR #1 契约过时，不合并，关闭及删除分支仍待确认；占用中的本地 worktree 保留。详细记录见 [四仓发布归档](docs/archive/2026-10-01-four-repository-release-wsnxxxs.md)。

## 本地后续（2026-10-01，已提交、未推送）

- 首页「最近收录」接近视口时预先加载截图，默认标题改为「模型效果对比」；数据仓库 `gallery.json` 的 `subtitle` 已同步修改，新数据包发布并更新 pin 后生效。见 [最近收录预加载](docs/archive/2026-10-01-recent-strip-loading-wsnxxxs.md)。首页动画过渡调整尚未提交。

更新：2026-10-01。接手时先读本文件，再按任务查阅专题文档；已完成轮次保存在 `docs/archive/`。

## 当前状态

- 本仓只维护 Gallery 前端和消费端构建工具。另一前端、共享后台与私有作品数据分别维护；真实配置、数据版本及运维备份通过私有渠道管理，公开仓库仅保留占位示例。
- main 已包含提示词版本切换、同模型结果分组、双栏独立作品版本切换，以及跳过空题榜单读取的修正。维护整理开始时 main 与 origin/main 均为 `28eba10`；`codex/shared-question-intake` 的提交已全部合入。
- 已删除合并完成的远端 `codex/shared-question-intake` 分支，当时无开放 PR；当前另支旧 PR #1 是否关闭待确认。本地同名分支仍由已有 worktree 使用，保留该 worktree 与本地分支。
- 前次正式部署为 `ccfd11d`（2026-09-30）：20 道题、83 件既有作品；当前由顶部 `4717910` / 121 件发布覆盖。SupernovAI 与云山巨城各有长短两份原文、仍各 0 件作品。原文与复制已验收，生产同模型长短结果配对仍无样本。
- 正式站已记录安装 Gallery/API/作品域名私有文件规则和共享读取、模型包及并发限制。部署、回滚与验证边界见发布归档；备份具体路径及回滚步骤保留在独立后台运维交接。

## 发布前实现与联调记录（历史，已由顶部发布结果覆盖）

- 最初两仓范围后来扩展为四仓和最新作品，commit、push、deploy、备份和四题清理均已完成，见顶部。
- 后端题目审核整套实现已经完成，两仓 API 契约完全一致。site/account.js 已修复未公开题作品标题：从我的题目或审核题目列表取标题，避免显示题目 ID。此前各轮标题中的未推送、未部署仅为当轮结束时的历史状态，现进入统一发布阶段。
- 最新门禁：check 41 文件、0 错；test 14/14；使用既有固定数据包 build 83 件作品、55 个 site 文件；CI intake 0 错、3 条既有 warning。后端最新 check 69/0、全量 test 154/154；此前一次既有 moderation mock 间歇失败，单独 6/6 与再次全量均通过。
- 用户用同一静态 ZIP（dist 旁有 README）实测后端建题成功、状态 pending；本地服务已停止。真实隔离联调见下文，之后已统一上线。
- 旧 Gallery PR #1 是否关闭仍待用户确认，不合并它；Show1 配套改动和新的 121 件作品数据随后纳入统一发布。
- 本轮归档：[question-title-fix](docs/archive/2026-10-01-question-title-fix-wsnxxxs.md)。
## 历史实现与本轮联调：新题目附示例结果 + 人工审核（2026-10-01）

- 规则（用户确定）：发起题目必须同时附一份模型结果；新题目一律人工审核，不交 AI；结果（作品）照常走 AI 内容审核与核验。生产上 4 道指定测试题（kme7 发布）已通过部署后的管理员 API 清理，见顶部。
- 后端任务说明写在本地忽略目录 `output/backend-question-review-prompt.md`（v22：`questions.moderation`、`deleted_at`；`__new__` 草稿；`POST /api/questions` 带 `draftId`、`confirmed`、`work` 并在一个事务内建题建作品；`GET /api/admin/questions` 带 `samples`；`POST /api/questions/:id/moderation`；`DELETE /api/questions/:id`；bootstrap `review.questions`；`admin/` 题目审核）。前端按这份契约实现，契约若有调整需同步前端。
- `site/submit.js` 拆出 `uploadFlow(root, ctx, options)`，上传作品页照旧调用；`site/publish.js` 改为两段：01 题目信息，下一步进入共用的 02 选择文件、03 试加载、04 结果信息，最后一起提交；可以返回修改题目并保留已填内容，完成页链接「我的题目」和示例结果预览。
- `site/account.js`：我的题目显示「等待人工审核」/ 未通过及理由，未公开的题目没有链接，可以连同示例结果撤回；审核页改名「审核」，新增「题目」标签：待审题目按提交顺序排在最前，显示示例结果（模型、内容审核状态、预览），可以通过、拒绝（必须写理由）、删除；记录页识别 question 审计 action。`site/platform.js` 新增 `moderationBadge`、`QUESTION_LABELS`、`reviewCount`，侧栏和菜单的待办数加上待审题目。旧后端没有 `/api/admin/questions` 时，这个标签页只显示提示。
- 验证：check 41 文件、test 14/14，以本地 API 构建 dist。浏览器里用本地后端并在页面内替换尚不存在的接口（`__new__` 草稿查询、`POST /api/questions`、`/api/admin/questions`、题目审核与删除）：走通发起题目两段流程（试加载用真实草稿，请求体字段与契约一致）、返回修改题目、再发起一道、上传作品页回归（仍为 01–03）、我的题目三种状态、审核页题目标签的排序、示例结果、拒绝必填理由、删除请求、旧后端提示。内置浏览器窗格隐藏时对话框的 close 事件不触发，删除确认改为手动派发事件验证。当时尚无真实后端实现，因此该轮未做真实联调、真机或生产验证；后续真实联调见下文。

- 联调（后端题目审核已由另一 agent 实现、未提交；后端 check 69 文件、test 153/153）：用 Gallery 缓存 pin `4c926d5` 起隔离后端（空临时库，`CONTENT_MODERATION=1`、`CAPTURE=0`），真实走通 `__new__` 草稿 → 发起题目两段流程 → 公开 bootstrap 不含待审题 → 我的题目「等待人工审核」、我的作品有示例结果 → 管理员在 Gallery「审核 · 题目」看到示例结果私有预览、待办数 2 → 人工通过后题目公开 → 示例结果通过内容审核后成为题目页第一份作品，可继续上传。联调发现并修复（未提交）：未公开题目的作品在「我的作品」和审核列表显示题目 ID，`workRow` 改为从我的题目 / 审核题目列表取标题。
- 联调发现的后端问题已修复（未提交）：只允许纯 HTML 的题目，示例结果是 `dist/` 旁还有其他文件的静态 ZIP 时，原先建题会被误拒。后端现在沿用创建草稿时识别出的格式，旧草稿按「有 package.json 且有 root」判断；后端 test 154/154。用同一个 ZIP 在隔离后端上复测，建题成功（`pending`）。

## 历史轮次：已提交投稿流程对齐数据库（2026-10-01，`03cd457`，未推送、未部署）

- 新增 `site/work-fields.js`：作品信息字段、联动与逐项校验，由投稿页第 03 步和个人中心「编辑信息」弹窗共用。新增提示词版本（多版本题目必选）、生成方式与人工介入（必选）、模型版本、生成日期、过程记录链接；原「生成说明」改为「补充说明」。校验错误显示在对应字段下并聚焦。
- `site/submit.js`：提示词预览可切换长短版；离开页面不再丢弃草稿，重新进入同题时提示继续试加载；包检查有 warn（如重复内容）时确认文案同步提示；侧栏步骤在确认试加载后切到 03。完成页与侧栏时间线按 `site.contentModeration` 区分「内容审核中」，不再写「核验通过后进入盲评」，改为由管理员决定。
- `site/account.js`：我的作品显示内容审核中 / 待人工复核 / 未通过（含原因）和提示词版本；审核通过前标题打开私有预览；`unverified` 作品可编辑信息。`site/app.js` 的投稿结果带上 `promptVariant`，与馆藏一样进入同模型版本卡片。`site/platform.css` 补无效输入、字段错误、编辑弹窗等少量样式。`docs/PRODUCT.md` 已补投稿行为。
- 依赖 arenaofbias-server `44df198`（v21 `prompt_variant`、`GET /api/drafts?task=`、`PATCH /api/works/:task/:id`，未推送），两边需一起发布；后端未更新时，多版本题目不会拒绝缺少版本的投稿，草稿恢复静默跳过，编辑保存会失败。
- 验证：check 41 文件、test 14/14、以本地 API 构建 dist。隔离后端（Gallery 缓存 pin `4c926d5`、临时库、`CONTENT_MODERATION=1`、`CAPTURE=0`）上用测试账号走通：草稿恢复与试加载、长短提示词预览切换、缺版本时字段报错、提交写入五项生成信息与版本、完成页显示内容审核中、我的作品显示待人工复核、编辑弹窗回填与保存（版本改为长版）、管理员人工通过后长短两份投稿合为一张卡片并切换。375px 下我的作品和编辑弹窗无横向滚动。文件选择与拖拽未在浏览器里点选（内置浏览器无法选本地文件，草稿经页面脚本上传）；console 有 2 条 404，疑为切换后端前的请求，未逐条定位；未运行 intake、未做真机与生产验证。

## 历史轮次：已提交排行榜按题型分榜（2026-10-01，`7d7eda3`，未推送、未部署）

- 排行榜的侧栏视图改为「综合」+ 数据包题目 `category`（文学 / 静态网页 / 建模，`#/leaderboard/text|page|model`）；题型视图的工具栏有题目下拉，单题仍是 `#/leaderboard/<题目>`，侧栏停在所属题型。标题行加搜索模型；综合榜在厂商小字后列出后端 `standings` 给出的各题型名次。区间条改为 4px 细槽 + 截取「灰 → 朱红」渐变的区间段 + 带描边圆点。作品页内嵌单题榜只继承新区间条样式。`public-catalog.mjs` 白名单加入 `category`，`ui.js` 新增 `cube` 图标。
- 依赖后端 `8efaccc`（arenaofbias-server，`/api/leaderboard?category=` 与综合榜 `standings`，未推送），两边需一起发布；后端未更新时题型视图提示「后端暂不支持这项筛选」并显示未筛选榜单。
- 验证：check 40 文件、test 14/14、build、`CI=1 check:intake`（83 件、0 错、3 条既有 warning）。本地隔离后端（正式 pin `4c926d5`、临时库、82 件馆藏开盲评、6 个测试账号 234 票，全部落在建模题）+ 本地 API 构建的 dist：综合 / 建模 / 选题下拉 / 旧单题链接 / 无效地址回退 / 文学空榜 / 搜索与无结果提示 / 作品页内嵌榜单 / 390 宽度无横向滚动 / 浅色主题均通过脚本核对，模型 logo 正常，无 console error。截图工具在本机超时，未做逐像素目检；文学、静态网页当前无作品，只验证了空状态。

## 历史轮次：已提交使用条款、隐私政策、备案、AI 标识与头像库（2026-10-01，未推送、未部署）

- `site/legal.js` 提供 `#/terms`（使用条款与免责声明）和 `#/privacy`（隐私政策），都可以用 `#/<页>#<节>` 定位。运营者写为「ArenaGalleri 运营团队」，联系邮箱常量 `CONTACT` 也在这里。正文要和 Show1 逐字一致，改动时两边一起改。隐私政策按后端实际实现撰写（密码哈希、30 天会话 Cookie、每日加盐 IP 哈希、Turnstile、邮件、AI 审核只发送作品内容、作品 CDN；按用户要求不写审核服务所在地），后端数据处理有变化时要同步修改。
- 页脚：使用条款、隐私政策、联系我们，以及一行版权 / AI 生成 / 注明来源说明。ICP 备案号按域名显示：`闽ICP备2026019671号-2` 只在 arenaofbias.icu 及其子域出现。迁到 gallery.arenagalleri.com 前，要在 `legal.js` 的 `BEIAN` 里加上新域名对应的备案号。
- 同意入口：注册弹窗（隐式同意文字）、投稿确认勾选框、发起题目按钮旁都链接了条款和隐私政策。
- 账号绑定：个人中心新增「账号绑定」区块，一种方式一行，目前只有邮箱（`site/account.js` 的 `bindEmail`），沿用后端已有的 `/api/auth/email/send|bind` 与 Turnstile；邮箱状态读 `/api/auth/me`，显示打码地址。用户要求界面只说「账号绑定」，不写「邮箱绑定」，以后可以在同一区块加其他方式。本地用假 SMTP 走完了发码、错码提示、绑定成功、打码显示，无 console error。
- 忘记密码：登录框新增「忘记密码？」，打开两步找回弹窗（`site/platform.js` 的 `openReset`）：先发码并核对验证码，再设置新密码，走 `/api/auth/email/send|verify` 与 `/api/auth/password/reset`。成功后回到登录框并填好账号。发码按钮（Turnstile、60 秒冷却）抽成 `codeSender`，账号绑定弹窗也改用它。本地用假 SMTP 走完了发码、错码、两次密码不一致、重置、用新密码登录，无 console error。
- AI 显式标识「AI 生成」：题目作品列表标题旁、在线预览顶栏、原作展厅卡片头、盲评匿名作品栏头。盲评标识只做了代码检查，本地没有可配对作品，未在浏览器中看到。
- 头像：`site/assets/avatars/` 共 16 个 SVG，由后端 `site.avatars` 下发 id；顶栏、菜单、社区题目发布者显示头像，个人中心点击头像可更换。后端未提供头像时退回首字母。依赖后端头像改动（arenaofbias-server，同样未提交），两边需一起发布。
- 验证：check 40 文件、test 14/14。用本地后端 + dist 副本做了无头 Chrome 验收：换头像流程、条款页和隐私政策页、注册弹窗、深浅色、手机宽度（无横向滚动）、题目页 / 预览 / 展厅的 AI 标识均正常，无 console error；备案号按主机名匹配用函数直接验证。未运行完整 build / intake。

## 历史轮次：已提交首页标题轮换（2026-10-01，未推送、未部署）

- `site/home.js` 的 `VERSES` 收录 30 组「典故上句 + 本题作品数下句」对句（含原「回字有四样写法」），附出处小字。进入首页随机选题；自动换题也随机选另一道；每次换题随机抽对句，不重复最近 8 组。等字体加载完（最多 1.2 秒）再淡入，减少动态效果时直接替换。
- 按风格用四款 OFL 字体：song 思源宋体（古典哲思、诗词），kai 霞鹜文楷（书画、故事，出处小字也用它），wei 站酷小薇（西方艺术），hei 得意黑（俗语、考场）。`site/assets/fonts/` 里是只含 home.js 字符的 woff2 子集（共约 390 KB，按需加载）和各自许可文件；子集改名为 Verse Song/Kai/Wei/Hei，避开 OFL 保留名。改文案新增字符后要重跑 `python scripts/verse-fonts.py <字体原件目录>`（需 fonttools、brotli；原件在 Google Fonts / 各字体 GitHub 发布页，不进仓库）。
- `site/studio.css`：`.home-copy` 设为尺寸容器，标题字号按较长一行的字数、字体字宽（`--adv`）和字距（`--ls`）收缩，不折行；`.home-verse` 保留最大字号时的高度，切换时下方内容不跳动。
- 验证：check 40 文件、test 14/14、build、check:intake（83 件、0 错、3 条既有 warning）。脚本核对 30 组文案字符在各自字体子集里全部存在。浏览器 1440 宽度随机出 29 组、375 手机宽度出齐 30 组，都没有溢出，手机无横向滚动，无 console error；四种字体都已加载并截图目检，浅色主题手机宽度看过一组宋体。未在真实 Windows/iOS 设备上检查。

## 前轮审查：提交就绪检查（2026-10-01，问题已由本轮修复）

- 仅审查现有改动，未修改功能、提交、推送或部署。首页标题轮换，以及条款 / 隐私页面、备案与 AI 标识可作为优先提交范围；`site/studio.css`、`site/app.js`、`site/platform.js` 混有其他功能，拆分提交必须按差异块选择，不能直接按整文件纳入。
- 账号绑定 / 找回密码依赖的邮箱接口已存在于后端 HEAD；但 `site/platform.js` 的 `codeSender` 在 `await ready` 之后才禁用按钮。用模拟的 300ms 初始化与发送回调复现：连续点击两次触发两次发送回调；成功路径还会创建两个共享倒计时的 interval。建议提交这组功能前先修正点击互斥。本轮没有发送真实邮件。
- 头像依赖相邻后端未提交的 avatar / DTO 改动，前端源码可保存为提交，完整功能发布需协调后端。作品资源仍在独立私有 data 仓库；新增头像和标题字体是前端界面资源。
- 本轮 check 40 文件、test 14/14、build、CI intake 全部通过（83 件、0 错、3 条既有 warning）。浏览器复查桌面首页、375px 首页 / 条款 / 隐私页及条款节定位，已目检截图，无页面横向溢出。使用纯静态服务，唯一 console error 为预期的 `/api/bootstrap` 404；未重新执行真实账号联调、生产或全部作品交互验收。
- 审查记录：[commit-readiness-review](docs/archive/2026-10-01-commit-readiness-review-wsnxxxs.md)。

## 本轮完成：验证码修复与分功能提交（2026-10-01）

- 用户授权修复、按功能提交，并明确先不推送。按要求使用 GPT-6.1 Sol / high 子 agent，仅负责 `codeSender` 修复，父 agent 负责验证、拆分和提交。
- `codeSender` 在等待初始化前立即锁定发送按钮，阻止重复进入；初始化后如果弹窗已关闭则不发送，未完成人机验证或发送失败时恢复按钮。子 agent 模拟双击仅一次发送、一个 interval；父 agent 浏览器模拟 300ms 初始化再次确认双击只调用一次发送回调。未发送真实邮件。
- `0dc5224`：首页标题轮换与字体；`d25b4fc`：条款 / 隐私、备案与 AI 标识；`2719fa9`：账号绑定 / 找回密码及验证码修复；`4e50a6b`：头像库。混合文件按差异拆分，均使用 wsnxxxs 的 GitHub noreply 身份。交接与两轮归档另作记录提交。
- 修复后 check 40 文件、test 14/14、build、CI intake 通过（83 件、0 错、3 条既有 warning）；浏览器已目检首页，纯静态服务仅有预期 `/api/bootstrap` 404。既有完整账号与头像联调结果沿用上轮记录，本轮未重新验收真实后端、生产或全部作品交互。
- 所有上述提交仅在本地。未推送、未部署、未修改相邻仓库。头像功能发布仍需协调后端未提交的 avatar / DTO 改动；`dist/` 为修复后、功能提交前的本地验证构建，正式发布需从确定的提交重新构建。
- 完成记录：[feature-commits](docs/archive/2026-10-01-feature-commits-wsnxxxs.md)。

## 待办与验证边界

- 正式题库、本轮配套功能与新增 38 件作品已统一发布。后续收录长短版题目作品时，在私有数据仓库填写实际 `promptVariant`；长短结果到位后再核对真实同模型卡片与双栏切换，不伪造生产样本。
- 最近发布未覆盖手机、全部原作、生产登录投票/投稿或付费审核。新增改动按影响范围验证，不能把构建成功或原文检查称为全部交互通过。
- 旧轮文档整理为 39 文件语法检查、14/14 合成测试；本次发布为顶部 41 文件 / 14 测试及干净构建、intake 和公网验证。私有配置、缓存及另一 worktree 保留，不纳入提交。

## 维护入口

- [长期约定](AGENTS.md) · [本地检查与授权构建](README.md)
- [架构](docs/ARCHITECTURE.md) · [产品行为](docs/PRODUCT.md) · [界面规范](docs/DESIGN.md)
- [收录流程](docs/intake-workflow.md) · [模型预览](docs/preview-loading.md) · [沙盘](docs/sandtable.md)

## 历史索引

历史记录描述各轮当时状态；后续合并、部署结论以较新的发布记录为准。

| 轮次 | 记录内容 |
| --- | --- |
| [four-repository-release](docs/archive/2026-10-01-four-repository-release-wsnxxxs.md) | 四仓正式上线、121 件作品、测试题清理和验证边界 |
| [home-hero-copy](docs/archive/2026-10-01-home-hero-copy-wsnxxxs.md) | 并行会话首页精简；其只本地提交状态已由本轮后续授权推送、部署覆盖 |
| [question-title-fix](docs/archive/2026-10-01-question-title-fix-wsnxxxs.md) | 未公开题作品标题修复、真实联调与发布前状态 |
| [feature-commits](docs/archive/2026-10-01-feature-commits-wsnxxxs.md) | 验证码发送修复、四组功能本地提交与验证边界 |
| [commit-readiness-review](docs/archive/2026-10-01-commit-readiness-review-wsnxxxs.md) | 未提交功能审查、验证码按钮并发问题与可提交范围 |
| [repository-cleanup](docs/archive/2026-09-30-repository-cleanup-wsnxxxs.md) | 文档整理、已合并远端分支清理与本轮验证范围 |
| [shared-question-release](docs/archive/2026-09-30-shared-question-release-wsnxxxs.md) | 版本切换合并、20 题正式发布、空题榜单修正、验证边界 |
| [protection-deploy](docs/archive/2026-09-30-protection-deploy-wsnxxxs.md) | 独立 Gallery 部署、私有文件与共享限流验收、备份位置说明 |
| [shared-question-intake](docs/archive/2026-09-30-shared-question-intake-wsnxxxs.md) | 功能分支交付与本地验收；当时尚未合并，现已由 release 完成 |
| [clean-gallery-migration](docs/archive/2026-09-30-clean-gallery-migration-wsnxxxs.md) | 干净仓库迁移、公开/私有边界和初始验证 |
