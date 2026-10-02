/* ハンズオンラボ：純粋な判定ロジック（SAA.labs.eval）と各ウィジェット（SAA.labs.widgets）。
   オーバーレイ・ラボ一覧画面は lab.js が担当する。 */
(function () {
  'use strict';

  const U = SAA.util;
  const el = U.el;

  // ======================================================================
  // 0. 小物
  // ======================================================================
  function sfx(id) {
    try { if (SAA.audio && SAA.audio.playSfx) SAA.audio.playSfx(id); } catch (e) { /* noop */ }
  }
  function deferred() {
    let resolve = null;
    const promise = new Promise(function (r) { resolve = r; });
    return { promise: promise, resolve: resolve };
  }
  function num(v, def) {
    if (v === null || v === undefined || v === '') return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  // 全角数字・カンマ・空白を取り除いて数値化する（calc の入力用）
  function parseNumber(v) {
    if (typeof v === 'number') return v;
    const s = String(v === null || v === undefined ? '' : v)
      .replace(/[０-９．－]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[,\s，]/g, '');
    if (s === '') return NaN;
    return Number(s);
  }
  function hm(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function parseHM(s) {
    const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(s || ''));
    if (!m) return NaN;
    const h = +m[1]; const mi = +m[2];
    if (h > 23 || mi > 59) return NaN;
    return h * 60 + mi;
  }
  function fmtUsd(v, digits) {
    const d = digits === undefined ? (Math.abs(v) >= 1000 ? 0 : 2) : digits;
    return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtNum(v) { return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 1 }); }

  // ======================================================================
  // 1. 純粋な判定ロジック（DOM なし）
  // ======================================================================
  const E = {};

  // ---- terminal ----
  function normalizeCmd(s) {
    return String(s === null || s === undefined ? '' : s).trim().replace(/\s+/g, ' ').replace(/\s*;$/, '').trim();
  }
  function has(hay, needle) {
    return hay.indexOf(normalizeCmd(needle).toLowerCase()) >= 0;
  }
  E.normalizeCmd = normalizeCmd;
  E.terminal = function (task, cmd) {
    const m = (task && task.match) || {};
    const c = normalizeCmd(cmd).toLowerCase();
    if (!c) return false;
    const all = m.all || [];
    const any = m.any || [];
    const none = m.none || [];
    if (!all.length && !any.length) return false;
    for (let i = 0; i < all.length; i++) if (!has(c, all[i])) return false;
    for (let i = 0; i < any.length; i++) {
      const group = Array.isArray(any[i]) ? any[i] : [any[i]];
      if (group.length && !group.some(function (s) { return has(c, s); })) return false;
    }
    for (let i = 0; i < none.length; i++) if (has(c, none[i])) return false;
    return true;
  };

  // ---- slots ----
  E.slots = function (step, assignment) {
    const perSlot = {};
    let ok = true;
    (step.slots || []).forEach(function (s) {
      const v = assignment ? assignment[s.id] : undefined;
      const good = v !== undefined && v !== null && (s.answer || []).indexOf(v) >= 0;
      perSlot[s.id] = good;
      if (!good) ok = false;
    });
    return { ok: ok, perSlot: perSlot };
  };

  // ---- calc ----
  E.calc = function (field, value) {
    const v = parseNumber(value);
    if (!Number.isFinite(v)) return false;
    const tol = Math.abs(num(field.tolerance, 0));
    return Math.abs(v - Number(field.answer)) <= tol + 1e-9;
  };

  // ---- order ----（arrangement は項目文字列の配列、または元インデックスの配列）
  E.order = function (items, arrangement) {
    if (!Array.isArray(items) || !Array.isArray(arrangement) || items.length !== arrangement.length) return false;
    for (let i = 0; i < items.length; i++) {
      const a = arrangement[i];
      if (typeof a === 'number') { if (items[a] !== items[i]) return false; }
      else if (a !== items[i]) return false;
    }
    return true;
  };

  // ---- match ----
  E.match = function (step, mapping) {
    const perItem = {};
    let ok = true;
    (step.left || []).forEach(function (l) {
      const good = !!mapping && mapping[l.id] !== undefined && mapping[l.id] === (step.answer || {})[l.id];
      perItem[l.id] = good;
      if (!good) ok = false;
    });
    return { ok: ok, perItem: perItem };
  };

  // ---- verdict ----
  E.verdict = function (step, answers) {
    const perCase = {};
    let ok = true;
    (step.cases || []).forEach(function (c) {
      const good = !!answers && answers[c.id] !== undefined && answers[c.id] === c.answer;
      perCase[c.id] = good;
      if (!good) ok = false;
    });
    return { ok: ok, perCase: perCase };
  };

  // ---- choice ----
  E.choice = function (step, selected) {
    const a = (step.answer || []).slice().sort(function (x, y) { return x - y; });
    const s = (selected || []).slice().sort(function (x, y) { return x - y; });
    return a.length > 0 && a.length === s.length && a.every(function (v, i) { return v === s[i]; });
  };

  // ---- sim: asg ----
  function lerpPts(pts, m) {
    if (m <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (m <= pts[i][0]) {
        const a = pts[i - 1]; const b = pts[i];
        return a[1] + (b[1] - a[1]) * (m - a[0]) / Math.max(1, b[0] - a[0]);
      }
    }
    return pts[pts.length - 1][1];
  }
  const PROFILE_PTS = {
    // 夜間120 → 08:45–09:15 で900へ急増 → 昼600 → 午後800 → 18:00–20:00 で120へ
    office: [[0, 120], [525, 120], [555, 900], [715, 900], [725, 600], [775, 600], [785, 800], [1080, 800], [1200, 120], [1440, 120]],
    // 200 を基準に 10:10 / 14:40 / 21:20 から20分間 1,000 へ急騰
    spiky: [[0, 200], [609, 200], [610, 1000], [630, 1000], [631, 200], [879, 200], [880, 1000], [900, 1000], [901, 200],
      [1279, 200], [1280, 1000], [1300, 1000], [1301, 200], [1440, 200]],
    // ほぼ50、01:00–03:00 だけ 1,200
    batch: [[0, 50], [59, 50], [60, 1200], [180, 1200], [181, 50], [1440, 50]]
  };
  const PROFILE_LABEL = {
    office: 'オフィスアワー型（朝に急増・昼に谷・夜に減少）',
    spiky: 'スパイク型（突発的な20分間の急騰が3回）',
    steady: '定常型（ほぼ一定）',
    batch: '夜間バッチ型（01:00–03:00 に集中）'
  };
  E.asgDemand = function (profile) {
    const out = new Array(1440);
    for (let m = 0; m < 1440; m++) {
      let v;
      if (profile === 'steady') v = 400 * (1 + 0.1 * Math.sin(2 * Math.PI * m / 480));
      else v = lerpPts(PROFILE_PTS[profile] || PROFILE_PTS.office, m);
      out[m] = Math.round(v * 10) / 10;
    }
    return out;
  };

  E.asgSimulate = function (params, config, goal) {
    const p = params || {};
    const c = config || {};
    const start = p.start || {};
    const g = goal || p.goal || null;
    const cap = Math.max(1, num(p.capacityPerInstance, 100));
    const hourly = Math.max(0, num(p.hourlyCost, 0.1));
    const warm = Math.max(0, Math.round(num(p.warmupMin, 5)));
    const policy = c.policy || 'fixed';
    const max = Math.max(0, Math.round(num(c.max, num(start.max, 10))));
    const baseMin = U.clamp(Math.round(num(c.min, num(start.min, 1))), 0, max);
    const util = U.clamp(num(c.targetUtil, 60), 5, 100);
    const tracking = policy === 'target' || policy === 'predictive';
    const predictive = policy === 'predictive' || (policy === 'target' && !!c.predictive);
    const steps = Array.isArray(c.steps) ? c.steps : [];
    const sched = (policy === 'fixed' ? [] : (c.schedule || []))
      .map(function (s) { return { at: parseHM(s.at), min: Math.round(num(s.min, NaN)) }; })
      .filter(function (s) { return Number.isFinite(s.at) && Number.isFinite(s.min); })
      .sort(function (a, b) { return a.at - b.at; });
    const demand = E.asgDemand(p.profile || 'office');

    // 予測スケーリング用：今後60分の最大需要
    const lookMax = function (m) {
      let mx = demand[m];
      for (let k = 1; k <= 60; k++) mx = Math.max(mx, demand[(m + k) % 1440]);
      return mx;
    };
    const wantFor = function (d, lo) {
      return U.clamp(Math.ceil(d / (cap * util / 100) - 1e-9), lo, max);
    };

    let curMin = baseMin;
    let desired;
    if (policy === 'fixed') desired = Math.max(0, Math.round(num(c.desired, num(start.desired, baseMin))));
    else if (policy === 'scheduled') desired = baseMin;
    else if (policy === 'step') desired = U.clamp(Math.round(num(c.desired, num(start.desired, baseMin))), baseMin, max);
    else desired = wantFor(predictive ? lookMax(0) : demand[0], curMin);

    let inService = desired;
    let pending = [];
    const hist = [];
    const series = { demand: demand, capacity: [], inService: [], running: [], desired: [], overload: [] };
    let overloadMin = 0; let served = 0; let capSum = 0; let peak = 0; let instMin = 0;

    for (let m = 0; m < 1440; m++) {
      // 起動完了
      if (pending.length) {
        pending = pending.filter(function (readyAt) {
          if (readyAt <= m) { inService += 1; return false; }
          return true;
        });
      }
      // スケジュールされたアクション
      for (let i = 0; i < sched.length; i++) {
        if (sched[i].at !== m) continue;
        curMin = U.clamp(sched[i].min, 0, max);
        desired = policy === 'scheduled' ? curMin : Math.max(desired, curMin);
      }
      const d = demand[m];
      if (tracking) {
        // スケールアウトは即時、スケールインは「低い希望台数が15分続いたら」
        hist.push(wantFor(predictive ? lookMax(m) : d, curMin));
        if (hist.length > 15) hist.shift();
        desired = Math.max(curMin, Math.max.apply(null, hist));
      } else if (policy === 'step' && m % 5 === 0) {
        const capNow = inService * cap;
        const u = capNow > 0 ? d / capNow * 100 : (d > 0 ? Infinity : 0);
        for (let i = 0; i < steps.length; i++) {
          const r = steps[i] || {};
          if (r.above !== undefined && r.above !== null && u > Number(r.above)) {
            // ウォームアップ中は重ねてスケールアウトしない
            if (!pending.length) desired = U.clamp(desired + Math.max(1, Math.round(num(r.add, 1))), curMin, max);
            break;
          }
          if (r.below !== undefined && r.below !== null && u < Number(r.below)) {
            desired = U.clamp(desired - Math.max(1, Math.round(num(r.remove, 1))), curMin, max);
            break;
          }
        }
      }
      // 希望台数に合わせる
      let running = inService + pending.length;
      if (desired > running) {
        const add = desired - running;
        if (warm === 0) inService += add;
        else for (let k = 0; k < add; k++) pending.push(m + warm);
      } else if (desired < running) {
        let remove = running - desired;
        while (remove > 0 && pending.length) { pending.pop(); remove -= 1; }
        inService = Math.max(0, inService - remove);
      }
      running = inService + pending.length;
      const capacity = inService * cap;
      const over = d > capacity + 1e-9;
      if (over) overloadMin += 1;
      served += Math.min(d, capacity);
      capSum += capacity;
      instMin += running;
      if (running > peak) peak = running;
      series.capacity.push(capacity);
      series.inService.push(inService);
      series.running.push(running);
      series.desired.push(desired);
      series.overload.push(over);
    }

    const dailyCost = Math.round(instMin * hourly / 60 * 100) / 100;
    const avgUtil = capSum > 0 ? Math.round(served / capSum * 1000) / 10 : 0;
    const overloadOk = g ? overloadMin <= num(g.maxOverloadMin, 0) : null;
    const costOk = g ? dailyCost <= num(g.maxDailyCost, Infinity) + 1e-9 : null;
    return {
      series: series, overloadMin: overloadMin, avgUtil: avgUtil, peakInstances: peak, dailyCost: dailyCost,
      overloadOk: overloadOk, costOk: costOk, pass: g ? !!(overloadOk && costOk) : null
    };
  };

  // ---- sim: s3cost ----
  const S3_ORDER = ['STANDARD', 'STANDARD_IA', 'INTELLIGENT_TIERING', 'ONEZONE_IA', 'GLACIER_IR', 'GLACIER', 'DEEP_ARCHIVE'];
  const S3_LABEL = {
    STANDARD: 'S3 Standard', STANDARD_IA: 'S3 Standard-IA', INTELLIGENT_TIERING: 'S3 Intelligent-Tiering',
    ONEZONE_IA: 'S3 One Zone-IA', GLACIER_IR: 'S3 Glacier Instant Retrieval',
    GLACIER: 'S3 Glacier Flexible Retrieval', DEEP_ARCHIVE: 'S3 Glacier Deep Archive'
  };
  const S3_PRICES = { STANDARD: 0.025, INTELLIGENT_TIERING: 0.025, STANDARD_IA: 0.0138, ONEZONE_IA: 0.011, GLACIER_IR: 0.005, GLACIER: 0.0045, DEEP_ARCHIVE: 0.002 };
  const S3_REQ = { STANDARD_IA: 0.01, ONEZONE_IA: 0.01, INTELLIGENT_TIERING: 0.01, GLACIER_IR: 0.02, GLACIER: 0.03, DEEP_ARCHIVE: 0.05 };
  const S3_MIN_DAYS = { STANDARD_IA: 30, ONEZONE_IA: 30, GLACIER_IR: 90, GLACIER: 90, DEEP_ARCHIVE: 180 };
  const S3_RETR_LEVEL = { STANDARD: 0, STANDARD_IA: 0, INTELLIGENT_TIERING: 0, ONEZONE_IA: 0, GLACIER_IR: 0, GLACIER: 1, DEEP_ARCHIVE: 2 };
  const REQ_LEVEL = { ms: 0, minutes: 1, '12h': 2, '48h': 3 };
  const REQ_LABEL = { ms: 'ミリ秒で即時に取得', minutes: '数分以内に取得', '12h': '12時間以内に取得', '48h': '48時間以内に取得' };
  const isIA = function (cls) { return cls === 'STANDARD_IA' || cls === 'ONEZONE_IA'; };

  E.s3 = { order: S3_ORDER, label: S3_LABEL, prices: S3_PRICES, requestPer1000: S3_REQ, minDays: S3_MIN_DAYS, reqLabel: REQ_LABEL };

  function s3Segments(transitions, exp) {
    const end = exp === null ? Infinity : exp;
    const segs = [];
    let from = 0; let cls = 'STANDARD';
    transitions.forEach(function (t) {
      const to = Math.min(t.days, end);
      if (to > from) segs.push({ cls: cls, from: from, to: to, moved: from > 0 || cls !== 'STANDARD' });
      from = t.days; cls = t.storageClass;
    });
    if (end > from) segs.push({ cls: cls, from: from, to: end, moved: cls !== 'STANDARD' });
    return segs;
  }

  // コホート（月ごとの投入分）を月単位で積み上げる
  function s3Cost(p, prices, segs, months) {
    const initGB = Math.max(0, num(p.initialTB, 0)) * 1024;
    const growGB = Math.max(0, num(p.monthlyGrowthTB, 0)) * 1024;
    const objKB = Math.max(1, num(p.avgObjectKB, 1024));
    const out = [];
    for (let t = 0; t < months; t++) out.push({ month: t + 1, byClass: {}, other: 0, total: 0, baseline: 0, storedGB: 0 });
    for (let born = 0; born < months; born++) {
      const gb = born === 0 ? initGB : growGB;
      if (gb <= 0) continue;
      const objects = gb * 1024 * 1024 / objKB;
      for (let t = born; t < months; t++) {
        const a = (t - born) * 30; const b = a + 30;
        const row = out[t];
        segs.forEach(function (s) {
          const ov = Math.min(b, s.to) - Math.max(a, s.from);
          if (ov > 0) {
            row.byClass[s.cls] = (row.byClass[s.cls] || 0) + gb * prices[s.cls] * ov / 30;
            row.storedGB += gb * ov / 30;
          }
          // 移行リクエスト料金（このセグメントに入った時点）
          if (s.cls !== 'STANDARD' && s.from >= a && s.from < b) row.other += objects / 1000 * (S3_REQ[s.cls] || 0);
          // 最小保存期間より早く出ていく場合の残り日数分
          const minDays = S3_MIN_DAYS[s.cls] || 0;
          if (Number.isFinite(s.to) && s.to >= a && s.to < b && s.to - s.from < minDays) {
            row.other += gb * prices[s.cls] * (minDays - (s.to - s.from)) / 30;
          }
        });
      }
    }
    out.forEach(function (row) {
      row.total = row.other + Object.keys(row.byClass).reduce(function (sum, k) { return sum + row.byClass[k]; }, 0);
    });
    return out;
  }

  E.s3costSimulate = function (params, rules, goal) {
    const p = params || {};
    const r = rules || {};
    const g = goal || p.goal || null;
    const prices = Object.assign({}, S3_PRICES, p.prices || {});
    const months = U.clamp(Math.round(num(p.months, 12)), 1, 240);
    const errors = [];
    const warnings = [];
    const trans = (r.transitions || []).map(function (t) {
      return { days: Number(t && t.days), storageClass: String((t && t.storageClass) || '') };
    });
    const expRaw = r.expirationDays;
    const hasExp = !(expRaw === null || expRaw === undefined || expRaw === '' || expRaw === 0);
    const exp = hasExp ? Number(expRaw) : null;

    let prevIdx = 0; let prevDays = null; let prevCls = 'STANDARD';
    trans.forEach(function (t, i) {
      const n = 'ルール' + (i + 1);
      const idx = S3_ORDER.indexOf(t.storageClass);
      if (idx < 0) { errors.push(n + '：ストレージクラスを選択してください。'); return; }
      const name = S3_LABEL[t.storageClass];
      if (!Number.isInteger(t.days) || t.days < 0) { errors.push(n + '：日数は0以上の整数で指定してください。'); return; }
      if (idx === 0) errors.push(n + '：S3 Standard へは移行できません（ライフサイクルは低頻度・アーカイブ方向への一方通行です）。');
      else if (idx <= prevIdx) errors.push(n + '：' + S3_LABEL[prevCls] + ' から ' + name + ' へは移行できません（ウォーターフォールを逆流しています）。');
      else if (prevCls === 'ONEZONE_IA' && t.storageClass === 'GLACIER_IR') errors.push(n + '：S3 One Zone-IA から S3 Glacier Instant Retrieval へは移行できません。');
      if (prevDays !== null && t.days <= prevDays) errors.push(n + '：日数は前のルール（' + prevDays + '日）より大きくしてください。');
      if (isIA(t.storageClass) && t.days < 30) errors.push(n + '：' + name + ' への移行は、作成から30日以上経過してからでないと設定できません。');
      if (isIA(prevCls) && prevDays !== null && t.days - prevDays < 30) errors.push(n + '：' + S3_LABEL[prevCls] + ' に移行してから30日以上あけてください。');
      prevIdx = Math.max(prevIdx, idx); prevDays = t.days; prevCls = t.storageClass;
    });
    if (hasExp) {
      if (!Number.isInteger(exp) || exp <= 0) errors.push('有効期限：日数は1以上の整数で指定してください。');
      else if (trans.length && Number.isFinite(prevDays) && exp <= prevDays) errors.push('有効期限：最後の移行（' + prevDays + '日）より後の日数にしてください。');
    }

    const small = num(p.avgObjectKB, 1024) < 128;
    if (small && trans.length) warnings.push('平均オブジェクトサイズが 128 KB 未満です。128 KB 未満のオブジェクトはデフォルトでは移行されないため、移行なしとして計算しました。');

    const validExp = hasExp && Number.isInteger(exp) && exp > 0 ? exp : null;
    const effective = errors.length || small ? [] : trans;
    const segs = s3Segments(effective, errors.length ? validExp : exp);
    if (!errors.length) {
      segs.forEach(function (s) {
        const minDays = S3_MIN_DAYS[s.cls] || 0;
        if (Number.isFinite(s.to) && s.to - s.from < minDays) {
          warnings.push(S3_LABEL[s.cls] + ' の最小保存期間は' + minDays + '日です。' + (s.to - s.from) + '日で出ていくため、残り' + (minDays - (s.to - s.from)) + '日分の料金が加算されます。');
        }
      });
    }

    const monthly = s3Cost(p, prices, segs, months);
    const base = s3Cost(p, prices, s3Segments([], errors.length ? validExp : exp), months);
    let total = 0; let baseline = 0;
    monthly.forEach(function (row, i) { row.baseline = base[i].total; total += row.total; baseline += base[i].total; });
    total = Math.round(total * 100) / 100;
    baseline = Math.round(baseline * 100) / 100;
    const savingPct = baseline > 0 ? Math.round((baseline - total) / baseline * 1000) / 10 : 0;

    const coldest = effective.length ? effective[effective.length - 1].storageClass : 'STANDARD';
    const requirement = (g && g.retrievalRequirement) || p.retrievalRequirement || '48h';
    const reqLevel = REQ_LEVEL[requirement] === undefined ? 3 : REQ_LEVEL[requirement];
    const retrievalOk = (S3_RETR_LEVEL[coldest] || 0) <= reqLevel;
    const savingOk = g ? savingPct >= num(g.minSavingPct, 0) : null;
    return {
      errors: errors, warnings: warnings, monthly: monthly, total: total, baseline: baseline, savingPct: savingPct,
      retrievalOk: retrievalOk, coldest: coldest, requirement: requirement, savingOk: savingOk,
      pass: g ? (!errors.length && !!savingOk && retrievalOk) : null
    };
  };

  // ======================================================================
  // 2. ウィジェット共通部品
  // ======================================================================
  // 項目ごとの正誤を試行回数つきで採点する（1回目正解=1点、2回目=0.5点）
  function makeTracker(ids, maxAttempts) {
    const first = {};
    let attempts = 0;
    return {
      attempts: function () { return attempts; },
      submit: function (per) {
        attempts += 1;
        let score = 0; let allOk = true;
        ids.forEach(function (id) {
          if (per[id]) {
            if (first[id] === undefined) first[id] = attempts;
            score += first[id] === 1 ? 1 : 0.5;
          } else {
            allOk = false;
          }
        });
        return { final: allOk || attempts >= maxAttempts, allOk: allOk, score: score, total: ids.length };
      }
    };
  }

  function promptEl(step) {
    return step.prompt ? el('div', { class: 'lw-prompt', html: U.md(step.prompt) }) : null;
  }
  function resultBox(kind, title, html) {
    return el('div', { class: 'lw-result lw-result--' + kind, role: 'status' },
      el('div', { class: 'lw-result__title' }, el('span', { class: 'lw-result__mark', 'aria-hidden': 'true', text: kind === 'ok' ? '✓' : (kind === 'ng' ? '✗' : '!') }), title),
      html ? el('div', { class: 'lw-result__body', html: html }) : null);
  }
  function markEl(ok) {
    return el('span', { class: 'lw-mark lw-mark--' + (ok ? 'ok' : 'ng'), 'aria-label': ok ? '正解' : '不正解', text: ok ? '✓' : '✗' });
  }
  function scoreTitle(res) {
    if (res.allOk) return res.score === res.total ? '正解です！' : '正解です（2回目）';
    return 'おしい… 解説を確認しましょう';
  }
  // チェック型ウィジェットの共通制御
  function checkedWidget(root, tracker, d) {
    let finished = false;
    return {
      done: d.promise,
      isFinished: function () { return finished; },
      checkLabel: function () { return tracker.attempts() ? 'もう一度チェック' : 'チェック'; },
      finish: function (res) {
        finished = true;
        root.classList.add('is-final');
        sfx(res.allOk ? 'success' : 'error');
        d.resolve({ ok: res.allOk, score: res.score, total: res.total });
      },
      retry: function () { sfx('error'); }
    };
  }

  const W = {};

  // ======================================================================
  // 3. brief / choice
  // ======================================================================
  W.brief = {
    mount: function (container, step) {
      const root = el('div', { class: 'lw lw-brief' }, el('div', { class: 'lw-brief__body', html: U.md(step.body || '') }));
      container.appendChild(root);
      return { done: Promise.resolve({ ok: true, score: 0, total: 0 }), destroy: function () { root.remove(); } };
    }
  };

  W.choice = {
    mount: function (container, step) {
      const d = deferred();
      const multi = (step.answer || []).length > 1;
      const selected = [];
      const tracker = makeTracker(['q'], 1);
      const result = el('div', { class: 'lw-result-area' });
      const buttons = (step.options || []).map(function (opt, i) {
        return el('button', {
          class: 'lw-opt', type: 'button', 'aria-pressed': 'false',
          onClick: function () {
            if (base.isFinished()) return;
            const at = selected.indexOf(i);
            if (multi) { if (at >= 0) selected.splice(at, 1); else selected.push(i); }
            else { selected.length = 0; selected.push(i); }
            sfx('select');
            sync();
          }
        }, el('span', { class: 'lw-opt__key', text: String.fromCharCode(65 + i) }), el('span', { class: 'lw-opt__text', html: U.mdInline(opt) }));
      });
      const root = el('div', { class: 'lw lw-choice' }, promptEl(step),
        multi ? el('p', { class: 'lw-note', text: (step.answer || []).length + 'つ選択してください。' }) : null,
        el('div', { class: 'lw-opts' }, buttons), result);
      const base = checkedWidget(root, tracker, d);
      function sync() {
        buttons.forEach(function (b, i) {
          const on = selected.indexOf(i) >= 0;
          b.classList.toggle('is-selected', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      container.appendChild(root);
      return {
        done: base.done,
        checkLabel: base.checkLabel,
        check: function () {
          if (base.isFinished()) return true;
          if (!selected.length) { U.toast('選択肢を選んでください', 'warn'); return false; }
          const ok = E.choice(step, selected);
          const res = tracker.submit({ q: ok });
          buttons.forEach(function (b, i) {
            b.disabled = true;
            if ((step.answer || []).indexOf(i) >= 0) b.classList.add('is-correct');
            else if (selected.indexOf(i) >= 0) b.classList.add('is-wrong');
          });
          U.clear(result).appendChild(resultBox(ok ? 'ok' : 'ng', scoreTitle(res), U.md(step.explain || '')));
          base.finish(res);
          return true;
        },
        destroy: function () { root.remove(); }
      };
    }
  };

  // ======================================================================
  // 4. terminal
  // ======================================================================
  const TERM_PROMPT = 'akari@saa-lab:~$';
  const AWS_USAGE = 'usage: aws [options] <command> <subcommand> [<subcommand> ...] [parameters]\n' +
    'To see help text, you can run:\n\n  aws help\n  aws <command> help\n  aws <command> <subcommand> help\n';
  function opName(op) {
    return String(op || '').split('-').map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join('');
  }
  // 間違ったコマンドに対する、それらしいが汎用的なエラー
  function termError(cmd, task) {
    const c = normalizeCmd(cmd);
    const toks = c.split(' ');
    if (toks[0].toLowerCase() !== 'aws') return 'bash: ' + toks[0] + ': command not found';
    if (toks.length < 3) {
      return AWS_USAGE + '\naws: error: the following arguments are required: ' + (toks.length < 2 ? 'command' : 'operation');
    }
    const ans = normalizeCmd((task && task.answer) || '').split(' ');
    const sameSvc = ans.length >= 3 && ans[1].toLowerCase() === toks[1].toLowerCase();
    if (sameSvc && ans[2].toLowerCase() === toks[2].toLowerCase()) {
      const lower = c.toLowerCase();
      const missing = ans.filter(function (t) { return /^--[a-z]/i.test(t); })
        .map(function (t) { return t.split('=')[0]; })
        .filter(function (f, i, arr) { return arr.indexOf(f) === i && lower.indexOf(f.toLowerCase()) < 0; });
      if (missing.length) return AWS_USAGE + '\naws: error: the following arguments are required: ' + missing.join(', ');
      return '\nParameter validation failed:\nInvalid value for one or more parameters（値・名前・書式を見直してください）';
    }
    if (sameSvc) {
      return AWS_USAGE + '\naws: error: argument operation: Invalid choice for this task: \'' + toks[2] + '\'（このタスクでは別のオペレーションを使います）';
    }
    return '\nAn error occurred (AccessDenied) when calling the ' + opName(toks[2]) + ' operation: User: arn:aws:iam::123456789012:user/akari is not authorized to perform: ' +
      toks[1] + ':' + opName(toks[2]) + '（ラボ環境ではタスクに必要な操作だけが許可されています）';
  }
  E.termError = termError;

  W.terminal = {
    mount: function (container, step) {
      const d = deferred();
      const tasks = step.tasks || [];
      const files = step.files || {};
      const st = tasks.map(function () { return { done: false, assisted: false, misses: 0 }; });
      const history = [];
      let hIndex = 0;
      let lastKey = 0;
      let finished = false;

      const taskList = el('ol', { class: 'lw-term__tasks' });
      const screen = el('div', { class: 'lw-term__screen', role: 'log', 'aria-live': 'polite', 'aria-label': 'ターミナル出力' });
      const input = el('input', {
        class: 'lw-term__input', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
        'aria-label': 'コマンド入力', placeholder: 'コマンドを入力して Enter'
      });
      const runBtn = el('button', { class: 'lw-term__run', type: 'button', 'aria-label': '実行', text: '⏎', onClick: function () { submit(); input.focus(); } });
      const term = el('div', { class: 'lw-term' },
        el('div', { class: 'lw-term__bar' },
          el('span', { class: 'lw-term__dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
          el('span', { class: 'lw-term__title', text: 'akari@saa-lab — AWS CLI v2（学習用シミュレーター）' })),
        screen,
        el('div', { class: 'lw-term__line-in' }, el('span', { class: 'lw-term__ps', text: TERM_PROMPT }), input, runBtn));
      const root = el('div', { class: 'lw lw-terminal' }, promptEl(step),
        el('div', { class: 'lw-term-layout' },
          el('aside', { class: 'lw-term__side' }, el('h4', { class: 'lw-subtitle', text: 'タスク' }), taskList,
            Object.keys(files).length ? el('p', { class: 'lw-note', html: 'ファイル: ' + Object.keys(files).map(function (f) { return '<code>' + U.esc(f) + '</code>'; }).join(' ') + '（<code>cat</code> で表示）' }) : null,
            el('p', { class: 'lw-note', html: '<code>help</code> コマンド一覧 ／ <code>hint</code> ヒント ／ <code>answer</code> 解答例（半分の得点）' })),
          term));

      function current() { return st.findIndex(function (s) { return !s.done; }); }
      function print(text, cls) {
        if (text === undefined || text === null || text === '') return;
        screen.appendChild(el('div', { class: 'lw-term__out' + (cls ? ' lw-term__out--' + cls : ''), text: String(text) }));
        screen.scrollTop = screen.scrollHeight;
      }
      function echo(cmd) {
        screen.appendChild(el('div', { class: 'lw-term__out lw-term__out--echo' }, el('span', { class: 'lw-term__ps', text: TERM_PROMPT + ' ' }), cmd));
      }
      function renderTasks() {
        U.clear(taskList);
        const cur = current();
        tasks.forEach(function (t, i) {
          const s = st[i];
          taskList.appendChild(el('li', { class: 'lw-task' + (s.done ? ' is-done' : '') + (i === cur ? ' is-current' : '') + (s.assisted ? ' is-assisted' : '') },
            el('span', { class: 'lw-task__box', 'aria-hidden': 'true', text: s.done ? '✓' : String(i + 1) }),
            el('div', { class: 'lw-task__main' },
              el('div', { class: 'lw-task__text', html: U.mdInline(t.instruction || '') }),
              s.done && s.assisted ? el('span', { class: 'badge badge--warn', text: '解答例を使用' }) : null,
              s.done && t.explain ? el('div', { class: 'lw-task__explain', html: U.md(t.explain) }) : null)));
        });
      }
      function showHint(i) {
        const t = tasks[i];
        if (!t) { print('すべてのタスクが完了しています。'); return; }
        print('💡 ヒント: ' + (t.hint || 'タスクの文に出てくるリソース名・値をそのままパラメータに使いましょう。'), 'hint');
      }
      function complete(i) {
        const t = tasks[i];
        st[i].done = true;
        print(t.output, 'ok-out');
        print('✔ タスク' + (i + 1) + ' 完了' + (st[i].assisted ? '（解答例を使用）' : ''), 'ok');
        sfx('success');
        renderTasks();
        if (current() < 0 && !finished) {
          finished = true;
          print('すべてのタスクが完了しました。「次へ」で進みましょう。', 'ok');
          let score = 0;
          st.forEach(function (s) { score += s.assisted ? 0.5 : 1; });
          d.resolve({ ok: score === tasks.length, score: score, total: tasks.length });
        }
      }
      function builtin(c) {
        const toks = c.split(' ');
        const name = toks[0].toLowerCase();
        const cur = current();
        if (name === 'help') {
          print('このターミナルで使えるコマンド:\n  help            この一覧\n  hint            現在のタスクのヒント\n  answer          現在のタスクの解答例（半分の得点になります）\n  ls              ファイル一覧\n  cat <file>      ファイルの内容を表示\n  clear           画面を消去\n  aws ...         AWS CLI（学習用のシミュレーション。実際の AWS には接続しません）');
          return true;
        }
        if (name === 'clear') { U.clear(screen); return true; }
        if (name === 'hint') { showHint(cur); return true; }
        if (name === 'answer') {
          if (cur < 0) { print('すべてのタスクが完了しています。'); return true; }
          st[cur].assisted = true;
          print('解答例:\n  ' + (tasks[cur].answer || '（解答例なし）'), 'hint');
          print('入力欄にセットしました。内容を確認して Enter で実行してください。');
          input.value = tasks[cur].answer || '';
          return true;
        }
        if (name === 'ls') {
          const names = Object.keys(files);
          print(names.length ? names.join('  ') : '');
          return true;
        }
        if (name === 'cat') {
          if (toks.length < 2) print('usage: cat <file>', 'err');
          else toks.slice(1).forEach(function (f) {
            if (Object.prototype.hasOwnProperty.call(files, f)) print(files[f]);
            else print('cat: ' + f + ': No such file or directory', 'err');
          });
          return true;
        }
        if (name === 'pwd') { print('/home/akari'); return true; }
        if (name === 'whoami') { print('akari'); return true; }
        if (c.toLowerCase() === 'aws --version') { print('aws-cli/2.x Python/3.x（学習用シミュレーター）'); return true; }
        if (name === 'aws' && toks[toks.length - 1].toLowerCase() === 'help') {
          print('ヘルプの全文は省略しています。hint でこのタスクのヒントを表示できます。');
          return true;
        }
        return false;
      }
      function submit() {
        const raw = input.value;
        const c = normalizeCmd(raw);
        input.value = '';
        echo(raw.trim());
        sfx('enter');
        if (!c) { screen.scrollTop = screen.scrollHeight; return; }
        if (history[history.length - 1] !== c) history.push(c);
        hIndex = history.length;
        if (builtin(c)) { screen.scrollTop = screen.scrollHeight; return; }
        // 未完了タスクのどれかに一致すれば完了（基本は上から順）
        const hit = tasks.findIndex(function (t, i) { return !st[i].done && E.terminal(t, c); });
        if (hit >= 0) { complete(hit); return; }
        const again = tasks.findIndex(function (t, i) { return st[i].done && E.terminal(t, c); });
        if (again >= 0) { print(tasks[again].output, 'ok-out'); print('（このタスクは完了済みです）'); return; }
        const cur = current();
        print(termError(c, tasks[cur]), 'err');
        sfx('error');
        if (cur >= 0) {
          st[cur].misses += 1;
          if (st[cur].misses >= 2) showHint(cur);
        }
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); return; }
        if (e.key === 'ArrowUp') {
          if (!history.length) return;
          e.preventDefault();
          hIndex = Math.max(0, hIndex - 1);
          input.value = history[hIndex];
          return;
        }
        if (e.key === 'ArrowDown') {
          if (!history.length) return;
          e.preventDefault();
          hIndex = Math.min(history.length, hIndex + 1);
          input.value = hIndex >= history.length ? '' : history[hIndex];
          return;
        }
        if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); U.clear(screen); return; }
        if (e.key.length === 1) {
          const now = Date.now();
          if (now - lastKey > 70) { lastKey = now; sfx('key'); }
        }
      });
      screen.addEventListener('click', function () {
        const sel = window.getSelection ? String(window.getSelection()) : '';
        if (!sel) input.focus();
      });

      print('SAA Lab Terminal へようこそ。help でコマンド一覧を表示します。', 'dim');
      renderTasks();
      container.appendChild(root);
      if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
        setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) { /* noop */ } }, 60);
      }
      return {
        done: d.promise,
        hint: function () { showHint(current()); input.focus(); },
        waitLabel: 'タスクを完了すると進めます',
        destroy: function () { root.remove(); },
        _run: function (cmd) { input.value = cmd; submit(); }
      };
    }
  };

  // ======================================================================
  // 5. slots（構成図ビルダー）
  // ======================================================================
  const ZONE_TAG = { edge: 'Edge', region: 'Region', az: 'AZ', vpc: 'VPC', public: 'Public', private: 'Private', onprem: 'On-premises', aws: 'AWS' };

  W.slots = {
    mount: function (container, step) {
      const d = deferred();
      const zones = step.zones || [];
      const slots = step.slots || [];
      const palette = step.palette || [];
      const pById = {};
      palette.forEach(function (p) { pById[p.id] = p; });
      const assign = {};
      const feedback = {};       // slotId -> { ok, html }
      let selSlot = null;
      let armed = null;
      const tracker = makeTracker(slots.map(function (s) { return s.id; }), 2);
      const slotEls = {};
      const chipEls = {};
      const result = el('div', { class: 'lw-result-area' });

      function chipContent(p) {
        return [el('span', { class: 'lw-chip__icon', 'aria-hidden': 'true', text: p.icon || '◻' }), el('span', { class: 'lw-chip__label', text: p.label })];
      }
      function nextEmpty(from) {
        const ids = slots.map(function (s) { return s.id; });
        const startAt = Math.max(0, ids.indexOf(from));
        for (let k = 1; k <= ids.length; k++) {
          const id = ids[(startAt + k) % ids.length];
          if (!assign[id]) return id;
        }
        return null;
      }
      function place(slotId, compId) {
        if (base.isFinished() || !pById[compId]) return;
        assign[slotId] = compId;
        delete feedback[slotId];
        sfx('select');
        armed = null;
        selSlot = nextEmpty(slotId);
        render();
      }
      function renderSlot(s) {
        const comp = assign[s.id] ? pById[assign[s.id]] : null;
        const fb = feedback[s.id];
        const btn = el('button', {
          class: 'lw-slot__drop' + (comp ? ' is-filled' : ''), type: 'button',
          'aria-label': 'スロット: ' + s.label + (comp ? '（' + comp.label + '）' : '（未配置）'),
          onClick: function () {
            if (base.isFinished()) return;
            if (armed) { place(s.id, armed); return; }
            selSlot = selSlot === s.id ? null : s.id;
            render();
          }
        }, comp ? chipContent(comp) : el('span', { class: 'lw-slot__empty', text: 'ここに配置' }));
        btn.addEventListener('dragover', function (e) { if (!base.isFinished()) { e.preventDefault(); btn.classList.add('is-over'); } });
        btn.addEventListener('dragleave', function () { btn.classList.remove('is-over'); });
        btn.addEventListener('drop', function (e) {
          e.preventDefault();
          btn.classList.remove('is-over');
          const id = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
          if (id) place(s.id, id);
        });
        const box = el('div', {
          class: 'lw-slot' + (selSlot === s.id ? ' is-selected' : '') + (fb ? (fb.ok ? ' is-ok' : ' is-ng') : '')
        },
          el('div', { class: 'lw-slot__label' }, fb ? markEl(fb.ok) : null, el('span', { html: U.mdInline(s.label || '') })),
          el('div', { class: 'lw-slot__row' }, btn,
            comp && !base.isFinished() ? el('button', {
              class: 'lw-slot__clear', type: 'button', 'aria-label': '配置を取り消す', text: '✕',
              onClick: function () { delete assign[s.id]; delete feedback[s.id]; selSlot = s.id; render(); }
            }) : null),
          fb && fb.html ? el('div', { class: 'lw-slot__fb', html: fb.html }) : null);
        slotEls[s.id] = box;
        return box;
      }
      function renderZone(z) {
        const kids = zones.filter(function (c) { return c.parent === z.id; });
        const own = slots.filter(function (s) { return s.zone === z.id; });
        return el('section', { class: 'lw-zone lw-zone--' + (z.kind || 'aws') },
          el('header', { class: 'lw-zone__label' },
            el('span', { class: 'lw-zone__tag', text: ZONE_TAG[z.kind] || 'Zone' }), el('span', { text: z.label || '' })),
          el('div', { class: 'lw-zone__body' }, own.map(renderSlot), kids.map(renderZone)));
      }
      const board = el('div', { class: 'lw-board' });
      const tray = el('div', { class: 'lw-palette__chips' });
      function render() {
        U.clear(board);
        const ids = zones.map(function (z) { return z.id; });
        zones.filter(function (z) { return !z.parent || ids.indexOf(z.parent) < 0; }).forEach(function (z) { board.appendChild(renderZone(z)); });
        const orphans = slots.filter(function (s) { return ids.indexOf(s.zone) < 0; });
        if (orphans.length) board.appendChild(el('section', { class: 'lw-zone lw-zone--aws' }, el('div', { class: 'lw-zone__body' }, orphans.map(renderSlot))));
        palette.forEach(function (p) {
          const c = chipEls[p.id];
          if (!c) return;
          c.classList.toggle('is-armed', armed === p.id);
          c.disabled = base.isFinished();
        });
      }
      palette.forEach(function (p) {
        const chip = el('button', {
          class: 'lw-chip', type: 'button', draggable: 'true', title: p.label,
          onClick: function () {
            if (base.isFinished()) return;
            if (selSlot) { place(selSlot, p.id); return; }
            armed = armed === p.id ? null : p.id;
            render();
          }
        }, chipContent(p));
        chip.addEventListener('dragstart', function (e) {
          if (e.dataTransfer) { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'copy'; }
        });
        chipEls[p.id] = chip;
        tray.appendChild(chip);
      });
      const root = el('div', { class: 'lw lw-slots' }, promptEl(step),
        el('div', { class: 'lw-slots__layout' },
          board,
          el('aside', { class: 'lw-palette' },
            el('h4', { class: 'lw-subtitle', text: 'コンポーネント' }),
            el('p', { class: 'lw-note', text: 'スロットを選んでから部品をタップ（PCはドラッグ＆ドロップも可）。同じ部品を何度でも使えます。' }),
            tray)),
        result);
      const base = checkedWidget(root, tracker, d);
      selSlot = slots.length ? slots[0].id : null;
      render();
      container.appendChild(root);

      return {
        done: base.done,
        checkLabel: base.checkLabel,
        check: function () {
          if (base.isFinished()) return true;
          const empty = slots.filter(function (s) { return !assign[s.id]; });
          if (empty.length) {
            U.toast('未配置のスロットがあります（あと' + empty.length + 'か所）', 'warn');
            selSlot = empty[0].id; render();
            return false;
          }
          const r = E.slots(step, assign);
          const res = tracker.submit(r.perSlot);
          slots.forEach(function (s) {
            const ok = r.perSlot[s.id];
            const parts = [];
            const why = (step.feedback || {})[assign[s.id]];
            if (!ok && why) parts.push('<p>' + U.mdInline(why) + '</p>');
            if (res.final) {
              if (!ok) {
                const names = (s.answer || []).map(function (id) { return pById[id] ? pById[id].label : id; }).join(' / ');
                parts.push('<p><strong>正解: ' + U.esc(names) + '</strong></p>');
              }
              if (s.explain) parts.push(U.md(s.explain));
            }
            feedback[s.id] = { ok: ok, html: parts.join('') };
          });
          selSlot = null; armed = null;
          if (res.final) {
            U.clear(result).appendChild(resultBox(res.allOk ? 'ok' : 'ng', scoreTitle(res),
              U.md(step.explain || '') || ('<p>' + res.score + ' / ' + res.total + ' 点</p>')));
            base.finish(res);
          } else {
            U.clear(result).appendChild(resultBox('warn', '✗ の付いたスロットを見直して、もう一度チェックしましょう', ''));
            base.retry();
          }
          render();
          return true;
        },
        destroy: function () { root.remove(); },
        _set: function (a) { Object.keys(a).forEach(function (k) { assign[k] = a[k]; }); render(); }
      };
    }
  };

  // ======================================================================
  // 6. calc
  // ======================================================================
  W.calc = {
    mount: function (container, step) {
      const d = deferred();
      const fields = step.fields || [];
      const tracker = makeTracker(fields.map(function (f) { return f.id; }), 2);
      const inputs = {};
      const rows = {};
      let hintLevel = 0;
      const hintArea = el('div', { class: 'lw-hints' });
      const result = el('div', { class: 'lw-result-area' });
      const list = el('div', { class: 'lw-calc__fields' }, fields.map(function (f) {
        const id = U.uid('calc');
        const inp = el('input', { id: id, class: 'lw-calc__input', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '数値' });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ctl.check(); } });
        inputs[f.id] = inp;
        const row = el('div', { class: 'lw-calc__row' },
          el('label', { class: 'lw-calc__label', for: id, html: U.mdInline(f.label || f.id) }),
          el('div', { class: 'lw-calc__control' }, inp, f.unit ? el('span', { class: 'lw-calc__unit', text: f.unit }) : null,
            el('span', { class: 'lw-calc__mark' })),
          el('div', { class: 'lw-calc__fb' }));
        rows[f.id] = row;
        return row;
      }));
      const root = el('div', { class: 'lw lw-calc' }, promptEl(step), list, hintArea, result);
      const base = checkedWidget(root, tracker, d);
      const ctl = {
        done: base.done,
        checkLabel: base.checkLabel,
        hint: (step.hint || step.formula) ? function () {
          const items = [];
          if (step.hint) items.push(['ヒント', step.hint]);
          if (step.formula) items.push(['計算式', step.formula]);
          if (hintLevel >= items.length) { U.toast('ヒントはすべて表示済みです', 'info'); return; }
          const it = items[hintLevel];
          hintLevel += 1;
          hintArea.appendChild(el('div', { class: 'lw-hint' }, el('span', { class: 'lw-hint__label', text: '💡 ' + it[0] }), el('div', { html: U.md(it[1]) })));
          sfx('notify');
        } : undefined,
        check: function () {
          if (base.isFinished()) return true;
          const blank = fields.filter(function (f) { return !Number.isFinite(parseNumber(inputs[f.id].value)); });
          if (blank.length) { U.toast('数値を入力してください', 'warn'); inputs[blank[0].id].focus(); return false; }
          const per = {};
          fields.forEach(function (f) { per[f.id] = E.calc(f, inputs[f.id].value); });
          const res = tracker.submit(per);
          fields.forEach(function (f) {
            const row = rows[f.id];
            row.classList.toggle('is-ok', per[f.id]);
            row.classList.toggle('is-ng', !per[f.id]);
            U.clear(row.querySelector('.lw-calc__mark')).appendChild(markEl(per[f.id]));
            const fb = U.clear(row.querySelector('.lw-calc__fb'));
            if (res.final) {
              inputs[f.id].disabled = true;
              if (!per[f.id]) fb.textContent = '正解: ' + fmtNum(f.answer) + (f.unit ? ' ' + f.unit : '') + (f.tolerance ? '（±' + f.tolerance + ' まで正解）' : '');
            }
          });
          if (res.final) {
            const extra = step.formula ? '<p><strong>計算式</strong></p>' + U.md(step.formula) : '';
            U.clear(result).appendChild(resultBox(res.allOk ? 'ok' : 'ng', scoreTitle(res), extra + U.md(step.explain || '')));
            base.finish(res);
          } else {
            U.clear(result).appendChild(resultBox('warn', '✗ の値を見直して、もう一度チェックしましょう（ヒントも使えます）', ''));
            base.retry();
          }
          return true;
        },
        destroy: function () { root.remove(); },
        _set: function (vals) { Object.keys(vals).forEach(function (k) { if (inputs[k]) inputs[k].value = vals[k]; }); }
      };
      container.appendChild(root);
      return ctl;
    }
  };

  // ======================================================================
  // 7. order
  // ======================================================================
  W.order = {
    mount: function (container, step) {
      const d = deferred();
      const items = step.items || [];
      const idx = items.map(function (_, i) { return i; });
      let arr = idx.slice();
      for (let k = 0; k < 12 && items.length > 1; k++) {
        arr = U.shuffle(idx);
        if (!E.order(items, arr)) break;
      }
      const tracker = makeTracker(idx, 2);
      let marks = null;
      let dragFrom = -1;
      const list = el('ol', { class: 'lw-order__list' });
      const result = el('div', { class: 'lw-result-area' });
      const root = el('div', { class: 'lw lw-order' }, promptEl(step),
        el('p', { class: 'lw-note', text: '↑ ↓ で並べ替えます（PCはドラッグでも移動できます）。' }), list, result);
      const base = checkedWidget(root, tracker, d);
      function move(from, to) {
        if (base.isFinished() || to < 0 || to >= arr.length || from === to) return;
        const v = arr.splice(from, 1)[0];
        arr.splice(to, 0, v);
        marks = null;
        sfx('select');
        render(to);
      }
      function render(focusPos) {
        U.clear(list);
        arr.forEach(function (itemIdx, pos) {
          const up = el('button', { class: 'lw-order__btn', type: 'button', 'aria-label': '上へ', text: '↑', disabled: pos === 0 || base.isFinished(), onClick: function () { move(pos, pos - 1); } });
          const down = el('button', { class: 'lw-order__btn', type: 'button', 'aria-label': '下へ', text: '↓', disabled: pos === arr.length - 1 || base.isFinished(), onClick: function () { move(pos, pos + 1); } });
          const li = el('li', {
            class: 'lw-order__item' + (marks ? (marks[pos] ? ' is-ok' : ' is-ng') : ''), draggable: base.isFinished() ? null : 'true'
          },
            el('span', { class: 'lw-order__no', text: String(pos + 1) }),
            el('span', { class: 'lw-order__text', html: U.mdInline(items[itemIdx]) }),
            marks ? markEl(marks[pos]) : null,
            el('span', { class: 'lw-order__btns' }, up, down));
          li.addEventListener('dragstart', function (e) {
            dragFrom = pos;
            if (e.dataTransfer) { e.dataTransfer.setData('text/plain', String(pos)); e.dataTransfer.effectAllowed = 'move'; }
          });
          li.addEventListener('dragover', function (e) { if (dragFrom >= 0) { e.preventDefault(); li.classList.add('is-over'); } });
          li.addEventListener('dragleave', function () { li.classList.remove('is-over'); });
          li.addEventListener('drop', function (e) { e.preventDefault(); const f = dragFrom; dragFrom = -1; move(f, pos); });
          li.addEventListener('dragend', function () { dragFrom = -1; });
          list.appendChild(li);
          if (focusPos === pos) setTimeout(function () { const b = li.querySelector('.lw-order__btn:not(:disabled)'); if (b) b.focus(); }, 0);
        });
      }
      render();
      container.appendChild(root);
      return {
        done: base.done,
        checkLabel: base.checkLabel,
        check: function () {
          if (base.isFinished()) return true;
          const per = {};
          const posOk = arr.map(function (itemIdx, pos) { return items[itemIdx] === items[pos]; });
          posOk.forEach(function (ok, pos) { per[pos] = ok; });
          const res = tracker.submit(per);
          marks = posOk;
          if (res.final) {
            const correct = res.allOk ? '' : '<p><strong>正しい順序</strong></p><ol class="md-list">' +
              items.map(function (t) { return '<li>' + U.mdInline(t) + '</li>'; }).join('') + '</ol>';
            U.clear(result).appendChild(resultBox(res.allOk ? 'ok' : 'ng', scoreTitle(res), correct + U.md(step.explain || '')));
            base.finish(res);
          } else {
            U.clear(result).appendChild(resultBox('warn', '✗ の位置が違います。並べ替えて、もう一度チェックしましょう', ''));
            base.retry();
          }
          render();
          return true;
        },
        destroy: function () { root.remove(); },
        _set: function (a) { arr = a.slice(); render(); }
      };
    }
  };

  // ======================================================================
  // 8. match
  // ======================================================================
  W.match = {
    mount: function (container, step) {
      const d = deferred();
      const left = step.left || [];
      const right = step.right || [];
      const rLabel = {};
      right.forEach(function (r) { rLabel[r.id] = r.label; });
      const tracker = makeTracker(left.map(function (l) { return l.id; }), 2);
      const selects = {};
      const rows = {};
      const result = el('div', { class: 'lw-result-area' });
      const list = el('div', { class: 'lw-match__list' }, left.map(function (l) {
        const id = U.uid('match');
        const sel = el('select', { id: id, class: 'lw-match__select' },
          el('option', { value: '', text: '選択してください' }),
          right.map(function (r) { return el('option', { value: r.id, text: r.label }); }));
        sel.addEventListener('change', function () { sfx('select'); });
        selects[l.id] = sel;
        const row = el('div', { class: 'lw-match__row' },
          el('label', { class: 'lw-match__left', for: id, html: U.mdInline(l.label || l.id) }),
          el('span', { class: 'lw-match__arrow', 'aria-hidden': 'true', text: '→' }),
          el('div', { class: 'lw-match__right' }, sel, el('span', { class: 'lw-match__mark' })),
          el('div', { class: 'lw-match__fb' }));
        rows[l.id] = row;
        return row;
      }));
      const root = el('div', { class: 'lw lw-match' }, promptEl(step), list, result);
      const base = checkedWidget(root, tracker, d);
      container.appendChild(root);
      return {
        done: base.done,
        checkLabel: base.checkLabel,
        check: function () {
          if (base.isFinished()) return true;
          const blank = left.filter(function (l) { return !selects[l.id].value; });
          if (blank.length) { U.toast('未選択の項目があります（あと' + blank.length + '件）', 'warn'); selects[blank[0].id].focus(); return false; }
          const mapping = {};
          left.forEach(function (l) { mapping[l.id] = selects[l.id].value; });
          const r = E.match(step, mapping);
          const res = tracker.submit(r.perItem);
          left.forEach(function (l) {
            const ok = r.perItem[l.id];
            const row = rows[l.id];
            row.classList.toggle('is-ok', ok);
            row.classList.toggle('is-ng', !ok);
            U.clear(row.querySelector('.lw-match__mark')).appendChild(markEl(ok));
            const fb = U.clear(row.querySelector('.lw-match__fb'));
            if (res.final) {
              selects[l.id].disabled = true;
              const parts = [];
              if (!ok) parts.push('<strong>正解: ' + U.esc(rLabel[(step.answer || {})[l.id]] || '') + '</strong>');
              const note = (step.notes || {})[l.id];
              if (note) parts.push(U.mdInline(note));
              fb.innerHTML = parts.join('<br>');
            }
          });
          if (res.final) {
            U.clear(result).appendChild(resultBox(res.allOk ? 'ok' : 'ng', scoreTitle(res), U.md(step.explain || '')));
            base.finish(res);
          } else {
            U.clear(result).appendChild(resultBox('warn', '✗ の組み合わせを見直して、もう一度チェックしましょう', ''));
            base.retry();
          }
          return true;
        },
        destroy: function () { root.remove(); },
        _set: function (m) { Object.keys(m).forEach(function (k) { if (selects[k]) selects[k].value = m[k]; }); }
      };
    }
  };

  // ======================================================================
  // 9. verdict
  // ======================================================================
  // JSON を整形し、軽く色分けした HTML にする
  function jsonHtml(content) {
    let obj = content;
    if (typeof content === 'string') { try { obj = JSON.parse(content); } catch (e) { return U.esc(content); } }
    const text = JSON.stringify(obj, null, 2) || '';
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let out = ''; let last = 0; let m;
    while ((m = re.exec(text)) !== null) {
      out += U.esc(text.slice(last, m.index));
      if (m[1]) out += '<span class="' + (m[2] ? 'lw-json__key' : 'lw-json__str') + '">' + U.esc(m[1]) + '</span>' + (m[2] || '');
      else if (m[3]) out += '<span class="lw-json__lit">' + m[3] + '</span>';
      else out += '<span class="lw-json__num">' + m[4] + '</span>';
      last = re.lastIndex;
    }
    return out + U.esc(text.slice(last));
  }
  function docEl(doc) {
    let body;
    if (doc.kind === 'json') body = el('pre', { class: 'lw-doc__json', html: jsonHtml(doc.content) });
    else if (doc.kind === 'table') {
      body = el('div', { class: 'lw-doc__table-wrap' }, el('table', { class: 'lw-doc__table' },
        el('thead', null, el('tr', null, (doc.columns || []).map(function (c) { return el('th', { html: U.mdInline(c) }); }))),
        el('tbody', null, (doc.rows || []).map(function (r) {
          return el('tr', null, (r || []).map(function (c) {
            const s = String(c);
            const cls = /^(許可|ALLOW|Allow)$/.test(s) ? 'is-allow' : (/^(拒否|DENY|Deny)$/.test(s) ? 'is-deny' : null);
            return el('td', { class: cls, html: U.mdInline(s) });
          }));
        }))));
    } else body = el('div', { class: 'lw-doc__text', html: U.md(typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content)) });
    return el('section', { class: 'lw-doc lw-doc--' + (doc.kind || 'text') },
      el('header', { class: 'lw-doc__title' }, el('span', { class: 'lw-doc__kind', text: doc.kind === 'json' ? 'JSON' : (doc.kind === 'table' ? '表' : 'メモ') }), el('span', { text: doc.title || '' })),
      body);
  }

  W.verdict = {
    mount: function (container, step) {
      const d = deferred();
      const choices = step.choices && step.choices.length ? step.choices : ['許可', '拒否'];
      const cases = step.cases || [];
      const answers = {};
      const tracker = makeTracker(cases.map(function (c) { return c.id; }), 1);
      const rows = {};
      const result = el('div', { class: 'lw-result-area' });
      const caseList = el('div', { class: 'lw-verdict__cases' }, cases.map(function (c, i) {
        const group = el('div', { class: 'lw-verdict__choices', role: 'radiogroup', 'aria-label': 'ケース' + (i + 1) + 'の判定' }, choices.map(function (ch) {
          return el('button', {
            class: 'lw-verdict__choice', type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { v: ch }, text: ch,
            onClick: function () {
              if (base.isFinished()) return;
              answers[c.id] = ch;
              sfx('select');
              U.$$('.lw-verdict__choice', group).forEach(function (b) {
                const on = b.dataset.v === ch;
                b.classList.toggle('is-selected', on);
                b.setAttribute('aria-checked', on ? 'true' : 'false');
              });
            }
          });
        }));
        const row = el('div', { class: 'lw-case' },
          el('div', { class: 'lw-case__head' }, el('span', { class: 'lw-case__no', text: 'ケース' + (i + 1) }), el('span', { class: 'lw-case__mark' })),
          el('div', { class: 'lw-case__desc', html: U.mdInline(c.desc || '') }),
          group,
          el('div', { class: 'lw-case__fb' }));
        rows[c.id] = row;
        return row;
      }));
      const root = el('div', { class: 'lw lw-verdict' }, promptEl(step),
        el('div', { class: 'lw-verdict__layout' },
          el('div', { class: 'lw-verdict__docs' }, (step.docs || []).map(docEl)),
          caseList),
        result);
      const base = checkedWidget(root, tracker, d);
      container.appendChild(root);
      return {
        done: base.done,
        checkLabel: base.checkLabel,
        check: function () {
          if (base.isFinished()) return true;
          const blank = cases.filter(function (c) { return answers[c.id] === undefined; });
          if (blank.length) {
            U.toast('未回答のケースがあります（あと' + blank.length + '件）', 'warn');
            rows[blank[0].id].scrollIntoView({ block: 'center', behavior: U.prefersReducedMotion() ? 'auto' : 'smooth' });
            return false;
          }
          const r = E.verdict(step, answers);
          const res = tracker.submit(r.perCase);
          cases.forEach(function (c) {
            const ok = r.perCase[c.id];
            const row = rows[c.id];
            row.classList.add(ok ? 'is-ok' : 'is-ng');
            U.clear(row.querySelector('.lw-case__mark')).appendChild(markEl(ok));
            U.$$('.lw-verdict__choice', row).forEach(function (b) {
              b.disabled = true;
              if (b.dataset.v === c.answer) b.classList.add('is-correct');
            });
            row.querySelector('.lw-case__fb').innerHTML = '<strong>正解: ' + U.esc(c.answer) + '</strong>' + (c.explain ? U.md(c.explain) : '');
          });
          U.clear(result).appendChild(resultBox(res.allOk ? 'ok' : 'ng',
            res.allOk ? '全ケース正解です！' : res.score + ' / ' + res.total + ' ケース正解', U.md(step.explain || '')));
          base.finish(res);
          return true;
        },
        destroy: function () { root.remove(); },
        _set: function (a) { Object.assign(answers, a); }
      };
    }
  };

  // ======================================================================
  // 10. グラフ部品（SVG）
  // ======================================================================
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, String(attrs[k])); });
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c === null || c === undefined) continue;
      n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return n;
  }
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  }
  function niceTicks(max, count) {
    const raw = max / count;
    const stepSize = niceMax(raw);
    const ticks = [];
    for (let v = 0; v <= max + stepSize * 0.001; v += stepSize) ticks.push(Math.round(v * 1000) / 1000);
    return { ticks: ticks, top: ticks[ticks.length - 1] };
  }
  // グラフの枠・ホバー（十字線＋ツールチップ）を用意する
  function chartFrame(opts) {
    const wrap = el('div', { class: 'lw-chart' });
    const tip = el('div', { class: 'lw-chart__tip', hidden: true });
    let ro = null;
    let lastW = 0;
    function width() { return Math.max(300, Math.round(wrap.clientWidth || 720)); }
    function draw() {
      const W0 = width();
      lastW = W0;
      const H = W0 < 520 ? 230 : 290;
      const mg = { l: 50, r: 12, t: 12, b: 28 };
      const g = { W: W0, H: H, l: mg.l, t: mg.t, pw: W0 - mg.l - mg.r, ph: H - mg.t - mg.b };
      const root = svg('svg', { class: 'lw-chart__svg', viewBox: '0 0 ' + W0 + ' ' + H, width: W0, height: H, role: 'img', 'aria-label': opts.label || 'グラフ' });
      const hover = opts.draw(root, g);
      const cross = svg('line', { class: 'lw-chart__cross', y1: g.t, y2: g.t + g.ph, x1: 0, x2: 0, visibility: 'hidden' });
      root.appendChild(cross);
      const hit = svg('rect', { x: g.l, y: g.t, width: g.pw, height: g.ph, fill: 'transparent' });
      root.appendChild(hit);
      const onMove = function (e) {
        const rect = root.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (W0 / Math.max(1, rect.width));
        const ratio = U.clamp((px - g.l) / g.pw, 0, 0.9999);
        const info = hover(ratio);
        if (!info) return;
        cross.setAttribute('x1', info.x); cross.setAttribute('x2', info.x);
        cross.setAttribute('visibility', 'visible');
        tip.hidden = false;
        tip.innerHTML = info.html;
        const tw = tip.offsetWidth || 160;
        const leftPx = info.x / W0 * rect.width;
        tip.style.left = U.clamp(leftPx + 12 + tw > rect.width ? leftPx - tw - 12 : leftPx + 12, 0, Math.max(0, rect.width - tw)) + 'px';
      };
      const onLeave = function () { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
      hit.addEventListener('pointermove', onMove);
      hit.addEventListener('pointerdown', onMove);
      hit.addEventListener('pointerleave', onLeave);
      U.clear(wrap);
      wrap.appendChild(root);
      wrap.appendChild(tip);
      tip.hidden = true;
    }
    const api = {
      el: wrap,
      redraw: draw,
      destroy: function () { if (ro) ro.disconnect(); }
    };
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(U.debounce(function () { if (wrap.clientWidth && Math.abs(width() - lastW) > 4) draw(); }, 120));
      ro.observe(wrap);
    }
    return api;
  }
  function yAxis(root, g, ticks, top, fmt) {
    ticks.forEach(function (v) {
      const y = g.t + g.ph - v / top * g.ph;
      root.appendChild(svg('line', { class: v === 0 ? 'lw-chart__axis' : 'lw-chart__grid', x1: g.l, x2: g.l + g.pw, y1: y, y2: y }));
      root.appendChild(svg('text', { class: 'lw-chart__tick', x: g.l - 6, y: y + 4, 'text-anchor': 'end' }, fmt(v)));
    });
  }
  function legend(items) {
    return el('div', { class: 'lw-legend' }, items.map(function (it) {
      return el('span', { class: 'lw-legend__item' }, el('i', { class: 'lw-legend__swatch lw-legend__swatch--' + it.kind, style: it.color ? { '--sw': it.color } : null }), it.label);
    }));
  }
  function metricCard(label, value, sub, state) {
    return el('div', { class: 'lw-metric' + (state ? ' is-' + state : '') },
      el('div', { class: 'lw-metric__label', text: label }),
      el('div', { class: 'lw-metric__value' }, value),
      sub ? el('div', { class: 'lw-metric__sub', text: sub }) : null);
  }
  function goalRow(ok, text) {
    return el('li', { class: 'lw-goal__item ' + (ok ? 'is-ok' : 'is-ng') }, markEl(ok), el('span', { text: text }));
  }
  function numInput(value, attrs, onChange) {
    const inp = el('input', Object.assign({ type: 'number', class: 'lw-num', inputmode: 'numeric', value: value === undefined || value === null ? '' : String(value) }, attrs || {}));
    inp.addEventListener('input', function () { onChange(inp.value === '' ? '' : Number(inp.value)); });
    return inp;
  }
  function fieldRow(label, control, unit, hint) {
    return el('label', { class: 'lw-field' },
      el('span', { class: 'lw-field__label', text: label }),
      el('span', { class: 'lw-field__control' }, control, unit ? el('span', { class: 'lw-field__unit', text: unit }) : null),
      hint ? el('span', { class: 'lw-field__hint', text: hint }) : null);
  }

  // ======================================================================
  // 11. sim: asg
  // ======================================================================
  const ASG_POLICIES = [
    { id: 'fixed', label: '固定', desc: '台数を固定します。スケーリングしません。' },
    { id: 'target', label: 'ターゲット追跡', desc: '平均使用率が目標値になるよう台数を自動調整します（スケールインは15分様子を見てから）。' },
    { id: 'step', label: 'ステップ', desc: '5分ごとに使用率を評価し、しきい値を超えたら決めた台数だけ増減します。' },
    { id: 'scheduled', label: 'スケジュール', desc: '決まった時刻に台数を切り替えます。需要の変化には反応しません。' },
    { id: 'predictive', label: '予測', desc: '需要パターンから60分先までを予測して事前に起動します（＋ターゲット追跡）。' }
  ];

  function mountAsg(container, step) {
    const d = deferred();
    const p = step.params || {};
    const start = p.start || {};
    const goal = step.goal || {};
    const cfg = {
      policy: 'fixed', desired: num(start.desired, 2), min: num(start.min, 1), max: num(start.max, 10), targetUtil: 60,
      steps: [{ kind: 'above', value: 70, count: 2 }, { kind: 'below', value: 30, count: 1 }],
      schedule: []
    };
    let runs = 0; let fails = 0; let assisted = false; let passed = false; let last = null;

    function toConfig() {
      return {
        policy: cfg.policy, desired: cfg.desired, min: cfg.min, max: cfg.max, targetUtil: cfg.targetUtil,
        steps: cfg.steps.map(function (s) { return s.kind === 'above' ? { above: s.value, add: s.count } : { below: s.value, remove: s.count }; }),
        schedule: cfg.schedule.map(function (s) { return { at: s.at, min: s.min }; })
      };
    }
    function loadConfig(c) {
      cfg.policy = c.policy === 'target' && c.predictive ? 'predictive' : (c.policy || 'fixed');
      ['desired', 'min', 'max', 'targetUtil'].forEach(function (k) { if (c[k] !== undefined && c[k] !== null) cfg[k] = c[k]; });
      if (Array.isArray(c.steps) && c.steps.length) {
        cfg.steps = c.steps.map(function (s) {
          return s.above !== undefined ? { kind: 'above', value: s.above, count: num(s.add, 1) } : { kind: 'below', value: s.below, count: num(s.remove, 1) };
        });
      }
      cfg.schedule = (c.schedule || []).map(function (s) { return { at: s.at, min: s.min }; });
    }

    const controls = el('div', { class: 'lw-sim__controls' });
    const out = el('div', { class: 'lw-sim__out' });
    const metrics = el('div', { class: 'lw-metrics' });
    const goalBox = el('div', { class: 'lw-goal' });
    const result = el('div', { class: 'lw-result-area' });
    const chart = chartFrame({
      label: '24時間の需要と稼働キャパシティ',
      draw: function (root, g) {
        const s = last.series;
        const peakD = Math.max.apply(null, s.demand);
        const peakC = Math.max.apply(null, s.capacity);
        const ax = niceTicks(Math.max(peakD, peakC) * 1.05, 4);
        const X = function (m) { return g.l + m / 1440 * g.pw; };
        const Y = function (v) { return g.t + g.ph - v / ax.top * g.ph; };
        yAxis(root, g, ax.ticks, ax.top, fmtNum);
        const hStep = g.pw < 420 ? 6 : 3;
        for (let h = 0; h <= 24; h += hStep) {
          root.appendChild(svg('text', { class: 'lw-chart__tick', x: X(h * 60), y: g.t + g.ph + 18, 'text-anchor': h === 24 ? 'end' : (h === 0 ? 'start' : 'middle') }, h + ':00'));
        }
        // 稼働キャパシティ（階段状の面）
        let area = 'M' + X(0) + ' ' + Y(0);
        let line = '';
        for (let m = 0; m < 1440; m++) {
          const y = Y(s.capacity[m]).toFixed(1);
          area += ' L' + X(m).toFixed(1) + ' ' + y + ' L' + X(m + 1).toFixed(1) + ' ' + y;
          line += (m ? ' L' : 'M') + X(m).toFixed(1) + ' ' + y + ' L' + X(m + 1).toFixed(1) + ' ' + y;
        }
        area += ' L' + X(1440) + ' ' + Y(0) + ' Z';
        root.appendChild(svg('path', { class: 'lw-chart__cap-area', d: area }));
        root.appendChild(svg('path', { class: 'lw-chart__cap-line', d: line }));
        // 過負荷区間（需要がキャパシティを超えた部分を赤で塗る）
        let m = 0;
        while (m < 1440) {
          if (!s.overload[m]) { m++; continue; }
          let e = m;
          while (e < 1440 && s.overload[e]) e++;
          let dpath = '';
          for (let k = m; k <= Math.min(e, 1439); k++) dpath += (k === m ? 'M' : ' L') + X(k).toFixed(1) + ' ' + Y(s.demand[k]).toFixed(1);
          for (let k = Math.min(e, 1439); k >= m; k--) dpath += ' L' + X(k).toFixed(1) + ' ' + Y(Math.min(s.capacity[k], s.demand[k])).toFixed(1);
          root.appendChild(svg('path', { class: 'lw-chart__over', d: dpath + ' Z' }));
          root.appendChild(svg('rect', { class: 'lw-chart__over-bar', x: X(m), y: g.t + g.ph + 1, width: Math.max(1.5, X(e) - X(m)), height: 4 }));
          m = e;
        }
        // 需要（線）
        let dl = '';
        for (let k = 0; k < 1440; k++) dl += (k ? ' L' : 'M') + X(k).toFixed(1) + ' ' + Y(s.demand[k]).toFixed(1);
        root.appendChild(svg('path', { class: 'lw-chart__demand', d: dl }));
        root.appendChild(svg('text', { class: 'lw-chart__unit', x: g.l, y: g.t - 1 }, 'req/s'));
        return function (ratio) {
          const mm = Math.min(1439, Math.floor(ratio * 1440));
          const warming = s.running[mm] - s.inService[mm];
          return {
            x: X(mm),
            html: '<strong>' + hm(mm) + '</strong>' +
              '<div><i class="lw-legend__swatch lw-legend__swatch--line"></i>需要 <b>' + fmtNum(s.demand[mm]) + '</b> req/s</div>' +
              '<div><i class="lw-legend__swatch lw-legend__swatch--area"></i>稼働 <b>' + fmtNum(s.capacity[mm]) + '</b> req/s（' + s.inService[mm] + '台' + (warming > 0 ? ' + 起動中' + warming + '台' : '') + '）</div>' +
              (s.overload[mm] ? '<div class="lw-chart__tip-ng">⚠ 過負荷（' + fmtNum(s.demand[mm] - s.capacity[mm]) + ' req/s 不足）</div>' : '')
          };
        };
      }
    });

    function rowsEditor(title, list, renderRow, makeNew, hint) {
      const box = el('div', { class: 'lw-rows' }, el('div', { class: 'lw-rows__title', text: title }));
      list.forEach(function (item, i) {
        box.appendChild(el('div', { class: 'lw-rows__row' }, renderRow(item),
          el('button', { class: 'lw-rows__del', type: 'button', 'aria-label': 'この行を削除', text: '✕', onClick: function () { list.splice(i, 1); renderControls(); } })));
      });
      if (hint && !list.length) box.appendChild(el('p', { class: 'lw-note', text: hint }));
      box.appendChild(el('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '＋ 行を追加', onClick: function () { list.push(makeNew()); renderControls(); } }));
      return box;
    }
    function scheduleEditor(optional) {
      return rowsEditor(optional ? 'スケジュール（任意・併用）' : 'スケジュール', cfg.schedule, function (s) {
        const time = el('input', { type: 'time', class: 'lw-time', value: s.at, 'aria-label': '時刻' });
        time.addEventListener('input', function () { s.at = time.value; });
        return [time, el('span', { class: 'lw-rows__txt', text: 'に最小' }),
          numInput(s.min, { min: 0, max: 99, 'aria-label': '最小台数' }, function (v) { s.min = v; }), el('span', { class: 'lw-rows__txt', text: '台' })];
      }, function () { return { at: '08:30', min: num(cfg.min, 1) }; },
      optional ? '決まった時刻に最小台数を引き上げて、急増の前に起動しておけます。' : '行を追加して、時刻ごとの台数を決めます。');
    }
    function renderControls() {
      U.clear(controls);
      const pol = ASG_POLICIES.find(function (x) { return x.id === cfg.policy; }) || ASG_POLICIES[0];
      controls.appendChild(el('div', { class: 'lw-seg', role: 'radiogroup', 'aria-label': 'スケーリングポリシー' }, ASG_POLICIES.map(function (x) {
        return el('button', {
          class: 'lw-seg__btn' + (x.id === cfg.policy ? ' is-active' : ''), type: 'button', role: 'radio', 'aria-checked': x.id === cfg.policy ? 'true' : 'false', text: x.label,
          onClick: function () { cfg.policy = x.id; sfx('select'); renderControls(); }
        });
      })));
      controls.appendChild(el('p', { class: 'lw-note', text: pol.desc }));
      const grid = el('div', { class: 'lw-fields' });
      const add = function (key, label, unit, attrs) {
        grid.appendChild(fieldRow(label, numInput(cfg[key], attrs, function (v) { cfg[key] = v; }), unit));
      };
      if (cfg.policy === 'fixed') add('desired', '希望台数', '台', { min: 0, max: 99 });
      else {
        add('min', cfg.policy === 'scheduled' ? '基本の台数（最小）' : '最小台数', '台', { min: 0, max: 99 });
        add('max', '最大台数', '台', { min: 0, max: 99 });
        if (cfg.policy === 'step') add('desired', '開始時の台数', '台', { min: 0, max: 99 });
        if (cfg.policy === 'target' || cfg.policy === 'predictive') add('targetUtil', '目標使用率', '%', { min: 5, max: 100, step: 5 });
      }
      controls.appendChild(grid);
      if (cfg.policy === 'step') {
        controls.appendChild(rowsEditor('ステップ調整（上から順に評価）', cfg.steps, function (s) {
          const sel = el('select', { class: 'lw-sel', 'aria-label': '条件' },
            el('option', { value: 'above', text: '使用率が次を超えたら' }), el('option', { value: 'below', text: '使用率が次を下回ったら' }));
          sel.value = s.kind;
          const act = el('span', { class: 'lw-rows__txt', text: s.kind === 'above' ? '台 追加' : '台 削除' });
          sel.addEventListener('change', function () { s.kind = sel.value; act.textContent = s.kind === 'above' ? '台 追加' : '台 削除'; });
          return [sel, numInput(s.value, { min: 0, max: 100, 'aria-label': 'しきい値（%）' }, function (v) { s.value = v; }), el('span', { class: 'lw-rows__txt', text: '% →' }),
            numInput(s.count, { min: 1, max: 20, 'aria-label': '台数' }, function (v) { s.count = v; }), act];
        }, function () { return { kind: 'above', value: 80, count: 1 }; }));
      }
      if (cfg.policy === 'scheduled') controls.appendChild(scheduleEditor(false));
      if (cfg.policy === 'target' || cfg.policy === 'step' || cfg.policy === 'predictive') controls.appendChild(scheduleEditor(true));
      controls.appendChild(el('button', { class: 'btn btn--accent lw-sim__run', type: 'button', text: '▶ 実行（24時間をシミュレーション）', onClick: function () { run(true); } }));
    }
    function renderOut() {
      const r = last;
      U.clear(metrics);
      metrics.appendChild(metricCard('過負荷', [String(r.overloadMin), el('small', { text: ' 分' })], '目標 ' + num(goal.maxOverloadMin, 0) + '分以下', r.overloadOk ? 'ok' : 'ng'));
      metrics.appendChild(metricCard('1日のコスト', [fmtUsd(r.dailyCost, 2)], '目標 ' + fmtUsd(num(goal.maxDailyCost, 0), 2) + ' 以下', r.costOk ? 'ok' : 'ng'));
      metrics.appendChild(metricCard('平均使用率', [String(r.avgUtil), el('small', { text: ' %' })], '稼働キャパシティに対する割合'));
      metrics.appendChild(metricCard('ピーク台数', [String(r.peakInstances), el('small', { text: ' 台' })], '起動中を含む'));
      U.clear(goalBox);
      goalBox.appendChild(el('div', { class: 'lw-goal__title', text: r.pass ? '目標達成！' : '目標チェック' }));
      goalBox.appendChild(el('ul', { class: 'lw-goal__list' },
        goalRow(r.overloadOk, '過負荷 ' + r.overloadMin + '分（目標: ' + num(goal.maxOverloadMin, 0) + '分以下）'),
        goalRow(r.costOk, '1日のコスト ' + fmtUsd(r.dailyCost, 2) + '（目標: ' + fmtUsd(num(goal.maxDailyCost, 0), 2) + ' 以下）')));
      goalBox.classList.toggle('is-pass', !!r.pass);
      chart.redraw();
    }
    function run(byUser) {
      last = E.asgSimulate(p, toConfig(), goal);
      renderOut();
      if (!byUser) return;
      runs += 1;
      if (last.pass) {
        sfx('success');
        if (!passed) {
          passed = true;
          U.clear(result).appendChild(resultBox('ok', assisted ? '目標達成（参考設定を使用）' : '目標達成！', U.md(step.explain || '')));
          d.resolve({ ok: !assisted, score: assisted ? 0.5 : 1, total: 1 });
        }
      } else {
        sfx('error');
        fails += 1;
        if (!passed) {
          const tips = [];
          if (!last.overloadOk) tips.push('過負荷が残っています。急増の**前に**台数を確保できる方法（スケジュール併用・予測）や最大台数を見直しましょう。');
          if (!last.costOk) tips.push('コストが目標を超えています。需要が少ない時間帯の台数を減らせないか確認しましょう。');
          U.clear(result).appendChild(resultBox('warn', '目標未達です。設定を変えて再実行しましょう', U.md(tips.join('\n\n'))));
        }
      }
    }

    const root = el('div', { class: 'lw lw-sim lw-sim--asg' }, promptEl(step),
      el('div', { class: 'lw-sim__info' },
        el('span', { class: 'lw-pill', text: '需要: ' + (PROFILE_LABEL[p.profile] || PROFILE_LABEL.office) }),
        el('span', { class: 'lw-pill', text: '1台あたり ' + fmtNum(num(p.capacityPerInstance, 100)) + ' req/s' }),
        el('span', { class: 'lw-pill', text: fmtUsd(num(p.hourlyCost, 0.1), 3).replace(/0$/, '') + ' / 台・時（学習用の概算値）' }),
        el('span', { class: 'lw-pill', text: '起動に ' + num(p.warmupMin, 5) + ' 分' })),
      el('div', { class: 'lw-sim__layout' },
        el('section', { class: 'lw-panel' }, el('h4', { class: 'lw-subtitle', text: 'スケーリング設定' }), controls),
        el('section', { class: 'lw-panel lw-sim__main' },
          el('h4', { class: 'lw-subtitle', text: '24時間の需要と稼働キャパシティ' }),
          legend([{ kind: 'line', label: '需要（req/s）' }, { kind: 'area', label: '稼働キャパシティ' }, { kind: 'over', label: '過負荷（処理しきれない分）' }]),
          chart.el, metrics, goalBox, out)),
      result);
    renderControls();
    container.appendChild(root);
    run(false);

    return {
      done: d.promise,
      waitLabel: '目標を達成すると進めます',
      hint: function () {
        if (fails < 3 || !step.reference) {
          U.toast(step.reference ? 'まずは自分で試しましょう。目標未達があと' + (3 - fails) + '回で参考設定を読み込めます。' : 'ポリシーを切り替えてグラフの変化を比べましょう。', 'info');
          return;
        }
        assisted = true;
        loadConfig(step.reference);
        renderControls();
        U.toast('参考設定を読み込みました。「実行」で確認しましょう（半分の得点）。', 'info');
      },
      destroy: function () { chart.destroy(); root.remove(); },
      _load: function (c) { loadConfig(c); renderControls(); run(true); }
    };
  }

  // ======================================================================
  // 12. sim: s3cost
  // ======================================================================
  function mountS3(container, step) {
    const d = deferred();
    const p = step.params || {};
    const goal = Object.assign({ retrievalRequirement: p.retrievalRequirement }, step.goal || {});
    const prices = Object.assign({}, S3_PRICES, p.prices || {});
    const rules = { transitions: [], expirationDays: '' };
    let fails = 0; let assisted = false; let passed = false; let last = null;

    const builder = el('div', { class: 'lw-s3__builder' });
    const messages = el('div', { class: 'lw-s3__msgs' });
    const metrics = el('div', { class: 'lw-metrics' });
    const goalBox = el('div', { class: 'lw-goal' });
    const legendBox = el('div');
    const result = el('div', { class: 'lw-result-area' });
    const months = U.clamp(Math.round(num(p.months, 12)), 1, 240);

    const chart = chartFrame({
      label: '月ごとのストレージコスト',
      draw: function (root, g) {
        const rows = last.monthly;
        const n = rows.length;
        const peak = rows.reduce(function (mx, r) { return Math.max(mx, r.total, r.baseline); }, 0);
        const ax = niceTicks(peak * 1.05 || 1, 4);
        const band = g.pw / n;
        const bw = Math.max(1.5, Math.min(26, band - (band > 6 ? 2 : 0.5)));
        const X = function (i) { return g.l + i * band + (band - bw) / 2; };
        const Y = function (v) { return g.t + g.ph - v / ax.top * g.ph; };
        yAxis(root, g, ax.ticks, ax.top, function (v) { return fmtUsd(v, 0); });
        const every = n <= 12 ? 1 : n <= 24 ? 3 : n <= 60 ? 6 : 12;
        rows.forEach(function (r, i) {
          if ((i + 1) % every === 0 || i === 0) {
            root.appendChild(svg('text', { class: 'lw-chart__tick', x: X(i) + bw / 2, y: g.t + g.ph + 18, 'text-anchor': 'middle' }, String(i + 1)));
          }
          let acc = 0;
          const segs = S3_ORDER.map(function (cls) { return { key: cls, v: r.byClass[cls] || 0 }; }).concat([{ key: 'OTHER', v: r.other }]);
          segs.forEach(function (sg) {
            if (sg.v <= 0) return;
            const y1 = Y(acc + sg.v); const y0 = Y(acc);
            const h = Math.max(0.5, y0 - y1 - (y0 - y1 > 3 ? 1 : 0));
            root.appendChild(svg('rect', { class: 'lw-chart__bar lw-s3c--' + sg.key, x: X(i).toFixed(1), y: y1.toFixed(1), width: bw.toFixed(1), height: h.toFixed(1) }));
            acc += sg.v;
          });
        });
        // ベースライン（すべて Standard）
        let bl = '';
        rows.forEach(function (r, i) {
          const y = Y(r.baseline).toFixed(1);
          bl += (i ? ' L' : 'M') + (g.l + i * band).toFixed(1) + ' ' + y + ' L' + (g.l + (i + 1) * band).toFixed(1) + ' ' + y;
        });
        root.appendChild(svg('path', { class: 'lw-chart__baseline', d: bl }));
        root.appendChild(svg('text', { class: 'lw-chart__unit', x: g.l, y: g.t - 1 }, 'USD / 月'));
        root.appendChild(svg('text', { class: 'lw-chart__unit', x: g.l + g.pw, y: g.t + g.ph + 18, 'text-anchor': 'end', dx: 0, dy: 9 }, ''));
        return function (ratio) {
          const i = Math.min(n - 1, Math.floor(ratio * n));
          const r = rows[i];
          const lines = S3_ORDER.filter(function (cls) { return (r.byClass[cls] || 0) > 0; }).map(function (cls) {
            return '<div><i class="lw-legend__swatch lw-legend__swatch--bar lw-s3c--' + cls + '"></i>' + U.esc(S3_LABEL[cls]) + ' <b>' + fmtUsd(r.byClass[cls]) + '</b></div>';
          });
          if (r.other > 0) lines.push('<div><i class="lw-legend__swatch lw-legend__swatch--bar lw-s3c--OTHER"></i>移行リクエスト・早期削除 <b>' + fmtUsd(r.other) + '</b></div>');
          return {
            x: X(i) + bw / 2,
            html: '<strong>' + (i + 1) + 'か月目</strong>' + lines.join('') +
              '<div class="lw-chart__tip-sum">合計 <b>' + fmtUsd(r.total) + '</b> ／ すべてStandard <b>' + fmtUsd(r.baseline) + '</b></div>'
          };
        };
      }
    });

    function classSelect(t) {
      const sel = el('select', { class: 'lw-sel', 'aria-label': '移行先のストレージクラス' },
        S3_ORDER.slice(1).map(function (cls) { return el('option', { value: cls, text: S3_LABEL[cls] + '（' + cls + '）' }); }));
      sel.value = t.storageClass;
      sel.addEventListener('change', function () { t.storageClass = sel.value; });
      return sel;
    }
    function renderBuilder() {
      U.clear(builder);
      const box = el('div', { class: 'lw-rows' }, el('div', { class: 'lw-rows__title', text: '移行（Transition）' }));
      rules.transitions.forEach(function (t, i) {
        box.appendChild(el('div', { class: 'lw-rows__row' },
          el('span', { class: 'lw-rows__no', text: String(i + 1) }),
          el('span', { class: 'lw-rows__txt', text: '作成から' }),
          numInput(t.days, { min: 0, max: 36500, 'aria-label': '日数' }, function (v) { t.days = v; }),
          el('span', { class: 'lw-rows__txt', text: '日後に' }),
          classSelect(t),
          el('button', { class: 'lw-rows__del', type: 'button', 'aria-label': 'このルールを削除', text: '✕', onClick: function () { rules.transitions.splice(i, 1); renderBuilder(); } })));
      });
      if (!rules.transitions.length) box.appendChild(el('p', { class: 'lw-note', text: 'ルールがありません。すべて S3 Standard に置いたままの状態です。' }));
      box.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button', text: '＋ 移行ルールを追加',
        onClick: function () {
          const lastT = rules.transitions[rules.transitions.length - 1];
          const idx = lastT ? Math.min(S3_ORDER.length - 1, S3_ORDER.indexOf(lastT.storageClass) + 1) : 1;
          rules.transitions.push({ days: lastT ? num(lastT.days, 0) + 60 : 30, storageClass: S3_ORDER[idx] });
          renderBuilder();
        }
      }));
      builder.appendChild(box);
      builder.appendChild(el('div', { class: 'lw-rows' }, el('div', { class: 'lw-rows__title', text: '有効期限（Expiration・任意）' }),
        el('div', { class: 'lw-rows__row' },
          el('span', { class: 'lw-rows__txt', text: '作成から' }),
          numInput(rules.expirationDays, { min: 1, max: 36500, placeholder: 'なし', 'aria-label': '有効期限の日数' }, function (v) { rules.expirationDays = v; }),
          el('span', { class: 'lw-rows__txt', text: '日後に削除' }))));
      builder.appendChild(el('button', { class: 'btn btn--accent lw-sim__run', type: 'button', text: '▶ 計算（' + months + 'か月分）', onClick: function () { run(true); } }));
    }
    function renderOut() {
      const r = last;
      U.clear(messages);
      r.errors.forEach(function (m) { messages.appendChild(el('div', { class: 'lw-msg lw-msg--err' }, el('span', { class: 'lw-msg__icon', 'aria-hidden': 'true', text: '✗' }), el('span', { text: 'ルールエラー: ' + m }))); });
      r.warnings.forEach(function (m) { messages.appendChild(el('div', { class: 'lw-msg lw-msg--warn' }, el('span', { class: 'lw-msg__icon', 'aria-hidden': 'true', text: '!' }), el('span', { text: '注意: ' + m }))); });
      U.clear(metrics);
      metrics.appendChild(metricCard('削減率', [String(r.savingPct), el('small', { text: ' %' })], '目標 ' + num(goal.minSavingPct, 0) + '% 以上', r.errors.length ? 'ng' : (r.savingOk ? 'ok' : 'ng')));
      metrics.appendChild(metricCard(months + 'か月の合計', [fmtUsd(r.total, 0)], 'このライフサイクル設定'));
      metrics.appendChild(metricCard('ベースライン', [fmtUsd(r.baseline, 0)], 'すべて S3 Standard'));
      metrics.appendChild(metricCard('最も低温のクラス', [el('span', { class: 'lw-metric__text', text: S3_LABEL[r.coldest].replace(/^S3 /, '') })], '取り出し要件: ' + (REQ_LABEL[r.requirement] || r.requirement), r.retrievalOk ? 'ok' : 'ng'));
      U.clear(goalBox);
      goalBox.appendChild(el('div', { class: 'lw-goal__title', text: r.pass ? '目標達成！' : '目標チェック' }));
      goalBox.appendChild(el('ul', { class: 'lw-goal__list' },
        goalRow(!r.errors.length, r.errors.length ? 'ルールエラーが ' + r.errors.length + ' 件あります' : 'ルールは S3 の制約を満たしています'),
        goalRow(!r.errors.length && r.savingOk, '削減率 ' + r.savingPct + '%（目標: ' + num(goal.minSavingPct, 0) + '% 以上）'),
        goalRow(r.retrievalOk, '取り出し要件「' + (REQ_LABEL[r.requirement] || r.requirement) + '」' + (r.retrievalOk ? 'を満たします' : 'を満たせません（' + S3_LABEL[r.coldest] + ' では間に合いません）'))));
      goalBox.classList.toggle('is-pass', !!r.pass);
      const used = S3_ORDER.filter(function (cls) { return r.monthly.some(function (row) { return (row.byClass[cls] || 0) > 0; }); });
      const items = used.map(function (cls) { return { kind: 'bar lw-s3c--' + cls, label: S3_LABEL[cls] }; });
      if (r.monthly.some(function (row) { return row.other > 0; })) items.push({ kind: 'bar lw-s3c--OTHER', label: '移行リクエスト・早期削除' });
      items.push({ kind: 'dash', label: 'ベースライン（すべて S3 Standard）' });
      U.clear(legendBox).appendChild(legend(items));
      chart.redraw();
    }
    function run(byUser) {
      last = E.s3costSimulate(p, {
        transitions: rules.transitions.map(function (t) { return { days: t.days === '' ? NaN : t.days, storageClass: t.storageClass }; }),
        expirationDays: rules.expirationDays
      }, goal);
      renderOut();
      if (!byUser) return;
      if (last.pass) {
        sfx('success');
        if (!passed) {
          passed = true;
          U.clear(result).appendChild(resultBox('ok', assisted ? '目標達成（参考設定を使用）' : '目標達成！', U.md(step.explain || '')));
          d.resolve({ ok: !assisted, score: assisted ? 0.5 : 1, total: 1 });
        }
      } else {
        sfx('error');
        fails += 1;
        if (!passed) {
          const tips = [];
          if (last.errors.length) tips.push('まずルールエラーを解消しましょう。S3 のライフサイクルは **Standard → IA → アーカイブ** の一方通行で、IA 系は作成から30日以上が必要です。');
          else if (!last.savingOk) tips.push('削減率が足りません。アクセスされなくなる時期に合わせて、より安いクラスへ早めに移行できないか検討しましょう。');
          if (!last.retrievalOk) tips.push('取り出し要件を満たせません。アーカイブクラスは取り出しに時間がかかります。');
          U.clear(result).appendChild(resultBox('warn', '目標未達です。ルールを見直して再計算しましょう', U.md(tips.join('\n\n'))));
        }
      }
    }

    const priceTable = el('details', { class: 'lw-prices' },
      el('summary', { text: '料金表（学習用の概算値）' }),
      el('div', { class: 'lw-doc__table-wrap' }, el('table', { class: 'lw-doc__table' },
        el('thead', null, el('tr', null, ['ストレージクラス', '保存 USD/GB・月', '移行 USD/1,000件', '最小保存期間'].map(function (h) { return el('th', { text: h }); }))),
        el('tbody', null, S3_ORDER.map(function (cls) {
          return el('tr', null,
            el('td', null, el('i', { class: 'lw-legend__swatch lw-legend__swatch--bar lw-s3c--' + cls }), S3_LABEL[cls]),
            el('td', { class: 'num', text: String(prices[cls]) }),
            el('td', { class: 'num', text: S3_REQ[cls] ? String(S3_REQ[cls]) : '—' }),
            el('td', { class: 'num', text: S3_MIN_DAYS[cls] ? S3_MIN_DAYS[cls] + '日' : '—' }));
        })))),
      el('p', { class: 'lw-note', text: '金額はすべて学習用の概算値です。実際の料金はリージョンや時期で変わります。取り出し料金は計算に含めていません。' }));

    const root = el('div', { class: 'lw lw-sim lw-sim--s3' }, promptEl(step),
      el('div', { class: 'lw-sim__info' },
        el('span', { class: 'lw-pill', text: '初期データ ' + fmtNum(num(p.initialTB, 0)) + ' TB' }),
        el('span', { class: 'lw-pill', text: '毎月 +' + fmtNum(num(p.monthlyGrowthTB, 0)) + ' TB' }),
        el('span', { class: 'lw-pill', text: '平均オブジェクト ' + fmtNum(num(p.avgObjectKB, 1024)) + ' KB' }),
        el('span', { class: 'lw-pill lw-pill--req', text: '取り出し要件: ' + (REQ_LABEL[goal.retrievalRequirement] || '指定なし') })),
      p.accessNote ? el('div', { class: 'lw-s3__access', html: '<strong>アクセスパターン</strong>' + U.md(p.accessNote) }) : null,
      el('div', { class: 'lw-sim__layout' },
        el('section', { class: 'lw-panel' }, el('h4', { class: 'lw-subtitle', text: 'ライフサイクルルール' }), builder, priceTable),
        el('section', { class: 'lw-panel lw-sim__main' },
          el('h4', { class: 'lw-subtitle' }, '月ごとのストレージコスト ', el('span', { class: 'badge badge--warn', text: '学習用の概算値' })),
          legendBox, chart.el, el('p', { class: 'lw-chart__xlabel', text: '経過月数（か月目）' }), messages, metrics, goalBox)),
      result);
    renderBuilder();
    container.appendChild(root);
    run(false);

    return {
      done: d.promise,
      waitLabel: '目標を達成すると進めます',
      hint: function () {
        if (fails < 3 || !step.reference) {
          U.toast(step.reference ? 'まずは自分で試しましょう。目標未達があと' + (3 - fails) + '回で参考設定を読み込めます。' : '料金表と最小保存期間を見比べましょう。', 'info');
          return;
        }
        assisted = true;
        rules.transitions = (step.reference.transitions || []).map(function (t) { return { days: t.days, storageClass: t.storageClass }; });
        rules.expirationDays = step.reference.expirationDays || '';
        renderBuilder();
        U.toast('参考設定を読み込みました。「計算」で確認しましょう（半分の得点）。', 'info');
      },
      destroy: function () { chart.destroy(); root.remove(); },
      _load: function (r) {
        rules.transitions = (r.transitions || []).map(function (t) { return { days: t.days, storageClass: t.storageClass }; });
        rules.expirationDays = r.expirationDays || '';
        renderBuilder(); run(true);
      }
    };
  }

  W.sim = {
    mount: function (container, step, ctx) {
      if (step.sim === 'asg') return mountAsg(container, step, ctx);
      if (step.sim === 's3cost') return mountS3(container, step, ctx);
      const root = el('div', { class: 'lw' }, resultBox('warn', '未対応のシミュレーターです: ' + String(step.sim), ''));
      container.appendChild(root);
      return { done: Promise.resolve({ ok: true, score: 0, total: 0 }), destroy: function () { root.remove(); } };
    }
  };
  W['sim:asg'] = { mount: mountAsg };
  W['sim:s3cost'] = { mount: mountS3 };

  // ======================================================================
  // 13. 公開（open / 画面 / _test.solve は lab.js が差し替える）
  // ======================================================================
  const prev = SAA.labs || {};
  SAA.labs = {
    open: prev.open || function () { return Promise.resolve({ completed: false, score: 0, total: 0 }); },
    widgets: W,
    eval: E,
    _test: prev._test || {}
  };
})();
