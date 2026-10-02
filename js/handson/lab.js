/* ハンズオンラボ：全画面オーバーレイ（SAA.labs.open）・ラボ一覧画面（labs）・セルフテスト用フック */
(function () {
  'use strict';

  const U = SAA.util;
  const el = U.el;
  const L = SAA.labs;
  const E = L.eval;
  const W = L.widgets;
  const POINTS = 10;   // 採点対象ステップ1つあたりの配点

  const TYPE_LABEL = {
    brief: '読み物', choice: 'ミニ問題', terminal: 'ターミナル', slots: '構成図', calc: '計算',
    order: '並べ替え', match: '組み合わせ', verdict: '判定', sim: 'シミュレーター'
  };

  function sfx(id) {
    try { if (SAA.audio && SAA.audio.playSfx) SAA.audio.playSfx(id); } catch (e) { /* noop */ }
  }
  function plain(s) {
    return String(s || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/^\s*>\s?/gm, '').trim();
  }
  function isGraded(step) { return !!step && step.type !== 'brief'; }
  function starCount(score, total) {
    if (!total) return 3;
    const r = score / total;
    return r >= 0.9 ? 3 : r >= 0.6 ? 2 : r > 0 ? 1 : 0;
  }
  function starsEl(n, big) {
    return el('span', { class: 'lab-stars' + (big ? ' lab-stars--lg' : ''), 'aria-label': '評価 ' + n + '/3' },
      [0, 1, 2].map(function (i) { return el('span', { class: i < n ? 'is-on' : '', text: i < n ? '★' : '☆' }); }));
  }
  function labStatus(id) {
    try { return SAA.stats && SAA.stats.labStatus ? SAA.stats.labStatus(id) : null; } catch (e) { return null; }
  }

  // ======================================================================
  // 1. オーバーレイ
  // ======================================================================
  let active = null;   // { forceClose }

  function open(labId) {
    const lab = SAA.data.labs[labId];
    if (!lab || !Array.isArray(lab.steps)) {
      U.toast('このラボはまだ準備中です（' + labId + '）', 'warn');
      return Promise.resolve({ completed: false, score: 0, total: 0 });
    }
    if (active) active.forceClose();

    return new Promise(function (resolve) {
      const host = document.getElementById('overlay-root') || document.body;
      const steps = lab.steps;
      const prevBgm = SAA.audio && SAA.audio.currentBgm ? SAA.audio.currentBgm() : null;
      const prevCtx = SAA.getContext ? Object.assign({}, SAA.getContext()) : null;
      const prevFocus = document.activeElement;
      let idx = 0;
      let token = 0;
      let ctl = null;
      let stepDone = false;
      let results = [];
      let outcome = { completed: false, score: 0, total: 0 };
      let onResult = false;
      let closed = false;

      // ---- DOM ----
      const dots = el('ol', { class: 'lab-dots', 'aria-label': 'ステップの進捗' });
      const counter = el('span', { class: 'lab-head__count' });
      const body = el('div', { class: 'lab-body' });
      const hintBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: '💡 ヒント' });
      const skipBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: 'スキップ' });
      const primary = el('button', { class: 'btn btn--primary lab-foot__primary', type: 'button' });
      const footNote = el('span', { class: 'lab-foot__note' });
      const foot = el('footer', { class: 'lab-foot' }, el('div', { class: 'lab-foot__left' }, hintBtn, skipBtn), footNote, primary);
      const hasDock = SAA.dock && typeof SAA.dock.toggle === 'function';
      const overlay = el('div', { class: 'lab-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ハンズオンラボ: ' + lab.title },
        el('header', { class: 'lab-head' },
          el('div', { class: 'lab-head__main' },
            el('span', { class: 'lab-head__icon', 'aria-hidden': 'true', text: '🧪' }),
            el('div', { class: 'lab-head__titles' },
              el('span', { class: 'lab-head__eyebrow', text: 'ハンズオンラボ' }),
              el('h2', { class: 'lab-head__title', text: lab.title }))),
          el('div', { class: 'lab-head__progress' }, dots, counter),
          el('div', { class: 'lab-head__actions' },
            hasDock ? el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'メモ', title: 'メモ', text: '📝', onClick: function () { SAA.dock.toggle('memo'); } }) : null,
            hasDock ? el('button', { class: 'icon-btn', type: 'button', 'aria-label': '質問チャット', title: '質問チャット', text: '💬', onClick: function () { SAA.dock.toggle('chat'); } }) : null,
            el('button', { class: 'icon-btn lab-head__close', type: 'button', 'aria-label': 'ラボを閉じる', title: '閉じる', text: '✕', onClick: function () { requestClose(); } }))),
        body, foot);

      function setCtx(extra, reveal) {
        if (!SAA.setContext) return;
        SAA.setContext({
          kind: 'lab', key: 'lab:' + lab.id, id: lab.id, title: 'ラボ｜' + lab.title,
          summary: ('ハンズオンラボ「' + lab.title + '」\n' + plain(lab.scenario) + '\n\n' + extra).slice(0, 4000),
          reveal: !!reveal
        });
      }
      function renderDots() {
        U.clear(dots);
        steps.forEach(function (s, i) {
          const r = results[i];
          const cls = r ? ' is-' + r.status : (i === idx && !onResult ? ' is-current' : '');
          dots.appendChild(el('li', { class: 'lab-dot' + cls, title: (i + 1) + '. ' + (s.title || ''), 'aria-current': i === idx && !onResult ? 'step' : null },
            el('span', { class: 'sr-only', text: 'ステップ' + (i + 1) + (r ? '（' + ({ ok: '正解', partial: '一部正解', ng: '不正解', skip: 'スキップ', read: '完了' })[r.status] + '）' : '') })));
        });
        counter.textContent = onResult ? '結果' : (idx + 1) + ' / ' + steps.length;
      }
      function updateFooter() {
        const last = idx === steps.length - 1;
        hintBtn.hidden = !(ctl && ctl.hint) || stepDone;
        skipBtn.hidden = stepDone;
        footNote.textContent = '';
        if (stepDone) {
          primary.textContent = last ? '結果を見る ▶' : '次へ ▶';
          primary.disabled = false;
        } else if (ctl && ctl.check) {
          primary.textContent = ctl.checkLabel ? ctl.checkLabel() : 'チェック';
          primary.disabled = false;
        } else {
          primary.textContent = '次へ ▶';
          primary.disabled = true;
          footNote.textContent = (ctl && ctl.waitLabel) || '';
        }
      }
      function destroyCtl() {
        if (ctl && ctl.destroy) { try { ctl.destroy(); } catch (e) { console.error('[labs] destroy', e); } }
        ctl = null;
      }
      function showStep(i) {
        destroyCtl();
        idx = i;
        onResult = false;
        stepDone = false;
        token += 1;
        const my = token;
        const step = steps[i];
        U.clear(body);
        foot.hidden = false;
        body.appendChild(el('details', { class: 'lab-scenario', open: i === 0 ? true : null },
          el('summary', { class: 'lab-scenario__sum' }, el('span', { text: '📋 シナリオ・要件' }),
            el('span', { class: 'lab-scenario__meta' }, lab.domain ? U.domainBadge(lab.domain) : null, lab.task ? el('span', { class: 'badge', text: 'タスク ' + lab.task }) : null)),
          el('div', { class: 'lab-scenario__body', html: U.md(lab.scenario || lab.summary || '') })));
        const holder = el('div', { class: 'lab-step__widget' });
        body.appendChild(el('section', { class: 'lab-step lab-step--' + step.type },
          el('header', { class: 'lab-step__head' },
            el('span', { class: 'lab-step__no', text: 'STEP ' + (i + 1) }),
            el('h3', { class: 'lab-step__title', text: step.title || '' }),
            el('span', { class: 'badge badge--accent', text: TYPE_LABEL[step.type] || step.type })),
          holder));
        const widget = W[step.type];
        try {
          if (!widget) throw new Error('unknown widget: ' + step.type);
          ctl = widget.mount(holder, step, { lab: lab, index: i, sfx: sfx });
        } catch (e) {
          console.error('[labs] mount', e);
          holder.appendChild(el('p', { class: 'muted', text: 'このステップを表示できませんでした。スキップして進めます。' }));
          ctl = null;
        }
        if (ctl && ctl.done) {
          ctl.done.then(function (res) {
            if (my !== token || closed) return;
            stepDone = true;
            const graded = isGraded(step);
            const total = res && res.total ? res.total : 0;
            const ratio = total ? U.clamp(res.score / total, 0, 1) : 1;
            results[i] = {
              status: !graded ? 'read' : (ratio >= 1 ? 'ok' : ratio > 0 ? 'partial' : 'ng'),
              points: graded ? Math.round(ratio * POINTS) : 0, max: graded ? POINTS : 0
            };
            renderDots();
            updateFooter();
          });
        }
        renderDots();
        updateFooter();
        body.scrollTop = 0;
        setCtx('ステップ' + (i + 1) + '「' + (step.title || '') + '」\n' + plain(step.prompt || step.body || ''), false);
      }
      function next() {
        if (idx >= steps.length - 1) showResult();
        else { sfx('page'); showStep(idx + 1); }
      }
      function showResult() {
        destroyCtl();
        token += 1;
        onResult = true;
        let score = 0; let total = 0;
        steps.forEach(function (s, i) {
          if (!isGraded(s)) return;
          total += POINTS;
          score += results[i] ? results[i].points : 0;
        });
        outcome = { completed: true, score: score, total: total };
        try { if (SAA.stats && SAA.stats.recordLab) SAA.stats.recordLab(lab.id, { score: score, total: total }); } catch (e) { console.error('[labs] recordLab', e); }
        SAA.bus.emit('lab:completed', { labId: lab.id, score: score, total: total });
        const n = starCount(score, total);
        sfx(n >= 3 ? 'fanfare' : 'chapter_clear');
        U.clear(body);
        foot.hidden = true;
        const msg = n >= 3 ? '完璧です。この考え方は本番でもそのまま使えます。' : n === 2 ? 'あと一歩。解説を読み直して、もう一度挑戦してみましょう。' : 'まずは流れをつかめれば十分。まとめを読んでから再挑戦しましょう。';
        body.appendChild(el('section', { class: 'lab-result' },
          el('div', { class: 'lab-result__hero' },
            el('div', { class: 'lab-result__label', text: 'ラボ完了' }),
            starsEl(n, true),
            el('div', { class: 'lab-result__score' }, el('b', { text: String(score) }), el('span', { text: ' / ' + total + ' 点' })),
            el('p', { class: 'lab-result__msg', text: msg })),
          el('ol', { class: 'lab-result__steps' }, steps.map(function (s, i) {
            const r = results[i] || { status: 'skip', points: 0, max: isGraded(s) ? POINTS : 0 };
            const mark = { ok: '✓', partial: '△', ng: '✗', skip: '—', read: '✓' }[r.status];
            return el('li', { class: 'lab-result__step is-' + r.status },
              el('span', { class: 'lab-result__mark', 'aria-hidden': 'true', text: mark }),
              el('span', { class: 'lab-result__name', text: s.title || TYPE_LABEL[s.type] || '' }),
              el('span', { class: 'lab-result__pts', text: r.status === 'skip' ? 'スキップ' : (r.max ? r.points + ' / ' + r.max : '読了') }));
          })),
          lab.debrief ? el('div', { class: 'lab-debrief' },
            el('h3', { class: 'lab-debrief__title', text: '学びのまとめ' }),
            el('div', { class: 'lab-debrief__body', html: U.md(lab.debrief) })) : null,
          el('div', { class: 'lab-result__actions' },
            lab.debrief ? el('button', {
              class: 'btn btn--ghost', type: 'button', text: '📝 まとめをメモに追加',
              onClick: function () {
                SAA.bus.emit('memo:append', { text: plain(lab.debrief), title: 'ラボ｜' + lab.title, contextKey: 'lab:' + lab.id });
                U.toast('メモに追加しました', 'ok');
              }
            }) : null,
            el('button', { class: 'btn btn--ghost', type: 'button', text: '↻ もう一度', onClick: function () { results = []; showStep(0); } }),
            el('button', { class: 'btn btn--primary', type: 'button', text: '閉じる', onClick: function () { close(); } }))));
        renderDots();
        body.scrollTop = 0;
        setCtx('結果: ' + score + ' / ' + total + ' 点\nまとめ: ' + plain(lab.debrief), true);
      }

      primary.addEventListener('click', function () {
        if (stepDone) { next(); return; }
        if (ctl && ctl.check) {
          try { ctl.check(); } catch (e) { console.error('[labs] check', e); }
          updateFooter();
          const res = body.querySelector('.lw-result-area');
          if (res && res.firstChild && res.scrollIntoView) res.scrollIntoView({ block: 'nearest', behavior: U.prefersReducedMotion() ? 'auto' : 'smooth' });
        }
      });
      hintBtn.addEventListener('click', function () { if (ctl && ctl.hint) ctl.hint(); });
      skipBtn.addEventListener('click', function () {
        if (stepDone) return;
        results[idx] = { status: isGraded(steps[idx]) ? 'skip' : 'read', points: 0, max: isGraded(steps[idx]) ? POINTS : 0 };
        next();
      });

      // ---- 開閉 ----
      const onKey = function (e) {
        if (e.key !== 'Escape' || e.defaultPrevented || closed) return;
        if (U.hasModal && U.hasModal()) return;
        if (SAA.dock && SAA.dock.isOpen && SAA.dock.isOpen()) return;   // ドックを先に閉じさせる
        e.preventDefault();
        requestClose();
      };
      const onDockOpen = function () { overlay.classList.add('has-dock'); };
      const onDockClose = function () { overlay.classList.remove('has-dock'); };
      let asking = false;
      function requestClose() {
        if (closed || asking) return;
        if (onResult) { close(); return; }
        asking = true;
        U.confirm('ラボを中断しますか？ここまでの進み具合は保存されません。', { okLabel: '中断する', cancelLabel: '続ける', danger: true }).then(function (yes) {
          asking = false;
          if (yes) close();
        });
      }
      function close() {
        if (closed) return;
        closed = true;
        token += 1;
        destroyCtl();
        document.removeEventListener('keydown', onKey);
        SAA.bus.off('dock:open', onDockOpen);
        SAA.bus.off('dock:close', onDockClose);
        overlay.remove();
        document.body.classList.remove('lab-open');
        if (active && active.overlay === overlay) active = null;
        sfx('close');
        try {
          if (SAA.audio) {
            if (prevBgm && SAA.audio.playBgm) SAA.audio.playBgm(prevBgm);
            else if (SAA.audio.stopBgm) SAA.audio.stopBgm({ fade: 0.6 });
          }
        } catch (e) { /* noop */ }
        if (prevCtx && SAA.setContext) SAA.setContext(prevCtx);
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus(); } catch (e) { /* noop */ } }
        resolve(outcome);
      }

      active = { overlay: overlay, forceClose: close };
      host.appendChild(overlay);
      document.body.classList.add('lab-open');
      document.addEventListener('keydown', onKey);
      SAA.bus.on('dock:open', onDockOpen);
      SAA.bus.on('dock:close', onDockClose);
      if (SAA.dock && SAA.dock.isOpen && SAA.dock.isOpen()) onDockOpen();
      sfx('open');
      try { if (SAA.audio && SAA.audio.playBgm) SAA.audio.playBgm('handson'); } catch (e) { /* noop */ }
      showStep(0);
    });
  }

  // ======================================================================
  // 2. ラボ一覧画面
  // ======================================================================
  let screenRoot = null;

  function labCard(lab) {
    const st = labStatus(lab.id);
    const done = !!(st && st.done);
    const task = U.task ? U.task(lab.task) : null;
    return el('article', { class: 'card card--hover labs-card' + (done ? ' is-done' : ''), dataset: { lab: lab.id } },
      el('div', { class: 'labs-card__meta' },
        lab.domain ? U.domainBadge(lab.domain) : null,
        lab.task ? el('span', { class: 'badge', title: task ? task.name || task.title || '' : '', text: 'タスク ' + lab.task }) : null,
        U.stars(lab.difficulty),
        el('span', { class: 'labs-card__time', text: '⏱ 約' + (lab.estMinutes || 10) + '分' })),
      el('h3', { class: 'card__title labs-card__title', text: lab.title }),
      el('p', { class: 'labs-card__summary', html: U.mdInline(lab.summary || '') }),
      el('div', { class: 'labs-card__foot' },
        done
          ? el('span', { class: 'labs-card__status is-done' }, el('span', { class: 'badge badge--ok', text: '完了' }),
            el('span', { class: 'labs-card__score', text: (st.score || 0) + ' / ' + (st.total || 0) + ' 点' }), starsEl(starCount(st.score || 0, st.total || 0)))
          : el('span', { class: 'labs-card__status' }, el('span', { class: 'badge', text: '未挑戦' })),
        el('button', {
          class: 'btn ' + (done ? 'btn--ghost' : 'btn--primary') + ' btn--sm', type: 'button', text: done ? 'もう一度' : '開始 ▶',
          onClick: function () { start(lab.id); }
        })));
  }
  function start(id) {
    L.open(id).then(function () {
      if (screenRoot && document.contains(screenRoot)) renderList(screenRoot);
    });
  }
  function renderList(root) {
    U.clear(root);
    const D = SAA.data;
    const cur = D.curriculum;
    const ids = D.labOrder || [];
    const doneCount = ids.filter(function (id) { const s = labStatus(id); return s && s.done; }).length;
    root.appendChild(el('header', { class: 'screen-header' },
      el('div', { class: 'screen-header__main' },
        el('span', { class: 'screen-header__eyebrow', text: 'Hands-on Labs' }),
        el('h1', { class: 'screen-header__title', text: 'ハンズオンラボ' }),
        el('p', { class: 'screen-header__sub', text: '手を動かして、設計の「なぜ」を体で覚えましょう。ターミナル・構成図・シミュレーターで要件から最適解を導きます。' })),
      ids.length ? el('div', { class: 'labs-progress' }, el('b', { text: String(doneCount) }), ' / ' + ids.length + ' 完了') : null));
    if (!ids.length) {
      root.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-state__icon', 'aria-hidden': 'true', text: '🧪' }),
        el('h2', { class: 'empty-state__title', text: 'ラボはまだ登録されていません' }),
        el('p', { class: 'empty-state__text', text: 'ラボのデータが読み込まれると、ここに章ごとの一覧が表示されます。' })));
      return;
    }
    const used = {};
    const chapters = cur && cur.chapters ? cur.chapters : [];
    const addGroup = function (title, sub, list) {
      if (!list.length) return;
      root.appendChild(el('h2', { class: 'section-title' }, title, sub ? el('span', { class: 'section-title__aside', text: sub }) : null));
      root.appendChild(el('div', { class: 'card-grid card-grid--lg labs-grid' }, list.map(labCard)));
    };
    chapters.forEach(function (ch) {
      const list = [];
      (ch.labs || []).forEach(function (id) { if (D.labs[id] && !used[id]) { used[id] = true; list.push(D.labs[id]); } });
      ids.forEach(function (id) { if (!used[id] && D.labs[id].chapter === ch.id) { used[id] = true; list.push(D.labs[id]); } });
      addGroup(ch.title || ch.id, ch.sub || '', list);
    });
    addGroup('その他', '', ids.filter(function (id) { return !used[id]; }).map(function (id) { return D.labs[id]; }));
  }

  SAA.app.registerScreen('labs', {
    title: 'ハンズオンラボ',
    topbar: true,
    render: function (container, params) {
      screenRoot = el('div', { class: 'screen labs-screen' });
      container.appendChild(screenRoot);
      renderList(screenRoot);
      if (SAA.setContext) SAA.setContext({ kind: 'none' });
      if (params && params.lab && SAA.data.labs[params.lab]) start(params.lab);
    },
    leave: function () { screenRoot = null; }
  });

  // ======================================================================
  // 3. セルフテスト用：作者の想定解で全ステップが正解判定になるか
  // ======================================================================
  function solveStep(step, label, errors) {
    const bad = function (msg) { errors.push(label + ': ' + msg); };
    if (!step || !step.type) { bad('type がありません'); return; }
    const t = step.type;
    if (t === 'brief') {
      if (!step.body) bad('body が空です');
    } else if (t === 'choice') {
      const a = step.answer || [];
      if (!a.length || a.some(function (i) { return !(i >= 0 && i < (step.options || []).length); })) bad('answer が選択肢の範囲外です');
      else if (!E.choice(step, a.slice())) bad('answer が正解判定になりません');
    } else if (t === 'terminal') {
      if (!(step.tasks || []).length) bad('tasks が空です');
      (step.tasks || []).forEach(function (task, i) {
        if (!task.answer) bad('task' + (i + 1) + ' に answer がありません');
        else if (!E.terminal(task, task.answer)) bad('task' + (i + 1) + ' の answer が match を満たしません');
      });
    } else if (t === 'slots') {
      const zoneIds = (step.zones || []).map(function (z) { return z.id; });
      const pal = (step.palette || []).map(function (p) { return p.id; });
      const assign = {};
      (step.slots || []).forEach(function (s) {
        if (zoneIds.indexOf(s.zone) < 0) bad('slot ' + s.id + ' の zone が未定義です: ' + s.zone);
        (s.answer || []).forEach(function (id) { if (pal.indexOf(id) < 0) bad('slot ' + s.id + ' の answer が palette にありません: ' + id); });
        assign[s.id] = (s.answer || [])[0];
      });
      (step.zones || []).forEach(function (z) { if (z.parent && zoneIds.indexOf(z.parent) < 0) bad('zone ' + z.id + ' の parent が未定義です'); });
      if (!(step.slots || []).length || !E.slots(step, assign).ok) bad('answer の配置が正解判定になりません');
    } else if (t === 'calc') {
      if (!(step.fields || []).length) bad('fields が空です');
      (step.fields || []).forEach(function (f) { if (!E.calc(f, f.answer)) bad('field ' + f.id + ' の answer が正解判定になりません'); });
    } else if (t === 'order') {
      if (!((step.items || []).length >= 2) || !E.order(step.items, step.items.slice())) bad('items が正解判定になりません');
    } else if (t === 'match') {
      const rids = (step.right || []).map(function (r) { return r.id; });
      (step.left || []).forEach(function (l) {
        if (rids.indexOf((step.answer || {})[l.id]) < 0) bad('left ' + l.id + ' の answer が right にありません');
      });
      if (!(step.left || []).length || !E.match(step, step.answer || {}).ok) bad('answer が正解判定になりません');
    } else if (t === 'verdict') {
      const choices = step.choices && step.choices.length ? step.choices : ['許可', '拒否'];
      const ans = {};
      (step.cases || []).forEach(function (c) {
        if (choices.indexOf(c.answer) < 0) bad('case ' + c.id + ' の answer が choices にありません: ' + c.answer);
        ans[c.id] = c.answer;
      });
      if (!(step.cases || []).length || !E.verdict(step, ans).ok) bad('cases が正解判定になりません');
    } else if (t === 'sim') {
      if (!step.reference) { bad('reference がありません'); return; }
      if (step.sim === 'asg') {
        const r = E.asgSimulate(step.params, step.reference, step.goal || {});
        if (!r.pass) bad('reference が目標未達です（過負荷 ' + r.overloadMin + '分 / コスト $' + r.dailyCost + '）');
      } else if (step.sim === 's3cost') {
        const r = E.s3costSimulate(step.params, step.reference, step.goal || {});
        if (!r.pass) bad('reference が目標未達です（errors: ' + r.errors.join(' ') + ' / 削減率 ' + r.savingPct + '% / 取り出し ' + (r.retrievalOk ? 'OK' : 'NG') + '）');
      } else bad('未対応の sim: ' + step.sim);
    } else {
      bad('未対応の type: ' + t);
      return;
    }
    // 描画できるか（画面には出さない）
    const box = document.createElement('div');
    try {
      const c = W[t].mount(box, step, {});
      if (!c || !c.done || typeof c.done.then !== 'function') bad('widget が done を返しません');
      if (c && c.destroy) c.destroy();
    } catch (e) {
      bad('mount でエラー: ' + (e && e.message));
    }
  }

  function solve(labId) {
    const errors = [];
    const lab = SAA.data.labs[labId];
    if (!lab) return Promise.resolve({ ok: false, errors: ['lab not found: ' + labId] });
    if (!Array.isArray(lab.steps) || !lab.steps.length) errors.push('steps が空です');
    (lab.steps || []).forEach(function (step, i) {
      try { solveStep(step, 'step' + (i + 1) + '(' + (step && step.type) + ')', errors); } catch (e) { errors.push('step' + (i + 1) + ': ' + (e && e.message)); }
    });
    return Promise.resolve({ ok: errors.length === 0, errors: errors });
  }

  L.open = open;
  L._test = { solve: solve };
})();
