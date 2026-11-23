// ========== State ==========
let currentUser = null;
let prepareData = [];
let moduleList = [];

// ========== DOM ==========
const $ = (id) => document.getElementById(id);

const els = {
  panelLogin: $('panel-login'),
  panelMain: $('panel-main'),
  userBadge: $('user-badge'),
  btnLogout: $('btn-logout'),
  btnSettings: $('btn-settings'),
  inputAccount: $('input-account'),
  inputPwd: $('input-pwd'),
  btnLogin: $('btn-login'),
  loginError: $('login-error'),
  selectProject: $('select-project'),
  selectTask: $('select-task'),
  selectModule: $('select-module'),
  btnScanModules: $('btn-scan-modules'),
  dateStart: $('input-date-start'),
  dateEnd: $('input-date-end'),
  inputHours: $('input-hours'),
  dateSummary: $('date-summary'),
  inputRemarks: $('input-remarks'),
  chkAutoFile: $('chk-auto-file'),
  btnSubmit: $('btn-submit'),
  btnOpenAudit: $('btn-open-audit'),
  auditModal: $('audit-modal'),
  btnCloseAudit: $('btn-close-audit'),
  auditDateStart: $('audit-date-start'),
  auditDateEnd: $('audit-date-end'),
  btnRunAudit: $('btn-run-audit'),
  auditSummary: $('audit-summary'),
  auditBatch: $('audit-batch'),
  auditBatchHint: $('audit-batch-hint'),
  auditSelectAll: $('audit-select-all'),
  btnAuditRewriteSelected: $('btn-audit-rewrite-selected'),
  auditList: $('audit-list'),
  btnRefreshPrepare: $('btn-refresh-prepare'),
  btnRefreshList: $('btn-refresh-list'),
  declarationList: $('declaration-list'),
  toast: $('toast'),
  loading: $('loading'),
  loadingText: $('loading-text'),
  // 设置弹窗
  settingsModal: $('settings-modal'),
  btnCloseSettings: $('btn-close-settings'),
  inputProjectDir: $('input-project-dir'),
  btnSelectDir: $('btn-select-dir'),
  inputLlmUrl: $('input-llm-url'),
  inputLlmKey: $('input-llm-key'),
  inputLlmModel: $('input-llm-model'),
  btnSaveSettings: $('btn-save-settings'),
};

// ========== Utils ==========
let toastTimer = null;
function showToast(msg, type = 'info', duration = 3000) {
  els.toast.textContent = msg;
  els.toast.className = `toast toast-${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), duration);
}

function showLoading(text = '处理中...') {
  els.loadingText.textContent = text;
  els.loading.classList.remove('hidden');
}

function hideLoading() {
  els.loading.classList.add('hidden');
}

function formatDate(dateStr) {
  return dateStr; // already YYYY-MM-DD
}

function getStatusInfo(status) {
  const map = {
    1: { text: '草稿', cls: 'status-draft' },
    2: { text: '审批中', cls: 'status-pending' },
    3: { text: '已拒绝', cls: 'status-rejected' },
    4: { text: '已驳回', cls: 'status-rejected' },
    5: { text: '已通过', cls: 'status-approved' },
  };
  return map[status] || { text: `状态${status}`, cls: 'status-draft' };
}

// 降级备注：根据文件名推断业务模块，生成具体的修改记录（类 changelog 风格）
// 未命中业务域时用于将命名空间段映射为中文
const TERM_MAP = {
  control: '控制台', controls: '控件', view: '界面', views: '界面',
  service: '服务', services: '服务', config: '参数配置', configuration: '参数配置',
  calibration: '校准', model: '数据', models: '数据', common: '公共',
  core: '核心', util: '工具', utils: '工具', helper: '辅助',
  data: '数据', device: '设备', driver: '驱动', ui: '界面',
  standard: '标准', wpf: '', app: '主程序', main: '主',
};

// 每个业务词 -> 一组合理的改动短语
const DOMAIN_RULES = [
  { kw: ['alarm', 'warn', '报警', '告警'], name: '报警', acts: ['增加设备编号', '配置增加额外参数', '支持按等级过滤', '修复重复弹窗问题', '增加声音提醒开关', '日志补充时间戳'] },
  { kw: ['config', 'setting', '配置', '设置'], name: '配置', acts: ['增加额外参数项', '支持导入导出', '增加默认值校验', '修复保存不生效的问题', '增加参数范围限制'] },
  { kw: ['device', 'dev', '设备'], name: '设备', acts: ['增加编号字段', '支持批量添加', '优化连接状态显示', '增加离线重连', '修复掍线后状态不刷新'] },
  { kw: ['control', 'ctrl', '控制'], name: '控制台', acts: ['增加手动微调', '优化按钮响应', '增加权限校验', '修复状态同步延迟'] },
  { kw: ['curve', 'chart', 'plot', '曲线', '图表'], name: '曲线', acts: ['增加多通道显示', '支持缩放拖拽', '优化刷新帧率', '增加数据导出'] },
  { kw: ['param', 'parameter', '参数'], name: '参数', acts: ['增加额外字段', '支持范围校验', '增加单位转换', '修复精度丢失'] },
  { kw: ['comm', 'protocol', 'modbus', 'serial', '通讯', '通信', '协议'], name: '通讯', acts: ['增加超时重试', '优化串口重连', '增加CRC校验', '修复丢包问题'] },
  { kw: ['user', 'account', 'login', 'auth', '用户', '登录'], name: '用户', acts: ['增加权限分级', '优化登录校验', '增加操作日志', '修复会话过期'] },
  { kw: ['log', 'record', '日志', '记录'], name: '日志', acts: ['增加时间戳', '支持按等级过滤', '增加导出功能', '优化写入性能'] },
  { kw: ['calib', '校准'], name: '校准', acts: ['增加多点校准', '优化拟合算法', '增加校准记录', '修复偏差计算'] },
  { kw: ['report', '报表'], name: '报表', acts: ['增加导出Excel', '优化模板排版', '增加筛选条件', '修复分页问题'] },
  { kw: ['view', 'ui', 'page', 'window', '界面', '页面'], name: '界面', acts: ['优化布局', '增加加载提示', '修复适配问题', '增加快捷操作'] },
];

function fallbackRemarks(moduleName, fileNames = []) {
  const haystack = (moduleName + ' ' + fileNames.join(' ')).toLowerCase();
  // 命中的业务域
  let hits = DOMAIN_RULES.filter((r) => r.kw.some((k) => haystack.includes(k)));
  if (hits.length === 0) {
    // 未命中时，取模块名映射 + 一个通用域兑底
    const parts = String(moduleName).split(/[.\-_\s]+/).filter(Boolean);
    const last = (parts[parts.length - 1] || '').toLowerCase();
    const cn = TERM_MAP[last] || '相关功能';
    hits = [{ name: cn, acts: ['优化显示逻辑', '修复已知问题', '增加异常处理', '补充参数校验'] }];
  }
  // 随机选 1-2 个业务域，每个配一个改动，拼成“报警增加设备编号，报警配置增加额外参数”风格
  hits = hits.sort(() => Math.random() - 0.5);
  const pick = hits.slice(0, Math.min(hits.length, Math.random() < 0.6 ? 2 : 1));
  const clauses = pick.map((r) => {
    const act = r.acts[Math.floor(Math.random() * r.acts.length)];
    return `${r.name}${act}`;
  });
  return clauses.join('，');
}

function analyzeDateRange() {
  return HolidayCalendar.analyze(els.dateStart.value, els.dateEnd.value);
}

let summarySeq = 0;

function refreshDateSummary() {
  const seq = ++summarySeq;
  const range = analyzeDateRange();
  els.dateSummary.textContent = HolidayCalendar.describe(range);
  if (!range.ok || !currentUser) return;

  fetchReportedDates(els.dateStart.value, els.dateEnd.value).then((reported) => {
    if (seq !== summarySeq) return;
    const merged = HolidayCalendar.excludeWorkdays(range, reported, '已报过');
    els.dateSummary.textContent = HolidayCalendar.describe(merged);
  }).catch(() => {
    if (seq !== summarySeq) return;
    els.dateSummary.textContent = HolidayCalendar.describe(range) + '；已申报记录核对失败';
  });
}

// 我的申报里已有记录的日期（含草稿、审批中、已通过、已驳回、已撤回）不再提交。
async function fetchReportedDates(start, end) {
  const reported = new Set();
  if (!start || !end) return reported;
  const limit = 100;
  let page = 1;
  let total = Infinity;
  while ((page - 1) * limit < total && page <= 30) {
    const res = await window.pms.getDeclarationList({ page, limit, tag: 5, filters: {} });
    if (res.code !== 200 || !Array.isArray(res.data?.list)) {
      throw new Error(res.msg || '申报列表加载失败');
    }
    const list = res.data.list;
    const totalCount = Number(res.data.totalCount);
    total = Number.isFinite(totalCount) ? totalCount : list.length;
    let pageAllOlder = list.length > 0;
    list.forEach((item) => {
      const date = String(item.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (date >= start) pageAllOlder = false;
      if (date >= start && date <= end) reported.add(date);
    });
    if (list.length < limit || pageAllOlder) break;
    page += 1;
  }
  return reported;
}

// ========== Auth ==========
function showMainPanel(user) {
  currentUser = user;
  els.panelLogin.classList.add('hidden');
  els.panelMain.classList.remove('hidden');
  els.userBadge.textContent = user.name;
  els.userBadge.classList.remove('hidden');
  els.btnLogout.classList.remove('hidden');
  els.btnSettings.classList.remove('hidden');
  loadPrepareData();
  loadDeclarationList();
  loadModules();
  refreshDateSummary();
}

function showLoginPanel() {
  els.panelMain.classList.add('hidden');
  els.panelLogin.classList.remove('hidden');
  els.userBadge.classList.add('hidden');
  els.btnLogout.classList.add('hidden');
  els.btnSettings.classList.add('hidden');
}

async function tryAutoLogin() {
  const config = await window.pms.getConfig();
  if (config.account) els.inputAccount.value = config.account;
  if (config.pwd) els.inputPwd.value = config.pwd;

  if (config.token) {
    showLoading('验证登录状态...');
    const result = await window.pms.validateToken();
    hideLoading();
    if (result.success) {
      showMainPanel(result.user);
      return;
    }
  }
  showLoginPanel();
}

async function doLogin() {
  const account = els.inputAccount.value.trim();
  const pwd = els.inputPwd.value.trim();
  if (!account || !pwd) {
    els.loginError.textContent = '请输入账号和密码';
    els.loginError.classList.remove('hidden');
    return;
  }

  els.btnLogin.disabled = true;
  els.loginError.classList.add('hidden');
  showLoading('登录中...');

  const result = await window.pms.login(account, pwd);
  hideLoading();
  els.btnLogin.disabled = false;

  if (result.success) {
    showToast(`欢迎, ${result.user?.name || '用户'}`, 'success');
    showMainPanel(result.user);
  } else {
    els.loginError.textContent = result.msg || '登录失败';
    els.loginError.classList.remove('hidden');
  }
}

// ========== Prepare Data ==========
async function loadPrepareData() {
  els.selectProject.innerHTML = '<option value="">加载中...</option>';
  const res = await window.pms.getPrepareData();
  if (res.code === 200 && res.data) {
    prepareData = res.data;
    renderProjectSelect();
  } else {
    els.selectProject.innerHTML = '<option value="">加载失败</option>';
  }
}

function renderProjectSelect() {
  els.selectProject.innerHTML = '<option value="">选择项目</option>';
  prepareData.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.project_name;
    els.selectProject.appendChild(opt);
  });
}

function onProjectChange() {
  const projectId = parseInt(els.selectProject.value);
  els.selectTask.innerHTML = '<option value="">选择任务</option>';
  if (!projectId) return;

  const project = prepareData.find((p) => p.id === projectId);
  if (project && project.tasks) {
    project.tasks.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.executed_working_hours}/${t.working_hours}h)`;
      els.selectTask.appendChild(opt);
    });
  }
}

// ========== Declaration List ==========
async function loadDeclarationList() {
  els.declarationList.innerHTML = '<p class="placeholder">加载中...</p>';
  const res = await window.pms.getDeclarationList({ page: 1, limit: 20, tag: 5, filters: {} });
  if (res.code === 200 && res.data?.list) {
    renderDeclarationList(res.data.list);
  } else {
    els.declarationList.innerHTML = '<p class="placeholder">加载失败</p>';
  }
}

function renderDeclarationList(list) {
  if (!list.length) {
    els.declarationList.innerHTML = '<p class="placeholder">暂无申报记录</p>';
    return;
  }
  els.declarationList.innerHTML = list.map((item) => {
    const st = getStatusInfo(item.status);
    // 审批中(2) 可撤销；草稿(1)/已拒绝(3)/已驳回(4) 可删除。已通过(5) 不能撤回或删除。
    const canCancel = item.status === 2;
    const canDelete = [1, 3, 4].includes(item.status);
    let actions = '';
    if (canCancel) {
      actions += `<button class="btn btn-xs btn-cancel" data-act="cancel" data-id="${item.id}" data-flow="${item.approval_flow_id}">撤销</button>`;
    }
    if (canDelete) {
      actions += `<button class="btn btn-xs btn-delete" data-act="delete" data-id="${item.id}">删除</button>`;
    }
    return `
      <div class="declaration-item">
        <div class="decl-top">
          <span class="decl-project">${item.project_name}</span>
          <div class="decl-top-right">
            <span class="decl-status ${st.cls}">${st.text}</span>
            ${actions}
          </div>
        </div>
        <div class="decl-detail">
          <span>📋 ${item.task_name}</span>
          <span>📅 ${item.date}</span>
          <span>⏱ ${item.executed_working_hours}h</span>
          <span>👤 ${item.handler_name || '-'} (${item.handler_node || '-'})</span>
        </div>
        ${item.remarks ? `<div class="decl-detail" style="margin-top:4px"><span>💬 ${item.remarks}</span></div>` : ''}
      </div>
    `;
  }).join('');
}

// 列表操作（撤销/删除）- 事件委派
async function onDeclarationListClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const id = parseInt(btn.dataset.id);

  if (act === 'cancel') {
    if (!confirm('确定要撤销这条申报吗？撤销后可重新编辑或删除。')) return;
    const flow = parseInt(btn.dataset.flow);
    btn.disabled = true;
    showLoading('撤销中...');
    const res = await window.pms.cancelDeclaration({ originId: id, approvalFlowId: flow });
    hideLoading();
    if (res.code === 200) {
      showToast(res.msg || '撤销成功', 'success');
      loadDeclarationList();
      refreshDateSummary();
    } else {
      btn.disabled = false;
      showToast('撤销失败: ' + (res.msg || '未知错误'), 'error');
    }
  } else if (act === 'delete') {
    if (!confirm('确定要删除这条申报吗？删除后不可恢复。')) return;
    btn.disabled = true;
    showLoading('删除中...');
    const res = await window.pms.deleteDeclaration({ ids: id });
    hideLoading();
    if (res.code === 200) {
      showToast(res.msg || '删除成功', 'success');
      loadDeclarationList();
      refreshDateSummary();
    } else {
      btn.disabled = false;
      showToast('删除失败: ' + (res.msg || '未知错误'), 'error');
    }
  }
}

// ========== Modules ==========
async function loadModules() {
  const res = await window.pms.scanModules();
  if (res.success && res.modules) {
    moduleList = res.modules;
    renderModuleSelect();
  }
}

function renderModuleSelect() {
  els.selectModule.innerHTML = '<option value="">随机模块</option>';
  moduleList.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    els.selectModule.appendChild(opt);
  });
}

// ========== Settings ==========
async function openSettings() {
  const config = await window.pms.getConfig();
  els.inputProjectDir.value = config.projectDir || '';
  els.inputLlmUrl.value = config.llmApiUrl || '';
  els.inputLlmKey.value = config.llmApiKey || '';
  els.inputLlmModel.value = config.llmModel || '';
  els.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  els.settingsModal.classList.add('hidden');
}

async function saveSettings() {
  await window.pms.saveConfig({
    llmApiUrl: els.inputLlmUrl.value.trim(),
    llmApiKey: els.inputLlmKey.value.trim(),
    llmModel: els.inputLlmModel.value.trim(),
  });
  showToast('设置已保存', 'success');
  closeSettings();
  loadModules();
}

async function selectProjectDir() {
  const dir = await window.pms.selectProjectDir();
  if (dir) {
    els.inputProjectDir.value = dir;
    loadModules();
  }
}

// ========== Submit ==========
async function submitDeclaration() {
  const projectId = parseInt(els.selectProject.value);
  const taskId = parseInt(els.selectTask.value);
  const hours = String(WorkhourAudit.declareHours(els.inputHours.value));
  const manualRemarks = els.inputRemarks.value.trim();
  const range = analyzeDateRange();
  const autoFile = els.chkAutoFile.checked;
  const selectedModule = els.selectModule.value; // 空 = 随机

  if (!projectId) return showToast('请选择项目', 'error');
  if (!taskId) return showToast('请选择任务', 'error');
  if (hours === '0') return showToast('每日工时至少为 1，小数会去掉', 'error');
  if (!range.ok) return showToast('请选择有效的日期范围', 'error');
  if (autoFile && moduleList.length === 0) return showToast('请先在设置中配置项目目录', 'error');

  els.btnSubmit.disabled = true;

  try {
    showLoading('核对已申报日期...');
    const reported = await fetchReportedDates(els.dateStart.value, els.dateEnd.value);
    const merged = HolidayCalendar.excludeWorkdays(range, reported, '已报过');
    const dates = merged.workdays;
    const reportedCount = merged.excluded.length;
    if (!dates.length) {
      hideLoading();
      const detail = reportedCount
        ? `所选工作日都已申报（${reportedCount} 天），不再重复提交`
        : '所选日期都是法定节假日或休息日';
      showToast(detail, 'error');
      els.btnSubmit.disabled = false;
      return;
    }

    const declarations = [];
    let fallbackCount = 0;   // 使用降级（非AI）备注的天数
    let lastLlmError = '';   // 最后一次LLM失败原因

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      let remarks = manualRemarks;
      let fileInfo = null;

      if (autoFile) {
        // 每天随机抽取模块文件生成zip
        const moduleName = selectedModule || moduleList[Math.floor(Math.random() * moduleList.length)];
        showLoading(`[${i + 1}/${dates.length}] ${date} 生成代码文件 (${moduleName})...`);

        const zipName = HolidayCalendar.buildBackupFileName(date);
        const zipRes = await window.pms.generateCodeZip({ moduleName, date, zipName });
        if (!zipRes.success) {
          hideLoading();
          showToast(`生成zip失败: ${zipRes.msg}`, 'error');
          els.btnSubmit.disabled = false;
          return;
        }

        // 上传名与本地 zip 一致：BackupFiles年月日_16点至17点
        showLoading(`[${i + 1}/${dates.length}] ${date} 上传附件...`);
        const uploadRes = await window.pms.uploadFile(zipRes.zipPath, zipRes.zipName);
        if (uploadRes.code === 200 && uploadRes.data) {
          fileInfo = {
            file_name: uploadRes.data.file_name,
            file_id: uploadRes.data.file_id,
            file_url: uploadRes.data.file_url,
          };
        } else {
          hideLoading();
          showToast(`上传失败: ${uploadRes.msg || ''}`, 'error');
          els.btnSubmit.disabled = false;
          return;
        }

        // LLM生成备注（如果用户没手动填）
        if (!remarks) {
          showLoading(`[${i + 1}/${dates.length}] ${date} AI生成备注...`);
          const llmRes = await window.pms.generateRemarks({
            fileNames: zipRes.fileNames,
            moduleName: zipRes.moduleName,
          });
          if (llmRes.success) {
            remarks = llmRes.remarks;
          } else {
            // LLM 不可用，降级为本地规则生成，记录以便提醒
            remarks = fallbackRemarks(moduleName, zipRes.fileNames);
            fallbackCount++;
            lastLlmError = llmRes.msg || '';
          }
        }
      }

      declarations.push({
        project_id: projectId,
        task_id: taskId,
        user_id_declaration: currentUser.id,
        executed_working_hours: String(hours),
        date,
        remarks: remarks || '研发调试',
        group_type: '',
        file: fileInfo ? [fileInfo] : [],
      });
    }

    // 提交申报
    showLoading(`提交 ${dates.length} 天工时申报...`);
    const res = await window.pms.createDeclaration(declarations);
    hideLoading();

    if (res.code === 200) {
      els.inputRemarks.value = '';
      loadDeclarationList();
      refreshDateSummary();
      const holidaySkip = merged.skipped.filter((item) => item.reason !== '已报过').length;
      const skippedNote = [
        holidaySkip ? `，已跳过 ${holidaySkip} 天节假日/休息日` : '',
        reportedCount ? `，已跳过 ${reportedCount} 天已申报` : '',
      ].join('');
      const yearNote = merged.missingYears.length ? `。${merged.missingYears.join('、')} 年放假安排尚未公布，该年只跳过了周末` : '';
      if (fallbackCount > 0) {
        // 备注非AI生成，明确提醒用户核对
        const reason = lastLlmError ? `（${lastLlmError}）` : '（未配置或调用失败）';
        showToast(`申报成功${dates.length}天${skippedNote}，但其中${fallbackCount}天备注为本地规则生成、非AI${reason}，请注意核对${yearNote}`, 'warn', 7000);
      } else if (yearNote) {
        showToast(`申报成功！共 ${dates.length} 天${skippedNote}${yearNote}`, 'warn', 7000);
      } else {
        showToast(`申报成功！共 ${dates.length} 天${skippedNote}`, 'success');
      }
    } else {
      showToast('申报失败: ' + (res.msg || '未知错误'), 'error');
    }
  } catch (err) {
    hideLoading();
    showToast('提交出错: ' + err.message, 'error');
  }

  els.btnSubmit.disabled = false;
}

// ========== 核对工时 ==========
let auditIssues = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// 列表按日期从新到旧返回时，整页都早于开始日就可以停。
function pageOlderThan(list, start, readDate) {
  let dated = false;
  for (const item of list) {
    const date = String(readDate(item) || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    dated = true;
    if (date >= start) return false;
  }
  return dated;
}

async function fetchPaged(loader, totalKeys, options = {}) {
  const limit = options.limit || 200;
  const maxPages = options.maxPages || 8;
  const all = [];
  let page = 1;
  let total = Infinity;
  while ((page - 1) * limit < total && page <= maxPages) {
    const res = await loader(page, limit);
    if (res.code !== 200 || !Array.isArray(res.data?.list)) {
      throw new Error(res.msg || '列表加载失败');
    }
    const list = res.data.list;
    let totalCount = NaN;
    for (const key of totalKeys) {
      const n = Number(res.data[key]);
      if (Number.isFinite(n)) {
        totalCount = n;
        break;
      }
    }
    all.push(...list);
    if (list.length < limit) break;
    if (typeof options.stopAfter === 'function' && options.stopAfter(list)) break;
    total = Number.isFinite(totalCount) ? totalCount : Infinity;
    page += 1;
  }
  return all;
}

function openAudit() {
  els.auditDateStart.value = els.dateStart.value;
  els.auditDateEnd.value = els.dateEnd.value;
  els.auditModal.classList.remove('hidden');
}

function closeAudit() {
  els.auditModal.classList.add('hidden');
}

function renderAuditIssues(result) {
  auditIssues = result.issues;
  els.auditSummary.textContent = result.issues.length
    ? `${result.start} 至 ${result.end}，共 ${result.dayCount} 天，${result.issues.length} 天有问题。工作日标准时长 ${WorkhourAudit.formatHours(result.standardHours)}h。`
    : `${result.start} 至 ${result.end}，共 ${result.dayCount} 天，申报时长与考勤加班、请假一致，也没有休息日或法定节假日误报。`;
  const actionable = result.issues.some((issue) => issue.action !== 'display');
  els.auditBatch.classList.toggle('hidden', !actionable);
  els.auditBatchHint.classList.toggle('hidden', !actionable);
  els.auditSelectAll.checked = false;
  if (!result.issues.length) {
    els.auditList.innerHTML = '<p class="placeholder">没有需要处理的日期</p>';
    updateAuditSelection();
    return;
  }
  els.auditList.innerHTML = result.issues.map((issue, index) => {
    const tags = issue.tags.map((tag) => {
      const cls = tag === '误报' ? 'audit-tag-danger' : 'audit-tag-warn';
      return `<span class="audit-tag ${cls}">${escapeHtml(tag)}</span>`;
    }).join('');
    const canAct = issue.action !== 'display';
    const willCreate = canAct && issue.expectedHours > 0.05;
    const source = (issue.records || []).find((rec) => rec.remarks) || {};
    const hasFiles = (issue.records || []).some((rec) => rec.files && rec.files.length);
    const bound = (issue.records || []).find((rec) => rec.projectId && rec.taskId);
    const defaultProjectId = parseInt(els.selectProject.value, 10);
    const lock = canAct
      ? `<button class="btn btn-xs btn-cancel" data-act="rewrite" data-index="${index}">${escapeHtml(issue.actionLabel)}</button>`
      : `<span class="audit-tag audit-tag-muted">${escapeHtml(issue.lockReason || '仅显示')}</span>`;
    const fields = willCreate ? `
      <div class="audit-rewrite-fields">
        ${bound ? '' : `
          <div class="audit-file-row">
            <select class="audit-project" data-index="${index}">${auditProjectOptions(defaultProjectId)}</select>
            <select class="audit-task" data-index="${index}">${auditTaskOptions(defaultProjectId, parseInt(els.selectTask.value, 10))}</select>
          </div>
        `}
        <input type="text" class="audit-remarks" data-index="${index}" placeholder="申报理由，留空则按附件自动生成" value="${escapeHtml(source.remarks || '')}">
        <div class="audit-file-row">
          <select class="audit-file-mode" data-index="${index}">
            <option value="auto">自动生成附件</option>
            ${hasFiles ? '<option value="keep">沿用原附件</option>' : ''}
            <option value="pick">选择文件</option>
          </select>
          <button type="button" class="btn btn-xs hidden" data-act="pick-file" data-index="${index}">选择</button>
          <span class="audit-file-name" data-index="${index}"></span>
        </div>
      </div>
    ` : '';
    return `
      <div class="audit-item${canAct ? '' : ' audit-item-lock'}" data-index="${index}">
        <div class="audit-top">
          <div class="audit-tags">
            ${canAct ? `<input type="checkbox" class="audit-check" data-index="${index}">` : ''}
            <span class="audit-date">${escapeHtml(issue.date)}</span>
            ${tags}
          </div>
          ${lock}
        </div>
        <div class="audit-detail">${escapeHtml(issue.detail)}</div>
        ${fields}
      </div>
    `;
  }).join('');
  updateAuditSelection();
}

function updateAuditSelection() {
  const boxes = [...els.auditList.querySelectorAll('.audit-check')];
  const selected = boxes.filter((box) => box.checked).length;
  els.btnAuditRewriteSelected.disabled = selected === 0;
  els.btnAuditRewriteSelected.textContent = selected ? `重新上报所选 (${selected})` : '重新上报所选';
  els.auditSelectAll.checked = boxes.length > 0 && selected === boxes.length;
  els.auditSelectAll.indeterminate = selected > 0 && selected < boxes.length;
}

function auditItemNode(index) {
  return els.auditList.querySelector(`.audit-item[data-index="${index}"]`);
}

function auditProjectOptions(selectedId) {
  const current = Number(selectedId);
  const options = ['<option value="">选择项目</option>'];
  prepareData.forEach((project) => {
    const selected = project.id === current ? ' selected' : '';
    options.push(`<option value="${project.id}"${selected}>${escapeHtml(project.project_name)}</option>`);
  });
  return options.join('');
}

function auditTaskOptions(projectId, selectedTaskId) {
  const project = prepareData.find((item) => item.id === Number(projectId));
  const current = Number(selectedTaskId);
  const options = ['<option value="">选择任务</option>'];
  ((project && project.tasks) || []).forEach((task) => {
    const selected = task.id === current ? ' selected' : '';
    options.push(`<option value="${task.id}"${selected}>${escapeHtml(task.name)}</option>`);
  });
  return options.join('');
}

function readRewriteForm(index) {
  const node = auditItemNode(index);
  const issue = auditIssues[index];
  if (!node || !issue || issue.expectedHours <= 0.05) {
    return { remarks: '', mode: 'none', pickedFile: null, pickTarget: false };
  }
  const projectEl = node.querySelector('.audit-project');
  const taskEl = node.querySelector('.audit-task');
  return {
    remarks: node.querySelector('.audit-remarks')?.value.trim() || '',
    mode: node.querySelector('.audit-file-mode')?.value || 'auto',
    pickedFile: issue.pickedFile || null,
    pickTarget: !!projectEl,
    projectId: projectEl ? parseInt(projectEl.value, 10) : null,
    taskId: taskEl ? parseInt(taskEl.value, 10) : null,
  };
}

function fileModeText(form) {
  if (form.mode === 'keep') return '沿用原附件';
  if (form.mode === 'pick') return form.pickedFile ? form.pickedFile.split(/[/\\]/).pop() : '未选择文件';
  if (form.mode === 'auto') return '自动生成附件';
  return '不重新提交';
}

async function runAudit() {
  if (!currentUser) return showToast('请先登录', 'error');
  const start = els.auditDateStart.value;
  const end = els.auditDateEnd.value;
  els.btnRunAudit.disabled = true;
  showLoading('核对加班、请假和申报记录...');
  try {
    const pageLimit = 200;
    const [declarations, leaves, overtimes, attendanceRes] = await Promise.all([
      fetchPaged(
        (page, limit) => window.pms.getDeclarationList({ page, limit, tag: 5, filters: {} }),
        ['totalCount', 'total'],
        { limit: pageLimit, stopAfter: (list) => pageOlderThan(list, start, (item) => item.date) }
      ),
      fetchPaged(
        (page, limit) => window.pms.getLeaveApplications({ page, limit, tag: 5 }),
        ['total', 'totalCount'],
        { limit: pageLimit }
      ),
      fetchPaged(
        (page, limit) => window.pms.getOvertimeApplications({
          page,
          limit,
          tag: 5,
          startDate: start,
          endDate: end,
        }),
        ['total', 'totalCount'],
        {
          limit: pageLimit,
          stopAfter: (list) => pageOlderThan(list, start, (item) => item.date || item.start_at),
        }
      ),
      window.pms.getAttendanceResults({
        userId: currentUser.id,
        startDate: start,
        endDate: end,
      }),
    ]);
    if (attendanceRes.code !== 200) {
      throw new Error(attendanceRes.msg || '考勤结果加载失败');
    }
    const attendance = Array.isArray(attendanceRes.data?.list)
      ? attendanceRes.data.list
      : (Array.isArray(attendanceRes.data) ? attendanceRes.data : []);
    const result = WorkhourAudit.buildAudit({
      start,
      end,
      standardHours: Number(els.inputHours.value) || 8,
      declarations,
      leaves,
      overtimes,
      attendance,
      classify: (date) => HolidayCalendar.classify(date),
    });
    hideLoading();
    if (!result.ok) {
      showToast(result.msg, 'error');
      return;
    }
    renderAuditIssues(result);
  } catch (err) {
    hideLoading();
    showToast('核对失败: ' + err.message, 'error');
  }
  els.btnRunAudit.disabled = false;
}

function projectTaskLabel(projectId, taskId) {
  const project = prepareData.find((item) => item.id === Number(projectId));
  const task = project && project.tasks
    ? project.tasks.find((item) => item.id === Number(taskId))
    : null;
  if (project && task) return `${project.project_name} / ${task.name}`;
  if (project) return project.project_name;
  if (projectId && taskId) return `项目 ${projectId} / 任务 ${taskId}`;
  return '';
}

function auditTargetLabel(records, form) {
  if (form && form.pickTarget) return projectTaskLabel(form.projectId, form.taskId);
  const source = records.find((rec) => rec.projectId && rec.taskId) || null;
  if (source) {
    const name = [source.projectName, source.taskName].filter(Boolean).join(' / ');
    return name || projectTaskLabel(source.projectId, source.taskId);
  }
  return projectTaskLabel(parseInt(els.selectProject.value, 10), parseInt(els.selectTask.value, 10));
}

function resolveRewriteTarget(records, form) {
  const source = records.find((rec) => rec.projectId && rec.taskId) || records[0] || {};
  let projectId = source.projectId || parseInt(els.selectProject.value, 10);
  let taskId = source.taskId || parseInt(els.selectTask.value, 10);
  if (form && form.pickTarget) {
    projectId = Number.isFinite(form.projectId) ? form.projectId : null;
    taskId = Number.isFinite(form.taskId) ? form.taskId : null;
  }
  return {
    projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : null,
    taskId: Number.isFinite(taskId) && taskId > 0 ? taskId : null,
    remarks: source.remarks || '',
    groupType: source.groupType || '',
    files: source.files || [],
  };
}

function attachmentUploadName(filePath, date) {
  const base = String(filePath).split(/[/\\]/).pop() || 'file.zip';
  const ext = (base.match(/\.[A-Za-z0-9]+$/) || ['.zip'])[0].toLowerCase();
  return `BackupFiles${String(date).replace(/-/g, '')}_attach${ext}`;
}

function validateRewrite(issue, form) {
  if (!issue || issue.action === 'display') return { ok: false, msg: '这条不能重新上报' };
  if (issue.expectedHours <= 0.05) return { ok: true, create: false };
  const target = resolveRewriteTarget(issue.records, form);
  if (!target.projectId || !target.taskId) {
    return { ok: false, msg: `${issue.date} 请选择项目和任务` };
  }
  if (form.mode === 'pick' && !form.pickedFile) {
    return { ok: false, msg: `${issue.date} 请选择附件` };
  }
  if (form.mode === 'keep' && !(target.files || []).length) {
    return { ok: false, msg: `${issue.date} 没有可沿用的原附件` };
  }
  if (form.mode === 'auto' && moduleList.length === 0) {
    return { ok: false, msg: `${issue.date} 无法自动生成附件，请先配置项目目录或改为选择文件` };
  }
  if (!form.remarks && form.mode !== 'auto') {
    return { ok: false, msg: `${issue.date} 请填写申报理由` };
  }
  return { ok: true, create: true, target };
}

function describeRewrite(issue, form, place) {
  const hoursText = WorkhourAudit.formatHours(issue.expectedHours);
  if (issue.expectedHours <= 0.05) {
    return `${issue.date}：撤回并删除，不再提交`;
  }
  const reason = form.remarks || '按附件自动生成';
  const verb = issue.action === 'create' ? '上报' : '撤回并删除后重新上报';
  return `${issue.date}：${verb} ${hoursText}h 到「${place}」，理由「${reason}」，${fileModeText(form)}`;
}

async function buildRewritePayload(issue, form, target, progress) {
  let remarks = form.remarks;
  let files = [];
  if (form.mode === 'keep') {
    files = target.files || [];
  } else if (form.mode === 'pick') {
    showLoading(`${progress} ${issue.date} 上传附件...`);
    const uploadRes = await window.pms.uploadFile(form.pickedFile, attachmentUploadName(form.pickedFile, issue.date));
    if (uploadRes.code !== 200 || !uploadRes.data) throw new Error(uploadRes.msg || '上传附件失败');
    files = [{
      file_name: uploadRes.data.file_name,
      file_id: uploadRes.data.file_id,
      file_url: uploadRes.data.file_url,
    }];
  } else {
    const selectedModule = els.selectModule.value;
    const moduleName = selectedModule || moduleList[Math.floor(Math.random() * moduleList.length)];
    showLoading(`${progress} ${issue.date} 生成附件...`);
    const zipName = HolidayCalendar.buildBackupFileName(issue.date);
    const zipRes = await window.pms.generateCodeZip({ moduleName, date: issue.date, zipName });
    if (!zipRes.success) throw new Error(zipRes.msg || '生成附件失败');
    const uploadRes = await window.pms.uploadFile(zipRes.zipPath, zipRes.zipName);
    if (uploadRes.code !== 200 || !uploadRes.data) throw new Error(uploadRes.msg || '上传附件失败');
    files = [{
      file_name: uploadRes.data.file_name,
      file_id: uploadRes.data.file_id,
      file_url: uploadRes.data.file_url,
    }];
    if (!remarks) {
      showLoading(`${progress} ${issue.date} 生成申报理由...`);
      const llmRes = await window.pms.generateRemarks({
        fileNames: zipRes.fileNames,
        moduleName: zipRes.moduleName,
      });
      remarks = llmRes.success
        ? llmRes.remarks
        : fallbackRemarks(moduleName, zipRes.fileNames);
    }
  }
  if (!remarks) throw new Error(`${issue.date} 缺少申报理由`);
  if (!files.length) throw new Error(`${issue.date} 缺少附件`);
  return {
    project_id: target.projectId,
    task_id: target.taskId,
    user_id_declaration: currentUser.id,
    executed_working_hours: WorkhourAudit.formatHours(issue.expectedHours),
    date: issue.date,
    remarks,
    group_type: target.groupType || '',
    file: files,
  };
}

async function applyAuditIssue(issue, form, progress) {
  const check = validateRewrite(issue, form);
  if (!check.ok) throw new Error(check.msg);
  for (const rec of issue.records) {
    if (rec.status !== 2) continue;
    if (!rec.id || !rec.approvalFlowId) {
      throw new Error(`${issue.date} 缺少申报编号或审批流，无法撤回`);
    }
    showLoading(`${progress} ${issue.date} 撤回...`);
    const res = await window.pms.cancelDeclaration({
      originId: rec.id,
      approvalFlowId: rec.approvalFlowId,
    });
    if (res.code !== 200) throw new Error(res.msg || '撤回失败');
  }
  for (const rec of issue.records) {
    if (rec.status === 5 || !rec.id) continue;
    showLoading(`${progress} ${issue.date} 删除...`);
    const res = await window.pms.deleteDeclaration({ ids: rec.id });
    if (res.code !== 200) throw new Error(res.msg || '删除失败');
  }
  if (!check.create) return;
  const payload = await buildRewritePayload(issue, form, check.target, progress);
  showLoading(`${progress} ${issue.date} 重新上报...`);
  const res = await window.pms.createDeclaration([payload]);
  if (res.code !== 200) throw new Error(res.msg || '重新上报失败');
}

async function rewriteAuditIssues(indexes) {
  const jobs = indexes
    .map((index) => ({ index, issue: auditIssues[index], form: readRewriteForm(index) }))
    .filter((job) => job.issue && job.issue.action !== 'display');
  if (!jobs.length) return showToast('请选择要重新上报的日期', 'error');
  if (!currentUser) return showToast('请先登录', 'error');
  for (const job of jobs) {
    const check = validateRewrite(job.issue, job.form);
    if (!check.ok) return showToast(check.msg, 'error');
    job.place = auditTargetLabel(job.issue.records, job.form);
  }
  const preview = jobs.map((job) => describeRewrite(job.issue, job.form, job.place)).join('\n');
  if (!confirm(`将处理 ${jobs.length} 天：\n${preview}`)) return;

  let done = 0;
  try {
    for (let i = 0; i < jobs.length; i++) {
      await applyAuditIssue(jobs[i].issue, jobs[i].form, `[${i + 1}/${jobs.length}]`);
      done += 1;
    }
    hideLoading();
    showToast(`已处理 ${done} 天`, 'success');
  } catch (err) {
    hideLoading();
    const prefix = done ? `已处理 ${done} 天，随后失败：` : '处理失败: ';
    showToast(prefix + err.message, 'error', 7000);
  }
  loadDeclarationList();
  refreshDateSummary();
  await runAudit();
}

// ========== Events ==========
els.btnLogin.addEventListener('click', doLogin);
els.inputPwd.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
els.btnLogout.addEventListener('click', async () => {
  await window.pms.saveConfig({ token: '' });
  currentUser = null;
  showLoginPanel();
  refreshDateSummary();
});
els.selectProject.addEventListener('change', onProjectChange);
els.dateStart.addEventListener('change', refreshDateSummary);
els.dateEnd.addEventListener('change', refreshDateSummary);
els.btnSubmit.addEventListener('click', submitDeclaration);
els.btnOpenAudit.addEventListener('click', openAudit);
els.btnCloseAudit.addEventListener('click', closeAudit);
els.btnRunAudit.addEventListener('click', runAudit);
els.auditSelectAll.addEventListener('change', () => {
  els.auditList.querySelectorAll('.audit-check').forEach((box) => {
    box.checked = els.auditSelectAll.checked;
  });
  updateAuditSelection();
});
els.btnAuditRewriteSelected.addEventListener('click', () => {
  const indexes = [...els.auditList.querySelectorAll('.audit-check:checked')]
    .map((box) => parseInt(box.dataset.index, 10));
  rewriteAuditIssues(indexes);
});
els.auditList.addEventListener('change', (e) => {
  if (e.target.classList.contains('audit-check')) updateAuditSelection();
  if (e.target.classList.contains('audit-project')) {
    const node = auditItemNode(e.target.dataset.index);
    const task = node && node.querySelector('.audit-task');
    if (task) task.innerHTML = auditTaskOptions(e.target.value);
    return;
  }
  if (e.target.classList.contains('audit-file-mode')) {
    const node = auditItemNode(e.target.dataset.index);
    const pick = node && node.querySelector('[data-act="pick-file"]');
    if (pick) pick.classList.toggle('hidden', e.target.value !== 'pick');
  }
});
els.auditList.addEventListener('click', async (e) => {
  const pick = e.target.closest('[data-act="pick-file"]');
  if (pick) {
    const index = parseInt(pick.dataset.index, 10);
    const filePath = await window.pms.selectFile();
    if (!filePath) return;
    auditIssues[index].pickedFile = filePath;
    const name = auditItemNode(index).querySelector('.audit-file-name');
    if (name) name.textContent = filePath.split(/[/\\]/).pop();
    return;
  }
  const btn = e.target.closest('button[data-act="rewrite"]');
  if (!btn) return;
  rewriteAuditIssues([parseInt(btn.dataset.index, 10)]);
});
els.auditModal.addEventListener('click', (e) => {
  if (e.target === els.auditModal) closeAudit();
});
els.btnRefreshPrepare.addEventListener('click', loadPrepareData);
els.btnRefreshList.addEventListener('click', loadDeclarationList);
els.btnScanModules.addEventListener('click', loadModules);
els.declarationList.addEventListener('click', onDeclarationListClick);
// 设置
els.btnSettings.addEventListener('click', openSettings);
els.btnCloseSettings.addEventListener('click', closeSettings);
els.btnSelectDir.addEventListener('click', selectProjectDir);
els.btnSaveSettings.addEventListener('click', saveSettings);
els.settingsModal.addEventListener('click', (e) => {
  if (e.target === els.settingsModal) closeSettings();
});

// 默认日期：本周一到今天（本地日历，避免 UTC 跨日）
function setDefaultDates() {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1);
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  els.dateStart.value = HolidayCalendar.formatISODate(monday);
  els.dateEnd.value = HolidayCalendar.formatISODate(todayLocal);
  refreshDateSummary();
}

// ========== Init ==========
setDefaultDates();
tryAutoLogin();
