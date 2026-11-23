# 更新日志

## [1.1.0] - 2026-07-21

### 新增
- **撤销申报**：审批中的记录可直接在列表中撤销（`POST /api/pms/projects/cancel_declaration`）
- **删除申报**：草稿/已驳回/已撤回的记录可直接删除（`DELETE /api/pms/projects/create_declaration`）
- **LLM 备注非 AI 提示**：当备注走降级规则（非 AI 生成）时，提交后以黄色警告明确提醒用户核对
- **降级备注业务域扩展**：从单句笼统描述扩展为 12 类业务域（报警/配置/设备/控制台/曲线/参数/通讯/用户/日志/校准/报表/界面），生成 changelog 风格的具体改动短语
- **LLM 提示词增强**：明确要求 2 个具体改动点 + 对象/动作风格 + 禁止输出思考过程

### 修复
- **文件上传 `postfix not allow`**：手动构建 multipart body，加入必须的 `content_type=5` 字段，上传文件名强制 ASCII（`code_files_YYYYMMDD.zip`）
- **推理模型 LLM 输出为空**：去掉 `max_tokens` 限制；当 `content` 为空时从 `reasoning_content` 提取最后一句作为兜底
- **archiver ESM 报错**：替换为 CommonJS 兼容的 `adm-zip`
- **form-data 流式上传失败**：改为 Buffer 读取文件 + 手动拼接 multipart

### 技术
- Electron 31.7.7
- 安装包体积：75 MB（NSIS）

## [1.0.0] - 2026-07-21

### 新增
- 自动登录 + Token 持久化
- 工时批量申报（自动跳过周末）
- 从项目目录随机抽取 5-10 个源码文件打包为 `相关代码文件_YYYYMMDD.zip` 上传
- LLM 自动生成口语化备注，失败时降级为本地规则生成
- 设置面板：项目目录 + LLM API 配置
