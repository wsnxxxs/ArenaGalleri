# 2026-10-01 · 简化投稿选项并补齐必填校验 · wsnxxxs

- 负责人：wsnxxxs（GitHub API 核对 id 269096463）｜执行 AI：Codex

## 本轮目标

用户要求 Harness 不细分且扩充主流选项、生成方式仅一轮与多轮、Qwen 归 Alibaba、开放六个指定模型并核对名字/logo，推理档位及服务商必填。用户每轮修改后 commit 的指示授权本地提交，每仓一条英文简单句。

## 改动

site/work-fields.js 移除 Harness optgroup，平铺按名称排序。生成方式仅一轮 / 多轮。推理档位必填，Default 为明确选择，不作为缺省；其他档位必填文本。服务商必填，仅官方 / 非官方。作者编辑共用表单；管理员核验补相同必填提示。更新文档和现有联调请求 fixture。 提交号见 Git。

## 验证

check 43/0、test 14/14；本地扩充数据包 build 182 件 / 57 site 文件，CI=1 intake 0 错 / 9 既有提示。真实隔离后端 integration smoke 通过。Browser 运行实际 work-fields 模块的本地验收页：空档位、空手填档位、空服务商逐项阻止；填完整成功；Harness 0 个 optgroup、27 选项；模型 45 项、Qwen 全归 Alibaba、六个品牌图均有 naturalWidth，console error 0。截图 output/submission-options/form.png。未通过实际上传页重新做 ZIP、SMTP、付费审核或真机验证。

## 明确没做

未推送、部署、更新生产消费者 pin；未回填或推断历史缺失档位、来源及 agent 轮数。

## 遗留物

其它会话正在修改 scripts/public-catalog.mjs、site/app.js、site/home.js、site/studio.css、site/style.css；未操作或纳入本轮提交。私有 pin 未改，忽略的 .datapack 为通过安装器加载的本地开发包。

## 下一步建议

需要上线时配套发布数据包、Gallery 与后端，并选定匹配包。
