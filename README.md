# PMS 工时申报工具

Bio-Cloud PMS 工时申报桌面端工具（Windows），基于 Electron，用于简化"波浪式嵌入式 WAVE"等项目的每日工时申报流程。

**当前版本**：`1.1.0`
**安装包位置**：`dist\PMS工时申报工具-1.1.0-setup.exe`（75 MB）
**免安装版本**：`dist\win-unpacked\PMS工时申报工具.exe`

---

## 1. 项目概述

本工具自动化对接 **bio-cloud.com.cn** 的 PMS 工时申报模块，主要面向嵌入式/上位机研发人员，解决以下痛点：

- 每天手动填工时、写备注繁琐
- 需要上传"相关代码文件"附件（zip）
- 备注要求口语化、具体到功能点，人工编写耗时

**核心能力**：

1. **自动登录**：Token 本地持久化，登录一次长期使用
2. **批量申报**：选日期范围（自动跳过周末）一次提交多天
3. **自动附件**：从指定项目目录随机抽取 5-10 个源码文件，打包为 `相关代码文件_YYYYMMDD.zip` 上传
4. **智能备注**：
   - 首选：调用 OpenAI 兼容 LLM（如 StepFun `step-3.5-flash`），根据抽取的文件名生成 30 字左右口语化修改记录
   - 降级：LLM 不可用时，使用本地规则引擎（12 类业务域 + 随机动词 + 对象组合）生成
   - 降级时会提示用户核对
5. **撤销/删除**：在申报列表中直接操作（撤销用于"审批中"，删除用于"草稿/已驳回/已撤回"）

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 运行时 | Electron | ^31.0.0 |
| 前端 | 原生 HTML/CSS/JS | — |
| 后端调用 | node-fetch (v2) | ^2.7.0 |
| 文件上传 | 手动构建 multipart（非 form-data 库） | — |
| 压缩 | adm-zip | ^0.6.0 |
| 配置持久化 | electron-store | ^8.1.0 |
| 打包 | electron-builder | ^24.13.3 |

> **为什么不用 `archiver`**：archiver v7+ 已转为 ESM-only，Electron 主进程是 CommonJS，无法 `require`。改用 `adm-zip`（同步 API，CommonJS 兼容）。

### 2.2 进程架构

```
┌─────────────────────── Electron 主进程 (main.js) ───────────────────────┐
│  - 窗口管理                                                             │
│  - IPC handlers (login/upload/create/cancel/delete/llm/zip)            │
│  - 文件系统访问 (adm-zip, fs)                                          │
│  - 配置持久化 (electron-store)                                         │
│  - 网络请求 (node-fetch) → bio-cloud API                               │
│                                                                         │
│         ▲ IPC (invoke/handle)                  contextBridge           │
└─────────┼──────────────────────────────────────────────────────────────┘
          │ preload.js (暴露 window.pms API)
          ▼
┌─────────────────────── 渲染进程 (renderer/*.html/js/css) ──────────────┐
│  - UI 交互 (登录/申报/列表/设置)                                       │
│  - 表单校验 + 流程控制                                                 │
│  - 无 Node 直接访问（contextIsolation: true, nodeIntegration: false）  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 目录结构

```
d:\Code\BLK\PMS\
├── main.js              # Electron 主进程
├── preload.js           # IPC 安全桥接 (contextBridge)
├── api.js               # Bio-Cloud API 封装（统一鉴权头 + 文件上传）
├── renderer/
│   ├── index.html       # 主界面
│   ├── style.css        # 样式
│   └── app.js           # 前端交互逻辑 + 降级备注生成
├── package.json         # 依赖 + electron-builder 配置
├── .npmrc               # 国内镜像（electron、electron-builder binaries）
└── dist/                # 打包输出
    ├── PMS工时申报工具-1.1.0-setup.exe
    └── win-unpacked/    # 免安装版
```

### 2.4 配置存储

`electron-store` 默认存储在：
```
C:\Users\<用户名>\AppData\Roaming\pms-workhour-declarer\pms-config.json
```

存储字段：
- `account` / `pwd`：登录账号密码（明文，可后续改为加密存储）
- `token`：Bearer Token（登录成功时更新）
- `userId`：当前用户 ID（用于申报 `user_id_declaration`）
- `projectDir`：项目工作目录（代码模块抽取源）
- `llmApiUrl` / `llmApiKey` / `llmModel`：LLM 配置（OpenAI 兼容接口）

---

## 3. API 接口清单

对接后端：**`https://www.bio-cloud.com.cn:8101`**（API）
静态资源：**`https://www.bio-cloud.com.cn:8022`**（文件/图标）

### 3.1 通用请求头

| Header | 值 | 说明 |
|--------|----|----|
| `system-type` | `4` | Web 平台标识 |
| `user-agent` | Chrome 150 UA | 伪装浏览器 |
| `origin` | `https://www.biolink.city` | 跨域来源（CORS `*`）|
| `referer` | `https://www.biolink.city/` | — |
| `authorization` | `Bearer <token>` | 登录后的鉴权头（除 login 外）|
| `accept` | `application/json, text/plain, */*`（JSON）/ `*/*`（文件上传）| — |

### 3.2 接口列表

#### 认证类

| 接口 | 方法 | 路径 | 请求体 | 说明 |
|------|------|------|--------|------|
| 登录 | POST | `/api/user/login` | `{"account":"手机号","pwd":"密码"}` | 返回 `data.token`，后续请求带 `Authorization: Bearer <token>` |
| 用户信息 | GET | `/api/user/info` | — | 校验 token、获取 `data.info.id`（用于申报的 `user_id_declaration`）|

#### 工时申报（PMS）

| 接口 | 方法 | 路径 | 请求体 | 说明 |
|------|------|------|--------|------|
| 申报列表 | GET | `/api/pms/projects/declaration_list` | query: `page`, `limit`, `tag`, `status`, `worker_name`, `project_name`, `task_name` | `tag=5` 表示"我的申报" |
| 申报准备数据 | GET | `/api/pms/declaration_prepare_data` | — | 返回当前用户可申报的项目列表及其下挂任务 |
| 创建申报 | POST | `/api/pms/projects/create_declaration` | 数组 `[{project_id, task_id, user_id_declaration, executed_working_hours, date, remarks, group_type, file:[{file_name,file_id,file_url}]}]` | 一次提交多天 |
| 撤销申报 | POST | `/api/pms/projects/cancel_declaration` | `{"origin_id": <申报id>, "approval_flow_id": <审批流id>}` | 仅"审批中"可用 |
| 删除申报 | DELETE | `/api/pms/projects/create_declaration` | `{"ids": <申报id>}` | 仅"草稿/已驳回/已撤回"可用 |

#### 文件上传

| 接口 | 方法 | 路径 | 请求体 | 说明 |
|------|------|------|--------|------|
| 添加文件 | POST | `/api/file/add_file` | `multipart/form-data` | **必须包含 `content_type=5` 字段**，详见下文 3.3 |

返回：
```json
{
  "code": 200,
  "data": {
    "file_id": "UUID",
    "file_url": "https://www.bio-cloud.com.cn:8022/annex/...",
    "file_name": "文件名.zip"
  }
}
```

### 3.3 文件上传的关键坑（重要）

后端是 PHP/Laravel，上传接口强校验 multipart 结构，踩过的坑：

1. **必须包含 `content_type` 表单字段**：值为 `5`，服务器据此判定允许的文件后缀白名单。缺失 → `Exception: postfix not allow`
2. **文件名必须纯 ASCII**：中文文件名在 multipart Content-Disposition 头中编码异常，服务器无法正确解析 `.zip` 扩展名。解决：上传前改为 `code_files_YYYYMMDD.zip`
3. **必须手动构建 multipart body**：Node.js `form-data` 库生成的格式与浏览器有差异，后端校验不通过。`api.js` 中 `uploadFile()` 采用 Buffer 拼接方式，确保：
   - `Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...`
   - 字段顺序：`content_type` → `file`
   - 文件部分 `Content-Type: application/x-zip-compressed`（与浏览器一致）
   - 显式 `content-length`

参考实现见 `api.js` → `uploadFile()`。

### 3.4 状态码约定

- `code === 200`：成功
- 其他：失败，`msg` 字段为错误描述

---

## 4. 业务流程

### 4.1 启动流程

```
app ready
  ↓
tryAutoLogin()
  ├─ 读本地 token
  ├─ 调 /api/user/info 验证
  ├─ 成功 → showMainPanel() → 并发加载:
  │     ├─ loadPrepareData()    项目/任务下拉
  │     ├─ loadDeclarationList()  申报记录列表
  │     └─ loadModules()        扫描项目目录子文件夹
  └─ 失败 → showLoginPanel()
```

### 4.2 申报提交流程（自动模式）

```
对日期范围中每一天（跳过周末）:
  1. 随机选模块（或用户指定）
  2. generateCodeZip(moduleName, date)
     └─ adm-zip 打包 5-10 个源码文件 → /tmp/pms-zip/相关代码文件_YYYYMMDD.zip
  3. uploadFile(zipPath, "code_files_YYYYMMDD.zip")  ← 用 ASCII 名
     └─ 返回 file_id / file_url
  4. 备注生成:
     ├─ 用户已填 → 使用用户输入
     ├─ LLM 成功 → 使用 AI 生成
     └─ LLM 失败 → fallbackRemarks()（规则引擎，记录 fallbackCount）
  5. 加入 declarations 数组
调用 /api/pms/projects/create_declaration 批量提交
刷新列表
若 fallbackCount > 0 → 显示"非 AI 生成"警告
```

### 4.3 LLM 调用

- **URL/Key/Model**：用户在 `⚙ 设置` 配置，存入 `pms-config.json`
- **协议**：OpenAI Chat Completions（`/v1/chat/completions`）
- **关键参数**：
  - `max_tokens`：**不限制**（`step-3.5-flash` 是推理模型，`max_tokens` 太小会被思考吃光）
  - `temperature`: 0.7
- **Prompt**：要求具体、口语化、30 字、2 个改动点、全中文、禁止思考过程
- **提取策略**：优先取 `message.content`；若为空（推理模型问题），从 `reasoning_content` 提取最后一段 ≤80 字的句子

---

## 5. 本地开发与打包

### 5.1 环境准备

```bash
cd d:\Code\BLK\PMS
npm install   # .npmrc 已配置 npmmirror 镜像
```

### 5.2 开发运行

```bash
npm start       # 或 npx electron .
```

> GPU cache 相关的报错（`Unable to create cache`）是 Chromium 的无害警告，不影响功能。

### 5.3 打包

```bash
npm run dist    # 生成 NSIS 安装包
npm run pack    # 仅生成免安装目录（调试用）
```

**打包注意点**：

- 打包前**杀掉正在运行的 Electron 进程**，否则 `d3dcompiler_47.dll` 被占用，app-builder 无法清空 `dist\win-unpacked`
- 首次打包可能遇到 `winCodeSign` 解压失败（含 macOS 符号链接，Windows 普通权限无法创建）。手动用 7za 解压到 `LOCALAPPDATA\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`，排除 `darwin` 目录即可
- `.npmrc` 中已配置 `electron_mirror` 和 `electron_builder_binaries_mirror` 指向 `npmmirror.com`，加速下载

### 5.4 版本号变更

修改 `package.json` → `version`，再 `npm run dist`，安装包文件名会随之更新。

---

## 6. 已知问题 & 后续优化建议

### 6.1 已知问题

- 账号密码明文存 `pms-config.json`（可改用 `electron safeStorage` 加密）
- 降级备注若未命中任何业务域，会使用通用词"相关功能"，可读性一般
- 未做 Token 自动刷新（过期需重新登录）
- GPU cache 警告每次启动都会打印（无害但影响观感）

### 6.2 可扩展方向

- 支持批量选择模块/按日期分配不同模块
- 附件 zip 中保留原目录结构（当前是扁平 + 相对路径）
- Token 过期自动续期（拦截 401 → 自动 login → 重试）
- 申报历史导出为 Excel
- 接入更多 PMS 接口（如项目变更、采购申请等）

---

## 7. 文件说明

| 文件 | 作用 |
|------|------|
| `main.js` | Electron 主进程，所有 IPC handlers 在此 |
| `preload.js` | `contextBridge` 暴露 `window.pms` API 给渲染进程 |
| `api.js` | `BioCloudAPI` 类，封装所有 bio-cloud 接口，统一鉴权头 |
| `renderer/index.html` | 主界面（登录 + 主面板 + 设置弹窗 + Toast + Loading）|
| `renderer/app.js` | 前端逻辑：登录、申报、列表、LLM 降级、事件绑定 |
| `renderer/style.css` | UI 样式，CSS 变量定义在 `:root` |
| `package.json` | 依赖 + electron-builder `build` 配置 |
| `.npmrc` | Electron/electron-builder 国内镜像 |

---

## 8. 联系 / 交接

代码风格：Node.js CommonJS，函数式前端，无构建工具（直接加载 HTML/CSS/JS）。
主要依赖：`node-fetch@2`、`adm-zip`、`electron-store`、`electron`、`electron-builder`。
遇到上传失败优先排查：multipart 格式、`content_type=5` 字段、文件名 ASCII。
遇到 LLM 返回空 `content`：优先检查 `max_tokens` 是否设置（推理模型应不限制或给足够大）。
