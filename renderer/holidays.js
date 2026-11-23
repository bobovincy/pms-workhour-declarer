// 国务院办公厅放假安排。isOffDay=1 为法定节假日或调休休息，0 为调休上班。
// 2024 https://www.gov.cn/zhengce/zhengceku/202310/content_6911528.htm
// 2025 https://www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm
// 2026 https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HolidayCalendar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RAW = [
    ['2024-01-01', '元旦', 1],
    ['2024-02-04', '春节', 0],
    ['2024-02-10', '春节', 1],
    ['2024-02-11', '春节', 1],
    ['2024-02-12', '春节', 1],
    ['2024-02-13', '春节', 1],
    ['2024-02-14', '春节', 1],
    ['2024-02-15', '春节', 1],
    ['2024-02-16', '春节', 1],
    ['2024-02-17', '春节', 1],
    ['2024-02-18', '春节', 0],
    ['2024-04-04', '清明节', 1],
    ['2024-04-05', '清明节', 1],
    ['2024-04-06', '清明节', 1],
    ['2024-04-07', '清明节', 0],
    ['2024-04-28', '劳动节', 0],
    ['2024-05-01', '劳动节', 1],
    ['2024-05-02', '劳动节', 1],
    ['2024-05-03', '劳动节', 1],
    ['2024-05-04', '劳动节', 1],
    ['2024-05-05', '劳动节', 1],
    ['2024-05-11', '劳动节', 0],
    ['2024-06-10', '端午节', 1],
    ['2024-09-14', '中秋节', 0],
    ['2024-09-15', '中秋节', 1],
    ['2024-09-16', '中秋节', 1],
    ['2024-09-17', '中秋节', 1],
    ['2024-09-29', '国庆节', 0],
    ['2024-10-01', '国庆节', 1],
    ['2024-10-02', '国庆节', 1],
    ['2024-10-03', '国庆节', 1],
    ['2024-10-04', '国庆节', 1],
    ['2024-10-05', '国庆节', 1],
    ['2024-10-06', '国庆节', 1],
    ['2024-10-07', '国庆节', 1],
    ['2024-10-12', '国庆节', 0],
    ['2025-01-01', '元旦', 1],
    ['2025-01-26', '春节', 0],
    ['2025-01-28', '春节', 1],
    ['2025-01-29', '春节', 1],
    ['2025-01-30', '春节', 1],
    ['2025-01-31', '春节', 1],
    ['2025-02-01', '春节', 1],
    ['2025-02-02', '春节', 1],
    ['2025-02-03', '春节', 1],
    ['2025-02-04', '春节', 1],
    ['2025-02-08', '春节', 0],
    ['2025-04-04', '清明节', 1],
    ['2025-04-05', '清明节', 1],
    ['2025-04-06', '清明节', 1],
    ['2025-04-27', '劳动节', 0],
    ['2025-05-01', '劳动节', 1],
    ['2025-05-02', '劳动节', 1],
    ['2025-05-03', '劳动节', 1],
    ['2025-05-04', '劳动节', 1],
    ['2025-05-05', '劳动节', 1],
    ['2025-05-31', '端午节', 1],
    ['2025-06-01', '端午节', 1],
    ['2025-06-02', '端午节', 1],
    ['2025-09-28', '国庆中秋', 0],
    ['2025-10-01', '国庆中秋', 1],
    ['2025-10-02', '国庆中秋', 1],
    ['2025-10-03', '国庆中秋', 1],
    ['2025-10-04', '国庆中秋', 1],
    ['2025-10-05', '国庆中秋', 1],
    ['2025-10-06', '国庆中秋', 1],
    ['2025-10-07', '国庆中秋', 1],
    ['2025-10-08', '国庆中秋', 1],
    ['2025-10-11', '国庆中秋', 0],
    ['2026-01-01', '元旦', 1],
    ['2026-01-02', '元旦', 1],
    ['2026-01-03', '元旦', 1],
    ['2026-01-04', '元旦', 0],
    ['2026-02-14', '春节', 0],
    ['2026-02-15', '春节', 1],
    ['2026-02-16', '春节', 1],
    ['2026-02-17', '春节', 1],
    ['2026-02-18', '春节', 1],
    ['2026-02-19', '春节', 1],
    ['2026-02-20', '春节', 1],
    ['2026-02-21', '春节', 1],
    ['2026-02-22', '春节', 1],
    ['2026-02-23', '春节', 1],
    ['2026-02-28', '春节', 0],
    ['2026-04-04', '清明节', 1],
    ['2026-04-05', '清明节', 1],
    ['2026-04-06', '清明节', 1],
    ['2026-05-01', '劳动节', 1],
    ['2026-05-02', '劳动节', 1],
    ['2026-05-03', '劳动节', 1],
    ['2026-05-04', '劳动节', 1],
    ['2026-05-05', '劳动节', 1],
    ['2026-05-09', '劳动节', 0],
    ['2026-06-19', '端午节', 1],
    ['2026-06-20', '端午节', 1],
    ['2026-06-21', '端午节', 1],
    ['2026-09-20', '国庆节', 0],
    ['2026-09-25', '中秋节', 1],
    ['2026-09-26', '中秋节', 1],
    ['2026-09-27', '中秋节', 1],
    ['2026-10-01', '国庆节', 1],
    ['2026-10-02', '国庆节', 1],
    ['2026-10-03', '国庆节', 1],
    ['2026-10-04', '国庆节', 1],
    ['2026-10-05', '国庆节', 1],
    ['2026-10-06', '国庆节', 1],
    ['2026-10-07', '国庆节', 1],
    ['2026-10-10', '国庆节', 0],
  ];

  const DAY_MAP = Object.create(null);
  const COVERED_YEARS = new Set();
  RAW.forEach(([date, name, off]) => {
    DAY_MAP[date] = { name, isOffDay: off === 1 };
    COVERED_YEARS.add(date.slice(0, 4));
  });

  function parseISODate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function formatISODate(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(dt, n) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  }

  // 工作日保留；周末、法定节假日、调休休息日跳过；调休上班日保留。
  function analyze(startStr, endStr) {
    const start = parseISODate(startStr);
    const end = parseISODate(endStr);
    if (!start || !end || start > end) {
      return { ok: false, workdays: [], skipped: [], makeup: [], missingYears: [] };
    }

    const workdays = [];
    const skipped = [];
    const makeup = [];
    const missingYears = new Set();

    for (let cur = start; cur <= end; cur = addDays(cur, 1)) {
      const key = formatISODate(cur);
      const year = key.slice(0, 4);
      if (!COVERED_YEARS.has(year)) missingYears.add(year);

      const rec = DAY_MAP[key];
      if (rec && !rec.isOffDay) {
        workdays.push(key);
        makeup.push({ date: key, name: rec.name });
        continue;
      }
      if (rec && rec.isOffDay) {
        skipped.push({ date: key, reason: rec.name });
        continue;
      }
      const dow = cur.getDay();
      if (dow === 0 || dow === 6) {
        skipped.push({ date: key, reason: '周末' });
        continue;
      }
      workdays.push(key);
    }

    return {
      ok: true,
      workdays,
      skipped,
      makeup,
      missingYears: Array.from(missingYears),
    };
  }

  function describe(result) {
    if (!result || !result.ok) {
      return '选择日期后，将自动跳过周末、法定节假日和调休休息日';
    }
    const seen = Object.create(null);
    const groups = [];
    let weekend = 0;
    let reported = 0;
    result.skipped.forEach((item) => {
      if (item.reason === '已报过') {
        reported += 1;
        return;
      }
      if (item.reason === '周末') {
        weekend += 1;
        return;
      }
      if (!seen[item.reason]) {
        seen[item.reason] = 0;
        groups.push(item.reason);
      }
      seen[item.reason] += 1;
    });
    const skipParts = groups.map((name) => `${name} ${seen[name]} 天`);
    if (weekend) skipParts.push(`周末 ${weekend} 天`);

    let text = `将申报 ${result.workdays.length} 个工作日`;
    if (skipParts.length) text += `，已跳过 ${skipParts.join('、')}`;
    if (reported) text += `；已报过 ${reported} 天不再提交`;
    if (result.makeup.length) {
      const list = result.makeup.map((m) => `${m.date.slice(5)}（${m.name}）`).join('、');
      text += `；调休上班 ${list}会计入`;
    }
    if (result.missingYears.length) {
      text += `；${result.missingYears.join('、')} 年放假安排尚未公布，该年只跳过周末`;
    }
    return text;
  }

  // BackupFiles + YYYYMMDD + 16:00:00–16:59:59
  function buildBackupFileName(dateStr, randomFn) {
    const rand = typeof randomFn === 'function' ? randomFn : Math.random;
    const ymd = String(dateStr || '').replace(/-/g, '');
    // ZIP 的 DOS 时间只保留偶数秒，文件名与包内修改时间用同一时刻
    const offset = Math.min(3598, Math.floor(rand() * 3600) & ~1);
    const mm = String(Math.floor(offset / 60)).padStart(2, '0');
    const ss = String(offset % 60).padStart(2, '0');
    return `BackupFiles${ymd}_16${mm}${ss}.zip`;
  }

  // 从工作日里去掉已经报过的日期，并记入 skipped。
  function excludeWorkdays(result, dates, reason) {
    if (!result || !result.ok) return result;
    const block = new Set(dates || []);
    const workdays = [];
    const skipped = result.skipped.slice();
    const excluded = [];
    result.workdays.forEach((date) => {
      if (block.has(date)) {
        skipped.push({ date, reason: reason || '已报过' });
        excluded.push(date);
      } else {
        workdays.push(date);
      }
    });
    return Object.assign({}, result, { workdays, skipped, excluded });
  }

  // workday 普通工作日；makeup 调休上班；weekend 周末；off 法定节假日或调休休息。
  function classify(dateStr) {
    const dt = parseISODate(dateStr);
    if (!dt) return { kind: 'invalid', name: '' };
    const rec = DAY_MAP[dateStr];
    if (rec && !rec.isOffDay) return { kind: 'makeup', name: rec.name };
    if (rec && rec.isOffDay) return { kind: 'off', name: rec.name };
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) return { kind: 'weekend', name: '周末' };
    return { kind: 'workday', name: '' };
  }

  return { analyze, describe, classify, formatISODate, parseISODate, buildBackupFileName, excludeWorkdays, COVERED_YEARS };
});
