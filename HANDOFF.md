# HANDOFF.md · 当前状态

## 本轮：去掉页脚「版本」诊断（2026-10-01，已本地提交，未推送、未部署）

- 访客用不到页脚右侧的「版本」折叠项，它还会暴露部署信息，所以删掉了：`site/app.js` 的 `buildVersion`/`shortSha` 和调用、`site/style.css` 的 `.build-info`、`docs/DESIGN.md` 的对应条目。`DATA.buildInfo` 保留，写请求版本校验仍在用。`platform.serverVersion` 不再显示；`platform.js` 有他人未提交改动，这次没动。
- 本轮重新运行 check：42 个文件、0 错误；test：14/14 通过。提交范围仅含三处删除及本轮记录，其他未提交改动保留。未运行 build、intake，未做浏览器目检，本轮仅核对和提交现有修改。归档：[footer-version-removal](docs/archive/2026-10-01-footer-version-removal-wsnxxxs.md)。

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
