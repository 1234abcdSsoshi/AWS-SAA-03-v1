/* 問題演習画面：絞り込み → 連続出題 → 結果サマリー（見直し・間違えた問題だけ再挑戦） */
(function () {
  'use strict';

  const SAA = window.SAA;
  const U = SAA.util;
  const el = U.el;

  const SOURCES = [
    { id: 'all', label: 'すべて' },
    { id: 'unanswered', label: '未回答' },
    { id: 'wrong', label: '間違えた問題' },
    { id: 'bookmarked', label: 'ブックマーク' },
    { id: 'weak', label: '弱点優先' }
  ];
  const COUNTS = [{ id: 5, label: '5問' }, { id: 10, label: '10問' }, { id: 20, label: '20問' }, { id: 0, label: '全部' }];
  const ORDERS = [{ id: 'random', label: 'ランダム' }, { id: 'sequential', label: '順番通り' }];

  function cur() { return SAA.data.curriculum || { domains: [], tasks: [], groups: {} }; }
  function allDomains() { return cur().domains.map(function (d) { return d.id; }); }
  function defaults() {
    return { domains: allDomains(), tasks: [], groups: [], source: 'all', count: 10, order: 'random', includeMock: false };
  }

  let filter = null;      // 画面を離れても保持する絞り込み条件
  let view = null;        // 現在の描画状態 { container, seq, prevBgm, running }

  function sfx(id) { try { SAA.audio.playSfx(id); } catch (e) { /* noop */ } }
  function bgmStart() {
    if (!view) return;
    try {
      view.prevBgm = SAA.audio.currentBgm ? SAA.audio.currentBgm() : null;
      view.bgmOn = true;
      SAA.audio.playBgm('quiz');
    } catch (e) { /* noop */ }
  }
  function bgmRestore() {
    if (!view || !view.bgmOn) return;
    view.bgmOn = false;
    try {
      if (view.prevBgm && view.prevBgm !== 'quiz') SAA.audio.playBgm(view.prevBgm);
      else if (!view.prevBgm) SAA.audio.stopBgm({ fade: 0.6 });
    } catch (e) { /* noop */ }
  }

  function applyParams(params) {
    const d = defaults();
    if (!filter) filter = d;
    if (!params) return;
    const has = ['domains', 'tasks', 'groups', 'source', 'count', 'order', 'includeMock'].some(function (k) { return params[k] !== undefined; });
    if (!has) return;
    filter = d;
    if (Array.isArray(params.domains) && params.domains.length) filter.domains = params.domains.map(Number);
    if (Array.isArray(params.tasks) && params.tasks.length) {
      filter.tasks = params.tasks.map(String);
      // タスク指定だけで来た場合は、そのタスクの分野に合わせる
      if (!Array.isArray(params.domains) || !params.domains.length) {
        const ds = {};
        filter.tasks.forEach(function (t) { const task = U.task(t); if (task) ds[task.domain] = true; });
        if (Object.keys(ds).length) filter.domains = Object.keys(ds).map(Number);
      }
    }
    if (Array.isArray(params.groups) && params.groups.length) filter.groups = params.groups.slice();
    if (SOURCES.some(function (s) { return s.id === params.source; })) filter.source = params.source;
    if (params.count !== undefined) filter.count = params.count === 'all' ? 0 : Math.max(0, Number(params.count) || 0);
    else if (params.source && params.source !== 'all') filter.count = 0;
    if (params.order === 'sequential' || params.order === 'random') filter.order = params.order;
    if (params.includeMock !== undefined) filter.includeMock = !!params.includeMock;
  }

  // 分野ごとに「タスク指定があればそのタスクだけ、無ければ分野全体」
  function effectiveTasks(f) {
    const out = [];
    cur().tasks.forEach(function (t) {
      if (f.domains.indexOf(t.domain) < 0) return;
      const anyInDomain = f.tasks.some(function (id) { const x = U.task(id); return x && x.domain === t.domain; });
      if (!anyInDomain || f.tasks.indexOf(t.id) >= 0) out.push(t.id);
    });
    return out;
  }
  function query(f, count) {
    if (!f.domains.length) return [];
    return SAA.stats.pickQuestions({
      domains: f.domains, tasks: effectiveTasks(f), groups: f.groups, source: f.source,
      count: count, order: f.order, includeMock: f.includeMock
    });
  }
  function groupTitle(g) {
    const def = cur().groups && cur().groups[g];
    return def && def.title ? def.title : g;
  }

  // ---------- 絞り込み画面 ----------
  function renderFilter() {
    const c = view.container;
    view.running = false;
    U.clear(c);
    const byD = SAA.stats.byDomain();
    const root = el('div', { class: 'screen pr' });
    c.appendChild(root);

    root.appendChild(el('header', { class: 'screen-header' },
      el('div', { class: 'screen-header__main' },
        el('span', { class: 'screen-header__eyebrow', text: 'Practice' }),
        el('h1', { class: 'screen-header__title', text: '問題演習' }),
        el('p', { class: 'screen-header__sub', text: '分野・タスク・出題対象を選んで、解説つきで1問ずつ解きます。' }))));

    // プリセット
    const presets = [
      { icon: '🎯', title: '弱点集中（D3・D4）', sub: '高性能・コスト最適化を弱点優先で10問', set: function () { filter = Object.assign(defaults(), { domains: [3, 4], source: 'weak', count: 10 }); }, n: function () { return query(Object.assign(defaults(), { domains: [3, 4], source: 'weak' }), 0).length; } },
      { icon: '🔁', title: '間違えた問題を復習', sub: '直近で不正解だった問題をすべて', set: function () { filter = Object.assign(defaults(), { source: 'wrong', count: 0, includeMock: true }); }, n: function () { return query(Object.assign(defaults(), { source: 'wrong', includeMock: true }), 0).length; } },
      { icon: '🔖', title: 'ブックマーク', sub: 'あとで復習に入れた問題', set: function () { filter = Object.assign(defaults(), { source: 'bookmarked', count: 0, includeMock: true }); }, n: function () { return query(Object.assign(defaults(), { source: 'bookmarked', includeMock: true }), 0).length; } }
    ];
    root.appendChild(el('div', { class: 'pr-presets' }, presets.map(function (p) {
      const n = p.n();
      return el('button', {
        type: 'button', class: 'pr-preset', onClick: function () { sfx('select'); p.set(); renderFilter(); }
      },
      el('span', { class: 'pr-preset__icon', 'aria-hidden': 'true', text: p.icon }),
      el('span', { class: 'pr-preset__main' },
        el('strong', { class: 'pr-preset__title', text: p.title }),
        el('span', { class: 'pr-preset__sub', text: p.sub })),
      el('span', { class: 'pr-preset__count', text: n + '問' }));
    })));

    const card = el('section', { class: 'card pr-filter' });
    root.appendChild(card);

    // 分野
    const domRow = el('div', { class: 'pr-domains' });
    cur().domains.forEach(function (d) {
      const st = byD[d.id] || { answeredQ: 0, totalQ: 0, rate: 0, n: 0 };
      const input = el('input', { type: 'checkbox', checked: filter.domains.indexOf(d.id) >= 0 });
      input.addEventListener('change', function () {
        if (input.checked) { if (filter.domains.indexOf(d.id) < 0) filter.domains.push(d.id); }
        else {
          filter.domains = filter.domains.filter(function (x) { return x !== d.id; });
          filter.tasks = filter.tasks.filter(function (id) { const t = U.task(id); return t && t.domain !== d.id; });
        }
        filter.domains.sort();
        sfx('select');
        syncTasks();
        update();
      });
      domRow.appendChild(el('label', { class: 'pr-domain pr-domain--d' + d.id, style: { '--dc': 'var(--c-d' + d.id + ')' } },
        input,
        el('span', { class: 'pr-domain__box', 'aria-hidden': 'true' }),
        el('span', { class: 'pr-domain__main' },
          el('strong', { class: 'pr-domain__name', text: 'D' + d.id + ' ' + d.short }),
          el('span', { class: 'pr-domain__sub', text: st.n ? '正答率 ' + U.pct(st.rate) + '・' + st.answeredQ + '/' + st.totalQ + '問' : '未回答・全' + st.totalQ + '問' }))));
    });
    card.appendChild(field('分野', domRow));

    // タスク
    const taskBox = el('div', { class: 'pr-tasks' });
    const taskChips = [];
    cur().domains.forEach(function (d) {
      const row = el('div', { class: 'pr-tasks__row', style: { '--dc': 'var(--c-d' + d.id + ')' } },
        el('span', { class: 'pr-tasks__dom', text: 'D' + d.id }));
      const chips = el('div', { class: 'chip-row' });
      cur().tasks.filter(function (t) { return t.domain === d.id; }).forEach(function (t) {
        const chip = el('button', { type: 'button', class: 'chip pr-task', title: t.name, 'aria-pressed': 'false' },
          el('b', { text: t.id }), el('span', { class: 'pr-task__name', text: shortTask(t.name) }));
        chip.addEventListener('click', function () {
          const i = filter.tasks.indexOf(t.id);
          if (i >= 0) filter.tasks.splice(i, 1);
          else {
            filter.tasks.push(t.id);
            if (filter.domains.indexOf(d.id) < 0) { filter.domains.push(d.id); filter.domains.sort(); syncDomains(); }
          }
          sfx('select');
          syncTasks();
          update();
        });
        chips.appendChild(chip);
        taskChips.push({ t: t, chip: chip });
      });
      row.appendChild(chips);
      taskBox.appendChild(row);
    });
    card.appendChild(field('タスク', taskBox, '選ばなければ分野内のすべてのタスクから出題します。'));

    function syncTasks() {
      taskChips.forEach(function (x) {
        const on = filter.tasks.indexOf(x.t.id) >= 0;
        x.chip.classList.toggle('is-active', on);
        x.chip.classList.toggle('is-off', filter.domains.indexOf(x.t.domain) < 0);
        x.chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function syncDomains() {
      U.$$('.pr-domain input', domRow).forEach(function (inp, i) {
        inp.checked = filter.domains.indexOf(cur().domains[i].id) >= 0;
      });
    }

    // グループ指定（他画面から渡されたとき）
    if (filter.groups.length) {
      const gRow = el('div', { class: 'chip-row' },
        filter.groups.map(function (g) { return el('span', { class: 'chip is-active', text: groupTitle(g) }); }),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '指定を解除', onClick: function () { filter.groups = []; renderFilter(); } }));
      card.appendChild(field('対象グループ', gRow));
    }

    card.appendChild(field('出題対象', segmented(SOURCES, function () { return filter.source; }, function (v) { filter.source = v; update(); })));
    card.appendChild(el('div', { class: 'pr-filter__cols' },
      field('問題数', segmented(COUNTS, function () { return filter.count; }, function (v) { filter.count = v; update(); })),
      field('順番', segmented(ORDERS, function () { return filter.order; }, function (v) { filter.order = v; update(); }))));

    const mockInput = el('input', { type: 'checkbox', checked: !!filter.includeMock });
    mockInput.addEventListener('change', function () { filter.includeMock = mockInput.checked; update(); });
    card.appendChild(el('label', { class: 'switch pr-mock-switch' }, mockInput, el('span', { class: 'switch__track' }),
      el('span', { class: 'switch__label', text: '模擬試験の問題も含める' })));

    // 開始バー
    const countEl = el('strong', { class: 'pr-start__n' });
    const subEl = el('span', { class: 'pr-start__sub' });
    const startBtn = el('button', { type: 'button', class: 'btn btn--primary btn--lg', text: '演習をはじめる ▶', onClick: function () { start(); } });
    const resetBtn = el('button', { type: 'button', class: 'btn btn--ghost', text: '条件をリセット', onClick: function () { filter = defaults(); renderFilter(); } });
    root.appendChild(el('div', { class: 'pr-start' },
      el('div', { class: 'pr-start__info' }, el('span', { class: 'pr-start__label', text: '該当する問題' }), countEl, subEl),
      el('div', { class: 'btn-row' }, resetBtn, startBtn)));

    function update() {
      const n = query(filter, 0).length;
      const m = filter.count > 0 ? Math.min(filter.count, n) : n;
      countEl.textContent = n + ' 問';
      subEl.textContent = n ? '→ ' + m + ' 問を出題' : emptyReason();
      startBtn.disabled = n === 0;
    }
    function emptyReason() {
      if (!filter.domains.length) return '分野を1つ以上選んでください';
      if (filter.source === 'wrong') return '間違えた問題はありません';
      if (filter.source === 'bookmarked') return 'ブックマークした問題はありません（問題右上の 🔖 で追加）';
      if (filter.source === 'unanswered') return '未回答の問題はありません';
      return '条件に合う問題がありません';
    }
    syncTasks();
    update();
  }

  function shortTask(name) {
    return String(name).replace(/を(設計|決定|判断)する$/, '').replace(/ソリューション$/, '').replace(/アーキテクチャ$/, '');
  }
  function field(label, content, hintText) {
    return el('div', { class: 'field pr-field' },
      el('span', { class: 'field__label', text: label }),
      content,
      hintText ? el('span', { class: 'field__hint', text: hintText }) : null);
  }
  function segmented(items, get, set) {
    const box = el('div', { class: 'segmented', role: 'group' });
    function paint() {
      Array.prototype.forEach.call(box.children, function (b, i) {
        const on = items[i].id === get();
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    items.forEach(function (it) {
      box.appendChild(el('button', { type: 'button', text: it.label, onClick: function () { sfx('select'); set(it.id); paint(); } }));
    });
    paint();
    return box;
  }

  // ---------- 出題 ----------
  function start(qids) {
    const ids = qids || query(filter, filter.count);
    if (!ids.length) { U.toast('条件に合う問題がありません', 'warn'); return; }
    const c = view.container;
    const myView = view;
    U.clear(c);
    view.running = true;
    let correct = 0;
    let answeredN = 0;

    const bar = el('div', { class: 'progress progress--lg pr-run__bar' }, el('div', { class: 'progress__bar' }));
    const posEl = el('span', { class: 'pr-run__pos' });
    const scoreEl = el('span', { class: 'pr-run__score' });
    const stopBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '中断' });
    const host = el('div', { class: 'pr-run__host' });
    c.appendChild(el('div', { class: 'screen pr pr-run' },
      el('div', { class: 'pr-run__top' },
        el('div', { class: 'pr-run__status' }, posEl, scoreEl),
        bar, stopBtn),
      host));

    function paint(i) {
      posEl.textContent = '問題 ' + Math.min(i + 1, ids.length) + ' / ' + ids.length;
      scoreEl.textContent = answeredN ? '正解 ' + correct + ' / ' + answeredN : '';
      bar.firstChild.style.width = (answeredN / ids.length * 100) + '%';
    }
    paint(0);
    bgmStart();
    try { window.scrollTo({ top: 0 }); } catch (e) { /* noop */ }

    const seq = SAA.quiz.runSequence(host, ids, {
      mode: 'practice',
      onQuestion: function (i) { paint(i); },
      onAnswer: function (r, i) { answeredN += 1; if (r.correct) correct += 1; paint(i); }
    });
    view.seq = seq;
    stopBtn.addEventListener('click', async function () {
      const ok = await U.confirm('演習を中断しますか？ ここまでの回答は記録されています。', { okLabel: '中断する' });
      if (ok) seq.abort();
    });
    seq.then(function (results) {
      if (view !== myView || !view.running) return; // 画面を離れた
      view.seq = null;
      view.running = false;
      bgmRestore();
      if (!results.length) { renderFilter(); return; }
      renderSummary(results, ids.length);
    });
  }

  // ---------- 結果 ----------
  function renderSummary(results, planned) {
    const c = view.container;
    U.clear(c);
    const total = results.length;
    const correct = results.filter(function (r) { return r.correct; }).length;
    const rate = total ? correct / total : 0;
    const wrongIds = results.filter(function (r) { return !r.correct; }).map(function (r) { return r.qid; });
    const meets = (cur().exam && cur().exam.meetsRate) || 0.72;
    sfx(rate >= meets ? 'chapter_clear' : 'notify');

    const root = el('div', { class: 'screen pr pr-sum' });
    c.appendChild(root);
    root.appendChild(el('header', { class: 'screen-header' },
      el('div', { class: 'screen-header__main' },
        el('span', { class: 'screen-header__eyebrow', text: 'Result' }),
        el('h1', { class: 'screen-header__title', text: '演習結果' }),
        total < planned ? el('p', { class: 'screen-header__sub', text: planned + '問中 ' + total + '問で中断しました。' }) : null)));

    let comment = '全問正解だ。この調子なら本番でも迷わないはずだ。';
    if (rate < 1) comment = rate >= meets ? '合格ラインは超えている。間違えた問題の「決め手」だけ確認しておけ。' :
      (rate >= 0.5 ? 'あと一歩だ。間違えた問題は、要件と制約のどこを読み落としたかを見直そう。' : '今は間違えていい。解説を読んで、もう一度同じ問題を解けば必ず伸びる。');

    const ring = el('div', { class: 'pr-sum__ring ' + (rate >= meets ? 'is-ok' : 'is-ng'), style: { '--p': String(Math.round(rate * 100)) } },
      el('div', { class: 'pr-sum__ring-in' },
        el('strong', { text: U.pct(rate) }),
        el('span', { text: correct + ' / ' + total + ' 正解' })));
    const doms = el('div', { class: 'pr-sum__doms' });
    cur().domains.forEach(function (d) {
      const rs = results.filter(function (r) { const q = SAA.data.qById[r.qid]; return q && q.domain === d.id; });
      if (!rs.length) return;
      const ok = rs.filter(function (r) { return r.correct; }).length;
      doms.appendChild(el('div', { class: 'pr-sum__dom' },
        U.domainBadge(d.id),
        el('div', { class: 'progress', style: { '--progress-c': 'var(--c-d' + d.id + ')' } },
          el('div', { class: 'progress__bar', style: { width: (ok / rs.length * 100) + '%' } })),
        el('span', { class: 'pr-sum__dom-n', text: ok + ' / ' + rs.length })));
    });
    root.appendChild(el('section', { class: 'card pr-sum__top' },
      ring,
      el('div', { class: 'pr-sum__side' },
        doms,
        el('div', { class: 'speech' }, U.charAvatar('ren'),
          el('div', { class: 'speech__bubble' }, el('span', { class: 'speech__name', text: '氷室 レン' }), el('p', { text: comment }))))));

    root.appendChild(el('div', { class: 'btn-row pr-sum__actions' },
      wrongIds.length ? el('button', { type: 'button', class: 'btn btn--primary', text: '間違えた問題だけもう一度（' + wrongIds.length + '問）', onClick: function () { start(wrongIds); } }) : null,
      el('button', { type: 'button', class: 'btn btn--ghost', text: '同じ条件でもう一度', onClick: function () { start(); } }),
      el('button', { type: 'button', class: 'btn btn--ghost', text: '条件を変える', onClick: function () { renderFilter(); } })));

    root.appendChild(el('h2', { class: 'section-title', text: '問題ごとの結果' }));
    root.appendChild(resultList(results));
    try { SAA.setContext({ kind: 'none' }); } catch (e) { /* noop */ }
    try { window.scrollTo({ top: 0 }); } catch (e) { /* noop */ }
  }

  // ✓/✗ の一覧（模試の結果画面でも使う）
  function resultList(results) {
    const list = el('ul', { class: 'pr-list' });
    results.forEach(function (r, i) {
      const q = SAA.data.qById[r.qid];
      if (!q) return;
      list.appendChild(el('li', { class: 'pr-list__row ' + (r.correct ? 'is-ok' : 'is-ng') },
        el('span', { class: 'pr-list__mark', 'aria-label': r.correct ? '正解' : '不正解', text: r.correct ? '✓' : '✗' }),
        el('span', { class: 'pr-list__no', text: String(i + 1) }),
        U.domainBadge(q.domain),
        el('span', { class: 'pr-list__topic' }, el('strong', { text: q.topic || q.id }), el('small', { text: q.id + '・タスク ' + q.task })),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '見直す', onClick: function () { openReview(r); } })));
    });
    return list;
  }

  function openReview(r) {
    const q = SAA.data.qById[r.qid];
    if (!q) return;
    const body = el('div', { class: 'pr-review' });
    const ctl = SAA.quiz.mount(body, q, { mode: 'review', selected: r.selected, order: r.order });
    U.modal({ title: '見直し｜' + (q.topic || q.id), body: body, wide: true, buttons: [{ label: '閉じる', kind: 'primary' }], onClose: function () { ctl.destroy(); } });
  }

  // ---------- 画面登録 ----------
  SAA.app.registerScreen('practice', {
    title: '問題演習',
    render: function (container, params) {
      view = { container: container, seq: null, prevBgm: null, bgmOn: false, running: false };
      applyParams(params);
      if (params && Array.isArray(params.qids) && params.qids.length) { start(params.qids.slice()); return; }
      if (params && params.autoStart && query(filter, 0).length) { start(); return; }
      renderFilter();
    },
    leave: function () {
      if (!view) return;
      const v = view;
      v.running = false;
      if (v.seq) { try { v.seq.abort(); } catch (e) { /* noop */ } }
      bgmRestore();
      view = null;
      try { SAA.setContext({ kind: 'none' }); } catch (e) { /* noop */ }
    }
  });

  SAA.practice = { resultList: resultList, openReview: openReview, _test: { effectiveTasks: effectiveTasks } };
})();
