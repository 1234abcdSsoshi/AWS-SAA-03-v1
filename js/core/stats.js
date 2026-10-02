/* 学習記録：問題ごとの回答履歴・分野別集計・出題候補の選定・ラボ／模試の記録・ブックマーク */
(function () {
  'use strict';

  const SAA = window.SAA;
  const MAX_MOCKS = 30;

  function store() { return SAA.store; }
  function cur() { return SAA.data.curriculum || {}; }
  function meetsRate() { return (cur().exam && cur().exam.meetsRate) || 0.72; }

  function load() {
    let s = null;
    try { s = store().get('stats', null); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (!s.q || typeof s.q !== 'object') s.q = {};
    if (!s.labs || typeof s.labs !== 'object') s.labs = {};
    if (!Array.isArray(s.mocks)) s.mocks = [];
    return s;
  }
  function save(s) {
    try { store().set('stats', s); } catch (e) { /* noop */ }
  }
  function loadBookmarks() {
    let b = null;
    try { b = store().get('bookmarks', []); } catch (e) { b = []; }
    return Array.isArray(b) ? b : [];
  }

  function isMockGroup(g) { return String(g || '').indexOf('mock-') === 0; }
  function rateOf(e) { return e && e.n ? e.c / e.n : 0; }
  function needsDomain(d) {
    const dom = (cur().domains || []).find(function (x) { return x.id === d; });
    return !!(dom && dom.lastResult === 'needs');
  }
  function shuffle(a) {
    return SAA.util && SAA.util.shuffle ? SAA.util.shuffle(a) : a.slice().sort(function () { return Math.random() - 0.5; });
  }

  // ---- 記録 ----
  function record(qid, r) {
    if (!qid) return null;
    r = r || {};
    const s = load();
    const e = s.q[qid] || { n: 0, c: 0, last: 0, lastAt: 0, sel: [] };
    e.n += 1;
    if (r.correct) e.c += 1;
    e.last = r.correct ? 1 : 0;
    e.lastAt = Date.now();
    e.sel = Array.isArray(r.selected) ? r.selected.slice() : [];
    if (r.mode) e.mode = r.mode;
    s.q[qid] = e;
    save(s);
    return e;
  }
  function getQ(qid) {
    const e = load().q[qid];
    return e || null;
  }

  // ---- 集計 ----
  function aggregate(keyOf, keys) {
    const s = load();
    const out = {};
    keys.forEach(function (k) { out[k] = { n: 0, c: 0, rate: 0, answeredQ: 0, correctQ: 0, totalQ: 0 }; });
    SAA.data.questions.forEach(function (q) {
      const o = out[keyOf(q)];
      if (!o) return;
      o.totalQ += 1;
      const e = s.q[q.id];
      if (!e || !e.n) return;
      o.answeredQ += 1;
      if (e.last) o.correctQ += 1;
      o.n += e.n;
      o.c += e.c;
    });
    keys.forEach(function (k) { out[k].rate = out[k].n ? out[k].c / out[k].n : 0; });
    return out;
  }
  function byDomain() {
    return aggregate(function (q) { return q.domain; }, (cur().domains || []).map(function (d) { return d.id; }));
  }
  function byTask() {
    return aggregate(function (q) { return q.task; }, (cur().tasks || []).map(function (t) { return t.id; }));
  }
  function summary() {
    const s = load();
    const out = { answered: 0, total: SAA.data.questions.length, correct: 0, attempts: 0, correctQ: 0, rate: 0 };
    SAA.data.questions.forEach(function (q) {
      const e = s.q[q.id];
      if (!e || !e.n) return;
      out.answered += 1;
      out.attempts += e.n;
      out.correct += e.c;
      if (e.last) out.correctQ += 1;
    });
    out.rate = out.attempts ? out.correct / out.attempts : 0;
    return out;
  }
  function status(d) {
    const o = byDomain()[d];
    if (!o || o.answeredQ < 5) return 'nodata';
    return o.rate >= meetsRate() ? 'meets' : 'needs';
  }

  // 苦手な問題：直近で間違えたもの → 正答率が低いもの（前回「改善が必要」の分野を優先）
  function weakest(n) {
    const s = load();
    const list = SAA.data.questions.filter(function (q) {
      const e = s.q[q.id];
      return e && e.n && (e.last === 0 || e.c < e.n);
    });
    list.sort(function (a, b) {
      const ea = s.q[a.id]; const eb = s.q[b.id];
      if (ea.last !== eb.last) return ea.last - eb.last;
      const ra = rateOf(ea); const rb = rateOf(eb);
      if (ra !== rb) return ra - rb;
      const na = needsDomain(a.domain) ? 0 : 1; const nb = needsDomain(b.domain) ? 0 : 1;
      if (na !== nb) return na - nb;
      return (eb.lastAt || 0) - (ea.lastAt || 0);
    });
    return list.slice(0, n || 5).map(function (q) { return q.id; });
  }

  // ---- 出題候補 ----
  function hasItems(a) { return Array.isArray(a) && a.length > 0; }

  function pickQuestions(f) {
    f = f || {};
    const s = load();
    const marks = f.source === 'bookmarked' ? loadBookmarks() : null;
    const domains = hasItems(f.domains) ? f.domains.map(Number) : null;
    const tasks = hasItems(f.tasks) ? f.tasks.map(String) : null;
    const groups = hasItems(f.groups) ? f.groups : null;
    const random = f.order !== 'sequential';

    let pool = SAA.data.questions.filter(function (q) {
      if (isMockGroup(q.group) && !f.includeMock && !(groups && groups.indexOf(q.group) >= 0)) return false;
      if (groups && groups.indexOf(q.group) < 0) return false;
      if (domains && domains.indexOf(q.domain) < 0) return false;
      if (tasks && tasks.indexOf(String(q.task)) < 0) return false;
      const e = s.q[q.id];
      if (f.source === 'unanswered') return !e || !e.n;
      if (f.source === 'wrong') return !!(e && e.n && e.last === 0);
      if (f.source === 'bookmarked') return marks.indexOf(q.id) >= 0;
      return true;
    });

    if (f.source === 'weak') {
      // 1) 一度も正解していない／直近で不正解 2) 未回答の第3・4分野 3) 残りを正答率の低い順
      const t1 = []; const t2 = []; const t3 = [];
      pool.forEach(function (q) {
        const e = s.q[q.id];
        if (e && e.n && (e.c === 0 || e.last === 0)) t1.push(q);
        else if ((!e || !e.n) && needsDomain(q.domain)) t2.push(q);
        else t3.push(q);
      });
      const mix = function (a) { return random ? shuffle(a) : a; };
      const rest = mix(t3).map(function (q, i) { return { q: q, i: i, r: s.q[q.id] && s.q[q.id].n ? rateOf(s.q[q.id]) : -1 }; });
      rest.sort(function (a, b) { return a.r - b.r || a.i - b.i; });
      pool = mix(t1).concat(mix(t2), rest.map(function (x) { return x.q; }));
    } else if (random) {
      pool = shuffle(pool);
    }

    const count = Number(f.count) > 0 ? Number(f.count) : pool.length;
    return pool.slice(0, count).map(function (q) { return q.id; });
  }

  function estimateScaled(rate) {
    return Math.max(100, Math.round(1000 * (Number(rate) || 0)));
  }

  function chapterSummary(chapterId) {
    const ch = (cur().chapters || []).find(function (c) { return c.id === chapterId; });
    const out = { answered: 0, correct: 0, total: 0 };
    if (!ch) return out;
    const s = load();
    (ch.groups || []).forEach(function (g) {
      (SAA.data.groups[g] || []).forEach(function (qid) {
        out.total += 1;
        const e = s.q[qid];
        if (!e || !e.n) return;
        out.answered += 1;
        if (e.last) out.correct += 1;
      });
    });
    return out;
  }

  // ---- ラボ・模試 ----
  function recordLab(labId, r) {
    if (!labId) return;
    r = r || {};
    const s = load();
    s.labs[labId] = { done: true, score: Number(r.score) || 0, total: Number(r.total) || 0, at: Date.now() };
    save(s);
  }
  function labStatus(labId) { return load().labs[labId] || null; }

  function recordMock(result) {
    if (!result) return null;
    const s = load();
    const rec = Object.assign({ id: 'm' + Date.now(), at: Date.now() }, result);
    s.mocks.push(rec);
    if (s.mocks.length > MAX_MOCKS) s.mocks = s.mocks.slice(s.mocks.length - MAX_MOCKS);
    save(s);
    return rec;
  }
  function mocks() { return load().mocks; }

  // ---- ブックマーク ----
  function isBookmarked(qid) { return loadBookmarks().indexOf(qid) >= 0; }
  function toggleBookmark(qid) {
    const b = loadBookmarks();
    const i = b.indexOf(qid);
    if (i >= 0) b.splice(i, 1); else b.push(qid);
    try { store().set('bookmarks', b); } catch (e) { /* noop */ }
    return i < 0;
  }
  function bookmarks() { return loadBookmarks(); }

  SAA.stats = {
    record: record, getQ: getQ, summary: summary, byDomain: byDomain, byTask: byTask, status: status,
    weakest: weakest, pickQuestions: pickQuestions, estimateScaled: estimateScaled, chapterSummary: chapterSummary,
    recordLab: recordLab, labStatus: labStatus, recordMock: recordMock, mocks: mocks,
    toggleBookmark: toggleBookmark, isBookmarked: isBookmarked, bookmarks: bookmarks,
    _test: { isMockGroup: isMockGroup }
  };
})();
