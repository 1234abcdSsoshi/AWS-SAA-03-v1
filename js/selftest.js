/* セルフテスト：index.html?selftest=1 のときだけ動く。
   結果は <pre id="selftest-result"> に JSON で出力し、document.title を SELFTEST:PASS / SELFTEST:FAIL にする。
   ユーザーのデータを汚さないよう、開始時に saa03.* の localStorage を退避し、終了時に復元する。 */
(function () {
  'use strict';
  if (!/[?&]selftest=1(&|$)/.test(location.search)) return;

  const caught = [];
  window.addEventListener('error', function (e) {
    caught.push(String(e.message) + ' @ ' + (e.filename || '').split('/').slice(-2).join('/') + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    const r = e.reason;
    caught.push('unhandledrejection: ' + String((r && (r.stack || r.message)) || r).slice(0, 300));
  });

  const result = { pass: true, failures: [], checks: [], counts: {}, caughtErrors: caught };
  function ok(name, detail) { result.checks.push({ name: name, ok: true, detail: detail || '' }); }
  function fail(name, detail) {
    result.pass = false;
    const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
    result.checks.push({ name: name, ok: false, detail: d });
    result.failures.push(name + ': ' + String(d).slice(0, 600));
  }
  function withTimeout(p, ms, label) {
    return Promise.race([
      Promise.resolve(p),
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout: ' + label)); }, ms); })
    ]);
  }
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // ---- localStorage の退避と復元 ----
  const PREFIX = 'saa03.';
  let backup = null;
  function snapshot() {
    try {
      backup = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) backup[k] = localStorage.getItem(k);
      }
    } catch (e) { backup = null; }
  }
  function restore() {
    if (!backup) return;
    try {
      const now = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) now.push(k);
      }
      now.forEach(function (k) { if (!(k in backup)) localStorage.removeItem(k); });
      Object.keys(backup).forEach(function (k) { localStorage.setItem(k, backup[k]); });
    } catch (e) { /* noop */ }
  }

  async function check(name, fn) {
    try {
      const r = await fn();
      if (r === false) fail(name, 'returned false');
      else if (r && r.ok === false) fail(name, r.errors || r.message || r);
      else ok(name, r && r.detail ? r.detail : '');
    } catch (e) {
      fail(name, String((e && (e.stack || e.message)) || e).slice(0, 600));
    }
  }

  async function run() {
    const SAA = window.SAA;
    const D = SAA.data;
    const cur = D.curriculum;

    // 1. 登録エラー・件数
    await check('registration errors', function () {
      return SAA.errors.length ? { ok: false, errors: SAA.errors.slice(0, 20) } : true;
    });
    result.counts = {
      questions: D.questions.length,
      slides: D.slideOrder.length,
      glossary: D.glossary.length,
      labs: D.labOrder.length,
      stories: Object.keys(D.stories).length,
      assets: Object.keys(D.assets).length
    };
    await check('content counts', function () {
      const expectQ = Object.values(cur.groups).reduce(function (s, g) { return s + g.count; }, 0);
      const expectSlides = cur.chapters.reduce(function (s, c) { return s + c.slides.length; }, 0);
      const expectLabs = cur.chapters.reduce(function (s, c) { return s + c.labs.length; }, 0);
      const errs = [];
      if (D.questions.length !== expectQ) errs.push('questions ' + D.questions.length + '/' + expectQ);
      if (D.slideOrder.length !== expectSlides) errs.push('slides ' + D.slideOrder.length + '/' + expectSlides);
      if (D.labOrder.length !== expectLabs) errs.push('labs ' + D.labOrder.length + '/' + expectLabs);
      if (Object.keys(D.stories).length !== cur.chapters.length) errs.push('stories ' + Object.keys(D.stories).length + '/' + cur.chapters.length);
      if (D.glossary.length < 120) errs.push('glossary ' + D.glossary.length + ' (< 120)');
      return errs.length ? { ok: false, errors: errs } : true;
    });

    // 2. モジュールが実体に置き換わっているか
    await check('modules loaded', function () {
      const need = {
        'util._test.md': SAA.util && SAA.util._test && SAA.util._test.md,
        'assets._test.keys': SAA.assets && SAA.assets._test && SAA.assets._test.keys,
        'story._test.dryRun': SAA.story && SAA.story._test && SAA.story._test.dryRun,
        'quiz._test.check': SAA.quiz && SAA.quiz._test && SAA.quiz._test.check,
        'mock._test.grade': SAA.mock && SAA.mock._test && SAA.mock._test.grade,
        'labs._test.solve': SAA.labs && SAA.labs._test && SAA.labs._test.solve,
        'audio._test.renderAll': SAA.audio && SAA.audio._test && SAA.audio._test.renderAll,
        'memo._test.roundTrip': SAA.memo && SAA.memo._test && SAA.memo._test.roundTrip,
        'chat._test.offline': SAA.chat && SAA.chat._test && SAA.chat._test.offline,
        'Anthropic SDK': window.Anthropic
      };
      const missing = Object.keys(need).filter(function (k) { return typeof need[k] !== 'function'; });
      return missing.length ? { ok: false, errors: missing } : true;
    });

    // 3. 全画面の描画
    const screens = ['title', 'chapters', 'practice', 'mock', 'labs', 'notes', 'glossary', 'stats', 'gallery', 'sound', 'settings', 'assets'];
    for (const id of screens) {
      await check('screen:' + id, async function () {
        const before = caught.length;
        if (!SAA.screens[id]) return { ok: false, errors: 'screen not registered' };
        SAA.app.go(id);
        await sleep(120);
        const root = document.getElementById('screen-root');
        if (!root || !root.children.length) return { ok: false, errors: 'screen-root is empty' };
        if (caught.length > before) return { ok: false, errors: caught.slice(before) };
        return true;
      });
    }

    // 4. ストーリーの静的検証
    for (const ch of cur.chapters) {
      await check('story dryRun:' + ch.id, function () {
        const r = SAA.story._test.dryRun(ch.id);
        return r && r.ok ? { detail: r.steps + ' steps' } : { ok: false, errors: (r && r.errors || []).slice(0, 15) };
      });
    }

    // 5. 採点ロジック（全問）
    await check('quiz grading (all questions)', function () {
      const bad = [];
      D.questions.forEach(function (q) {
        if (!SAA.quiz._test.check(q, q.answer.slice())) bad.push(q.id + ': correct answer graded wrong');
        const wrong = q.options.map(function (_, i) { return i; }).filter(function (i) { return q.answer.indexOf(i) < 0; }).slice(0, q.answer.length);
        if (SAA.quiz._test.check(q, wrong)) bad.push(q.id + ': wrong answer graded correct');
      });
      return bad.length ? { ok: false, errors: bad.slice(0, 20) } : { detail: D.questions.length + ' questions' };
    });

    // 6. 問題コンポーネントのマウント（各グループの先頭1問）
    await check('quiz mount (one per group)', async function () {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;';
      document.body.appendChild(host);
      const bad = [];
      for (const gid of Object.keys(D.groups)) {
        const q = D.qById[D.groups[gid][0]];
        if (!q) continue;
        const before = caught.length;
        const box = document.createElement('div');
        host.appendChild(box);
        try {
          const ctl = SAA.quiz.mount(box, q, { mode: 'practice', shuffle: true, index: 1, total: 1 });
          await sleep(20);
          if (box.querySelectorAll('button').length < q.options.length) bad.push(q.id + ': too few buttons');
          if (ctl && ctl.destroy) ctl.destroy();
        } catch (e) { bad.push(q.id + ': ' + e.message); }
        if (caught.length > before) bad.push(q.id + ': ' + caught.slice(before).join(' | '));
        box.remove();
      }
      host.remove();
      return bad.length ? { ok: false, errors: bad } : true;
    });

    // 7. ラボ（作者の想定解で全ステップが正解判定になるか）
    for (const labId of D.labOrder) {
      await check('lab solve:' + labId, async function () {
        const r = await withTimeout(SAA.labs._test.solve(labId), 20000, labId);
        return r && r.ok ? true : { ok: false, errors: r && r.errors };
      });
    }

    // 8. 模擬試験の採点・統計
    await check('mock grade', function () {
      const qids = [].concat.apply([], cur.mockExams.mockA.groups.map(function (g) { return D.groups[g] || []; }));
      const answers = {};
      qids.forEach(function (id) { answers[id] = D.qById[id].answer.slice(); });
      const r = SAA.mock._test.grade(answers, qids);
      if (!r || Math.abs(r.rate - 1) > 1e-9) return { ok: false, errors: 'all-correct rate = ' + (r && r.rate) };
      const r0 = SAA.mock._test.grade({}, qids);
      if (!r0 || r0.rate !== 0) return { ok: false, errors: 'empty answers rate = ' + (r0 && r0.rate) };
      return { detail: qids.length + ' questions' };
    });
    await check('scaled score', function () {
      return SAA.stats.estimateScaled(0.72) === 720 && SAA.stats.estimateScaled(0) === 100;
    });

    // 9. メモ・チャット（オフライン）
    await check('memo roundTrip', function () { return SAA.memo._test.roundTrip(); });
    await check('chat offline answers', function () {
      const qs = ['gp3 と io2 の違いは？', 'NAT ゲートウェイのコストを下げたい', 'SQS の可視性タイムアウトって何？'];
      const bad = qs.filter(function (t) { const a = SAA.chat._test.offline(t); return !a || String(a).length < 40; });
      return bad.length ? { ok: false, errors: bad } : true;
    });
    await check('markdown renderer', function () {
      const html = SAA.util._test.md('**a** <b>x</b>\n- i\n\n| h | k |\n|---|---|\n| 1 | 2 |');
      return html.indexOf('<strong>a</strong>') >= 0 && html.indexOf('&lt;b&gt;') >= 0 && html.indexOf('<table') >= 0;
    });

    // 10. 音（オフラインレンダリング）
    await check('audio renderAll', async function () {
      if (typeof OfflineAudioContext === 'undefined' && typeof webkitOfflineAudioContext === 'undefined') return { detail: 'skipped (no OfflineAudioContext)' };
      const r = await withTimeout(SAA.audio._test.renderAll(), 120000, 'audio');
      return r && r.ok ? true : { ok: false, errors: r && r.errors };
    });

    // 11. ストーリー画面を実際に数ステップ進める（プロローグ）
    await check('story live (prologue first steps)', async function () {
      const before = caught.length;
      SAA.app.go('story', { chapter: 'prologue', step: 0 });
      await sleep(400);
      for (let i = 0; i < 6; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await sleep(150);
      }
      if (caught.length > before) return { ok: false, errors: caught.slice(before) };
      SAA.app.go('title');
      return true;
    });

    await check('no uncaught errors', function () {
      return caught.length ? { ok: false, errors: caught.slice(0, 20) } : true;
    });
  }

  function finish() {
    restore();
    const pre = document.createElement('pre');
    pre.id = 'selftest-result';
    pre.textContent = JSON.stringify(result, null, 2);
    pre.style.cssText = 'position:fixed;inset:auto 0 0 0;max-height:40vh;overflow:auto;background:#111;color:#0f0;font:12px monospace;z-index:9999;margin:0;padding:8px;';
    document.body.appendChild(pre);
    document.title = result.pass ? 'SELFTEST:PASS' : 'SELFTEST:FAIL';
  }

  window.addEventListener('DOMContentLoaded', function () {
    snapshot();
    setTimeout(function () {
      run().catch(function (e) { fail('selftest crashed', String(e && e.stack || e)); }).then(finish);
    }, 600);
  });
})();
