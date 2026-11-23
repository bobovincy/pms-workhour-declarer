// 核对工时申报：工作日应申报 = 标准工时 − 请假 + 加班；休息日/法定节假日只应申报加班时长。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WorkhourAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // 考勤单据：1 暂存，2 审核中，3 已拒绝，5 已通过。只把审核中和已通过算进时长。
  const HR_COUNTED = { 2: '审核中', 5: '已通过' };
  const DECL_STATUS = { 1: '草稿', 2: '审批中', 3: '已拒绝', 4: '已驳回', 5: '已通过' };

  function round1(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 10) / 10;
  }

  function sameHours(a, b) {
    return Math.abs(round1(a) - round1(b)) < 0.05;
  }

  function formatHours(n) {
    const v = round1(n);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  // 申报接口不接受小数。9.5 小时只申报 9，不足 1 小时记为 0。
  function declareHours(n) {
    const v = round1(n);
    if (v <= 0) return 0;
    return Math.floor(v);
  }

  function dateKey(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }

  function addDays(iso, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return '';
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n);
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  function eachDate(start, end) {
    const dates = [];
    if (!dateKey(start) || !dateKey(end) || start > end) return dates;
    for (let cur = start, guard = 0; cur <= end && guard < 400; cur = addDays(cur, 1), guard += 1) {
      dates.push(cur);
    }
    return dates;
  }

  function kindLabel(day) {
    if (day.kind === 'makeup') return `调休上班（${day.name}）`;
    if (day.kind === 'off') return `法定节假日/调休休息（${day.name}）`;
    if (day.kind === 'weekend') return '休息日（周末）';
    return '工作日';
  }

  function isWorkBase(kind) {
    return kind === 'workday' || kind === 'makeup';
  }

  function quantityHours(item, standardHours, preferDisplay) {
    const unit = Number(item.duration_unit || 1);
    let qty = preferDisplay ? Number(item.display_quantity) : NaN;
    if (!Number.isFinite(qty)) qty = Number(item.duration_quantity);
    if (!Number.isFinite(qty)) qty = 0;
    return unit === 2 ? qty * standardHours : qty;
  }

  function hrStatusText(status) {
    return HR_COUNTED[Number(status)] || '';
  }

  // 把一条请假摊到覆盖的每一天。按天请的假按标准工时换算，按小时请的假直接用小时。
  function spreadLeave(item, standardHours) {
    const start = dateKey(item.start_at);
    const end = dateKey(item.end_at || item.start_at);
    const days = eachDate(start, end);
    if (!days.length) return [];
    const total = quantityHours(item, standardHours, false);
    const per = total / days.length;
    const label = item.leave_type_config_name || item.leave_type_name || '请假';
    const unit = Number(item.duration_unit || 1);
    const qty = item.duration_quantity;
    const span = unit === 2 ? `${qty}天` : `${qty}小时`;
    return days.map((date) => ({
      date,
      hours: per,
      text: `${label} ${span}（${hrStatusText(item.status)}）`,
    }));
  }

  function declStatusText(status) {
    return DECL_STATUS[Number(status)] || `状态${status}`;
  }

  function pickNumber(item, keys) {
    for (const key of keys) {
      const n = Number(item && item[key]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  function normalizeRecord(item) {
    const status = Number(item.status);
    let files = item.file || item.files || [];
    if (typeof files === 'string') {
      try { files = JSON.parse(files); } catch { files = []; }
    }
    if (!Array.isArray(files)) files = [];
    return {
      id: pickNumber(item, ['id', 'origin_id']),
      status,
      statusText: declStatusText(status),
      hours: round1(item.executed_working_hours),
      approvalFlowId: pickNumber(item, ['approval_flow_id', 'approvalFlowId']),
      projectId: pickNumber(item, ['project_id', 'projectId']),
      taskId: pickNumber(item, ['task_id', 'taskId']),
      projectName: item.project_name || '',
      taskName: item.task_name || '',
      remarks: item.remarks || '',
      groupType: item.group_type || '',
      files: files.filter((f) => f && f.file_id).map((f) => ({
        file_name: f.file_name,
        file_id: f.file_id,
        file_url: f.file_url,
      })),
    };
  }

  function buildAudit(input) {
    const start = dateKey(input.start);
    const end = dateKey(input.end);
    const dates = eachDate(start, end);
    const standardHours = round1(input.standardHours > 0 ? input.standardHours : 8);
    const classify = input.classify;
    if (!dates.length || typeof classify !== 'function') {
      return { ok: false, msg: '请选择有效的日期范围' };
    }
    if (dates.length > 150) {
      return { ok: false, msg: '一次最多核对 150 天' };
    }

    const leaveByDate = Object.create(null);
    const otByDate = Object.create(null);
    const attLeaveByDate = Object.create(null);
    (input.leaves || []).forEach((item) => {
      if (!hrStatusText(item.status)) return;
      spreadLeave(item, standardHours).forEach((part) => {
        if (part.date < start || part.date > end) return;
        if (!leaveByDate[part.date]) leaveByDate[part.date] = [];
        leaveByDate[part.date].push(part);
      });
    });
    (input.overtimes || []).forEach((item) => {
      const statusText = hrStatusText(item.status);
      if (!statusText) return;
      const date = dateKey(item.date || item.start_at);
      if (!date || date < start || date > end) return;
      const hours = quantityHours(item, standardHours, true);
      if (!otByDate[date]) otByDate[date] = [];
      const shown = item.display_quantity != null && item.display_quantity !== ''
        ? item.display_quantity
        : item.duration_quantity;
      otByDate[date].push({
        hours,
        text: `${shown}${Number(item.duration_unit) === 2 ? '天' : '小时'}（${statusText}）`,
      });
    });
    (input.attendance || []).forEach((item) => {
      const date = dateKey(item.work_date);
      if (!date) return;
      const minutes = Number(item.leave_minutes);
      if (Number.isFinite(minutes) && minutes > 0) attLeaveByDate[date] = minutes / 60;
    });

    const declByDate = Object.create(null);
    (input.declarations || []).forEach((item) => {
      const date = dateKey(item.date);
      if (!date || date < start || date > end) return;
      if (!declByDate[date]) declByDate[date] = [];
      declByDate[date].push(normalizeRecord(item));
    });

    const issues = [];
    dates.forEach((date) => {
      const day = classify(date);
      const leaveParts = leaveByDate[date] || [];
      let leaveHours = leaveParts.reduce((sum, part) => sum + part.hours, 0);
      let leaveNote = leaveParts.map((part) => part.text).join('、');
      const attLeave = attLeaveByDate[date] || 0;
      if (leaveHours <= 0 && attLeave > 0) {
        leaveHours = attLeave;
        leaveNote = `考勤请假 ${formatHours(attLeave)}h（没有计入审核中或已通过的请假单）`;
      } else if (leaveHours > 0 && attLeave > 0 && !sameHours(leaveHours, attLeave)) {
        leaveNote += `；考勤请假分钟折合 ${formatHours(attLeave)}h`;
      }
      const otParts = otByDate[date] || [];
      const otHours = otParts.reduce((sum, part) => sum + part.hours, 0);
      const base = isWorkBase(day.kind) ? standardHours : 0;
      const expected = declareHours(Math.max(0, base - leaveHours) + otHours);
      const records = declByDate[date] || [];
      // 已拒绝、已驳回不计入当前申报时长。已通过(5) 和审批中、草稿要计入。
      const live = records.filter((rec) => [1, 2, 5].includes(rec.status));
      const declared = round1(live.reduce((sum, rec) => sum + rec.hours, 0));
      if (sameHours(declared, expected)) return;

      const approved = records.filter((rec) => rec.status === 5);
      const pending = records.filter((rec) => rec.status === 2);
      const removable = records.filter((rec) => rec.status !== 5);
      const tags = [];
      const restDay = day.kind === 'weekend' || day.kind === 'off';
      if (restDay && declared > 0.05 && expected < 0.05) tags.push('误报');
      else if (declared < 0.05 && expected > 0.05) tags.push('未申报');
      else tags.push('时长不符');

      let action = 'display';
      let actionLabel = '';
      let lockReason = '';
      if (approved.length) {
        lockReason = '含已通过的申报，不能撤回';
      } else if (!records.length) {
        action = 'create';
        actionLabel = '上报';
      } else if (removable.length) {
        action = 'rewrite';
        actionLabel = expected > 0.05 ? '重新上报' : '撤回并删除';
        if (!pending.length && removable.every((rec) => rec.status !== 2)) {
          actionLabel = expected > 0.05 ? '删除并重新上报' : '删除';
        }
      }

      const recordText = records.length
        ? records.map((rec) => `${formatHours(rec.hours)}h ${rec.statusText}${rec.projectName ? ' ' + rec.projectName : ''}`).join('；')
        : '无申报';
      const detail = [
        kindLabel(day),
        `标准 ${formatHours(base)}h`,
        `请假 ${formatHours(leaveHours)}h${leaveNote ? '（' + leaveNote + '）' : ''}`,
        `加班 ${formatHours(otHours)}h${otParts.length ? '（' + otParts.map((part) => part.text).join('、') + '）' : ''}`,
        `应申报 ${formatHours(expected)}h`,
        `当前 ${formatHours(declared)}h`,
        recordText,
      ].join('，');

      issues.push({
        date,
        kind: day.kind,
        kindLabel: kindLabel(day),
        tags,
        baseHours: round1(base),
        leaveHours: round1(leaveHours),
        overtimeHours: round1(otHours),
        expectedHours: expected,
        declaredHours: declared,
        detail,
        action,
        actionLabel,
        lockReason,
        records,
      });
    });

    return {
      ok: true,
      start,
      end,
      dayCount: dates.length,
      standardHours,
      issues,
    };
  }

  return {
    buildAudit,
    formatHours,
    declareHours,
    round1,
    eachDate,
    HR_COUNTED,
    DECL_STATUS,
  };
});
