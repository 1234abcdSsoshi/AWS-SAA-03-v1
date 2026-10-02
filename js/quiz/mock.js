/* 模擬試験：モード選択 → 試験（タイマー・見直しフラグ・一覧）→ 結果（推定スコア・分野別判定・見直し）→ 履歴 */
(function () {
  'use strict';

  const SAA = window.SAA;
  const U = SAA.util;
  const el = U.el;
  const SESSION_KEY = 'mock.session';   // 中断した試験の再開用

  const MODES = {
    official: { id: 'official', icon: '🎓', title: '本番形式', planned: 65, minutes: 130, targets: { 1: 20, 2: 17, 3: 15, 4: 13 }, bank: 'mock',
      desc: '公式の出題比率（30 / 26 / 24 / 20%）で 65 問・130 分。本番と同じ条件で実力を測ります。' },
    weak: { id: 'weak', icon: '🎯', title: '弱点強化', planned: 65, minutes: 130, targets: { 1: 10, 2: 10, 3: 25, 4: 20 }, bank: 'story',
      desc: 'ストーリーの問題から、第3分野（高性能）と第4分野（コスト）を厚めに 65 問・130 分。' },
    mini: { id: 'mini', icon: '⏱', title: 'ミニ模試', planned: 20, minutes: 40, targets: { 1: 6, 2: 5, 3: 5, 4: 4 }, bank: 'mock',
      desc: '公式比率に近い 20 問・40 分。すきま時間の力試しに。' }
  };

  function cur() { return SAA.data.curriculum || { domains: [], exam: {}, mockExams: {} }; }
  function exam() { return cur().exam || {}; }
  function passScaled() { return exam().passScaled || 720; }
  function meetsRate() { return exam().meetsRate || 0.72; }
  function sfx(id) { try { SAA.audio.playSfx(id); } catch (e) { /* noop */ } }
  function bgm(id) {
    try { if (id) SAA.audio.playBgm(id); else SAA.audio.stopBgm({ fade: 0.6 }); } catch (e) { /* noop */ }
  }
  function currentBgm() { try { return SAA.audio.currentBgm ? SAA.audio.currentBgm() : null; } catch (e) { return null; } }
  function settings() { try { return SAA.store.getSettings(); } catch (e) { return {}; } }

  // ---------- 採点（純粋関数） ----------
  function grade(answers, qids) {
    answers = answers || {};
    const byDomain = {};
    (cur().domains || []).forEach(function (d) { byDomain[d.id] = { n: 0, c: 0 }; });
    let total = 0; let correct = 0;
    (qids || []).forEach(function (id) {
      const q = SAA.data.qById[id];
      if (!q) return;
      const ok = SAA.quiz._test.check(q, answers[id] || []);
      const o = byDomain[q.domain] || (byDomain[q.domain] = { n: 0, c: 0 });
      o.n += 1; total += 1;
      if (ok) { o.c += 1; correct += 1; }
    });
    return { rate: total ? correct / total : 0, byDomain: byDomain, total: total, correct: correct };
  }

  // ---------- 出題セットの作成 ----------
  function mockGroupIds(mockId) {
    const def = (cur().mockExams || {})[mockId] || (cur().mockExams || {}).mockA || { groups: [] };
    return def.groups || [];
  }
  function mockBank(mockId, d) {
    const out = [];
    mockGroupIds(mockId).forEach(function (g) {
      (SAA.data.groups[g] || []).forEach(function (id) { const q = SAA.data.qById[id]; if (q && q.domain === d) out.push(id); });
    });
    return out;
  }
  function storyBank(d) {
    return SAA.data.questions.filter(function (q) { return q.domain === d && String(q.group).indexOf('mock-') !== 0; }).map(function (q) { return q.id; });
  }
  function buildSet(modeId, mockId) {
    const mode = MODES[modeId] || MODES.official;
    let qids = [];
    let usedFallback = false;
    (cur().domains || []).forEach(function (dom) {
      const d = dom.id;
      const need = mode.targets[d] || 0;
      let pickd = [];
      if (mode.bank === 'story') {
        pickd = SAA.stats.pickQuestions({ domains: [d], source: 'weak', count: need, order: 'random' });
      } else {
        const mb = mockBank(mockId, d);
        if (mb.length >= need) pickd = U.shuffle(mb).slice(0, need);
        else {
          // 模試用の問題が足りない → ストーリーの問題から補う
          usedFallback = true;
          pickd = U.shuffle(storyBank(d)).slice(0, need);
          if (pickd.length < need) pickd = pickd.concat(U.shuffle(mb).slice(0, need - pickd.length));
        }
      }
      qids = qids.concat(pickd);
    });
    qids = U.shuffle(qids);
    const total = qids.length;
    const minutes = total >= mode.planned ? mode.minutes : Math.max(5, Math.round(mode.minutes * total / mode.planned));
    return { qids: qids, minutes: minutes, usedFallback: usedFallback, short: total < mode.planned };
  }
  function available(modeId, mockId) {
    const mode = MODES[modeId];
    let total = 0;
    const per = {};
    (cur().domains || []).forEach(function (dom) {
      const d = dom.id;
      const need = mode.targets[d] || 0;
      const mb = mockBank(mockId, d).length;
      const sb = storyBank(d).length;
      let n;
      if (mode.bank === 'story') n = Math.min(need, sb);
      else n = mb >= need ? need : Math.min(need, sb + mb);
      per[d] = n; total += n;
    });
    return { total: total, per: per, minutes: total >= mode.planned ? mode.minutes : Math.max(5, Math.round(mode.minutes * total / mode.planned)) };
  }

  // ---------- 実行中の状態 ----------
  let pendingStart = null;   // start() から mock 画面へ渡す resolve
  let screenFlow = null;     // mock 画面で動いているフロー

  function saveSession(S) {
    try {
      SAA.store.set(SESSION_KEY, {
        mockId: S.mockId, mode: S.mode, qids: S.qids, orders: S.orders, answers: S.answers, flagged: Object.keys(S.flagged),
        idx: S.idx, remaining: Math.max(0, Math.round((S.deadline - Date.now()) / 1000)), totalSec: S.totalSec, savedAt: Date.now()
      });
    } catch (e) { /* noop */ }
  }
  function loadSession() {
    let s = null;
    try { s = SAA.store.get(SESSION_KEY, null); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.qids) || !s.qids.length || !(s.remaining > 0)) return null;
    if (!s.qids.every(function (id) { return SAA.data.qById[id]; })) return null;
    return s;
  }
  function clearSession() { try { SAA.store.remove(SESSION_KEY); } catch (e) { /* noop */ } }

  /* フロー：host（画面のコンテナ or #overlay-root のレイヤー）の中で intro → exam → result を切り替える */
  function createFlow(host, ctx) {
    const flow = { host: host, ctx: ctx, exam: null, closed: false, prevBgm: currentBgm(), resolved: false };
    flow.resolve = function (v) {
      if (flow.resolved) return;
      flow.resolved = true;
      if (ctx.resolve) ctx.resolve(v);
    };
    flow.dispose = function () {
      if (flow.closed) return;
      flow.closed = true;
      if (flow.exam) stopExam(flow, true);
      flow.resolve(flow.result ? toResult(flow.result) : null);
    };
    return flow;
  }

  // ---------- イントロ ----------
  function renderIntro(flow) {
    const host = flow.host;
    const mockId = flow.ctx.mockId || 'mockA';
    U.clear(host);
    const root = el('div', { class: 'screen mk mk-intro' });
    host.appendChild(root);

    root.appendChild(el('header', { class: 'screen-header' },
      el('div', { class: 'screen-header__main' },
        el('span', { class: 'screen-header__eyebrow', text: 'Mock Exam' }),
        el('h1', { class: 'screen-header__title', text: '模擬試験' }),
        el('p', { class: 'screen-header__sub', text: '本番と同じく、試験中は正誤も解説も表示されません。終了後に推定スコアと分野別の判定を確認できます。' })),
      flow.ctx.fromStory ? el('div', { class: 'screen-header__actions' },
        el('button', { type: 'button', class: 'btn btn--ghost', text: '今は受けない', onClick: async function () {
          const ok = await U.confirm('模擬試験を受けずにストーリーへ戻りますか？（未受験として進みます）', { okLabel: '戻る' });
          if (ok) closeFlow(flow, null);
        } })) : null));

    const sess = loadSession();
    if (sess) {
      const m = MODES[sess.mode] || MODES.official;
      const done = sess.qids.filter(function (id) { return (sess.answers[id] || []).length; }).length;
      root.appendChild(el('section', { class: 'card mk-resume' },
        el('div', { class: 'mk-resume__main' },
          el('strong', { text: '中断した試験があります：' + m.title }),
          el('span', { text: '回答済み ' + done + ' / ' + sess.qids.length + ' 問・残り ' + U.fmtTime(sess.remaining) })),
        el('div', { class: 'btn-row' },
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '破棄する', onClick: function () { clearSession(); renderIntro(flow); } }),
          el('button', { type: 'button', class: 'btn btn--primary', text: '再開する ▶', onClick: function () { startExam(flow, sess.mode, sess); } }))));
    }

    const grid = el('div', { class: 'mk-modes' });
    Object.keys(MODES).forEach(function (id) {
      const m = MODES[id];
      const av = available(id, mockId);
      const short = av.total < m.planned;
      const dist = el('div', { class: 'mk-mode__dist' }, (cur().domains || []).map(function (d) {
        return el('span', { class: 'mk-mode__d', style: { '--dc': 'var(--c-d' + d.id + ')', flexGrow: String(Math.max(1, av.per[d.id])) }, title: 'D' + d.id + ' ' + d.short, text: 'D' + d.id + ' ' + av.per[d.id] });
      }));
      grid.appendChild(el('section', { class: 'card mk-mode mk-mode--' + id },
        el('div', { class: 'mk-mode__head' },
          el('span', { class: 'mk-mode__icon', 'aria-hidden': 'true', text: m.icon }),
          el('h2', { class: 'mk-mode__title', text: m.title }),
          el('span', { class: 'mk-mode__spec', text: av.total + '問・' + av.minutes + '分' })),
        el('p', { class: 'mk-mode__desc', text: m.desc }),
        dist,
        short ? el('p', { class: 'mk-mode__warn', text: '※ 問題データが不足しているため ' + av.total + ' 問（' + av.minutes + ' 分）で実施します。' }) : null,
        el('button', { type: 'button', class: 'btn btn--' + (id === 'official' ? 'primary' : 'soft') + ' btn--block', disabled: av.total === 0, text: 'この形式ではじめる ▶',
          onClick: function () { confirmStart(flow, id, av); } })));
    });
    root.appendChild(grid);

    root.appendChild(el('ul', { class: 'mk-rules' },
      el('li', { text: '合格ラインは 1000 点中 ' + passScaled() + ' 点。推定スコアは正答率からの目安です（本番は補整スコアリング）。' }),
      el('li', { text: 'あとで見直したい問題には「見直しフラグ」を付け、一覧からいつでも戻れます。' }),
      el('li', { text: '試験中はメモ・質問チャットで問題の内容を相談できません。' })));

    // 履歴
    const hist = SAA.stats.mocks().slice().reverse();
    root.appendChild(el('h2', { class: 'section-title', text: '受験履歴' }));
    if (!hist.length) {
      root.appendChild(el('div', { class: 'empty-state' },
        el('span', { class: 'empty-state__icon', text: '📝' }),
        el('strong', { class: 'empty-state__title', text: 'まだ受験履歴がありません' }),
        el('span', { class: 'empty-state__text', text: '模擬試験を終了すると、推定スコアと分野別の判定がここに残ります。' })));
    } else {
      root.appendChild(el('div', { class: 'table-wrap' }, el('table', { class: 'data-table mk-hist' },
        el('thead', null, el('tr', null, ['受験日時', '形式', '推定スコア', '正答率', '合否の目安', ''].map(function (h) { return el('th', { text: h }); }))),
        el('tbody', null, hist.map(function (r) {
          const pass = r.passed !== undefined ? r.passed : r.scaled >= passScaled();
          return el('tr', null,
            el('td', { text: U.fmtDate(r.at) }),
            el('td', { text: (MODES[r.mode] || MODES.official).title + (r.total ? '（' + r.total + '問）' : '') }),
            el('td', { class: 'num', text: String(r.scaled) }),
            el('td', { class: 'num', text: U.pct(r.rate) }),
            el('td', null, el('span', { class: 'badge badge--solid badge--' + (pass ? 'ok' : 'ng'), text: pass ? '合格圏' : '不合格圏' })),
            el('td', null, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '結果を見る', onClick: function () { renderResult(flow, r, { history: true }); } })));
        })))));
    }
    try { SAA.setContext({ kind: 'none' }); } catch (e) { /* noop */ }
  }

  function confirmStart(flow, modeId, av) {
    const m = MODES[modeId];
    const body = el('div', { class: 'mk-confirm' },
      el('p', { text: m.title + '（' + av.total + '問・' + av.minutes + '分）を開始します。' }),
      el('ul', null,
        el('li', { text: '開始するとタイマーが動きます。時間切れで自動的に採点されます。' }),
        el('li', { text: '途中で画面を離れても、同じ端末なら再開できます。' })));
    U.modal({
      title: '試験を開始しますか？', body: body,
      buttons: [
        { label: 'キャンセル', kind: 'ghost' },
        { label: '開始する', kind: 'primary', onClick: function () { clearSession(); startExam(flow, modeId, null); } }
      ]
    });
  }

  // ---------- 試験 ----------
  function startExam(flow, modeId, sess) {
    if (flow.closed) return;
    const mockId = flow.ctx.mockId || 'mockA';
    const mode = MODES[modeId] || MODES.official;
    let S;
    if (sess) {
      S = { mockId: sess.mockId || mockId, mode: mode.id, qids: sess.qids.slice(), orders: sess.orders || {}, answers: sess.answers || {}, flagged: {},
        idx: U.clamp(sess.idx || 0, 0, sess.qids.length - 1), totalSec: sess.totalSec || mode.minutes * 60, deadline: Date.now() + sess.remaining * 1000 };
      (sess.flagged || []).forEach(function (id) { S.flagged[id] = true; });
    } else {
      const set = buildSet(mode.id, mockId);
      if (!set.qids.length) { U.toast('出題できる問題がありません', 'warn'); return; }
      S = { mockId: mockId, mode: mode.id, qids: set.qids, orders: {}, answers: {}, flagged: {}, idx: 0, totalSec: set.minutes * 60, deadline: Date.now() + set.minutes * 60 * 1000 };
    }
    const shuffle = settings().shuffleOptions !== false;
    S.qids.forEach(function (id) {
      const q = SAA.data.qById[id];
      if (!Array.isArray(S.orders[id]) || S.orders[id].length !== q.options.length) {
        const base = q.options.map(function (_, i) { return i; });
        S.orders[id] = shuffle ? U.shuffle(base) : base;
      }
    });
    S.ctl = null; S.timer = null; S.modals = []; S.alarm10 = false; S.alarm1 = false;
    flow.exam = S;

    SAA.setMockActive(true);
    try { SAA.setContext({ kind: 'none' }); } catch (e) { /* noop */ }
    bgm('exam');
    sfx('chapter_start');

    const host = flow.host;
    U.clear(host);
    const timeEl = el('strong', { class: 'mk-time__v', text: '--:--' });
    const timeBox = el('div', { class: 'mk-time', role: 'timer', 'aria-label': '残り時間' }, el('span', { class: 'mk-time__label', text: '残り時間' }), timeEl);
    const posEl = el('span', { class: 'mk-pos' });
    const ansEl = el('span', { class: 'mk-ans' });
    const flagBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm mk-flag', 'aria-pressed': 'false' }, '🚩 ', el('span', { text: '見直しフラグ' }));
    const gridBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '▦ 一覧' });
    const body = el('div', { class: 'mk-exam__body' });
    const prevBtn = el('button', { type: 'button', class: 'btn btn--ghost', text: '◀ 前へ' });
    const nextBtn = el('button', { type: 'button', class: 'btn btn--accent', text: '次へ ▶' });
    const gridBtn2 = el('button', { type: 'button', class: 'btn btn--ghost mk-nav__grid', text: '▦ 一覧' });
    const endBtn = el('button', { type: 'button', class: 'btn btn--danger mk-nav__end', text: '試験を終了する' });
    const miniBar = el('div', { class: 'progress mk-exam__progress' }, el('div', { class: 'progress__bar' }));

    host.appendChild(el('div', { class: 'mk mk-exam' },
      el('div', { class: 'mk-bar' },
        el('div', { class: 'mk-bar__left' }, el('span', { class: 'mk-bar__title', text: mode.title }), posEl, ansEl),
        timeBox,
        el('div', { class: 'mk-bar__right' }, flagBtn, gridBtn),
        miniBar),
      body,
      el('div', { class: 'mk-nav' }, prevBtn, gridBtn2, nextBtn, el('span', { class: 'mk-nav__space' }), endBtn)));

    function answeredCount() { return S.qids.filter(function (id) { return (S.answers[id] || []).length; }).length; }
    function paintBar() {
      const id = S.qids[S.idx];
      posEl.innerHTML = '';
      posEl.appendChild(document.createTextNode('Q '));
      posEl.appendChild(el('b', { text: String(S.idx + 1) }));
      posEl.appendChild(document.createTextNode(' / ' + S.qids.length));
      const n = answeredCount();
      ansEl.textContent = '回答済み ' + n;
      miniBar.firstChild.style.width = (n / S.qids.length * 100) + '%';
      const on = !!S.flagged[id];
      flagBtn.classList.toggle('is-on', on);
      flagBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      prevBtn.disabled = S.idx === 0;
      nextBtn.disabled = S.idx === S.qids.length - 1;
    }
    function show(i) {
      S.idx = U.clamp(i, 0, S.qids.length - 1);
      if (S.ctl) { S.ctl.destroy(); S.ctl = null; }
      U.clear(body);
      const id = S.qids[S.idx];
      S.ctl = SAA.quiz.mount(body, SAA.data.qById[id], {
        mode: 'mock', order: S.orders[id], selected: S.answers[id] || [], index: S.idx + 1, total: S.qids.length,
        onChange: function (selArr) {
          if (selArr.length) S.answers[id] = selArr; else delete S.answers[id];
          paintBar();
          saveSession(S);
        },
        onEnter: function () { if (S.idx < S.qids.length - 1) show(S.idx + 1); }
      });
      paintBar();
      saveSession(S);
      try { body.scrollTop = 0; (flow.ctx.fromStory ? host : window).scrollTo({ top: 0 }); } catch (e) { /* noop */ }
    }
    S.show = show;

    function openGrid() {
      const wrap = el('div', { class: 'mk-grid-wrap' });
      const flaggedN = Object.keys(S.flagged).length;
      wrap.appendChild(el('p', { class: 'mk-grid__sum', text: '回答済み ' + answeredCount() + '・未回答 ' + (S.qids.length - answeredCount()) + '・見直しフラグ ' + flaggedN }));
      const grid = el('div', { class: 'mk-grid' });
      let m = null;
      S.qids.forEach(function (id, i) {
        const cls = ['mk-cell'];
        if ((S.answers[id] || []).length) cls.push('is-answered');
        if (S.flagged[id]) cls.push('is-flagged');
        if (i === S.idx) cls.push('is-current');
        grid.appendChild(el('button', { type: 'button', class: cls.join(' '), text: String(i + 1),
          'aria-label': '問題 ' + (i + 1) + ((S.answers[id] || []).length ? ' 回答済み' : ' 未回答') + (S.flagged[id] ? ' フラグあり' : ''),
          onClick: function () { show(i); if (m) m.close(); } }));
      });
      wrap.appendChild(grid);
      wrap.appendChild(el('div', { class: 'mk-legend' },
        el('span', null, el('i', { class: 'mk-cell is-answered' }), '回答済み'),
        el('span', null, el('i', { class: 'mk-cell' }), '未回答'),
        el('span', null, el('i', { class: 'mk-cell is-flagged' }), '見直しフラグ'),
        el('span', null, el('i', { class: 'mk-cell is-current' }), '表示中')));
      m = U.modal({ title: '問題一覧', body: wrap, wide: true, buttons: [{ label: '閉じる', kind: 'ghost' }] });
      S.modals.push(m);
    }

    function nums(list) {
      if (!list.length) return 'なし';
      const s = list.slice(0, 30).map(function (i) { return i + 1; }).join(', ');
      return s + (list.length > 30 ? ' ほか' : '');
    }
    function confirmEnd() {
      const un = []; const fl = [];
      S.qids.forEach(function (id, i) {
        if (!(S.answers[id] || []).length) un.push(i);
        if (S.flagged[id]) fl.push(i);
      });
      const bodyEl = el('div', { class: 'mk-confirm' },
        el('p', { text: '試験を終了して採点します。終了後は回答を変更できません。' }),
        el('dl', { class: 'mk-confirm__list' },
          el('dt', { class: un.length ? 'is-warn' : '', text: '未回答 ' + un.length + ' 問' }), el('dd', { text: nums(un) }),
          el('dt', { text: '見直しフラグ ' + fl.length + ' 問' }), el('dd', { text: nums(fl) })),
        un.length ? el('p', { class: 'mk-confirm__warn', text: '未回答の問題は不正解として採点されます。' }) : null);
      const m = U.modal({
        title: '試験を終了しますか？', body: bodyEl,
        buttons: [
          { label: '試験に戻る', kind: 'ghost' },
          { label: '終了して採点する', kind: 'danger', onClick: function () { finishExam(flow); } }
        ]
      });
      S.modals.push(m);
    }

    flagBtn.addEventListener('click', function () {
      const id = S.qids[S.idx];
      if (S.flagged[id]) delete S.flagged[id]; else S.flagged[id] = true;
      sfx('select');
      paintBar();
      saveSession(S);
    });
    gridBtn.addEventListener('click', openGrid);
    gridBtn2.addEventListener('click', openGrid);
    prevBtn.addEventListener('click', function () { show(S.idx - 1); });
    nextBtn.addEventListener('click', function () { show(S.idx + 1); });
    endBtn.addEventListener('click', confirmEnd);

    S.onKey = function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || U.isTyping(e) || U.hasModal()) return;
      if (e.key === 'ArrowLeft' && S.idx > 0) { e.preventDefault(); show(S.idx - 1); }
      else if (e.key === 'ArrowRight' && S.idx < S.qids.length - 1) { e.preventDefault(); show(S.idx + 1); }
    };
    document.addEventListener('keydown', S.onKey);

    function tick() {
      const remain = Math.max(0, Math.round((S.deadline - Date.now()) / 1000));
      timeEl.textContent = U.fmtTime(remain);
      timeBox.classList.toggle('is-warn', remain <= 600 && remain > 60);
      timeBox.classList.toggle('is-danger', remain <= 60);
      if (remain <= 600 && remain > 60 && !S.alarm10) { S.alarm10 = true; if (S.totalSec > 600) { sfx('alarm'); U.toast('残り 10 分です', 'warn'); } }
      if (remain <= 60 && remain > 0 && !S.alarm1) { S.alarm1 = true; S.alarm10 = true; sfx('alarm'); U.toast('残り 1 分です', 'warn'); }
      if (remain <= 0) {
        U.toast('時間切れです。採点します。', 'warn');
        finishExam(flow);
      }
    }
    // 再開時に既に閾値を過ぎていたら鳴らさない
    const r0 = Math.round((S.deadline - Date.now()) / 1000);
    if (r0 <= 600) S.alarm10 = true;
    if (r0 <= 60) S.alarm1 = true;
    S.timer = setInterval(tick, 500);
    show(S.idx);
    tick();
  }

  // 試験の後始末（abandon=true のときは採点せず、再開用データを残す）
  function stopExam(flow, abandon) {
    const S = flow.exam;
    if (!S) return;
    flow.exam = null;
    clearInterval(S.timer);
    document.removeEventListener('keydown', S.onKey);
    S.modals.forEach(function (m) { try { m.close(); } catch (e) { /* noop */ } });
    if (S.ctl) { S.ctl.destroy(); S.ctl = null; }
    SAA.setMockActive(false);
    if (abandon) {
      saveSession(S);
      if (!flow.ctx.fromStory) bgm(flow.prevBgm && flow.prevBgm !== 'exam' ? flow.prevBgm : null);
    }
  }

  function finishExam(flow) {
    const S = flow.exam;
    if (!S) return;
    const durationSec = U.clamp(Math.round(S.totalSec - (S.deadline - Date.now()) / 1000), 0, S.totalSec);
    stopExam(flow, false);
    clearSession();

    const g = grade(S.answers, S.qids);
    const scaled = SAA.stats.estimateScaled(g.rate);
    const rec = {
      id: 'm' + Date.now(), mockId: S.mockId, mode: S.mode, at: Date.now(),
      rate: g.rate, scaled: scaled, passed: scaled >= passScaled(), total: g.total, correct: g.correct,
      byDomain: g.byDomain, durationSec: durationSec, totalSec: S.totalSec,
      answers: S.answers, flagged: Object.keys(S.flagged), qids: S.qids, orders: S.orders
    };
    // 回答した問題だけ学習記録に反映する（未回答は採点上のみ不正解）
    S.qids.forEach(function (id) {
      const selArr = S.answers[id] || [];
      if (!selArr.length) return;
      try { SAA.stats.record(id, { correct: SAA.quiz._test.check(SAA.data.qById[id], selArr), selected: selArr, mode: 'mock' }); } catch (e) { /* noop */ }
    });
    try { SAA.stats.recordMock(rec); } catch (e) { console.error(e); }
    flow.result = rec;
    SAA.bus.emit('mock:finished', rec);
    renderResult(flow, rec, { fresh: true });
  }

  // ---------- 結果 ----------
  function verdict(rec) {
    const pass = rec.passed !== undefined ? rec.passed : rec.scaled >= passScaled();
    if (pass) return { cls: 'is-pass', label: '合格圏', text: '合格ライン ' + passScaled() + ' 点を上回っています。' };
    if (rec.scaled >= passScaled() - 70) return { cls: 'is-near', label: 'あと一歩', text: '合格ラインまで、あと ' + (passScaled() - rec.scaled) + ' 点です。' };
    return { cls: 'is-fail', label: '要復習', text: '合格ラインまで ' + (passScaled() - rec.scaled) + ' 点。弱点の分野から固めましょう。' };
  }
  function renComment(rec) {
    const pass = rec.passed !== undefined ? rec.passed : rec.scaled >= passScaled();
    let worst = null;
    (cur().domains || []).forEach(function (d) {
      const o = rec.byDomain && rec.byDomain[d.id];
      if (!o || !o.n) return;
      const r = o.c / o.n;
      if (!worst || r < worst.r) worst = { d: d, r: r };
    });
    if (pass) {
      return worst && worst.r < meetsRate()
        ? '合格圏だ。よくやった。ただし「' + worst.d.short + '」はまだ伸ばせる。そこを詰めれば本番はもっと楽になる。'
        : '文句なしだ。全分野で基準を超えている。本番でも同じように、要件と制約を拾っていけ。';
    }
    return '結果は結果だ。でも、ここで弱点が見えたのは収穫だ。' + (worst ? 'まずは「' + worst.d.short + '」の間違えた問題から、なぜ他の選択肢がダメなのかを確認しよう。' : '') + '大丈夫、まだ伸びる。';
  }

  function renderResult(flow, rec, o) {
    o = o || {};
    const host = flow.host;
    U.clear(host);
    const pass = rec.passed !== undefined ? rec.passed : rec.scaled >= passScaled();
    const v = verdict(rec);
    const mode = MODES[rec.mode] || MODES.official;
    const min = exam().scaledMin || 100; const max = exam().scaledMax || 1000;
    const pos = function (s) { return U.clamp((s - min) / (max - min) * 100, 0, 100); };
    const root = el('div', { class: 'screen mk mk-result ' + v.cls + (o.fresh ? ' is-pending' : '') });
    host.appendChild(root);

    root.appendChild(el('header', { class: 'screen-header' },
      el('div', { class: 'screen-header__main' },
        el('span', { class: 'screen-header__eyebrow', text: 'Score Report' }),
        el('h1', { class: 'screen-header__title', text: '模擬試験の結果' }),
        el('p', { class: 'screen-header__sub', text: mode.title + '（' + (rec.total || (rec.qids || []).length) + '問）・' + U.fmtDate(rec.at) }))));

    const scoreEl = el('strong', { class: 'mk-score__num', text: o.fresh ? '···' : String(rec.scaled) });
    const fill = el('div', { class: 'mk-scale__fill', style: { width: o.fresh ? '0%' : pos(rec.scaled) + '%' } });
    const badge = el('span', { class: 'mk-verdict', text: v.label });
    root.appendChild(el('section', { class: 'card mk-score' },
      el('div', { class: 'mk-score__main' },
        el('span', { class: 'mk-score__label', text: '推定スコア' }),
        el('div', { class: 'mk-score__row' }, scoreEl, el('span', { class: 'mk-score__max', text: '/ ' + max }), badge),
        el('p', { class: 'mk-score__text' }, el('b', { text: '合否の目安：' }), v.text)),
      el('div', { class: 'mk-scale' },
        el('div', { class: 'mk-scale__track' }, fill,
          el('div', { class: 'mk-scale__mark', style: { left: pos(passScaled()) + '%' } }, el('span', { text: '合格ライン ' + passScaled() }))),
        el('div', { class: 'mk-scale__ends' }, el('span', { text: String(min) }), el('span', { text: String(max) }))),
      el('div', { class: 'mk-score__facts' },
        fact('正答数', rec.correct + ' / ' + rec.total),
        fact('正答率', U.pct(rec.rate)),
        fact('所要時間', U.fmtTime(rec.durationSec) + (rec.totalSec ? ' / ' + U.fmtTime(rec.totalSec) : '')))));

    // 公式スコアレポート風の分野別テーブル
    const tbody = el('tbody');
    (cur().domains || []).forEach(function (d) {
      const s = rec.byDomain && rec.byDomain[d.id];
      const has = s && s.n > 0;
      const meets = has && s.c / s.n >= meetsRate();
      const cell = function (on, text) {
        return el('td', { class: 'mk-rep__cell' + (on ? ' is-on' : ''), style: on ? { '--dc': 'var(--c-d' + d.id + ')' } : null },
          on ? el('span', { class: 'mk-rep__fill' }, el('b', { text: text }), el('small', { text: s.c + ' / ' + s.n + '（' + U.pct(s.c / s.n) + '）' })) : null);
      };
      tbody.appendChild(el('tr', null,
        el('th', { scope: 'row', class: 'mk-rep__sec' }, el('span', { class: 'mk-rep__dot', style: { background: 'var(--c-d' + d.id + ')' } }), '第 ' + d.id + ' 分野: ' + d.name),
        el('td', { class: 'mk-rep__w', text: d.weight + '%' }),
        has ? cell(!meets, '改善が必要') : el('td', { class: 'mk-rep__cell mk-rep__none', colspan: '2', text: '出題なし' }),
        has ? cell(meets, '満たしている') : null));
    });
    root.appendChild(el('h2', { class: 'section-title' }, '分野別の成績', el('span', { class: 'section-title__aside', text: '基準：正答率 ' + U.pct(meetsRate()) + ' 以上' })));
    root.appendChild(el('div', { class: 'table-wrap' }, el('table', { class: 'data-table mk-rep' },
      el('thead', null, el('tr', null,
        el('th', { text: 'セクション' }), el('th', { text: 'スコアリングされた項目の %' }),
        el('th', { text: '改善が必要' }), el('th', { text: 'コンピテンシーを満たしている' }))),
      tbody)));

    root.appendChild(el('div', { class: 'speech mk-result__ren' }, U.charAvatar('ren'),
      el('div', { class: 'speech__bubble' }, el('span', { class: 'speech__name', text: '氷室 レン' }), el('p', { text: renComment(rec) }))));

    // 見直し
    const qids = rec.qids || Object.keys(rec.answers || {});
    const rows = qids.map(function (id, i) {
      const q = SAA.data.qById[id];
      if (!q) return null;
      const selArr = (rec.answers && rec.answers[id]) || [];
      return { no: i + 1, q: q, selected: selArr, correct: SAA.quiz._test.check(q, selArr), flagged: (rec.flagged || []).indexOf(id) >= 0, order: rec.orders && rec.orders[id] };
    }).filter(Boolean);
    const wrongN = rows.filter(function (r) { return !r.correct; }).length;
    const reviewBox = el('div', { class: 'mk-review', hidden: true });
    let reviewFilter = 'wrong';
    let reviewCtls = [];
    function renderReview() {
      reviewCtls.forEach(function (c) { c.destroy(); });
      reviewCtls = [];
      U.clear(reviewBox);
      const seg = el('div', { class: 'segmented' },
        [['wrong', '間違えた問題（' + wrongN + '）'], ['flagged', 'フラグ付き'], ['all', 'すべて（' + rows.length + '）']].map(function (x) {
          return el('button', { type: 'button', class: reviewFilter === x[0] ? 'is-active' : '', text: x[1], onClick: function () { reviewFilter = x[0]; renderReview(); } });
        }));
      reviewBox.appendChild(seg);
      const list = rows.filter(function (r) { return reviewFilter === 'all' || (reviewFilter === 'wrong' ? !r.correct : r.flagged); });
      if (!list.length) {
        reviewBox.appendChild(el('p', { class: 'mk-review__empty', text: reviewFilter === 'wrong' ? '間違えた問題はありません。お見事です。' : '該当する問題はありません。' }));
        return;
      }
      list.forEach(function (r) {
        const bodyEl = el('div', { class: 'mk-review__body' });
        let ctl = null;
        const det = el('details', { class: 'mk-review__item ' + (r.correct ? 'is-ok' : 'is-ng') },
          el('summary', { class: 'mk-review__sum' },
            el('span', { class: 'pr-list__mark', text: r.correct ? '✓' : '✗' }),
            el('span', { class: 'pr-list__no', text: 'Q' + r.no }),
            U.domainBadge(r.q.domain),
            el('span', { class: 'pr-list__topic' }, el('strong', { text: r.q.topic || r.q.id }), el('small', { text: r.q.id + (r.selected.length ? '' : '・未回答') + (r.flagged ? '・🚩' : '') }))),
          bodyEl);
        det.addEventListener('toggle', function () {
          if (det.open && !ctl) {
            ctl = SAA.quiz.mount(bodyEl, r.q, { mode: 'review', selected: r.selected, order: r.order, context: false });
            reviewCtls.push(ctl);
          }
        });
        reviewBox.appendChild(det);
      });
    }

    const reviewBtn = el('button', { type: 'button', class: 'btn btn--primary', text: '間違えた問題を見直す（' + wrongN + '問）', onClick: function () {
      reviewBox.hidden = !reviewBox.hidden;
      if (!reviewBox.hidden) {
        renderReview();
        try { reviewBox.scrollIntoView({ block: 'start', behavior: U.prefersReducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* noop */ }
      }
    } });
    const wrongIds = rows.filter(function (r) { return !r.correct; }).map(function (r) { return r.q.id; });
    const retryBtn = (!flow.ctx.fromStory && wrongIds.length) ? el('button', { type: 'button', class: 'btn btn--ghost', text: '間違えた問題を演習する', onClick: function () {
      SAA.app.go('practice', { qids: wrongIds });
    } }) : null;
    const closeBtn = el('button', { type: 'button', class: 'btn btn--ghost', text: o.history ? '一覧に戻る' : (flow.ctx.fromStory ? '閉じてストーリーへ ▶' : '閉じる'), onClick: function () {
      reviewCtls.forEach(function (c) { c.destroy(); });
      if (o.history) { renderIntro(flow); return; }
      closeFlow(flow, toResult(rec));
    } });
    root.appendChild(el('div', { class: 'btn-row mk-result__actions' }, reviewBtn, retryBtn, closeBtn));
    root.appendChild(reviewBox);
    root.appendChild(el('p', { class: 'mk-result__note', text: '※ 推定スコアは正答率 × 1000 の単純な目安です。本番は補整スコアリングで、分野ごとの合格ラインはありません。' }));
    try { (flow.ctx.fromStory ? host : window).scrollTo({ top: 0 }); } catch (e) { /* noop */ }

    if (!o.fresh) return;
    // ドラムロール → スコア発表
    bgm(null);
    sfx('drumroll');
    const revealScore = function () {
      if (flow.closed || !root.isConnected) return;
      root.classList.remove('is-pending');
      root.classList.add('is-revealed');
      scoreEl.textContent = String(rec.scaled);
      fill.style.width = pos(rec.scaled) + '%';
      if (pass) { sfx('fanfare'); bgm('victory'); setTimeout(function () { if (root.isConnected) sfx('stamp'); }, 700); }
      else { sfx('fail'); bgm('daily'); }
    };
    if (U.prefersReducedMotion()) { setTimeout(revealScore, 300); return; }
    const t0 = Date.now();
    const spin = setInterval(function () {
      if (!root.isConnected) { clearInterval(spin); return; }
      if (Date.now() - t0 >= 1700) { clearInterval(spin); revealScore(); return; }
      scoreEl.textContent = String(100 + Math.floor(Math.random() * 900));
    }, 70);
  }
  function fact(label, value) {
    return el('div', { class: 'mk-fact' }, el('span', { text: label }), el('strong', { text: value }));
  }
  function toResult(rec) {
    return Object.assign({}, rec, { rate: rec.rate, scaled: rec.scaled, passed: rec.passed, byDomain: rec.byDomain });
  }

  function closeFlow(flow, result) {
    if (flow.closed) return;
    if (flow.exam) stopExam(flow, true);
    flow.resolve(result);
    if (flow.ctx.fromStory) {
      flow.closed = true;
      flow.host.remove();
      return;
    }
    // 画面内：BGM を戻してイントロへ
    bgm(flow.prevBgm && ['exam', 'victory'].indexOf(flow.prevBgm) < 0 ? flow.prevBgm : null);
    flow.resolved = false;
    flow.result = null;
    flow.ctx.resolve = null;
    renderIntro(flow);
  }

  // ---------- 公開 API ----------
  function start(mockId, opts) {
    opts = opts || {};
    const id = mockId || 'mockA';
    if (opts.fromStory) {
      const overlay = document.getElementById('overlay-root') || document.body;
      const layer = el('div', { class: 'mk-layer', role: 'dialog', 'aria-modal': 'true', 'aria-label': '模擬試験' });
      overlay.appendChild(layer);
      return new Promise(function (resolve) {
        const flow = createFlow(layer, { mockId: id, fromStory: true, resolve: resolve });
        renderIntro(flow);
      });
    }
    return new Promise(function (resolve) {
      pendingStart = { mockId: id, resolve: resolve };
      try { SAA.app.go('mock', { mockId: id }); } catch (e) { console.error(e); }
      if (pendingStart) { pendingStart = null; resolve(null); } // 画面が描画されなかった
    });
  }

  SAA.app.registerScreen('mock', {
    title: '模擬試験',
    render: function (container, params) {
      const pend = pendingStart;
      pendingStart = null;
      if (screenFlow) screenFlow.dispose();
      screenFlow = createFlow(container, { mockId: (pend && pend.mockId) || (params && params.mockId) || 'mockA', fromStory: false, resolve: pend ? pend.resolve : null });
      renderIntro(screenFlow);
    },
    leave: function () {
      if (!screenFlow) return;
      const f = screenFlow;
      screenFlow = null;
      const hadExam = !!f.exam;
      f.dispose();
      if (!hadExam && f.result) bgm(f.prevBgm && ['exam', 'victory'].indexOf(f.prevBgm) < 0 ? f.prevBgm : null);
    }
  });

  SAA.mock = {
    start: start,
    _test: { grade: grade, buildSet: buildSet, available: available, modes: MODES }
  };
})();
