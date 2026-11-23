const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const Store = require('electron-store');
const BioCloudAPI = require('./api');
const fetch = require('node-fetch');

const store = new Store({ name: 'pms-config' });
const api = new BioCloudAPI();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'PMS 工时申报工具',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ========== IPC Handlers ==========

// 获取保存的配置
ipcMain.handle('get-config', () => {
  return {
    account: store.get('account', ''),
    pwd: store.get('pwd', ''),
    token: store.get('token', ''),
    userId: store.get('userId', null),
    projectDir: store.get('projectDir', ''),
    llmApiUrl: store.get('llmApiUrl', ''),
    llmApiKey: store.get('llmApiKey', ''),
    llmModel: store.get('llmModel', ''),
  };
});

// 保存配置
ipcMain.handle('save-config', (e, config) => {
  const keys = ['account', 'pwd', 'token', 'userId', 'projectDir', 'llmApiUrl', 'llmApiKey', 'llmModel'];
  keys.forEach((k) => {
    if (config[k] !== undefined) store.set(k, config[k]);
  });
  return true;
});

// 登录
ipcMain.handle('login', async (e, { account, pwd }) => {
  try {
    const result = await api.login(account, pwd);
    if (result.success) {
      store.set('token', result.token);
      store.set('account', account);
      store.set('pwd', pwd);
      // 获取用户信息
      const userInfo = await api.getUserInfo();
      if (userInfo.code === 200) {
        store.set('userId', userInfo.data.info.id);
        return { success: true, user: userInfo.data.info };
      }
      return { success: true, user: null };
    }
    return result;
  } catch (err) {
    return { success: false, msg: err.message };
  }
});

// 验证已保存的 token
ipcMain.handle('validate-token', async () => {
  const token = store.get('token', '');
  if (!token) return { success: false };
  api.setToken(token);
  const result = await api.validateToken();
  if (result.success) {
    store.set('userId', result.user.id);
  }
  return result;
});

// 获取申报列表
ipcMain.handle('get-declaration-list', async (e, { page, limit, tag, filters }) => {
  try {
    return await api.getDeclarationList(page, limit, tag, filters);
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

// 获取准备数据
ipcMain.handle('get-prepare-data', async () => {
  try {
    return await api.getDeclarationPrepareData();
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

// 选择文件
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: '选择附件',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 上传文件
ipcMain.handle('upload-file', async (e, { filePath, uploadName }) => {
  try {
    return await api.uploadFile(filePath, uploadName);
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

// 创建申报
ipcMain.handle('create-declaration', async (e, declarations) => {
  try {
    return await api.createDeclaration(declarations);
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

// 撤销申报
ipcMain.handle('cancel-declaration', async (e, { originId, approvalFlowId }) => {
  try {
    return await api.cancelDeclaration(originId, approvalFlowId);
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

// 删除申报
ipcMain.handle('delete-declaration', async (e, { ids }) => {
  try {
    return await api.deleteDeclaration(ids);
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

ipcMain.handle('get-overtime-applications', async (e, { page, limit, tag, startDate, endDate }) => {
  try {
    return await api.getOvertimeApplications(page, limit, tag, { startDate, endDate });
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

ipcMain.handle('get-leave-applications', async (e, { page, limit, tag }) => {
  try {
    return await api.getLeaveApplications(page, limit, tag);
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

ipcMain.handle('get-attendance-results', async (e, { userId, startDate, endDate }) => {
  try {
    return await api.getAttendanceResults(userId, startDate, endDate);
  } catch (err) {
    return { code: -1, msg: err.message };
  }
});

// ========== 项目目录 & 代码文件相关 ==========

// 选择项目目录
ipcMain.handle('select-project-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择项目工作目录',
  });
  if (result.canceled) return null;
  const dir = result.filePaths[0];
  store.set('projectDir', dir);
  return dir;
});

// 扫描模块文件夹（项目目录下的一级子目录）
ipcMain.handle('scan-modules', async () => {
  const dir = store.get('projectDir', '');
  if (!dir || !fs.existsSync(dir)) return { success: false, msg: '目录不存在' };
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const modules = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => e.name);
  return { success: true, modules };
});

// 递归获取目录下所有文件
function getAllFiles(dirPath, fileList = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      getAllFiles(fullPath, fileList);
    } else {
      // 跳过二进制/无关文件
      const ext = path.extname(entry.name).toLowerCase();
      const skipExts = ['.exe', '.dll', '.so', '.dylib', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.zip', '.rar', '.7z', '.pdf'];
      if (!skipExts.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// 附件名里的时刻，作为包内文件和 zip 本身的修改时间。日期取上报日。
function timestampFromReport(date, zipFileName) {
  const named = /^BackupFiles(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.zip$/.exec(zipFileName || '');
  if (named) {
    return new Date(
      Number(named[1]),
      Number(named[2]) - 1,
      Number(named[3]),
      Number(named[4]),
      Number(named[5]),
      Number(named[6])
    );
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (day) {
    return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 16, 0, 0);
  }
  return new Date();
}

// 从指定模块随机抽取5-10个文件，打包成zip
ipcMain.handle('generate-code-zip', async (e, { moduleName, date, zipName }) => {
  try {
    const projectDir = store.get('projectDir', '');
    if (!projectDir) return { success: false, msg: '未设置项目目录' };

    const modulePath = path.join(projectDir, moduleName);
    if (!fs.existsSync(modulePath)) return { success: false, msg: `模块目录不存在: ${moduleName}` };

    // 获取所有文件
    const allFiles = getAllFiles(modulePath);
    if (allFiles.length === 0) return { success: false, msg: '模块内无可用文件' };

    // 随机抽取 5-10 个文件
    const count = Math.min(allFiles.length, Math.floor(Math.random() * 6) + 5);
    const shuffled = allFiles.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    // 附件名: BackupFilesYYYYMMDD_HHmmss.zip，时间为当天 16:00–17:00
    const dateStr = String(date || '').replace(/-/g, '');
    const requested = typeof zipName === 'string' ? path.basename(zipName) : '';
    const finalName = /^BackupFiles\d{8}_16[0-5]\d[0-5]\d\.zip$/.test(requested)
      ? requested
      : `BackupFiles${dateStr}_160000.zip`;
    const tmpDir = path.join(os.tmpdir(), 'pms-zip');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, finalName);

    // 创建zip，包内文件修改时间改为该次上报日期（与附件名中的时刻一致）
    const modifiedAt = timestampFromReport(date, finalName);
    const zip = new AdmZip();
    selected.forEach((filePath) => {
      const relPath = path.relative(modulePath, filePath);
      zip.addLocalFile(filePath, path.dirname(relPath));
    });
    zip.getEntries().forEach((entry) => {
      entry.header.time = modifiedAt;
    });
    zip.writeZip(zipPath);
    fs.utimesSync(zipPath, modifiedAt, modifiedAt);

    // 返回zip路径和选中的文件名列表
    const fileNames = selected.map((f) => path.relative(modulePath, f));
    return { success: true, zipPath, zipName: finalName, fileNames, moduleName };
  } catch (err) {
    return { success: false, msg: err.message };
  }
});

// 调用LLM生成修改记录
ipcMain.handle('generate-remarks', async (e, { fileNames, moduleName }) => {
  try {
    const apiUrl = store.get('llmApiUrl', '');
    const apiKey = store.get('llmApiKey', '');
    const model = store.get('llmModel', '');

    if (!apiUrl) return { success: false, msg: '未配置LLM API地址' };

    const prompt = `你是一个嵌入式/上位机软件开发者。根据以下代码文件名列表，编写一条具体的开发修改记录（用于工时申报备注）。
风格参考（非常重要，必须像这样具体到功能点）：
- “报警增加设备编号，报警配置增加额外参数”
- “设备列表支持批量导入，修复离线后状态不刷新”
- “曲线图增加多通道显示，优化刷新帧率”
要求：
- 2个左右具体的改动点，用逗号分隔，总长30字左右
- 每个改动都要有明确的“对象+动作”，比如“增加XX字段”“支持XX”“修复XX问题”“优化XX”
- 根据文件名合理推测业务（如 Alarm→报警，Device→设备，Config→配置，Curve→曲线，Calibration→校准），可以编造合理的细节
- 必须全中文，不要出现英文单词、命名空间、点号（如 WAVE.Wpf.Standard.Control）
- 不要出现“文件”“代码”“模块”这种笼统词
- 禁止输出任何思考过程、解释、分析、字数统计，禁止输出草稿或对比过程
- 只能输出最终结果的一句话，不要引号，不要前缀（不要“答：”“备注：”等）

模块: ${moduleName}
文件列表:
${fileNames.join('\n')}`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, msg: `LLM请求失败 HTTP ${res.status}: ${errText.slice(0, 150)}` };
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message || {};
    // 优先取正式回复 content；推理模型有时把答案放在 reasoning_content 中，尝试从中提取最后一句
    let text = (msg.content || '').trim();
    if (!text) {
      const reasoning = (msg.reasoning_content || msg.reasoning || '').trim();
      if (reasoning) {
        // 取最后一个以句号结尾的片段，或最后一段（按“？”“。”切分后取末段）
        const sentences = reasoning.split(/[。？！\n]/).map(s => s.trim()).filter(Boolean);
        const last = sentences[sentences.length - 1] || '';
        if (last && last.length <= 80) text = last;
      }
    }
    if (text) return { success: true, remarks: text };
    return { success: false, msg: 'LLM未返回内容' };
  } catch (err) {
    return { success: false, msg: err.message };
  }
});
