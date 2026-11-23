const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.bio-cloud.com.cn:8101';
const FILE_URL = 'https://www.bio-cloud.com.cn:8022';

const COMMON_HEADERS = {
  'system-type': '4',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'origin': 'https://www.biolink.city',
  'referer': 'https://www.biolink.city/',
};

class BioCloudAPI {
  constructor() {
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  getHeaders(withAuth = true) {
    const headers = { ...COMMON_HEADERS };
    if (withAuth && this.token) {
      headers['authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(method, endpoint, body = null, withAuth = true) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(withAuth),
    };

    if (body && method !== 'GET') {
      options.headers['content-type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const data = await res.json();
    return data;
  }

  // 登录
  async login(account, pwd) {
    const data = await this.request('POST', '/api/user/login', { account, pwd }, false);
    if (data.code === 200 && data.data?.token) {
      this.token = data.data.token;
      return { success: true, token: data.data.token };
    }
    return { success: false, msg: data.msg || '登录失败' };
  }

  // 验证 token 是否有效
  async validateToken() {
    if (!this.token) return { success: false };
    try {
      const data = await this.request('GET', '/api/user/info');
      if (data.code === 200 && data.data?.info) {
        return { success: true, user: data.data.info };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }

  // 获取用户信息
  async getUserInfo() {
    return await this.request('GET', '/api/user/info');
  }

  // 获取申报列表
  async getDeclarationList(page = 1, limit = 10, tag = 5, filters = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      status: filters.status || '',
      worker_name: filters.worker_name || '',
      project_name: filters.project_name || '',
      task_name: filters.task_name || '',
      tag: String(tag),
    });
    return await this.request('GET', `/api/pms/projects/declaration_list?${params}`);
  }

  // 获取申报准备数据（可选项目/任务）
  async getDeclarationPrepareData() {
    return await this.request('GET', '/api/pms/declaration_prepare_data');
  }

  // 创建工时申报
  async createDeclaration(declarations) {
    // declarations: [{project_id, task_id, user_id_declaration, executed_working_hours, date, remarks, group_type, file:[]}]
    return await this.request('POST', '/api/pms/projects/create_declaration', declarations);
  }

  // 撤销申报（处于审批中的记录）
  async cancelDeclaration(originId, approvalFlowId) {
    return await this.request('POST', '/api/pms/projects/cancel_declaration', {
      origin_id: originId,
      approval_flow_id: approvalFlowId,
    });
  }

  // 删除申报
  async deleteDeclaration(ids) {
    // ids 可为单个id（数字）或多个id
    return await this.request('DELETE', '/api/pms/projects/create_declaration', { ids });
  }

  // 加班申请。tag=5 与页面「我的」列表一致。start_date/end_date 按加班日期过滤。
  async getOvertimeApplications(page = 1, limit = 50, tag = 5, range = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      tag: String(tag),
    });
    if (range.startDate) params.set('start_date', range.startDate);
    if (range.endDate) params.set('end_date', range.endDate);
    return await this.request('GET', `/api/hr/overtime_application?${params}`);
  }

  // 请假申请。duration_unit=1 为小时，2 为天。
  async getLeaveApplications(page = 1, limit = 50, tag = 5) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      tag: String(tag),
    });
    return await this.request('GET', `/api/hr/leave_application?${params}`);
  }

  // 按人按日的考勤结果，请假分钟在 leave_minutes。
  async getAttendanceResults(userId, startDate, endDate) {
    const params = new URLSearchParams({
      user_id: String(userId),
      start_date: startDate,
      end_date: endDate,
    });
    return await this.request('GET', `/api/hr/attendance-results/by-user-date?${params}`);
  }

  // 上传文件
  async uploadFile(filePath, uploadName) {
    const url = `${BASE_URL}/api/file/add_file`;
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = uploadName || path.basename(filePath);

    // 手动构建 multipart/form-data，格式与浏览器完全一致
    // 必须包含 content_type=5 字段，服务器据此判断允许的文件后缀类别
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2, 18);
    const CRLF = '\r\n';

    const preamble = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="content_type"${CRLF}` +
      CRLF +
      `5${CRLF}` +
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
      `Content-Type: application/x-zip-compressed${CRLF}` +
      CRLF,
      'utf-8'
    );
    const postamble = Buffer.from(
      CRLF + `--${boundary}--` + CRLF,
      'utf-8'
    );
    const body = Buffer.concat([preamble, fileBuffer, postamble]);

    const headers = {
      'system-type': '4',
      'user-agent': COMMON_HEADERS['user-agent'],
      'accept': '*/*',
      'origin': COMMON_HEADERS['origin'],
      'referer': COMMON_HEADERS['referer'],
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
      ...(this.token ? { 'authorization': `Bearer ${this.token}` } : {}),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { code: -1, msg: `服务器返回非JSON (HTTP ${res.status}): ${text.slice(0, 200)}` };
    }
  }
}

module.exports = BioCloudAPI;
