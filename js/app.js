/* アプリ本体：ルーター、トップバー、コア画面（タイトル・チャプター・講義ノート・用語集・学習記録・ギャラリー・設定・画像チェック）、起動処理 */
(function () {
  'use strict';

  const U = SAA.util;
  const S = SAA.store;
  const el = U.el;

  // ---------- 小物 ----------
  function safe(fn, fallback) {
    try { const r = fn(); return r === undefined ? fallback : r; } catch (e) { console.error('[app]', e); return fallback; }
  }
  function cur() { return SAA.data.curriculum || { domains: [], tasks: [], chapters: [], groups: {}, mockExams: {}, exam: {} }; }
  function settings() { return safe(function () { return S.getSettings(); }, {}) || {}; }
  function progress() {
    const p = safe(function () { return S.get('progress', null); }, null) || {};
    return {
      last: p.last && p.last.chapter ? p.last : null,
      chapters: (p.chapters && typeof p.chapters === 'object') ? p.chapters : {},
      seenCg: Array.isArray(p.seenCg) ? p.seenCg : [],
      endings: Array.isArray(p.endings) ? p.endings : []
    };
  }
  function hasProgress(p) { return !!p.last || Object.keys(p.chapters).length > 0; }
  function sfx(id) { safe(function () { SAA.audio.playSfx(id); }); }
  function rateOf(c, n) { return n > 0 ? c / n : 0; }

  function screenHeader(eyebrow, title, sub, actions) {
    return el('header', { class: 'screen-header' },
      el('div', { class: 'screen-header__main' },
        el('span', { class: 'screen-header__eyebrow', text: eyebrow }),
        el('h1', { class: 'screen-header__title', text: title }),
        sub ? el('p', { class: 'screen-header__sub', text: sub }) : null),
      actions && actions.length ? el('div', { class: 'screen-header__actions' }, actions) : null);
  }
  function emptyState(icon, title, text, action) {
    return el('div', { class: 'empty-state' },
      el('div', { class: 'empty-state__icon', 'aria-hidden': 'true', text: icon }),
      el('h3', { class: 'empty-state__title', text: title }),
      text ? el('p', { class: 'empty-state__text', text: text }) : null,
      action || null);
  }
  function progressBar(rate, opts) {
    opts = opts || {};
    const pct = Math.round(U.clamp(rate || 0, 0, 1) * 100);
    const style = opts.color ? { '--progress-c': opts.color } : null;
    return el('div', {
      class: 'progress' + (opts.lg ? ' progress--lg' : ''), style: style, role: 'progressbar',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': opts.label || '進捗', title: opts.title || (pct + '%')
    },
      el('div', { class: 'progress__bar', style: { width: pct + '%' } }),
      opts.mark !== undefined ? el('span', { class: 'progress__mark', style: { left: Math.round(opts.mark * 100) + '%' }, title: '合格目安 ' + Math.round(opts.mark * 100) + '%' }) : null);
  }
  function btn(label, kind, onClick, extra) {
    return el('button', Object.assign({ class: 'btn' + (kind ? ' btn--' + kind : ''), type: 'button', text: label, onClick: onClick }, extra || {}));
  }
  function navBtn(label, kind, id, params, extra) {
    return btn(label, kind, function () { go(id, params); }, extra);
  }
  function switchCtl(checked, label, onChange) {
    const input = el('input', { type: 'checkbox', checked: !!checked, 'aria-label': label });
    input.checked = !!checked;
    input.addEventListener('change', function () { onChange(input.checked); });
    return el('label', { class: 'switch' }, input, el('span', { class: 'switch__track' }));
  }
  function setRangePct(input) {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    input.style.setProperty('--range-pct', ((parseFloat(input.value) - min) / (max - min) * 100) + '%');
  }

  // ---------- ルーター ----------
  let current = null;        // { id, params }
  const stack = [];          // 戻る用の履歴
  let topbarState = { title: '', back: true };

  function registerScreen(id, def) { SAA.screens[id] = def; }

  function setHash(id) {
    const h = '#' + id;
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { safe(function () { location.hash = h; }); }
  }
  function hashId() { return decodeURIComponent(String(location.hash || '').replace(/^#\/?/, '').split('?')[0]); }

  function go(id, params, opts) {
    opts = opts || {};
    params = params || {};
    const root = document.getElementById('screen-root');
    if (!root) return;
    if (!SAA.screens[id]) {
      U.toast('「' + id + '」の画面は準備中です。', 'warn');
      if (current && current.id === 'title') return;
      if (!SAA.screens.title) return;
      id = 'title'; params = {};
    }
    const def = SAA.screens[id];
    const prev = current;
    if (prev && SAA.screens[prev.id] && typeof SAA.screens[prev.id].leave === 'function') {
      safe(function () { SAA.screens[prev.id].leave(); });
    }
    if (id === 'title') stack.length = 0;
    else if (prev && !opts.back && !opts.replace && prev.id !== id) {
      stack.push(prev);
      if (stack.length > 40) stack.shift();
    }
    current = { id: id, params: params };
    U.clear(root);
    const body = document.body;
    Array.prototype.slice.call(body.classList).forEach(function (c) { if (c.indexOf('screen-') === 0) body.classList.remove(c); });
    body.classList.add('screen-' + id);
    body.classList.toggle('no-topbar', def.topbar === false);
    topbarState = { title: def.title || '', back: id !== 'title' };
    renderTopbar();
    safe(function () { window.scrollTo(0, 0); });
    try {
      def.render(root, params);
    } catch (e) {
      console.error('[app] render ' + id, e);
      U.clear(root);
      root.appendChild(el('div', { class: 'screen' },
        emptyState('🛠️', 'この画面を表示できませんでした', 'ページを再読み込みしても直らない場合は、設定のデータエクスポートでバックアップを取ってからお試しください。',
          navBtn('タイトルへ戻る', 'primary', 'title'))));
    }
    setHash(id);
    SAA.bus.emit('screen:change', { from: prev ? prev.id : null, to: id, params: params });
  }

  function back() {
    const prev = stack.pop();
    if (prev && SAA.screens[prev.id]) go(prev.id, prev.params, { back: true });
    else go('title', {}, { back: true });
  }

  function setTopbar(opts) {
    opts = opts || {};
    if (opts.title !== undefined) topbarState.title = opts.title;
    if (opts.back !== undefined) topbarState.back = !!opts.back;
    renderTopbar();
  }

  function isMuted() { return !!settings().muted; }
  function renderTopbar() {
    const bar = document.getElementById('topbar');
    if (!bar) return;
    U.clear(bar);
    const muted = isMuted();
    bar.appendChild(el('button', {
      class: 'icon-btn topbar__back' + (topbarState.back ? '' : ' is-hidden'), type: 'button', 'aria-label': '戻る', title: '戻る',
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
      onClick: function () { sfx('click'); back(); }
    }));
    bar.appendChild(el('div', { class: 'topbar__brand' },
      el('button', { class: 'topbar__home', type: 'button', title: 'タイトルへ', 'aria-label': 'タイトルへ', onClick: function () { go('title'); } },
        el('span', { class: 'topbar__logo-mark', 'aria-hidden': 'true', text: '☁' }),
        el('span', { class: 'topbar__home-text', text: 'リベンジ・レッスン' })),
      el('span', { class: 'topbar__sep', 'aria-hidden': 'true', text: '/' }),
      el('h1', { class: 'topbar__title', text: topbarState.title || '' })));
    bar.appendChild(el('div', { class: 'topbar__actions' },
      el('button', {
        class: 'icon-btn topbar__mute', type: 'button', text: muted ? '🔇' : '🔊',
        'aria-label': muted ? 'ミュートを解除' : 'ミュート', 'aria-pressed': String(muted), title: muted ? 'ミュートを解除' : 'ミュート',
        onClick: function () {
          const next = !isMuted();
          safe(function () { S.setSetting('muted', next); });
          safe(function () { SAA.audio.setMuted(next); });
          renderTopbar();
        }
      }),
      el('button', { class: 'icon-btn', type: 'button', text: '📝', 'aria-label': 'メモ', title: 'メモ (M)', onClick: function () { safe(function () { SAA.dock.toggle('memo'); }); } }),
      el('button', { class: 'icon-btn', type: 'button', text: '💬', 'aria-label': '質問チャット', title: '質問チャット (C)', onClick: function () { safe(function () { SAA.dock.toggle('chat'); }); } }),
      el('button', {
        class: 'icon-btn' + (current && current.id === 'settings' ? ' is-on' : ''), type: 'button', text: '⚙', 'aria-label': '設定', title: '設定',
        onClick: function () { if (!current || current.id !== 'settings') go('settings'); }
      })));
  }

  // ---------- タイトル ----------
  let gateDone = false;
  const MENU = [
    { id: 'chapters', icon: '📚', label: 'チャプター選択' },
    { id: 'practice', icon: '✏️', label: '問題演習' },
    { id: 'mock', icon: '⏱️', label: '模擬試験' },
    { id: 'labs', icon: '🧪', label: 'ハンズオンラボ' },
    { id: 'notes', icon: '📒', label: '講義ノート' },
    { id: 'glossary', icon: '📖', label: '用語集' },
    { id: 'stats', icon: '📊', label: '学習記録' },
    { id: 'gallery', icon: '🖼️', label: 'ギャラリー' },
    { id: 'sound', icon: '🎵', label: 'サウンドルーム' },
    { id: 'settings', icon: '⚙️', label: '設定' }
  ];

  function titleBtn(cls, icon, label, sub, onClick, disabled) {
    return el('button', { class: 'title-btn' + (cls ? ' ' + cls : ''), type: 'button', disabled: !!disabled, onClick: function () { sfx('select'); onClick(); } },
      el('span', { class: 'title-btn__icon', 'aria-hidden': 'true', text: icon }),
      el('span', { class: 'title-btn__text' },
        el('span', { text: label }),
        sub ? el('span', { class: 'title-btn__sub', text: sub }) : null));
  }

  function startStory(chapterId, step) {
    if (!SAA.screens.story) { U.toast('ストーリーは準備中です。', 'warn'); return; }
    safe(function () { SAA.story.start(chapterId, { step: step || 0 }); });
  }
  function resumeStory() {
    if (!SAA.screens.story) { U.toast('ストーリーは準備中です。', 'warn'); return; }
    safe(function () { SAA.story.resume(); });
  }

  function renderTitle(container) {
    const c = cur();
    const p = progress();
    const first = (c.chapters[0] && c.chapters[0].id) || 'prologue';
    const lastCh = p.last ? U.chapter(p.last.chapter) : null;
    const totalQ = Object.keys(c.groups).reduce(function (s, g) { return s + (c.groups[g].count || 0); }, 0);
    const totalLabs = c.chapters.reduce(function (s, ch) { return s + (ch.labs || []).length; }, 0);

    const bg = el('div', { class: 'title-screen__bg' });
    const scr = el('div', { class: 'title-screen screen' + (gateDone ? '' : ' is-gated') });
    safe(function () { SAA.assets.applyBg(bg, 'cg_title'); });
    safe(function () {
      SAA.assets.resolve('cg_title').then(function (url) { if (url) scr.classList.add('has-art'); });
    });

    const sparkles = el('div', { class: 'title-screen__sparkles', 'aria-hidden': 'true' });
    for (let i = 0; i < 14; i++) {
      sparkles.appendChild(el('i', { style: { left: ((i * 37 + 11) % 100) + '%', top: (30 + (i * 53) % 65) + '%', animationDelay: (-(i * 0.7)) + 's', animationDuration: (7 + (i % 5)) + 's' } }));
    }
    const charsBox = el('div', { class: 'title-screen__chars', 'aria-hidden': 'true' });
    safe(function () {
      charsBox.appendChild(SAA.assets.sprite('akari', 'smile'));
      charsBox.appendChild(SAA.assets.sprite('ren', 'smile'));
    });

    const menuMain = el('div', { class: 'title-menu__main' },
      titleBtn('title-btn--primary', '▶', 'はじめから', 'プロローグから', function () {
        if (!hasProgress(p)) { startStory(first, 0); return; }
        U.confirm('プロローグの最初から始めますか？\n（問題の正答記録やメモは消えません。ストーリーの再開位置だけが変わります）', { okLabel: 'はじめから' })
          .then(function (ok) { if (ok) startStory(first, 0); });
      }),
      titleBtn('title-btn--continue', '⏩', 'つづきから', lastCh ? lastCh.title + ' のつづき' : 'セーブデータなし', resumeStory, !p.last));
    const menuGrid = el('div', { class: 'title-menu__grid' }, MENU.map(function (m) {
      return titleBtn('', m.icon, m.label, '', function () { go(m.id); });
    }));

    scr.append(
      bg,
      el('div', { class: 'title-screen__glow' }),
      charsBox,
      el('div', { class: 'title-screen__shade' }),
      sparkles,
      el('div', { class: 'title-screen__lead' },
        el('span', { class: 'title-screen__credit', text: '🍁 再受験までの 14 日間 ・ 全 ' + c.chapters.length + ' 章 ・ 問題 ' + totalQ + ' 問 ・ ラボ ' + totalLabs + ' 本' })),
      el('div', { class: 'title-screen__panel' },
        el('div', { class: 'title-logo' },
          el('span', { class: 'title-logo__eyebrow', text: 'STORY × QUIZ × HANDS-ON' }),
          el('h1', { class: 'title-logo__main' },
            el('span', { text: '先輩、' }),
            el('span', { class: 'title-logo__accent', text: 'AWSを教えて' }),
            el('span', { text: 'ください！' })),
          el('p', { class: 'title-logo__sub' },
            el('span', { class: 'title-logo__code', text: 'SAA-C03' }),
            el('span', { text: 'リベンジ・レッスン' }))),
        el('nav', { class: 'title-menu', 'aria-label': 'メインメニュー' }, menuMain, menuGrid),
        el('p', { class: 'title-screen__footer', text: '非公式の学習アプリです（AWS とは関係ありません）・問題はすべてオリジナル' })));

    if (!gateDone) {
      const gate = el('button', { class: 'title-gate', type: 'button', 'aria-label': 'タップしてはじめる' },
        el('span', null,
          el('span', { class: 'title-gate__label', text: 'タップしてはじめる' }),
          el('span', { class: 'title-gate__hint', text: '音が鳴ります（右上の 🔊 や設定でいつでもミュートできます）' })));
      gate.addEventListener('click', function () {
        gateDone = true;
        safe(function () { SAA.audio.init(); });
        safe(function () { SAA.audio.playBgm('title'); });
        sfx('select');
        gate.classList.add('is-leaving');
        scr.classList.remove('is-gated');
        setTimeout(function () { gate.remove(); }, 600);
        const firstBtn = scr.querySelector('.title-btn:not(:disabled)');
        if (firstBtn) safe(function () { firstBtn.focus({ preventScroll: true }); });
      });
      scr.appendChild(gate);
      setTimeout(function () { if (gate.isConnected) safe(function () { gate.focus({ preventScroll: true }); }); }, 50);
    } else {
      safe(function () { SAA.audio.playBgm('title'); });
    }
    container.appendChild(scr);
  }

  // ---------- チャプター選択 ----------
  function chapterProgress(ch, p) {
    const story = SAA.data.stories[ch.id];
    const len = story && story.script ? story.script.length : 0;
    const rec = p.chapters[ch.id] || null;
    const done = !!(rec && rec.done);
    const step = rec ? (rec.step || 0) : 0;
    const maxStep = rec ? Math.max(rec.maxStep || 0, step) : 0;
    const rate = done ? 1 : (len ? U.clamp(maxStep / len, 0, 1) : 0);
    return { ready: len > 0, done: done, step: step, started: !!rec && (maxStep > 0 || done), rate: rate };
  }

  function renderChapters(container) {
    const c = cur();
    const p = progress();
    const weakDomains = c.domains.filter(function (d) { return d.lastResult === 'needs'; }).map(function (d) { return d.id; });
    const scr = el('div', { class: 'screen chapters-screen' });
    scr.appendChild(screenHeader('Chapters', 'チャプター選択', 'どの章からでも始められます。おすすめは上から順番に、弱点分野（第3〜6章）は特にじっくりと。',
      [navBtn('📊 学習記録', 'ghost', 'stats')]));
    scr.appendChild(el('div', { class: 'card', style: { marginBottom: '16px', padding: '12px 18px' } },
      el('div', { class: 'chapter-flow', 'aria-label': 'おすすめの順番' },
        el('strong', { text: 'おすすめの順番：' }),
        c.chapters.map(function (ch) { return el('span', { text: ch.title + '（' + ch.day + '）' }); }))));

    const grid = el('div', { class: 'card-grid card-grid--lg' });
    c.chapters.forEach(function (ch) {
      const pr = chapterProgress(ch, p);
      const weak = weakDomains.indexOf(ch.domain) >= 0;
      const sum = safe(function () { return SAA.stats.chapterSummary(ch.id); }, null) || { answered: 0, correct: 0, total: 0 };
      const totalQ = sum.total || (ch.groups || []).reduce(function (s, g) { return s + ((c.groups[g] || {}).count || 0); }, 0);
      const acc = rateOf(sum.correct, sum.answered);
      const color = ch.domain ? 'var(--c-d' + ch.domain + ')' : 'var(--c-accent)';
      const meta = [];
      if (totalQ) meta.push('✏️ 問題 ' + totalQ + ' 問');
      if ((ch.slides || []).length) meta.push('📒 スライド ' + ch.slides.length + ' 枚');
      if ((ch.labs || []).length) meta.push('🧪 ラボ ' + ch.labs.length + ' 本');
      if (ch.mock) meta.push('⏱️ 模擬試験');

      const actions = el('div', { class: 'chapter-card__actions' });
      if (!pr.ready) {
        actions.appendChild(btn('ストーリー準備中', 'ghost', null, { disabled: true }));
      } else if (pr.started && !pr.done && pr.step > 0) {
        actions.appendChild(btn('⏩ つづきから', 'primary', function () { startStory(ch.id, pr.step); }));
        actions.appendChild(btn('はじめから', 'ghost', function () { startStory(ch.id, 0); }));
      } else {
        actions.appendChild(btn(pr.done ? '🔁 もう一度読む' : '▶ はじめから', pr.done ? '' : 'primary', function () { startStory(ch.id, 0); }));
      }
      if (totalQ) actions.appendChild(navBtn('この章の問題', 'ghost', 'practice', { groups: (ch.groups || []).slice(), source: 'all' }));

      grid.appendChild(el('article', { class: 'chapter-card' + (weak ? ' is-weak' : '') + (pr.done ? ' is-done' : ''), style: { '--ch-c': color }, dataset: { chapter: ch.id } },
        el('div', { class: 'chapter-card__hero' },
          el('div', { class: 'chapter-card__no' }, el('small', { text: 'CHAPTER' }), String(ch.no)),
          el('span', { class: 'chapter-card__day', text: ch.day }),
          weak ? el('span', { class: 'chapter-card__ribbon', text: '弱点分野' }) : null),
        el('div', { class: 'chapter-card__body' },
          el('h2', { class: 'chapter-card__title' }, ch.title, ch.domain ? U.domainBadge(ch.domain) : null),
          el('p', { class: 'chapter-card__sub', text: ch.sub }),
          el('div', { class: 'chapter-card__meta' }, meta.map(function (m) { return el('span', { text: m }); }))),
        el('div', { class: 'chapter-card__stats' },
          el('div', { class: 'mini-stat' },
            el('div', { class: 'mini-stat__row' }, el('span', { text: 'ストーリー' }), el('span', { class: 'mini-stat__value', text: pr.ready ? U.pct(pr.rate) : '—' })),
            progressBar(pr.rate, { color: color, label: 'ストーリーの進捗' })),
          el('div', { class: 'mini-stat' },
            el('div', { class: 'mini-stat__row' },
              el('span', { text: '正答率' + (totalQ ? '（' + sum.answered + '/' + totalQ + '問）' : '') }),
              el('span', { class: 'mini-stat__value', text: sum.answered ? U.pct(acc) : '—' })),
            progressBar(acc, { color: color, label: '正答率', mark: totalQ ? 0.72 : undefined }))),
        actions));
    });
    scr.appendChild(grid);
    container.appendChild(scr);
  }

  // ---------- 講義ノート ----------
  function slideText(s) {
    const parts = [s.title, s.lead];
    if (s.columns) parts.push(s.columns.join(' | '));
    (s.rows || []).forEach(function (r) { parts.push(r.join(' | ')); });
    (s.bullets || []).forEach(function (b) { parts.push(b); });
    (s.items || []).forEach(function (it) { parts.push([it.tag, it.title, it.body].filter(Boolean).join('：')); });
    (s.steps || []).forEach(function (st, i) { parts.push((i + 1) + '. ' + st.title + (st.body ? '：' + st.body : '')); });
    if (s.note) parts.push('試験のツボ：' + s.note);
    return parts.filter(Boolean).join('\n');
  }
  function slideContext(s) {
    return { kind: 'slide', key: 'slide:' + s.id, id: s.id, title: '講義ノート｜' + s.title, summary: slideText(s), reveal: true };
  }

  function renderNotes(container, params) {
    params = params || {};
    const c = cur();
    const D = SAA.data;
    const state = { chapter: params.chapter || 'all', q: params.q || '' };
    const scr = el('div', { class: 'screen notes-screen' });
    const total = D.slideOrder.length;
    scr.appendChild(screenHeader('Lecture Notes', '講義ノート', 'レン先輩のホワイトボード講義をまとめたスライド集です。気になったらメモや質問チャットへ。'));

    const input = el('input', { type: 'search', placeholder: 'スライドを検索（例：gp3、マルチAZ、NAT）', value: state.q, 'aria-label': 'スライドを検索' });
    const count = el('span', { class: 'result-count' });
    const tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': '章' });
    const body = el('div', { class: 'notes-body' });
    scr.appendChild(el('div', { class: 'toolbar' }, el('div', { class: 'search' }, input), count));
    scr.appendChild(el('div', { style: { marginBottom: '24px' } }, tabs));
    scr.appendChild(body);

    function drawTabs() {
      U.clear(tabs);
      [{ id: 'all', title: 'すべて' }].concat(c.chapters.filter(function (ch) { return (ch.slides || []).length; })).forEach(function (ch) {
        tabs.appendChild(el('button', {
          class: 'tab' + (state.chapter === ch.id ? ' is-active' : ''), type: 'button', role: 'tab', 'aria-selected': String(state.chapter === ch.id), text: ch.title,
          onClick: function () { state.chapter = ch.id; drawTabs(); draw(); }
        }));
      });
    }

    function slideCard(s) {
      const ctx = slideContext(s);
      return el('div', { class: 'note-slide', id: 'slide-' + s.id },
        safe(function () { return U.renderSlide(s, {}); }, el('div', { class: 'card', text: s.title })),
        el('div', { class: 'note-slide__actions' },
          el('div', { class: 'note-slide__kw' }, (s.keywords || []).slice(0, 6).map(function (k) { return el('span', { text: k }); })),
          btn('📝 メモ', 'ghost btn--sm', function () {
            SAA.setContext(ctx);
            safe(function () { SAA.dock.open('memo'); });
          }),
          btn('💬 質問', 'ghost btn--sm', function () {
            SAA.setContext(ctx);
            safe(function () { SAA.dock.open('chat'); });
            SAA.bus.emit('chat:ask', { text: '講義スライド「' + s.title + '」について、試験で狙われるポイントと見分け方を教えてください。', autoSend: true });
          })));
    }

    function draw() {
      U.clear(body);
      const q = state.q.trim().toLowerCase();
      const chapters = c.chapters.filter(function (ch) { return (ch.slides || []).length && (state.chapter === 'all' || state.chapter === ch.id); });
      let shown = 0;
      chapters.forEach(function (ch) {
        const ready = [];
        const planned = [];
        ch.slides.forEach(function (sid) {
          const s = D.slides[sid];
          if (!s) { if (!q) planned.push(sid); return; }
          if (q && (slideText(s) + '\n' + (s.keywords || []).join(' ')).toLowerCase().indexOf(q) < 0) return;
          ready.push(s);
        });
        // 章に紐づくがカリキュラムに無いスライドも拾う
        D.slideOrder.forEach(function (sid) {
          const s = D.slides[sid];
          if (s.chapter === ch.id && ch.slides.indexOf(sid) < 0 && (!q || slideText(s).toLowerCase().indexOf(q) >= 0)) ready.push(s);
        });
        if (!ready.length && !planned.length) return;
        shown += ready.length;
        const sec = el('section', { class: 'notes-chapter' },
          el('div', { class: 'notes-chapter__head' },
            el('h2', { class: 'notes-chapter__title section-title', text: ch.title }),
            ch.domain ? U.domainBadge(ch.domain) : null,
            el('span', { class: 'notes-chapter__sub', text: ch.sub })));
        if (ready.length) sec.appendChild(el('div', { class: 'notes-list' }, ready.map(slideCard)));
        if (planned.length) {
          sec.appendChild(el('div', { class: 'planned-list', style: ready.length ? { marginTop: '28px' } : null }, planned.map(function (sid) {
            const plan = (c.slidePlans || {})[sid];
            return el('div', { class: 'planned-item' }, el('span', { 'aria-hidden': 'true', text: '🕓' }),
              el('span', null, el('b', { text: plan ? plan.title : sid }), '（準備中）'));
          })));
        }
        body.appendChild(sec);
      });
      count.textContent = q ? shown + ' 件ヒット' : '全 ' + total + ' 枚';
      if (!body.children.length) {
        body.appendChild(q
          ? emptyState('🔍', '「' + state.q.trim() + '」に一致するスライドはありません', '別のキーワード（サービス名や略語）で試してみてください。')
          : emptyState('📒', '講義ノートは準備中です', 'ストーリーを進めると、レン先輩の講義スライドがここにまとまります。'));
      }
    }

    input.addEventListener('input', U.debounce(function () { state.q = input.value; draw(); }, 140));
    drawTabs();
    draw();
    container.appendChild(scr);
    if (params.slide) {
      setTimeout(function () {
        const target = document.getElementById('slide-' + params.slide);
        if (target) safe(function () { target.scrollIntoView({ block: 'start' }); });
      }, 60);
    }
  }

  // ---------- 用語集 ----------
  const CATEGORY = {
    compute: 'コンピューティング', storage: 'ストレージ', database: 'データベース', network: 'ネットワーク', security: 'セキュリティ',
    integration: 'アプリ統合', analytics: '分析', management: '管理・運用', cost: 'コスト', migration: '移行・転送', ml: '機械学習', general: '基本概念'
  };
  function highlight(text, q) {
    const s = String(text || '');
    if (!q) return U.esc(s);
    const i = s.toLowerCase().indexOf(q);
    if (i < 0) return U.esc(s);
    return U.esc(s.slice(0, i)) + '<mark>' + U.esc(s.slice(i, i + q.length)) + '</mark>' + U.esc(s.slice(i + q.length));
  }
  function glossaryContext(g) {
    return {
      kind: 'glossary', key: 'glossary:' + g.id, id: g.id, title: '用語｜' + g.term,
      summary: [g.term + (g.aliases && g.aliases.length ? '（' + g.aliases.join('、') + '）' : ''), g.short, g.detail, g.examTip ? '試験のポイント：' + g.examTip : ''].filter(Boolean).join('\n'),
      reveal: true
    };
  }

  function renderGlossary(container, params) {
    params = params || {};
    const all = (SAA.data.glossary || []).slice().sort(function (a, b) { return String(a.term).localeCompare(String(b.term), 'ja'); });
    const state = { q: params.q || '', cat: params.category || 'all', open: params.id || null };
    const scr = el('div', { class: 'screen glossary-screen' });
    scr.appendChild(screenHeader('Glossary', '用語集', 'サービス名や略語をさっと確認。開いた用語はそのままメモ・質問チャットの話題になります。'));

    const input = el('input', { type: 'search', placeholder: '用語を検索（例：RPO、gp3、エンドポイント）', value: state.q, 'aria-label': '用語を検索' });
    const count = el('span', { class: 'result-count' });
    const chips = el('div', { class: 'chip-row', style: { marginBottom: '16px' } });
    const list = el('div', { class: 'glossary-list' });
    scr.appendChild(el('div', { class: 'toolbar' }, el('div', { class: 'search' }, input), count));
    scr.appendChild(chips);
    scr.appendChild(list);

    function matches(g, q) {
      if (!q) return true;
      return [g.term, (g.aliases || []).join(' '), g.short, g.detail, g.examTip].join('\n').toLowerCase().indexOf(q) >= 0;
    }
    function drawChips() {
      U.clear(chips);
      const q = state.q.trim().toLowerCase();
      const counts = {};
      all.forEach(function (g) { if (matches(g, q)) counts[g.category] = (counts[g.category] || 0) + 1; });
      const cats = Object.keys(CATEGORY).filter(function (k) { return all.some(function (g) { return g.category === k; }); });
      [{ id: 'all', label: 'すべて', n: all.filter(function (g) { return matches(g, q); }).length }]
        .concat(cats.map(function (k) { return { id: k, label: CATEGORY[k], n: counts[k] || 0 }; }))
        .forEach(function (cat) {
          chips.appendChild(el('button', {
            class: 'chip' + (state.cat === cat.id ? ' is-active' : ''), type: 'button', 'aria-pressed': String(state.cat === cat.id),
            onClick: function () { state.cat = cat.id; drawChips(); draw(); }
          }, cat.label, el('span', { class: 'chip__count', text: String(cat.n) })));
        });
    }
    function entry(g, q) {
      const open = state.open === g.id;
      const bodyId = 'gl-' + g.id;
      const node = el('article', { class: 'gl-entry' + (open ? ' is-open' : ''), dataset: { id: g.id } });
      node.appendChild(el('button', {
        class: 'gl-entry__head', type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyId,
        onClick: function () {
          state.open = open ? null : g.id;
          if (!open) SAA.setContext(glossaryContext(g));
          draw();
        }
      },
        el('span', { class: 'gl-entry__term' },
          el('span', { html: highlight(g.term, q) }),
          g.aliases && g.aliases.length ? el('span', { class: 'gl-entry__aliases', html: highlight(g.aliases.join(' / '), q) }) : null),
        el('span', { class: 'gl-entry__chev', 'aria-hidden': 'true', text: '▾' }),
        el('span', { class: 'gl-entry__short', html: highlight(g.short, q) })));
      if (open) {
        const ctx = glossaryContext(g);
        node.appendChild(el('div', { class: 'gl-entry__body', id: bodyId },
          el('div', { class: 'gl-entry__detail', html: U.md(g.detail) }),
          g.examTip ? el('div', { class: 'gl-entry__tip' }, el('span', { class: 'gl-entry__tip-label', text: '🎯 試験での狙われ方' }), el('div', { html: U.md(g.examTip) })) : null,
          el('div', { class: 'gl-entry__foot' },
            el('span', { class: 'badge', text: CATEGORY[g.category] || g.category }),
            (g.domains || []).map(function (d) { return U.domainBadge(d); }),
            el('div', { class: 'btn-row' },
              btn('📝 メモ', 'ghost btn--sm', function () { SAA.setContext(ctx); safe(function () { SAA.dock.open('memo'); }); }),
              btn('💬 質問', 'ghost btn--sm', function () {
                SAA.setContext(ctx);
                safe(function () { SAA.dock.open('chat'); });
                SAA.bus.emit('chat:ask', { text: '「' + g.term + '」について、似たサービスとの違いと、試験での見分け方を教えてください。', autoSend: true });
              })))));
      }
      return node;
    }
    function draw() {
      U.clear(list);
      const q = state.q.trim().toLowerCase();
      const items = all.filter(function (g) { return (state.cat === 'all' || g.category === state.cat) && matches(g, q); });
      count.textContent = all.length ? items.length + ' / ' + all.length + ' 語' : '';
      if (!all.length) { list.appendChild(emptyState('📖', '用語集は準備中です', '用語データが追加されると、ここで検索・確認できるようになります。')); return; }
      if (!items.length) { list.appendChild(emptyState('🔍', '一致する用語がありません', 'キーワードを短くするか、カテゴリを「すべて」に戻してみてください。')); return; }
      items.forEach(function (g) { list.appendChild(entry(g, q)); });
    }

    input.addEventListener('input', U.debounce(function () { state.q = input.value; drawChips(); draw(); }, 140));
    drawChips();
    draw();
    container.appendChild(scr);
    if (state.open && SAA.data.glossaryById[state.open]) {
      SAA.setContext(glossaryContext(SAA.data.glossaryById[state.open]));
      setTimeout(function () {
        const t = list.querySelector('.gl-entry.is-open');
        if (t) safe(function () { t.scrollIntoView({ block: 'center' }); });
      }, 60);
    }
  }

  // ---------- 学習記録 ----------
  const JUDGE = {
    meets: { icon: '✓', label: 'コンピテンシーを満たしている' },
    needs: { icon: '▲', label: '改善が必要' },
    nodata: { icon: '…', label: 'データ不足' }
  };
  const LAST_LABEL = { meets: '満たしている', needs: '改善が必要' };
  function heatClass(n, rate) {
    if (!n) return 'heat--none';
    if (rate >= 0.72) return 'heat--good';
    if (rate >= 0.5) return 'heat--mid';
    return 'heat--bad';
  }
  function statTile(label, value, unit, sub, color) {
    return el('div', { class: 'stat-tile', style: color ? { '--tile-c': color } : null },
      el('div', { class: 'stat-tile__label', text: label }),
      el('div', { class: 'stat-tile__value' }, value, unit ? el('small', { text: unit }) : null),
      sub ? el('div', { class: 'stat-tile__sub', text: sub }) : null);
  }

  function renderStats(container) {
    const c = cur();
    const st = SAA.stats;
    const sum = safe(function () { return st.summary(); }, null) || { answered: 0, total: 0, correct: 0, rate: 0 };
    const byDomain = safe(function () { return st.byDomain(); }, null) || {};
    const byTask = safe(function () { return st.byTask(); }, null) || {};
    const mocks = (safe(function () { return st.mocks(); }, null) || []).slice();
    const labIds = [].concat.apply([], c.chapters.map(function (ch) { return ch.labs || []; }));
    const labsDone = labIds.filter(function (id) { const r = safe(function () { return st.labStatus(id); }, null); return !!(r && r.done); }).length;
    const best = mocks.reduce(function (m, r) { return Math.max(m, r.scaled || 0); }, 0);
    const pass = (c.exam && c.exam.passScaled) || 720;
    const totalQ = sum.total || SAA.data.questions.length;

    const scr = el('div', { class: 'screen stats-screen' });
    scr.appendChild(screenHeader('Study Log', '学習記録', '分野ごとの到達度を、本番のスコアレポートと同じ見方で確認できます。',
      [navBtn('✏️ 問題演習へ', 'ghost', 'practice'), navBtn('⏱️ 模擬試験へ', 'ghost', 'mock')]));

    scr.appendChild(el('div', { class: 'stat-grid', style: { marginBottom: '24px' } },
      statTile('✏️ 回答済みの問題', String(sum.answered || 0), ' / ' + totalQ + ' 問', totalQ ? '全体の ' + U.pct(rateOf(sum.answered, totalQ)) + ' に挑戦済み' : '問題データは準備中です', 'var(--c-accent)'),
      statTile('🎯 正答率', sum.answered ? String(Math.round((sum.rate || 0) * 100)) : '—', sum.answered ? '%' : '', '合格目安は 72% 以上', 'var(--c-primary)'),
      statTile('🧪 ハンズオンラボ', String(labsDone), ' / ' + labIds.length + ' 本', labsDone === labIds.length && labIds.length ? 'すべて完了！' : '手を動かして定着させよう', 'var(--c-d2)'),
      statTile('⏱️ 模擬試験ベスト', best ? String(best) : '—', best ? ' 点' : '', best ? (best >= pass ? '合格ライン ' + pass + ' を超えています' : '合格ライン ' + pass + ' まであと ' + (pass - best) + ' 点') : '合格ラインは ' + pass + ' 点', 'var(--c-d1)')));

    if (!sum.answered) {
      scr.appendChild(el('div', { class: 'speech', style: { marginBottom: '24px' } },
        U.charAvatar('ren'),
        el('div', { class: 'speech__bubble' },
          el('span', { class: 'speech__name', text: '氷室 レン' }),
          el('p', { text: 'まだ記録がないな。まずは問題を数問解いてみろ。どこが弱いかが見えれば、やることは勝手に絞られる。' }),
          el('div', { class: 'btn-row', style: { marginTop: '8px' } },
            navBtn('▶ ストーリーで学ぶ', 'primary btn--sm', 'chapters'),
            navBtn('✏️ 問題演習', 'ghost btn--sm', 'practice')))));
    }

    // 分野別
    scr.appendChild(el('h2', { class: 'section-title' }, '分野別の到達度', el('span', { class: 'section-title__aside', text: '縦線は合格目安の 72%' })));
    scr.appendChild(el('div', { class: 'domain-grid' }, c.domains.map(function (d) {
      const r = byDomain[d.id] || {};
      const n = r.n || 0;
      const cc = r.c || 0;
      const rate = r.rate !== undefined ? r.rate : rateOf(cc, n);
      const status = safe(function () { return st.status(d.id); }, 'nodata') || 'nodata';
      const j = JUDGE[status] || JUDGE.nodata;
      return el('article', { class: 'domain-card', style: { '--dc': 'var(--c-d' + d.id + ')' }, dataset: { domain: String(d.id) } },
        el('div', { class: 'domain-card__head' }, U.domainBadge(d.id), el('span', { class: 'domain-card__weight', text: '配点 ' + d.weight + '%' })),
        el('h3', { class: 'domain-card__name', text: '第' + d.id + '分野：' + d.name }),
        el('div', { class: 'domain-card__rate' }, n ? U.pct(rate) : '—', el('small', { text: n ? cc + ' / ' + n + ' 正解' : 'まだ回答がありません' })),
        progressBar(rate, { lg: true, mark: 0.72, label: 'D' + d.id + ' の正答率', title: n ? '正答率 ' + U.pct(rate) + '（' + cc + '/' + n + '）' : '未回答' }),
        el('span', { class: 'judge judge--' + status }, el('span', { 'aria-hidden': 'true', text: j.icon }), j.label),
        el('div', { class: 'small muted', text: '挑戦した問題 ' + (r.answeredQ || 0) + ' / ' + (r.totalQ || 0) + ' 問' }),
        el('div', { class: 'domain-card__last' }, '前回の本番: ', el('b', { class: 'is-' + d.lastResult, text: LAST_LABEL[d.lastResult] || '—' })));
    })));

    // 弱点集中モード
    scr.appendChild(el('div', { class: 'stats-cta' },
      el('div', null,
        el('h2', { class: 'stats-cta__title', text: '弱点集中モード（D3・D4）' }),
        el('p', { class: 'stats-cta__text', text: '前回「改善が必要」だった高性能・コスト最適化から、苦手な問題を優先して 10 問出題します。' })),
      navBtn('10問チャレンジ ▶', 'lg', 'practice', { domains: [3, 4], source: 'weak', count: 10, autoStart: true })));

    // タスク別
    scr.appendChild(el('h2', { class: 'section-title' }, 'タスク別の正答率', el('span', { class: 'section-title__aside', text: '全 ' + c.tasks.length + ' タスク' })));
    scr.appendChild(el('div', { class: 'table-wrap' },
      el('table', { class: 'data-table' },
        el('thead', null, el('tr', null,
          el('th', { text: 'タスク' }), el('th', { text: '内容' }), el('th', { class: 'num', text: '正解 / 回答' }), el('th', { text: '正答率' }), el('th', { text: '' }))),
        el('tbody', null, c.tasks.map(function (t) {
          const r = byTask[t.id] || {};
          const n = r.n || 0;
          const rate = r.rate !== undefined ? r.rate : rateOf(r.c || 0, n);
          return el('tr', { dataset: { task: t.id } },
            el('td', null, el('span', { class: 'badge badge--d' + t.domain + ' task-id', text: t.id })),
            el('td', { text: t.name }),
            el('td', { class: 'num', text: n ? (r.c || 0) + ' / ' + n : '—' }),
            el('td', null, el('span', { class: 'heat ' + heatClass(n, rate), text: n ? U.pct(rate) : '未回答' })),
            el('td', { class: 'num' }, navBtn('このタスクを練習', 'ghost btn--sm', 'practice', { tasks: [t.id], source: 'all', autoStart: true })));
        })))));

    // 苦手問題・模試履歴
    const weakIds = (safe(function () { return st.weakest(5); }, null) || []).filter(function (id) { return SAA.data.qById[id]; });
    const weakSec = el('section', null, el('h2', { class: 'section-title', text: '苦手な問題 トップ5' }));
    if (weakIds.length) {
      weakSec.appendChild(el('ul', { class: 'weak-list' }, weakIds.map(function (id) {
        const q = SAA.data.qById[id];
        const r = safe(function () { return st.getQ(id); }, null) || {};
        return el('li', { class: 'weak-item' },
          U.domainBadge(q.domain),
          el('span', { class: 'weak-item__topic', text: q.topic || id }),
          el('span', { class: 'weak-item__id', text: id }),
          el('span', { class: 'small muted', text: r.n ? (r.c || 0) + ' / ' + r.n + ' 正解' : '' }));
      })));
      weakSec.appendChild(el('div', { class: 'btn-row', style: { marginTop: '12px' } },
        navBtn('苦手な問題を復習する', 'primary', 'practice', { source: 'weak', count: 5, autoStart: true }),
        navBtn('間違えた問題をすべて復習', 'ghost', 'practice', { source: 'wrong', autoStart: true })));
    } else {
      weakSec.appendChild(emptyState('🌱', 'まだ苦手な問題はありません', '問題を解くと、間違えやすい問題がここに並びます。'));
    }

    const mockSec = el('section', null, el('h2', { class: 'section-title', text: '模擬試験の履歴' }));
    if (mocks.length) {
      mocks.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      mockSec.appendChild(el('div', { class: 'table-wrap' },
        el('table', { class: 'data-table' },
          el('thead', null, el('tr', null, el('th', { text: '日時' }), el('th', { class: 'num', text: '推定スコア' }), el('th', { class: 'num', text: '正答率' }), el('th', { text: '合否目安' }))),
          el('tbody', null, mocks.slice(0, 10).map(function (m) {
            const ok = (m.scaled || 0) >= pass;
            return el('tr', null,
              el('td', { text: U.fmtDate(m.at) }),
              el('td', { class: 'num', text: String(m.scaled || 0) }),
              el('td', { class: 'num', text: U.pct(m.rate) }),
              el('td', null, el('span', { class: 'badge badge--' + (ok ? 'ok' : 'ng'), text: ok ? '✓ 合格圏' : '▲ あと一歩' })));
          })))));
    } else {
      mockSec.appendChild(emptyState('⏱️', '模擬試験はまだ受けていません', '本番と同じ 65 問・130 分。仕上げの力試しにどうぞ。', navBtn('模擬試験へ', '', 'mock')));
    }
    scr.appendChild(el('div', { class: 'two-col', style: { marginTop: '32px' } }, weakSec, mockSec));
    container.appendChild(scr);
  }

  // ---------- ギャラリー ----------
  const ENDINGS = [
    { id: 'true', label: 'トゥルーエンド', icon: '🍁' },
    { id: 'good', label: 'グッドエンド', icon: '🎉' },
    { id: 'retry', label: 'リトライエンド', icon: '🔁' }
  ];
  function assetBox(key, opts) {
    return safe(function () { return (SAA.assets.box || SAA.assets.img)(key, opts); }, null) || el('span', { class: 'asset-ph', text: key });
  }

  function renderGallery(container) {
    const man = SAA.data.assets || {};
    const p = progress();
    const keys = Object.keys(man).filter(function (k) { return man[k].kind === 'cg'; });
    const isOpen = function (k) { return k === 'cg_title' || p.seenCg.indexOf(k) >= 0; };
    const opened = keys.filter(isOpen).length;
    const scr = el('div', { class: 'screen gallery-screen' });
    scr.appendChild(screenHeader('Gallery', 'ギャラリー', 'ストーリーで見たイベント CG がここに並びます。',
      [el('span', { class: 'badge badge--accent', text: '解放 ' + opened + ' / ' + keys.length })]));

    if (!keys.length) {
      scr.appendChild(emptyState('🖼️', 'CG は準備中です', ''));
    } else {
      scr.appendChild(el('div', { class: 'gallery-grid' }, keys.map(function (k) {
        const a = man[k];
        if (!isOpen(k)) {
          return el('button', { class: 'gallery-item is-locked', type: 'button', disabled: true, 'aria-label': '未解放の CG' },
            el('div', { class: 'gallery-item__lock' }, el('span', { 'aria-hidden': 'true', text: '🔒' }), el('span', { text: 'ストーリーを進めると解放' })),
            el('div', { class: 'gallery-item__cap' }, el('span', { text: '？？？' })));
        }
        return el('button', {
          class: 'gallery-item', type: 'button', 'aria-label': a.label + ' を拡大',
          onClick: function () {
            const view = el('div', { class: 'gallery-view' }, assetBox(k, { alt: a.label }));
            if (safe(function () { return SAA.assets.has(k); }, undefined) === false) {
              view.appendChild(el('p', { class: 'small muted', text: 'この CG の画像はまだ作成されていないため、プレースホルダーを表示しています（設定 → 画像アセットで確認できます）。' }));
            }
            U.modal({ title: a.label, wide: true, body: view });
          }
        },
          assetBox(k, { alt: a.label }),
          el('div', { class: 'gallery-item__cap' }, el('span', { text: a.label }), el('span', { 'aria-hidden': 'true', text: '🔍' })));
      })));
    }

    scr.appendChild(el('h2', { class: 'section-title', text: 'エンディング' }));
    scr.appendChild(el('div', { class: 'ending-row' }, ENDINGS.map(function (e) {
      const seen = p.endings.indexOf(e.id) >= 0;
      return el('span', { class: 'chip' + (seen ? ' is-active' : ''), text: seen ? e.icon + ' ' + e.label : '🔒 ？？？' });
    })));
    container.appendChild(scr);
  }

  // ---------- 設定 ----------
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
  }
  function settingRow(label, hint, control) {
    return el('div', { class: 'setting-row' },
      el('div', { class: 'setting-row__text' },
        el('span', { class: 'setting-row__label', text: label }),
        hint ? el('span', { class: 'setting-row__hint', text: hint }) : null),
      el('div', { class: 'setting-row__control' }, control));
  }
  function section(id, icon, title, desc) {
    const sec = el('section', { class: 'card settings-section', id: 'sec-' + id },
      el('div', { class: 'settings-section__head' },
        el('span', { class: 'settings-section__icon', 'aria-hidden': 'true', text: icon }),
        el('div', null,
          el('h2', { class: 'settings-section__title', text: title }),
          desc ? el('p', { class: 'settings-section__desc', text: desc }) : null)));
    return sec;
  }
  function rangeCtl(opts) {
    const value = el('span', { class: 'field__value', text: opts.format(opts.value) });
    const input = el('input', { type: 'range', min: String(opts.min), max: String(opts.max), step: String(opts.step), value: String(opts.value), 'aria-label': opts.label });
    setRangePct(input);
    input.addEventListener('input', function () {
      setRangePct(input);
      value.textContent = opts.format(parseFloat(input.value));
    });
    input.addEventListener('change', function () { opts.onChange(parseFloat(input.value)); });
    return el('div', { class: 'field' }, el('div', { class: 'field__label' }, el('span', { class: 'sr-only', text: opts.label }), el('span'), value), input);
  }

  let previewTimer = null;
  function stopPreview() { if (previewTimer) { clearInterval(previewTimer); previewTimer = null; } }

  function renderSettings(container) {
    const s = settings();
    const scr = el('div', { class: 'screen settings-screen' });
    scr.appendChild(screenHeader('Settings', '設定', '表示・テキスト・サウンド・質問チャット・データの管理ができます。'));

    const sections = [];
    const add = function (sec, navLabel, icon) { sections.push({ sec: sec, label: navLabel, icon: icon }); return sec; };

    // 表示
    const secView = add(section('view', '🎨', '表示', '画面の配色を選べます。'), '表示', '🎨');
    const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'テーマ' });
    const drawSeg = function () {
      U.clear(seg);
      const now = settings().theme || 'auto';
      [['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']].forEach(function (t) {
        seg.appendChild(el('button', {
          type: 'button', class: now === t[0] ? 'is-active' : '', 'aria-pressed': String(now === t[0]), text: t[1],
          onClick: function () { S.setSetting('theme', t[0]); applyTheme(t[0]); drawSeg(); }
        }));
      });
    };
    drawSeg();
    secView.appendChild(settingRow('テーマ', '「自動」は端末のライト／ダーク設定に合わせます。', seg));

    // テキスト
    const secText = add(section('text', '💬', 'テキスト', 'ストーリーの文字送りの速さです。'), 'テキスト', '💬');
    const previewBody = el('span');
    const preview = el('div', { class: 'text-preview', 'aria-hidden': 'true' }, el('span', { class: 'text-preview__name', text: '氷室 レン' }), previewBody);
    const SAMPLE = '要件を読め。制約を拾え。そうすれば選択肢は勝手に減る。';
    const playPreview = function () {
      stopPreview();
      const speed = settings().textSpeed;
      if (!speed || U.prefersReducedMotion()) { previewBody.textContent = SAMPLE; return; }
      let i = 0;
      previewBody.textContent = '';
      previewTimer = setInterval(function () {
        i += 1;
        previewBody.textContent = SAMPLE.slice(0, i);
        if (i >= SAMPLE.length || !preview.isConnected) stopPreview();
      }, 1000 / speed);
    };
    secText.appendChild(settingRow('文字の表示速度', '0 にすると一瞬で全文を表示します。', rangeCtl({
      label: '文字の表示速度', min: 0, max: 100, step: 5, value: s.textSpeed,
      format: function (v) { return v ? v + ' 文字/秒' : '瞬時'; },
      onChange: function (v) { S.setSetting('textSpeed', v); playPreview(); }
    })));
    secText.appendChild(preview);
    secText.appendChild(settingRow('オート送りの待ち時間', '読み終わってから次の文に進むまでの時間です。', rangeCtl({
      label: 'オート送りの待ち時間', min: 0.5, max: 3, step: 0.1, value: s.autoDelay,
      format: function (v) { return Number(v).toFixed(1) + ' 秒'; },
      onChange: function (v) { S.setSetting('autoDelay', Math.round(v * 10) / 10); }
    })));
    secText.appendChild(settingRow('未読の文もスキップする', 'オフの場合、スキップは一度読んだ文だけに働きます。',
      switchCtl(s.skipUnread, '未読の文もスキップする', function (v) { S.setSetting('skipUnread', v); })));
    playPreview();

    // 問題
    const secQuiz = add(section('quiz', '✏️', '問題', '問題演習の出し方です。'), '問題', '✏️');
    secQuiz.appendChild(settingRow('選択肢をシャッフルする', '毎回、選択肢の並び順を入れ替えます（位置で覚えてしまうのを防ぎます）。',
      switchCtl(s.shuffleOptions, '選択肢をシャッフルする', function (v) { S.setSetting('shuffleOptions', v); })));

    // サウンド
    const secSound = add(section('sound', '🔊', 'サウンド', 'BGM と効果音の音量です。'), 'サウンド', '🔊');
    const soundBox = el('div', { class: 'settings-module' });
    safe(function () { SAA.audio.renderSettings(soundBox); });
    if (!soundBox.children.length) {
      soundBox.appendChild(settingRow('ミュート', 'すべての音を消します。', switchCtl(s.muted, 'ミュート', function (v) {
        S.setSetting('muted', v);
        safe(function () { SAA.audio.setMuted(v); });
        renderTopbar();
      })));
      soundBox.appendChild(el('p', { class: 'module-fallback', text: '音量の詳細設定は準備中です。' }));
    }
    secSound.appendChild(soundBox);
    if (SAA.screens.sound) secSound.appendChild(el('div', { class: 'btn-row', style: { marginTop: '12px' } }, navBtn('🎵 サウンドルームを開く', 'ghost btn--sm', 'sound')));

    // 質問チャット
    const secChat = add(section('chat', '🤖', '質問チャット', 'レン先輩への質問（Claude API）の設定です。API キーが無くてもオフライン回答が使えます。'), '質問チャット', '🤖');
    const chatBox = el('div', { class: 'settings-module' });
    safe(function () { SAA.chat.renderSettings(chatBox); });
    if (!chatBox.children.length) chatBox.appendChild(el('p', { class: 'module-fallback', text: '質問チャットの設定は準備中です。' }));
    secChat.appendChild(chatBox);

    // データ
    const secData = add(section('data', '💾', 'データ', '学習記録・メモ・設定はこのブラウザーの中だけに保存されます。'), 'データ', '💾');
    const persistent = safe(function () { return S.isPersistent(); }, false);
    secData.appendChild(el('p', { class: 'storage-state' + (persistent ? '' : ' is-volatile') },
      persistent ? '保存先：このブラウザー（localStorage）に保存されています。' : '保存できません：このブラウザーでは保存が無効のため、ページを閉じると記録が消えます。'));
    secData.appendChild(settingRow('バックアップを書き出す', '学習記録・メモ・設定を JSON ファイルに保存します（API キーは含まれません）。',
      btn('⬇ エクスポート', '', function () {
        const d = new Date();
        const p2 = function (n) { return String(n).padStart(2, '0'); };
        const name = 'saa03-backup-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.json';
        try { U.download(name, S.exportAll(), 'application/json'); U.toast('バックアップを書き出しました。', 'ok'); } catch (e) { console.error(e); U.toast('書き出しに失敗しました。', 'ng'); }
      })));
    secData.appendChild(settingRow('バックアップを読み込む', 'エクスポートした JSON ファイルを読み込み、現在のデータに上書きします。',
      btn('⬆ インポート', '', function () {
        U.pickFile('.json,application/json').then(function (json) {
          if (!S.importAll(json)) { U.toast('このファイルは読み込めませんでした（形式が違います）。', 'ng'); return; }
          U.toast('読み込みました。ページを再読み込みします。', 'ok');
          setTimeout(function () { location.reload(); }, 700);
        }).catch(function (e) { U.toast((e && e.message) || 'ファイルを読み込めませんでした。', 'warn'); });
      })));
    secData.appendChild(settingRow('すべてのデータを消去', 'ストーリーの進行・正答記録・メモ・チャット履歴・設定・API キーを消して初期状態に戻します。',
      btn('🗑 全データ消去', 'danger', function () {
        U.confirm('すべての学習データを消去します。この操作は取り消せません。\n必要なら先にエクスポートしてください。本当に消去しますか？', { title: '全データ消去', okLabel: 'すべて消去する', danger: true })
          .then(function (ok) {
            if (!ok) return;
            S.resetAll();
            safe(function () { S.session.remove('chat.apiKey'); });
            location.reload();
          });
      })));

    // 画像アセット
    const secAssets = add(section('assets', '🖼️', '画像アセット', '立ち絵・背景・CG の画像がそろっているかを確認します。画像が無くてもプレースホルダーで動きます。'), '画像アセット', '🖼️');
    secAssets.appendChild(el('div', { class: 'btn-row' }, navBtn('画像アセットを確認する', '', 'assets')));

    // 操作方法
    const secKeys = add(section('keys', '⌨️', 'キーボード操作', ''), '操作方法', '⌨️');
    const keyRow = function (keys, desc) {
      return [el('dt', null, keys.map(function (k, i) { return [i ? ' / ' : '', el('span', { class: 'kbd', text: k })]; })), el('dd', { text: desc })];
    };
    secKeys.appendChild(el('dl', { class: 'key-list' },
      keyRow(['M'], 'メモを開く／閉じる'),
      keyRow(['C'], '質問チャットを開く／閉じる'),
      keyRow(['Esc'], 'パネルやダイアログを閉じる（ストーリー中はメニュー）'),
      keyRow(['Enter', 'Space'], 'ストーリーの文を送る・問題の回答を確定する'),
      keyRow(['1〜6', 'A〜F'], '問題の選択肢を選ぶ'),
      keyRow(['L'], 'ストーリーのバックログ'),
      keyRow(['A'], 'オート送り'),
      keyRow(['H'], 'ストーリーの UI を隠す')));

    const nav = el('nav', { class: 'settings-nav', 'aria-label': '設定の項目' }, sections.map(function (x) {
      return el('a', {
        href: '#settings', onClick: function (e) {
          e.preventDefault();
          safe(function () { x.sec.scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }); });
        }
      }, el('span', { 'aria-hidden': 'true', text: x.icon }), x.label);
    }));
    scr.appendChild(el('div', { class: 'settings-layout' }, nav, el('div', { class: 'settings-sections' }, sections.map(function (x) { return x.sec; }))));
    container.appendChild(scr);
  }

  // ---------- 画像アセット ----------
  function renderAssets(container) {
    const scr = el('div', { class: 'screen assets-screen' });
    scr.appendChild(screenHeader('Assets', '画像アセット', 'アプリで使う画像の一覧と、ファイルが置かれているかどうかの確認です。'));
    const box = el('div');
    scr.appendChild(box);
    container.appendChild(scr);
    safe(function () { SAA.assets.renderChecker(box); });
    if (!box.children.length) box.appendChild(emptyState('🖼️', '画像チェッカーは準備中です', ''));
  }

  // ---------- 画面登録 ----------
  function registerCoreScreens() {
    registerScreen('title', { title: 'タイトル', topbar: false, render: renderTitle });
    registerScreen('chapters', { title: 'チャプター選択', render: renderChapters });
    registerScreen('notes', { title: '講義ノート', render: renderNotes });
    registerScreen('glossary', { title: '用語集', render: renderGlossary });
    registerScreen('stats', { title: '学習記録', render: renderStats });
    registerScreen('gallery', { title: 'ギャラリー', render: renderGallery });
    registerScreen('settings', { title: '設定', render: renderSettings, leave: stopPreview });
    registerScreen('assets', { title: '画像アセット', render: renderAssets });
  }

  // ---------- 起動 ----------
  let booted = false;
  function initAudioOnce() {
    let done = false;
    const handler = function () {
      if (done) return;
      done = true;
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('keydown', handler, true);
      safe(function () { SAA.audio.init(); });
    };
    window.addEventListener('pointerdown', handler, true);
    window.addEventListener('keydown', handler, true);
  }

  function onGlobalKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (U.isTyping(e)) return;
    const key = e.key;
    if (key === 'Escape') {
      if (U.hasModal()) return;
      if (safe(function () { return SAA.dock.isOpen(); }, false)) { e.preventDefault(); safe(function () { SAA.dock.close(); }); }
      return;
    }
    if (U.hasModal()) return;
    if (key === 'm' || key === 'M') { e.preventDefault(); safe(function () { SAA.dock.toggle('memo'); }); }
    else if (key === 'c' || key === 'C') { e.preventDefault(); safe(function () { SAA.dock.toggle('chat'); }); }
  }

  function boot() {
    if (booted) return;
    booted = true;
    const s = settings();
    applyTheme(s.theme);
    safe(function () {
      const v = s.volume || {};
      ['master', 'bgm', 'sfx'].forEach(function (k) { if (typeof v[k] === 'number') SAA.audio.setVolume(k, v[k]); });
      SAA.audio.setMuted(!!s.muted);
    });
    registerCoreScreens();
    renderTopbar();
    safe(function () { if (SAA.dock && typeof SAA.dock.init === 'function') SAA.dock.init(); });

    SAA.bus.on('settings:change', function (p) {
      if (!p) return;
      if (p.key === 'theme') applyTheme(p.value);
      if (p.key === 'muted') renderTopbar();
    });
    // window のバブリング段階で受ける（問題やストーリー側が先に preventDefault できるように）
    window.addEventListener('keydown', onGlobalKey);
    window.addEventListener('hashchange', function () {
      const id = hashId();
      if (id && (!current || current.id !== id)) go(id);
    });
    initAudioOnce();

    const first = hashId();
    go(first && SAA.screens[first] ? first : 'title', {});
    if (first && !SAA.screens[first]) U.toast('「' + first + '」の画面は準備中です。', 'warn');
    SAA.bus.emit('app:ready', {});
  }

  SAA.app = {
    go: go,
    back: back,
    registerScreen: registerScreen,
    current: function () { return current ? { id: current.id, params: current.params } : null; },
    setTopbar: setTopbar,
    _test: { applyTheme: applyTheme, stack: function () { return stack.slice(); } }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
