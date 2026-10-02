/* ビジュアルノベル・エンジン（ストーリー画面）：SPEC §4.5 / §5 / §8 SAA.story */
(function () {
  'use strict';

  const U = SAA.util;
  const POS = { left: 22, center: 50, right: 78 };
  const FX_LIST = ['shake', 'flash', 'heart', 'sparkle', 'fadeout', 'fadein'];
  const TRANS = ['fade', 'cut'];
  const ENDINGS = ['true', 'good', 'retry'];
  // コマンド判定の優先順（オプションキーと衝突しないように並べる：{bg, fx}・{if, jump}・{say, sfx} など）
  const CMD_ORDER = ['title', 'if', 'branch', 'choice', 'quiz', 'lab', 'mock', 'say', 'narr', 'show', 'hide',
    'bg', 'cg', 'slide', 'bgm', 'sfx', 'fx', 'wait', 'label', 'jump', 'ending', 'end'];
  const STOP_SKIP = { title: 1, choice: 1, quiz: 1, lab: 1, mock: 1, end: 1 };
  const MAX_NONBLOCK = 3000; // 待ちの無いステップが連続しすぎたら無限ループとみなす

  let S = null; // マウント中の状態（DOM・実行状態）

  // ---------- 小物 ----------
  const has = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  function chars() { return (SAA.data && SAA.data.characters) || {}; }
  function manifest() { return (SAA.data && SAA.data.assets) || {}; }
  function curriculum() { return (SAA.data && SAA.data.curriculum) || { chapters: [], mockExams: {}, groups: {} }; }
  function chapterDef(id) { return (U.chapter && U.chapter(id)) || null; }
  function cmdOf(step) {
    if (!step || typeof step !== 'object') return null;
    for (let i = 0; i < CMD_ORDER.length; i++) if (has(step, CMD_ORDER[i])) return CMD_ORDER[i];
    return null;
  }
  function settings() {
    if (!S.settings) {
      try { S.settings = SAA.store.getSettings(); } catch (e) { S.settings = { textSpeed: 40, autoDelay: 1.2, skipUnread: false, shuffleOptions: true }; }
    }
    return S.settings;
  }
  function sfx(id, opts) {
    try { if (SAA.audio && SAA.audio.playSfx) SAA.audio.playSfx(id, opts); } catch (e) { /* noop */ }
  }
  function toast(msg, kind) { try { U.toast(msg, kind); } catch (e) { /* noop */ } }
  function reduced() { try { return U.prefersReducedMotion(); } catch (e) { return false; } }
  function reflow(el) { return el && el.offsetWidth; }
  function btn(cls, label, onClick, attrs) {
    const b = U.el('button', Object.assign({ type: 'button', class: cls, dataset: { noadv: '1' } }, attrs || {}), label);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      try { b.blur(); } catch (er) { /* noop */ }
      onClick(e);
    });
    return b;
  }
  function later(fn, ms) {
    if (!S) return null;
    const t = setTimeout(function () {
      if (S) S.timers.delete(t);
      fn();
    }, ms);
    S.timers.add(t);
    return t;
  }
  function delay(ms) { return new Promise(function (r) { later(r, Math.max(0, ms || 0)); }); }
  function alive(gen) { return !!S && S.gen === gen; }

  // ---------- 進捗 ----------
  function defProgress() { return { last: null, chapters: {}, flags: {}, vars: {}, seenCg: [], endings: [] }; }
  function normP(p) {
    p = (p && typeof p === 'object' && !Array.isArray(p)) ? p : defProgress();
    if (!p.chapters || typeof p.chapters !== 'object') p.chapters = {};
    if (!p.flags || typeof p.flags !== 'object') p.flags = {};
    if (!p.vars || typeof p.vars !== 'object') p.vars = {};
    if (!Array.isArray(p.seenCg)) p.seenCg = [];
    if (!Array.isArray(p.endings)) p.endings = [];
    return p;
  }
  function getP() {
    try { return normP(SAA.store.get('progress', defProgress())); } catch (e) { return defProgress(); }
  }
  function updP(fn) {
    try {
      return SAA.store.update('progress', function (p) { p = normP(p); fn(p); return p; }, defProgress());
    } catch (e) { console.error('[story] progress', e); return null; }
  }
  function chapterEntry(p, id) {
    if (!p.chapters[id] || typeof p.chapters[id] !== 'object') {
      p.chapters[id] = { step: 0, maxStep: 0, done: false, startedAt: Date.now(), finishedAt: null };
    }
    return p.chapters[id];
  }
  function save() {
    if (!S || !S.chapterId) return;
    const id = S.chapterId; const idx = S.idx;
    S.maxStep = Math.max(S.maxStep, idx);
    const maxStep = S.maxStep;
    updP(function (p) {
      const c = chapterEntry(p, id);
      c.step = idx;
      c.maxStep = Math.max(c.maxStep || 0, maxStep);
      p.last = { chapter: id, step: idx };
    });
    // app の履歴が同じ params を保持していれば「戻る」で現在位置から再開できる
    if (S.params && S.params.chapter === id) S.params.step = idx;
  }

  // ---------- 学習コンテキスト ----------
  function storyTitle() {
    const ch = chapterDef(S.chapterId) || {};
    const st = S.story || {};
    return { title: ch.title || st.title || S.chapterId, sub: ch.sub || st.sub || '' };
  }
  function setStoryContext() {
    if (!S || !S.chapterId) return;
    const t = storyTitle();
    const ch = chapterDef(S.chapterId) || {};
    const slideTitles = (ch.slides || []).map(function (sid) { const s = SAA.data.slides[sid]; return s ? s.title : null; }).filter(Boolean);
    let summary = '学習者はストーリー「' + t.title + (t.sub ? '　' + t.sub : '') + '」を進めています。';
    if (slideTitles.length) summary += '\nこの章の講義スライド：' + slideTitles.join(' / ');
    SAA.setContext({ kind: 'story', key: 'story:' + S.chapterId, id: S.chapterId, title: 'ストーリー｜' + t.title + (t.sub ? ' ' + t.sub : ''), summary: summary, reveal: false });
  }
  function slideText(s) {
    const strip = function (x) { return String(x === undefined || x === null ? '' : x).replace(/\*\*|`/g, ''); };
    const out = [s.title];
    if (s.lead) out.push(strip(s.lead));
    if (Array.isArray(s.columns)) out.push(s.columns.map(strip).join(' | '));
    (s.rows || []).forEach(function (r) { out.push((r || []).map(strip).join(' | ')); });
    (s.bullets || []).forEach(function (b) { out.push('・' + strip(b).trim().replace(/^-\s*/, '')); });
    (s.items || []).forEach(function (it) { out.push((it.tag ? '[' + it.tag + '] ' : '') + it.title + '：' + strip(it.body)); });
    (s.steps || []).forEach(function (st, i) { out.push((i + 1) + '. ' + st.title + (st.body ? '：' + strip(st.body) : '')); });
    if (s.note) out.push('試験のツボ：' + strip(s.note));
    return out.join('\n').slice(0, 3000);
  }
  function setSlideContext(id) {
    const s = SAA.data.slides[id];
    if (!s) return;
    SAA.setContext({ kind: 'slide', key: 'slide:' + id, id: id, title: 'スライド｜' + s.title, summary: slideText(s), reveal: true });
  }

  // ---------- DOM 構築 ----------
  function buildStage(container) {
    const el = U.el;
    const m = {};
    m.stage = el('div', { class: 'vn-stage', role: 'application', 'aria-label': 'ストーリー' });
    m.backdrop = el('div', { class: 'vn-backdrop', 'aria-hidden': 'true' });
    m.frame = el('div', { class: 'vn-frame' });
    m.scene = el('div', { class: 'vn-scene' });
    m.bg = el('div', { class: 'vn-bg', 'aria-hidden': 'true' });
    m.chars = el('div', { class: 'vn-chars', 'aria-hidden': 'true' });
    m.cg = el('div', { class: 'vn-cg', 'aria-hidden': 'true' });
    m.fx = el('div', { class: 'vn-fx', 'aria-hidden': 'true' });
    m.fade = el('div', { class: 'vn-fade', 'aria-hidden': 'true' });
    m.scene.append(m.bg, m.chars, m.cg, m.fx, m.fade);

    // ホワイトボード（スライド）
    m.slideTitle = el('span', { class: 'vn-slide__name' });
    m.slideMinBtn = btn('vn-slide__icon', '－', function () { toggleSlideMin(); }, { title: '最小化', 'aria-label': '最小化' });
    m.slideBody = el('div', { class: 'vn-slide__body' });
    m.slide = el('section', { class: 'vn-slide', dataset: { noadv: '1' }, 'aria-label': 'ホワイトボード' },
      el('header', { class: 'vn-slide__bar' },
        el('span', { class: 'vn-slide__label', text: '📋 ホワイトボード' }),
        m.slideTitle,
        el('span', { class: 'vn-slide__tools' },
          btn('vn-slide__act', '📝 メモ', function () { slideDock('memo'); }, { title: 'このスライドのメモ' }),
          btn('vn-slide__act', '💬 質問', function () { slideDock('chat'); }, { title: 'このスライドについて質問' }),
          m.slideMinBtn,
          btn('vn-slide__icon', '✕', function () { closeSlide(true); }, { title: '閉じる', 'aria-label': '閉じる' }))),
      m.slideBody);
    m.slide.querySelector('.vn-slide__bar').addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      e.stopPropagation();
      if (m.slide.classList.contains('is-min')) toggleSlideMin();
    });

    // 会話ウィンドウ
    m.name = el('div', { class: 'vn-name' });
    m.textShown = el('span', { class: 'vn-text__shown' });
    m.textRest = el('span', { class: 'vn-text__rest', 'aria-hidden': 'true' });
    m.caret = el('span', { class: 'vn-caret', 'aria-hidden': 'true', text: '▼' });
    m.text = el('div', { class: 'vn-text' }, m.textShown, m.textRest, m.caret);
    m.btnAuto = btn('vn-ctl', 'オート', function () { toggleAuto(); }, { title: 'オート (A)', 'aria-pressed': 'false' });
    m.btnSkip = btn('vn-ctl', 'スキップ', function () { toggleSkip(); }, { title: 'スキップ (Ctrl長押し / S)', 'aria-pressed': 'false' });
    m.ctrls = el('div', { class: 'vn-ctrls', dataset: { noadv: '1' } },
      m.btnAuto, m.btnSkip,
      btn('vn-ctl', 'ログ', function () { openBacklog(); }, { title: 'バックログ (L)' }),
      btn('vn-ctl', '非表示', function () { setHidden(true); }, { title: 'UIを隠す (H / 右クリック)' }),
      btn('vn-ctl', 'メニュー', function () { openMenu(); }, { title: 'メニュー (Esc)' }));
    m.dialog = el('section', { class: 'vn-dialog', 'aria-live': 'polite' }, m.name, m.text, m.ctrls);
    m.frame.append(m.scene, m.slide, m.dialog);

    // ミニツールバー
    m.btnMute = btn('vn-tb', '🔊', function () { toggleMute(); }, { title: 'サウンド', 'aria-label': 'サウンドのオン/オフ' });
    m.toolbar = el('div', { class: 'vn-toolbar', dataset: { noadv: '1' } },
      btn('vn-tb', '≡', function () { openMenu(); }, { title: 'メニュー', 'aria-label': 'メニュー' }),
      btn('vn-tb', '📝', function () { try { SAA.dock.toggle('memo'); } catch (e) { /* noop */ } }, { title: 'メモ (M)', 'aria-label': 'メモ' }),
      btn('vn-tb', '💬', function () { try { SAA.dock.toggle('chat'); } catch (e) { /* noop */ } }, { title: '質問チャット (C)', 'aria-label': '質問チャット' }),
      m.btnMute);

    m.stage.append(m.backdrop, m.frame, m.toolbar);
    container.appendChild(m.stage);
    return m;
  }

  // ---------- 背景・CG ----------
  function applyBgSafe(el, key) {
    try { if (SAA.assets && SAA.assets.applyBg) SAA.assets.applyBg(el, key); } catch (e) { /* noop */ }
    // アセットモジュールが無い場合の保険（プレースホルダーのグラデーション）
    if (!el.style.backgroundImage && !el.style.background && !el.firstChild) {
      const a = manifest()[key];
      if (a && a.ph) el.style.backgroundImage = a.ph;
      if (a && a.label && !el.classList.contains('vn-backdrop__layer')) {
        el.appendChild(U.el('span', { class: 'vn-ph-label', text: (a.icon ? a.icon + ' ' : '') + a.label }));
      }
    }
  }
  function setBg(key, mode, instant) {
    if (!S) return Promise.resolve();
    const m = S.m;
    S.bgKey = key;
    const layer = U.el('div', { class: 'vn-bg__layer' });
    applyBgSafe(layer, key);
    const olds = Array.prototype.slice.call(m.bg.children);
    m.bg.appendChild(layer);
    // 外枠（レターボックス）用のぼかしコピー
    U.clear(m.backdrop);
    const bl = U.el('div', { class: 'vn-backdrop__layer' });
    applyBgSafe(bl, key);
    m.backdrop.appendChild(bl);
    const cut = instant || mode === 'cut' || skipActive() || reduced();
    if (cut) {
      layer.classList.add('is-on', 'no-anim');
      olds.forEach(function (o) { o.remove(); });
      return Promise.resolve();
    }
    reflow(layer);
    layer.classList.add('is-on');
    later(function () { olds.forEach(function (o) { o.remove(); }); }, 750);
    return delay(520);
  }
  function setCg(key, instant) {
    const m = S.m;
    if (!key) {
      S.cgKey = null;
      m.cg.classList.remove('is-on');
      if (instant) U.clear(m.cg);
      else later(function () { if (S && !S.cgKey) U.clear(S.m.cg); }, 600);
      return;
    }
    S.cgKey = key;
    U.clear(m.cg);
    const a = manifest()[key] || {};
    const back = U.el('div', { class: 'vn-cg__back' });
    applyBgSafe(back, key);
    m.cg.appendChild(back);
    let img = null;
    try { img = SAA.assets.img(key, { cls: 'vn-cg__img', alt: a.label || '' }); } catch (e) { img = null; }
    if (img && img.tagName === 'IMG') m.cg.appendChild(img);
    if (instant) m.cg.classList.add('no-anim');
    reflow(m.cg);
    m.cg.classList.add('is-on');
    if (instant) { reflow(m.cg); m.cg.classList.remove('no-anim'); }
    updP(function (p) { if (p.seenCg.indexOf(key) < 0) p.seenCg.push(key); });
  }

  // ---------- キャラクター ----------
  function charRec(id) { return S.chars[id] || null; }
  function setFace(rec, face, instant) {
    rec.face = face;
    let sp = null;
    try { sp = SAA.assets.sprite(rec.id, face); } catch (e) { sp = null; }
    if (!sp) sp = U.el('span', { class: 'asset-ph asset-ph--sprite', text: rec.id + ':' + face });
    const holder = U.el('div', { class: 'vn-char__img' }, sp);
    const olds = Array.prototype.slice.call(rec.fig.children);
    rec.fig.appendChild(holder);
    if (instant || !olds.length) { olds.forEach(function (o) { o.remove(); }); return; }
    olds.forEach(function (o) { o.classList.add('is-leaving'); });
    later(function () { olds.forEach(function (o) { o.remove(); }); }, 260);
  }
  function showChar(id, face, at, instant) {
    const c = chars()[id];
    if (!c) { console.warn('[story] 不明なキャラクター: ' + id); return; }
    let rec = charRec(id);
    if (!rec) {
      const fig = U.el('div', { class: 'vn-char__fig' });
      const node = U.el('div', { class: 'vn-char vn-char--' + id, style: { '--who-color': c.color || '' }, dataset: { char: id } }, fig);
      rec = { id: id, el: node, fig: fig, face: null, at: null, visible: false };
      S.chars[id] = rec;
      S.m.chars.appendChild(node);
    }
    const f = face && c.faces && c.faces[face] ? face : (face ? (console.warn('[story] 不明な表情: ' + id + '/' + face), rec.face || c.defaultFace || 'normal') : (rec.face || c.defaultFace || 'normal'));
    const pos = POS[at] !== undefined ? at : (rec.visible && rec.at ? rec.at : (POS[c.side] !== undefined ? c.side : 'center'));
    if (rec.face !== f) setFace(rec, f, instant || !rec.visible);
    if (instant) rec.el.classList.add('no-anim');
    rec.at = pos;
    rec.el.dataset.at = pos;
    rec.el.style.left = POS[pos] + '%';
    if (!rec.visible) {
      rec.visible = true;
      reflow(rec.el);
      rec.el.classList.add('is-on');
    }
    if (instant) { reflow(rec.el); rec.el.classList.remove('no-anim'); }
  }
  function hideChar(id, instant) {
    const ids = id === '*' ? Object.keys(S.chars) : [id];
    ids.forEach(function (k) {
      const rec = charRec(k);
      if (!rec) return;
      rec.visible = false;
      if (instant) rec.el.classList.add('no-anim');
      rec.el.classList.remove('is-on', 'is-speaking', 'is-dim');
      if (instant) { reflow(rec.el); rec.el.classList.remove('no-anim'); }
    });
  }
  function setSpeaker(id) {
    Object.keys(S.chars).forEach(function (k) {
      const rec = S.chars[k];
      rec.el.classList.toggle('is-speaking', !!id && k === id && rec.visible);
      rec.el.classList.toggle('is-dim', !!id && k !== id);
    });
  }

  // ---------- 会話 ----------
  function skipActive() { return !!S && (S.skip || S.ctrlHeld); }
  function canSkip(idx) { return !!settings().skipUnread || idx < S.maxStep; }
  function updateCtrls() {
    if (!S) return;
    const m = S.m;
    m.btnAuto.classList.toggle('is-on', !!S.auto);
    m.btnAuto.setAttribute('aria-pressed', S.auto ? 'true' : 'false');
    m.btnSkip.classList.toggle('is-on', skipActive());
    m.btnSkip.setAttribute('aria-pressed', skipActive() ? 'true' : 'false');
    m.stage.classList.toggle('is-skipping', skipActive());
  }
  function stopSkip(notify) {
    if (!S || !skipActive()) return;
    S.skip = false;
    S.ctrlHeld = false;
    updateCtrls();
    if (notify) toast('未読のテキストに到達したため、スキップを停止しました', 'info');
  }
  function stopTyper() {
    if (S && S.typer && S.typer.timer) clearTimeout(S.typer.timer);
  }
  function renderTyped(str, n) {
    S.m.textShown.textContent = str.slice(0, n);
    S.m.textRest.textContent = str.slice(n);
  }
  function finishTyping() {
    const t = S.typer;
    if (!t) return;
    if (t.timer) clearTimeout(t.timer);
    t.timer = null;
    t.done = true;
    renderTyped(t.str, t.str.length);
    S.m.dialog.classList.add('is-done');
    scheduleNext();
  }
  function typeText(str, instant) {
    stopTyper();
    const t = { str: str, n: 0, done: false, timer: null, t0: performance.now() };
    S.typer = t;
    S.m.dialog.classList.remove('is-done');
    renderTyped(str, 0);
    const sp = Number(settings().textSpeed);
    if (instant || !(sp > 0)) { finishTyping(); return; }
    const tick = function () {
      if (!S || S.typer !== t || t.done) return;
      const speed = Number(settings().textSpeed);
      if (!(speed > 0)) { finishTyping(); return; }
      const n = Math.min(str.length, Math.floor((performance.now() - t.t0) / 1000 * speed) + 1);
      if (n !== t.n) { t.n = n; renderTyped(str, n); }
      if (n >= str.length) finishTyping();
      else t.timer = setTimeout(tick, 22);
    };
    tick();
  }
  function scheduleNext() {
    if (!S) return;
    clearTimeout(S.autoTimer);
    S.autoTimer = null;
    const w = S.wait;
    if (!w || w.kind !== 'line' || !S.typer || !S.typer.done) return;
    if (overlayOpen() || S.hidden) return;
    if (skipActive()) {
      if (canSkip(w.idx)) { S.autoTimer = setTimeout(function () { resolveWait(false); }, 40); return; }
      stopSkip(true);
    }
    if (S.auto) {
      const s = settings();
      const ms = Math.max(400, (Number(s.autoDelay) || 1.2) * 1000 + 25 * w.chars);
      S.autoTimer = setTimeout(function () { resolveWait(false); }, ms);
    }
  }
  function resolveWait(user) {
    if (!S || !S.wait) return;
    const w = S.wait;
    S.wait = null;
    clearTimeout(S.autoTimer);
    S.autoTimer = null;
    if (user && w.kind === 'line') sfx('advance', { volume: 0.45 });
    w.resolve();
  }
  function advance() {
    if (!S || !S.wait) return;
    if (S.wait.kind === 'line' && S.typer && !S.typer.done) { finishTyping(); return; }
    resolveWait(true);
  }
  function lineInfo(step) {
    if (typeof step.narr === 'string' || has(step, 'narr')) return { who: null, name: '', color: '', text: String(step.narr || ''), inner: false, narr: true };
    const id = step.say;
    const c = chars()[id];
    return {
      who: c ? id : null,
      name: c ? c.name : String(step.name || id || ''),
      color: c ? c.color : '',
      text: String(step.text === undefined || step.text === null ? '' : step.text),
      inner: !!step.inner,
      narr: false
    };
  }
  function showLine(step, idx) {
    const m = S.m;
    const info = lineInfo(step);
    if (info.who) {
      const rec = charRec(info.who);
      if (!rec || !rec.visible) showChar(info.who, step.face, null, false);
      else if (step.face) showChar(info.who, step.face, null, false);
    }
    setSpeaker(info.narr ? null : (info.who || '__npc'));
    if (step.sfx && !skipActive()) sfx(step.sfx);
    // 名前欄
    m.dialog.classList.toggle('is-narr', info.narr);
    m.dialog.classList.toggle('is-inner', info.inner);
    m.name.textContent = info.name;
    m.name.hidden = info.narr || !info.name;
    if (info.color) m.dialog.style.setProperty('--who-color', info.color);
    else m.dialog.style.removeProperty('--who-color');
    m.dialog.dataset.who = info.who || (info.narr ? 'narr' : 'npc');
    m.dialog.classList.remove('is-idle');
    const shown = info.inner ? '（' + info.text + '）' : info.text;
    S.backlog.push({ name: info.narr ? '' : info.name, color: info.color, text: shown, inner: info.inner, narr: info.narr });
    if (S.backlog.length > 400) S.backlog.shift();
    S.nonBlock = 0;
    return new Promise(function (resolve) {
      S.wait = { kind: 'line', idx: idx, resolve: resolve, chars: shown.length };
      let instant = false;
      if (skipActive()) {
        if (canSkip(idx)) instant = true;
        else stopSkip(true);
      }
      typeText(shown, instant);
    });
  }

  // ---------- オーバーレイ ----------
  function overlayOpen() {
    if (!S) return false;
    return Object.keys(S.overlays).length > 0 || (U.hasModal && U.hasModal());
  }
  function openOverlay(name, node) {
    closeOverlay(name, true);
    S.overlays[name] = node || true;
    if (node) {
      node.dataset.noadv = '1';
      S.m.stage.appendChild(node);
      reflow(node);
      node.classList.add('is-open');
    }
    clearTimeout(S.autoTimer);
    S.autoTimer = null;
  }
  function closeOverlay(name, silent) {
    if (!S || !S.overlays[name]) return;
    const node = S.overlays[name];
    delete S.overlays[name];
    if (node && node !== true) {
      node.classList.remove('is-open');
      if (silent || reduced()) node.remove();
      else setTimeout(function () { node.remove(); }, 220);
    }
    if (!silent) scheduleNext();
  }
  function ovShell(cls, label) {
    return U.el('div', { class: 'vn-ov ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': label || '' });
  }

  function openMenu() {
    if (!S || S.overlays.menu) return;
    if (S.overlays.end) return;
    const t = S.chapterId ? storyTitle() : { title: 'ストーリー', sub: '' };
    const go = function (id, params) { return function () { closeOverlay('menu', true); try { SAA.app.go(id, params || {}); } catch (e) { console.error(e); } }; };
    const panel = U.el('div', { class: 'vn-menu' },
      U.el('div', { class: 'vn-menu__head' },
        U.el('span', { class: 'vn-menu__kicker', text: 'MENU' }),
        U.el('strong', { class: 'vn-menu__title', text: t.title }),
        t.sub ? U.el('span', { class: 'vn-menu__sub', text: t.sub }) : null),
      U.el('div', { class: 'vn-menu__list' },
        btn('vn-menu__btn is-primary', '▶ 続ける', function () { closeOverlay('menu'); }),
        btn('vn-menu__btn', '🏠 タイトルへ', go('title')),
        btn('vn-menu__btn', '📚 チャプター選択', go('chapters')),
        btn('vn-menu__btn', '📈 学習記録', go('stats')),
        btn('vn-menu__btn', '⚙ 設定', go('settings'))),
      U.el('p', { class: 'vn-menu__hint', text: 'Enter / クリック：進む　A：オート　Ctrl：スキップ　L：ログ　H：非表示' }));
    const ov = ovShell('vn-ov--menu', 'メニュー');
    ov.appendChild(panel);
    ov.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === ov) closeOverlay('menu'); });
    openOverlay('menu', ov);
    sfx('open');
    const first = panel.querySelector('.vn-menu__btn');
    if (first) setTimeout(function () { try { first.focus(); } catch (e) { /* noop */ } }, 30);
  }

  function openBacklog() {
    if (!S || S.overlays.backlog || S.overlays.end) return;
    const list = U.el('ol', { class: 'vn-log__list' });
    if (!S.backlog.length) list.appendChild(U.el('li', { class: 'vn-log__empty', text: 'まだ表示されたテキストはありません。' }));
    S.backlog.forEach(function (b) {
      list.appendChild(U.el('li', { class: 'vn-log__item' + (b.narr ? ' is-narr' : '') + (b.inner ? ' is-inner' : ''), style: b.color ? { '--who-color': b.color } : null },
        b.name ? U.el('span', { class: 'vn-log__name', text: b.name }) : null,
        U.el('p', { class: 'vn-log__text', text: b.text })));
    });
    const ov = ovShell('vn-ov--log', 'バックログ');
    const panel = U.el('div', { class: 'vn-log' },
      U.el('header', { class: 'vn-log__head' },
        U.el('strong', { text: '📜 バックログ' }),
        U.el('span', { class: 'vn-log__count', text: S.backlog.length + '件' }),
        btn('vn-log__close', '✕', function () { closeOverlay('backlog'); }, { 'aria-label': '閉じる' })),
      U.el('div', { class: 'vn-log__scroll' }, list));
    ov.appendChild(panel);
    ov.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === ov) closeOverlay('backlog'); });
    ov.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); closeOverlay('backlog'); });
    openOverlay('backlog', ov);
    const sc = panel.querySelector('.vn-log__scroll');
    sc.scrollTop = sc.scrollHeight;
    requestAnimationFrame(function () { sc.scrollTop = sc.scrollHeight; });
  }

  function setHidden(v) {
    if (!S) return;
    S.hidden = !!v;
    S.m.stage.classList.toggle('is-ui-hidden', S.hidden);
    if (!S.hidden) scheduleNext();
    else { clearTimeout(S.autoTimer); S.autoTimer = null; }
  }
  function toggleAuto() {
    S.auto = !S.auto;
    updateCtrls();
    scheduleNext();
  }
  function toggleSkip() {
    S.skip = !S.skip;
    if (!S.skip) S.ctrlHeld = false;
    updateCtrls();
    kickSkip();
  }
  function kickSkip() {
    if (!S || !S.wait || S.wait.kind !== 'line') return;
    if (skipActive() && S.typer && !S.typer.done && canSkip(S.wait.idx)) { finishTyping(); return; }
    scheduleNext();
  }
  function updateMuteIcon() {
    if (!S) return;
    let muted = false;
    try { muted = SAA.audio && SAA.audio.isMuted ? !!SAA.audio.isMuted() : false; } catch (e) { muted = false; }
    S.m.btnMute.textContent = muted ? '🔇' : '🔊';
    S.m.btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }
  function toggleMute() {
    try {
      const next = !SAA.audio.isMuted();
      SAA.audio.init && SAA.audio.init();
      SAA.audio.setMuted(next);
      if (SAA.store.setSetting) SAA.store.setSetting('muted', next);
    } catch (e) { /* noop */ }
    updateMuteIcon();
  }

  // ---------- スライド ----------
  function openSlide(id, instant) {
    const s = SAA.data.slides[id];
    const m = S.m;
    if (!s) { console.warn('[story] スライドが見つかりません: ' + id); return; }
    S.slideId = id;
    U.clear(m.slideBody);
    try { m.slideBody.appendChild(U.renderSlide(s, { compact: true })); } catch (e) { m.slideBody.textContent = s.title; }
    m.slideBody.scrollTop = 0;
    m.slideTitle.textContent = s.title;
    m.slide.classList.remove('is-min');
    m.slideMinBtn.textContent = '－';
    m.frame.classList.add('has-slide');
    if (instant) m.slide.classList.add('no-anim');
    reflow(m.slide);
    m.slide.classList.add('is-open');
    if (instant) { reflow(m.slide); m.slide.classList.remove('no-anim'); }
    if (!instant && !skipActive()) sfx('page');
    setSlideContext(id);
  }
  function closeSlide(byUser) {
    if (!S) return;
    const m = S.m;
    const wasOpen = !!S.slideId;
    S.slideId = null;
    m.slide.classList.remove('is-open', 'is-min');
    m.frame.classList.remove('has-slide');
    if (wasOpen && byUser) sfx('close');
    if (wasOpen) setStoryContext();
  }
  function toggleSlideMin() {
    const m = S.m;
    const min = !m.slide.classList.contains('is-min');
    m.slide.classList.toggle('is-min', min);
    m.frame.classList.toggle('has-slide', !min);
    m.slideMinBtn.textContent = min ? '□' : '－';
    m.slideMinBtn.setAttribute('title', min ? '元に戻す' : '最小化');
  }
  function slideDock(tab) {
    if (S.slideId) setSlideContext(S.slideId);
    try { SAA.dock.open(tab); } catch (e) { /* noop */ }
  }

  // ---------- 演出 ----------
  function particles(ch, count, cls) {
    const layer = S.m.fx;
    for (let i = 0; i < count; i++) {
      const p = U.el('span', { class: 'vn-particle ' + cls, text: ch, style: {
        left: (12 + Math.random() * 76) + '%',
        top: (cls === 'is-heart' ? 45 + Math.random() * 30 : 10 + Math.random() * 60) + '%',
        animationDelay: (Math.random() * 0.5).toFixed(2) + 's',
        fontSize: (cls === 'is-heart' ? 1.6 + Math.random() * 1.6 : 0.9 + Math.random() * 1.4).toFixed(2) + 'em'
      } });
      layer.appendChild(p);
      later(function () { p.remove(); }, 2600);
    }
  }
  function runFx(kind) {
    const m = S.m;
    const rm = reduced();
    const fast = skipActive();
    if (kind === 'fadeout' || kind === 'fadein') {
      const on = kind === 'fadeout';
      if (rm || fast) m.fade.classList.add('no-anim');
      m.fade.classList.toggle('is-on', on);
      if (rm || fast) { reflow(m.fade); m.fade.classList.remove('no-anim'); return Promise.resolve(); }
      return delay(720);
    }
    if (rm || fast) return Promise.resolve();
    if (kind === 'shake') {
      m.frame.classList.remove('fx-shake');
      reflow(m.frame);
      m.frame.classList.add('fx-shake');
      later(function () { if (S) S.m.frame.classList.remove('fx-shake'); }, 600);
    } else if (kind === 'flash') {
      const f = U.el('div', { class: 'vn-flash' });
      m.fx.appendChild(f);
      later(function () { f.remove(); }, 800);
    } else if (kind === 'heart') {
      particles('♥', 7, 'is-heart');
    } else if (kind === 'sparkle') {
      particles('✦', 14, 'is-sparkle');
    }
    return Promise.resolve();
  }

  // ---------- 章タイトル ----------
  function runTitle(step) {
    return new Promise(function (resolve) {
      const card = U.el('div', { class: 'vn-titlecard', role: 'img', 'aria-label': String(step.title) + ' ' + String(step.sub || '') },
        U.el('div', { class: 'vn-titlecard__inner' },
          (function () {
            const ch = chapterDef(S.chapterId);
            return ch && ch.day ? U.el('span', { class: 'vn-titlecard__day', text: ch.day }) : null;
          })(),
          U.el('h2', { class: 'vn-titlecard__title', text: String(step.title || '') }),
          U.el('span', { class: 'vn-titlecard__line', 'aria-hidden': 'true' }),
          step.sub ? U.el('p', { class: 'vn-titlecard__sub', text: String(step.sub) }) : null));
      S.m.stage.appendChild(card);
      reflow(card);
      card.classList.add('is-open');
      sfx('chapter_start');
      S.nonBlock = 0;
      let fin = false;
      const done = function () {
        if (fin) return;
        fin = true;
        card.classList.remove('is-open');
        card.classList.add('is-closing');
        setTimeout(function () { card.remove(); }, 450);
        resolve();
      };
      S.wait = { kind: 'title', resolve: done };
      later(function () { if (S && S.wait && S.wait.resolve === done) resolveWait(false); }, 2600);
    });
  }

  // ---------- 選択肢 ----------
  function runChoice(step) {
    return new Promise(function (resolve) {
      const opts = Array.isArray(step.choice) ? step.choice : [];
      if (!opts.length) { resolve(); return; }
      S.nonBlock = 0;
      const ov = ovShell('vn-ov--choice', '選択肢');
      const list = U.el('div', { class: 'vn-choice__list' });
      opts.forEach(function (c, i) {
        list.appendChild(btn('vn-choice__btn', U.el('span', { class: 'vn-choice__text', text: String(c.text || '…') }), function () {
          sfx('select');
          if (c.set && typeof c.set === 'object') updP(function (p) { Object.assign(p.flags, c.set); });
          S.backlog.push({ name: '', color: '', text: '▶ ' + String(c.text || ''), inner: false, narr: true });
          closeOverlay('choice');
          if (c.jump) jumpTo(c.jump);
          resolve();
        }, { style: { animationDelay: (0.06 * i) + 's' } }));
      });
      ov.appendChild(U.el('div', { class: 'vn-choice' },
        step.prompt ? U.el('p', { class: 'vn-choice__prompt', text: String(step.prompt) }) : null,
        list));
      ov.addEventListener('click', function (e) { e.stopPropagation(); });
      ov.addEventListener('keydown', function (e) {
        const bs = Array.prototype.slice.call(list.querySelectorAll('button'));
        const i = bs.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const n = e.key === 'ArrowDown' ? (i + 1) % bs.length : (i - 1 + bs.length) % bs.length;
          bs[n].focus();
        } else if (/^[1-9]$/.test(e.key) && bs[+e.key - 1]) {
          e.preventDefault();
          bs[+e.key - 1].click();
        }
      });
      openOverlay('choice', ov);
      const first = list.querySelector('button');
      if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* noop */ } }, 60);
    });
  }

  // ---------- クイズ ----------
  function resolveQids(step) {
    if (Array.isArray(step.quiz)) return step.quiz.slice();
    const ids = SAA.data.groups[step.quiz] || [];
    if (Array.isArray(step.pick)) return step.pick.map(function (k) { return ids[k]; }).filter(Boolean);
    return ids.slice();
  }
  function realQuiz() {
    return !!(SAA.quiz && typeof SAA.quiz.mount === 'function' && SAA.quiz._test && typeof SAA.quiz._test.check === 'function');
  }
  function mountQuiz(box, q, opts) {
    if (realQuiz()) {
      try { return SAA.quiz.mount(box, q, opts); } catch (e) { console.error('[story] quiz.mount', e); U.clear(box); }
    }
    return fallbackQuiz(box, q, opts);
  }
  // quiz.js が無い場合の最小限の出題（保険）
  function fallbackQuiz(box, q, opts) {
    let resA; let resD;
    const answered = new Promise(function (r) { resA = r; });
    const done = new Promise(function (r) { resD = r; });
    const answer = Array.isArray(q.answer) ? q.answer : [];
    const need = Math.max(1, answer.length);
    const order = (q.options || []).map(function (_, i) { return i; });
    const ord = opts.shuffle ? U.shuffle(order) : order;
    const sel = new Set();
    let submitted = false;
    const list = U.el('div', { class: 'vn-fq__opts' });
    const submit = U.el('button', { type: 'button', class: 'vn-btn vn-btn--primary', disabled: true, text: '回答する' });
    const result = U.el('div', { class: 'vn-fq__result' });
    ord.forEach(function (oi, k) {
      const b = U.el('button', { type: 'button', class: 'vn-fq__opt', dataset: { i: String(oi) } },
        U.el('span', { class: 'vn-fq__key', text: String.fromCharCode(65 + k) }),
        U.el('span', { text: q.options[oi] }));
      b.addEventListener('click', function () {
        if (submitted) return;
        if (need === 1) sel.clear();
        if (sel.has(oi)) sel.delete(oi); else if (sel.size < need) sel.add(oi);
        Array.prototype.forEach.call(list.children, function (x) { x.classList.toggle('is-sel', sel.has(+x.dataset.i)); });
        submit.disabled = sel.size !== need;
        sfx('select');
      });
      list.appendChild(b);
    });
    submit.addEventListener('click', function () {
      if (submitted || sel.size !== need) return;
      submitted = true;
      const selected = Array.from(sel).sort();
      const correct = selected.length === answer.length && answer.every(function (a) { return sel.has(a); });
      Array.prototype.forEach.call(list.children, function (x) {
        const i = +x.dataset.i;
        x.classList.toggle('is-ok', answer.indexOf(i) >= 0);
        x.classList.toggle('is-ng', sel.has(i) && answer.indexOf(i) < 0);
        x.disabled = true;
      });
      sfx(correct ? 'correct' : 'incorrect');
      try { SAA.stats.record(q.id, { correct: correct, selected: selected, mode: 'story' }); } catch (e) { /* noop */ }
      SAA.bus.emit('quiz:answered', { qid: q.id, correct: correct, selected: selected, mode: 'story' });
      submit.remove();
      result.appendChild(U.el('p', { class: 'vn-fq__verdict ' + (correct ? 'is-ok' : 'is-ng'), text: correct ? '○ 正解！' : '× 不正解' }));
      const line = correct ? q.onCorrect : q.onWrong;
      if (line) result.appendChild(U.el('p', { class: 'vn-fq__ren', text: '氷室：' + line }));
      if (q.explanation) result.appendChild(U.el('div', { class: 'vn-fq__exp', html: U.md(q.explanation) }));
      if (q.point) result.appendChild(U.el('p', { class: 'vn-fq__point', text: '💡 ' + q.point }));
      result.appendChild(U.el('div', { class: 'vn-fq__foot' }, U.el('button', { type: 'button', class: 'vn-btn vn-btn--primary', text: '次へ ▶', onClick: function () { resD(); } })));
      resA({ correct: correct, selected: selected, q: q });
    });
    box.appendChild(U.el('article', { class: 'vn-fq' },
      U.el('header', { class: 'vn-fq__head', text: '問題 ' + (opts.index || 1) + ' / ' + (opts.total || 1) + (q.topic ? '｜' + q.topic : '') }),
      U.el('div', { class: 'vn-fq__q', html: U.md(q.question || '') }),
      list,
      U.el('div', { class: 'vn-fq__foot' }, submit),
      result));
    return { answered: answered, done: done, destroy: function () { U.clear(box); } };
  }
  async function runQuiz(step, idx, gen) {
    const ids = resolveQids(step);
    const qs = ids.map(function (id) { return SAA.data.qById[id]; }).filter(Boolean);
    if (ids.length !== qs.length) console.warn('[story] 見つからない問題があります', ids.filter(function (id) { return !SAA.data.qById[id]; }));
    if (!qs.length) { toast('問題データが見つかりませんでした', 'warn'); return; }
    let correct = 0;
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (q.intro) {
        await showLine({ say: 'ren', face: 'explain', text: q.intro }, idx);
        if (!alive(gen)) return;
      }
      const inner = U.el('div', { class: 'vn-quiz__inner' });
      const ov = ovShell('vn-ov--quiz', '問題');
      ov.appendChild(U.el('div', { class: 'vn-quiz__scroll' }, inner));
      ov.addEventListener('click', function (e) { e.stopPropagation(); });
      openOverlay('quiz', ov);
      const ctl = mountQuiz(inner, q, { mode: 'story', shuffle: settings().shuffleOptions !== false, index: i + 1, total: qs.length, reaction: true });
      S.quizCtl = ctl;
      let res = null;
      try { res = await ctl.answered; } catch (e) { res = null; }
      if (!alive(gen)) return;
      if (res && res.correct) correct++;
      try { await ctl.done; } catch (e) { /* noop */ }
      if (!alive(gen)) return;
      try { ctl.destroy(); } catch (e) { /* noop */ }
      S.quizCtl = null;
      closeOverlay('quiz');
    }
    toast(qs.length + '問中' + correct + '問正解', correct === qs.length ? 'ok' : 'info');
    setStoryContext();
  }

  // ---------- ラボ・模試 ----------
  async function runLab(id, gen) {
    openOverlay('lab');
    try { await SAA.labs.open(id); } catch (e) { console.error('[story] lab', e); }
    if (!alive(gen)) return;
    closeOverlay('lab');
    setStoryContext();
  }
  async function runMock(id, gen) {
    openOverlay('mock');
    let r = null;
    try { r = await SAA.mock.start(id, { fromStory: true }); } catch (e) { console.error('[story] mock', e); }
    if (!alive(gen)) return;
    closeOverlay('mock');
    const rate = r && typeof r.rate === 'number' ? r.rate : 0;
    const passLine = (curriculum().exam && curriculum().exam.passScaled) || 720;
    let passed = false;
    if (r) {
      if (typeof r.passed === 'boolean') passed = r.passed;
      else if (typeof r.scaled === 'number') passed = r.scaled >= passLine;
      else passed = rate >= ((curriculum().exam && curriculum().exam.meetsRate) || 0.72);
    }
    updP(function (p) { p.vars.mockRate = rate; p.vars.mockPassed = passed; });
    setStoryContext();
  }

  // ---------- 分岐 ----------
  function jumpTo(label) {
    if (has(S.labels, label)) S.idx = S.labels[label];
    else console.warn('[story] ラベルが見つかりません: ' + label);
  }
  function flagTrue(name) {
    const neg = String(name).charAt(0) === '!';
    const key = neg ? String(name).slice(1) : String(name);
    const v = !!getP().flags[key];
    return neg ? !v : v;
  }
  function matchCase(c, v) {
    if (!c || typeof c !== 'object') return false;
    let ok = true;
    if (typeof c.gte === 'number') ok = ok && v >= c.gte;
    if (typeof c.gt === 'number') ok = ok && v > c.gt;
    if (typeof c.lte === 'number') ok = ok && v <= c.lte;
    if (typeof c.lt === 'number') ok = ok && v < c.lt;
    if (typeof c.eq === 'number') ok = ok && v === c.eq;
    return ok;
  }
  function runBranch(step) {
    const n = Number(getP().vars[step.branch]);
    const v = isFinite(n) ? n : 0;
    const cases = Array.isArray(step.cases) ? step.cases : [];
    for (let i = 0; i < cases.length; i++) {
      if (matchCase(cases[i], v)) { jumpTo(cases[i].jump); return; }
    }
    if (step.else) jumpTo(step.else);
  }

  // ---------- 章の終わり ----------
  function nextChapterId(id) {
    const list = curriculum().chapters || [];
    const i = list.findIndex(function (c) { return c.id === id; });
    return i >= 0 && list[i + 1] ? list[i + 1].id : null;
  }
  function qMark(qid) {
    let s = null;
    try { s = SAA.stats.getQ(qid); } catch (e) { s = null; }
    if (!s || !s.n) return { mark: '–', cls: 'is-none', label: '未回答' };
    return s.last === 1 ? { mark: '✓', cls: 'is-ok', label: '正解' } : { mark: '✗', cls: 'is-ng', label: '不正解' };
  }
  function labDone(id) {
    let s = null;
    try { s = SAA.stats.labStatus(id); } catch (e) { s = null; }
    return !!(s && (s.done || s.completed || s.at));
  }
  function showEnd(step, idx) {
    stopSkip(false);
    closeSlide(false);
    const id = S.chapterId;
    const ch = chapterDef(id) || { title: S.story.title || id, sub: S.story.sub || '', groups: [], labs: [] };
    const next = (step && typeof step.next === 'string' && step.next) || nextChapterId(id);
    const len = S.script.length;
    updP(function (p) {
      const c = chapterEntry(p, id);
      c.done = true;
      c.finishedAt = Date.now();
      c.step = idx;
      c.maxStep = Math.max(c.maxStep || 0, len);
      const nc = next && p.chapters[next];
      p.last = next ? { chapter: next, step: nc && !nc.done ? (nc.step || 0) : 0 } : { chapter: id, step: idx };
    });
    S.maxStep = Math.max(S.maxStep, len);
    if (S.params && S.params.chapter === id) S.params.step = idx;
    sfx('chapter_clear');

    // 問題リスト
    const groups = Array.isArray(ch.groups) ? ch.groups : [];
    let total = 0; let ok = 0; let answered = 0;
    const qBlocks = groups.map(function (gid) {
      const ids = SAA.data.groups[gid] || [];
      const g = (curriculum().groups || {})[gid] || {};
      const items = ids.map(function (qid, i) {
        const q = SAA.data.qById[qid] || {};
        const mk = qMark(qid);
        total++;
        if (mk.cls !== 'is-none') answered++;
        if (mk.cls === 'is-ok') ok++;
        return U.el('li', { class: 'vn-end__q ' + mk.cls, title: qid + '：' + mk.label },
          U.el('span', { class: 'vn-end__mark', text: mk.mark, 'aria-label': mk.label }),
          U.el('span', { class: 'vn-end__qno', text: String(i + 1).padStart(2, '0') }),
          U.el('span', { class: 'vn-end__qtopic', text: q.topic || qid }));
      });
      if (!items.length) return null;
      return U.el('section', { class: 'vn-end__group' },
        U.el('h4', { class: 'vn-end__gtitle' }, g.domain ? U.domainBadge(g.domain) : null, ' ', g.title || gid),
        U.el('ul', { class: 'vn-end__qlist' }, items));
    }).filter(Boolean);
    const labs = Array.isArray(ch.labs) ? ch.labs : [];
    const labPlans = curriculum().labPlans || {};
    let labsDone = 0;
    const labItems = labs.map(function (lid) {
      const lab = SAA.data.labs[lid] || labPlans[lid] || {};
      const d = labDone(lid);
      if (d) labsDone++;
      return U.el('li', { class: 'vn-end__lab ' + (d ? 'is-ok' : 'is-none') },
        U.el('span', { class: 'vn-end__mark', text: d ? '✓' : '–' }),
        U.el('span', { text: lab.title || lid }));
    });
    const vars = getP().vars;
    const mockLine = ch.mock && typeof vars.mockRate === 'number'
      ? U.el('p', { class: 'vn-end__mock' }, '🧪 模擬試験の正答率 ', U.el('strong', { text: Math.round(vars.mockRate * 100) + '%' }),
        (function () { try { return '（推定スコア ' + SAA.stats.estimateScaled(vars.mockRate) + '）'; } catch (e) { return ''; } })())
      : null;

    const stat = function (label, val, sub) {
      return U.el('div', { class: 'vn-end__stat' }, U.el('span', { class: 'vn-end__stat-label', text: label }), U.el('strong', { class: 'vn-end__stat-val', text: val }), sub ? U.el('span', { class: 'vn-end__stat-sub', text: sub }) : null);
    };
    const goto = function (sid, params) { return function () { closeOverlay('end', true); try { SAA.app.go(sid, params || {}); } catch (e) { console.error(e); } }; };
    const nextDef = next ? chapterDef(next) : null;
    const buttons = U.el('div', { class: 'vn-end__btns' },
      next ? btn('vn-btn vn-btn--primary', '次の章へ ▶' + (nextDef ? '　' + nextDef.title : ''), goto('story', { chapter: next, step: 0 })) : null,
      btn('vn-btn', '🔁 苦手を復習', goto('practice', { groups: groups.length ? groups.slice() : undefined, source: 'wrong', autoStart: true })),
      btn('vn-btn', '📚 チャプター選択', goto('chapters')),
      btn('vn-btn vn-btn--ghost', '🏠 タイトルへ', goto('title')));

    const card = U.el('article', { class: 'vn-end' },
      U.el('header', { class: 'vn-end__head' },
        U.el('span', { class: 'vn-end__kicker', text: 'CHAPTER CLEAR' }),
        U.el('h2', { class: 'vn-end__title', text: ch.title || '' }),
        ch.sub ? U.el('p', { class: 'vn-end__sub', text: ch.sub }) : null),
      U.el('div', { class: 'vn-end__stats' },
        total ? stat('この章の問題', ok + ' / ' + total, '正解（回答 ' + answered + '問）') : null,
        total ? stat('正答率', answered ? Math.round(ok / answered * 100) + '%' : '—', answered ? '回答した問題のうち' : 'まだ回答なし') : null,
        labs.length ? stat('ハンズオン', labsDone + ' / ' + labs.length, '完了') : null),
      mockLine,
      qBlocks.length ? U.el('div', { class: 'vn-end__groups' }, qBlocks) : null,
      labItems.length ? U.el('section', { class: 'vn-end__group' }, U.el('h4', { class: 'vn-end__gtitle', text: '🧪 ハンズオンラボ' }), U.el('ul', { class: 'vn-end__labs' }, labItems)) : null,
      buttons);
    const ov = ovShell('vn-ov--end', '章のまとめ');
    ov.appendChild(U.el('div', { class: 'vn-end__scroll' }, card));
    ov.addEventListener('click', function (e) { e.stopPropagation(); });
    openOverlay('end', ov);
    if (!reduced()) particles('✦', 12, 'is-sparkle');
    const first = buttons.querySelector('button');
    if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* noop */ } }, 80);
  }

  // ---------- 実行ループ ----------
  async function exec(step, i, gen) {
    const cmd = cmdOf(step);
    if (!cmd) { console.warn('[story] 不明なステップ', S.chapterId, i, step); return null; }
    if (STOP_SKIP[cmd]) stopSkip(false);
    switch (cmd) {
      case 'title': await runTitle(step); break;
      case 'bg': await setBg(step.bg, step.fx, false); break;
      case 'bgm':
        try { if (step.bgm) SAA.audio.playBgm(step.bgm); else SAA.audio.stopBgm({ fade: 1.0 }); } catch (e) { /* noop */ }
        break;
      case 'sfx': if (!skipActive()) sfx(step.sfx); break;
      case 'show':
        showChar(step.show, step.face, step.at, false);
        setSpeaker(null);
        if (step.sfx && !skipActive()) sfx(step.sfx);
        break;
      case 'hide': hideChar(step.hide, false); break;
      case 'say': case 'narr': await showLine(step, i); break;
      case 'cg':
        setCg(step.cg, step.fx === 'cut' || skipActive() || reduced());
        if (step.cg && !skipActive() && !reduced() && step.fx !== 'cut') await delay(450);
        break;
      case 'slide': if (step.slide) openSlide(step.slide, false); else closeSlide(false); break;
      case 'quiz': await runQuiz(step, i, gen); break;
      case 'lab': await runLab(step.lab, gen); break;
      case 'choice': await runChoice(step); break;
      case 'label': break;
      case 'jump': jumpTo(step.jump); break;
      case 'if': if (flagTrue(step.if)) jumpTo(step.jump); break;
      case 'fx': await runFx(step.fx); break;
      case 'wait': if (!skipActive()) await delay(Number(step.wait) || 0); break;
      case 'mock': await runMock(step.mock, gen); break;
      case 'branch': runBranch(step); break;
      case 'ending':
        updP(function (p) { if (p.endings.indexOf(step.ending) < 0) p.endings.push(step.ending); });
        break;
      case 'end':
        if (step.end) { showEnd(step, i); return 'halt'; }
        break;
      default: break;
    }
    return null;
  }
  async function loop(gen) {
    while (alive(gen)) {
      if (S.idx >= S.script.length) { showEnd({ end: true }, S.script.length - 1); S.running = false; return; }
      const i = S.idx;
      const step = S.script[i];
      S.idx = i + 1;
      S.cur = i;
      let r = null;
      try { r = await exec(step, i, gen); } catch (e) { console.error('[story] step ' + i, e); }
      if (!alive(gen)) return;
      if (r === 'halt') { S.running = false; return; }
      save();
      S.nonBlock++;
      if (S.nonBlock > MAX_NONBLOCK) {
        console.error('[story] 待ちの無いステップが連続しています（ジャンプの無限ループ？）');
        S.running = false;
        return;
      }
    }
  }

  // ---------- 開始・再構築 ----------
  function buildLabels(script) {
    const labels = {};
    script.forEach(function (s, i) { if (s && typeof s.label === 'string' && !has(labels, s.label)) labels[s.label] = i; });
    return labels;
  }
  function replay(upto) {
    const script = S.script;
    const cs = chars();
    let bg = null; let bgm; let cg = null; let slide = null; let faded = false;
    const st = {}; const order = [];
    const rec = function (id) {
      if (!st[id]) { st[id] = { face: null, at: null, visible: false }; order.push(id); }
      return st[id];
    };
    for (let i = 0; i < upto && i < script.length; i++) {
      const s = script[i];
      const cmd = cmdOf(s);
      if (cmd === 'bg') bg = s.bg;
      else if (cmd === 'bgm') bgm = s.bgm;
      else if (cmd === 'cg') cg = s.cg || null;
      else if (cmd === 'slide') slide = s.slide || null;
      else if (cmd === 'fx' && (s.fx === 'fadeout' || s.fx === 'fadein')) faded = s.fx === 'fadeout';
      else if (cmd === 'show' && cs[s.show]) {
        const r = rec(s.show);
        if (s.face) r.face = s.face;
        r.at = POS[s.at] !== undefined ? s.at : (r.visible && r.at ? r.at : cs[s.show].side);
        r.visible = true;
      } else if (cmd === 'hide') {
        Object.keys(st).forEach(function (k) { if (s.hide === '*' || s.hide === k) st[k].visible = false; });
      } else if (cmd === 'say' && cs[s.say]) {
        const r = rec(s.say);
        if (s.face) r.face = s.face;
        if (!r.visible) { r.visible = true; r.at = cs[s.say].side; }
      }
    }
    if (bg) setBg(bg, 'cut', true);
    order.forEach(function (id) { if (st[id].visible) showChar(id, st[id].face, st[id].at, true); });
    if (cg) setCg(cg, true);
    if (slide) openSlide(slide, true);
    if (faded) { S.m.fade.classList.add('no-anim', 'is-on'); reflow(S.m.fade); S.m.fade.classList.remove('no-anim'); }
    try {
      if (bgm === null) SAA.audio.stopBgm({ fade: 0.6 });
      else if (bgm) SAA.audio.playBgm(bgm);
    } catch (e) { /* noop */ }
  }
  function resetVisual() {
    const m = S.m;
    U.clear(m.bg); U.clear(m.chars); U.clear(m.cg); U.clear(m.fx); U.clear(m.backdrop);
    m.cg.classList.remove('is-on');
    m.fade.classList.remove('is-on');
    m.slide.classList.remove('is-open', 'is-min');
    m.frame.classList.remove('has-slide', 'fx-shake');
    m.name.textContent = ''; m.name.hidden = true;
    m.textShown.textContent = ''; m.textRest.textContent = '';
    m.dialog.classList.remove('is-done', 'is-inner', 'is-narr');
    m.dialog.classList.add('is-idle'); // 最初の台詞までは会話ウィンドウを隠す
    S.chars = {}; S.bgKey = null; S.cgKey = null; S.slideId = null;
    Array.prototype.slice.call(m.stage.querySelectorAll('.vn-titlecard')).forEach(function (n) { n.remove(); });
  }
  function haltRun() {
    if (!S) return;
    S.gen++;
    S.running = false;
    S.timers.forEach(function (t) { clearTimeout(t); });
    S.timers.clear();
    clearTimeout(S.autoTimer); S.autoTimer = null;
    stopTyper();
    S.typer = null;
    S.wait = null;
    if (S.quizCtl) { try { S.quizCtl.destroy(); } catch (e) { /* noop */ } S.quizCtl = null; }
    Object.keys(S.overlays).forEach(function (k) { closeOverlay(k, true); });
  }
  function showMissing(chapterId) {
    const ch = chapterDef(chapterId);
    S.chapterId = null;
    S.m.stage.classList.add('is-missing');
    const ov = ovShell('vn-ov--missing', 'ストーリー未登録');
    ov.appendChild(U.el('div', { class: 'vn-missing' },
      U.el('div', { class: 'vn-missing__icon', text: '📖', 'aria-hidden': 'true' }),
      U.el('h2', { class: 'vn-missing__title', text: (ch ? ch.title + '　' : '') + 'ストーリーは準備中です' }),
      U.el('p', { class: 'vn-missing__text', text: 'この章のシナリオはまだ登録されていません。問題演習や講義ノートで先に学習しておきましょう。' }),
      U.el('div', { class: 'vn-end__btns' },
        btn('vn-btn vn-btn--primary', '📚 チャプター選択へ', function () { try { SAA.app.go('chapters'); } catch (e) { /* noop */ } }),
        btn('vn-btn vn-btn--ghost', '🏠 タイトルへ', function () { try { SAA.app.go('title'); } catch (e) { /* noop */ } }))));
    ov.addEventListener('click', function (e) { e.stopPropagation(); });
    openOverlay('missing', ov);
  }
  function begin(chapterId, step) {
    haltRun();
    S.m.stage.classList.remove('is-missing');
    resetVisual();
    S.backlog = [];
    const story = SAA.data.stories[chapterId];
    if (!story || !Array.isArray(story.script) || !story.script.length) { showMissing(chapterId); return; }
    S.chapterId = chapterId;
    S.story = story;
    S.script = story.script;
    S.labels = buildLabels(S.script);
    S.skip = false; S.ctrlHeld = false;
    updateCtrls();
    const p = getP();
    const cp = p.chapters[chapterId];
    S.maxStep = cp ? (cp.maxStep || 0) : 0;
    let st = Math.floor(Number(step) || 0);
    st = U.clamp(st, 0, S.script.length - 1);
    S.idx = st;
    updP(function (pp) { const c = chapterEntry(pp, chapterId); if (!c.startedAt) c.startedAt = Date.now(); pp.last = { chapter: chapterId, step: st }; });
    if (st > 0) replay(st);
    setStoryContext();
    S.running = true;
    S.nonBlock = 0;
    loop(S.gen);
  }

  // ---------- 入力 ----------
  function inForeignLayer(e) {
    const t = e.target;
    if (!t || !t.closest) return false;
    return !!t.closest('#dock, #overlay-root');
  }
  function onStageClick(e) {
    if (!S) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    if (e.target.closest && e.target.closest('[data-noadv]')) return;
    if (S.hidden) { setHidden(false); return; }
    if (overlayOpen()) return;
    advance();
  }
  function onContext(e) {
    if (!S) return;
    if (e.target.closest && e.target.closest('.vn-slide, .vn-ov')) return;
    e.preventDefault();
    if (overlayOpen()) return;
    setHidden(!S.hidden);
  }
  function onWheel(e) {
    if (!S || e.deltaY >= 0) return;
    if (e.target.closest && e.target.closest('.vn-slide, .vn-ov')) return;
    if (overlayOpen() || S.hidden) return;
    openBacklog();
  }
  function onKeyDown(e) {
    if (!S || !S.mounted) return;
    if (e.key === 'Control') {
      if (e.repeat || overlayOpen() || !S.chapterId) return; // キーリピートで再開しない
      if (!S.ctrlHeld) { S.ctrlHeld = true; updateCtrls(); kickSkip(); }
      return;
    }
    if (e.defaultPrevented || U.isTyping(e) || inForeignLayer(e)) return;
    if (U.hasModal && U.hasModal()) return;
    const k = e.key;
    if (S.overlays.lab || S.overlays.mock) return; // ラボ・模試（#overlay-root 側）が操作を持つ
    if (S.overlays.menu) { if (k === 'Escape') { e.preventDefault(); closeOverlay('menu'); } return; }
    if (S.overlays.backlog) {
      if (k === 'Escape' || k === 'l' || k === 'L') { e.preventDefault(); closeOverlay('backlog'); }
      return;
    }
    if (k === 'Escape') {
      let dockOpen = false;
      try { dockOpen = SAA.dock.isOpen(); } catch (er) { dockOpen = false; }
      if (dockOpen) return; // ドックは app 側の Esc で閉じる
      e.preventDefault();
      if (S.hidden) { setHidden(false); return; }
      if (S.overlays.end || S.overlays.missing) return;
      openMenu();
      return;
    }
    if (overlayOpen()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (k === 'Enter' || k === ' ' || k === 'ArrowRight') {
      if (tag === 'BUTTON' && k !== 'ArrowRight') return; // フォーカス中のボタンを優先
      e.preventDefault();
      if (S.hidden) { setHidden(false); return; }
      advance();
      return;
    }
    if (!S.chapterId) return;
    const lk = k.length === 1 ? k.toLowerCase() : k;
    if (lk === 'a') { e.preventDefault(); toggleAuto(); }
    else if (lk === 's') { e.preventDefault(); toggleSkip(); }
    else if (lk === 'l') { e.preventDefault(); openBacklog(); }
    else if (lk === 'h') { e.preventDefault(); setHidden(!S.hidden); }
  }
  function onKeyUp(e) {
    if (!S) return;
    if (e.key === 'Control' && S.ctrlHeld) { S.ctrlHeld = false; updateCtrls(); }
  }
  function onBlur() {
    if (S && S.ctrlHeld) { S.ctrlHeld = false; updateCtrls(); }
  }
  function onSettings(ev) {
    if (!S) return;
    S.settings = null;
    const key = ev && ev.key ? String(ev.key) : '';
    if (key === 'muted' || key.indexOf('volume') === 0) updateMuteIcon();
    if (key === 'textSpeed' && S.typer && !S.typer.done && S.typer.timer === null) finishTyping();
    if (key === 'autoDelay' || key === 'skipUnread' || key === 'textSpeed') scheduleNext();
  }

  // ---------- マウント ----------
  function mount(container, params) {
    unmount();
    const m = buildStage(container);
    S = {
      m: m, mounted: true, params: params || null, settings: null,
      gen: 0, running: false, timers: new Set(), autoTimer: null,
      chapterId: null, story: null, script: [], labels: {}, idx: 0, cur: 0, maxStep: 0, nonBlock: 0,
      chars: {}, bgKey: null, cgKey: null, slideId: null,
      backlog: [], overlays: {}, wait: null, typer: null, quizCtl: null,
      auto: false, skip: false, ctrlHeld: false, hidden: false,
      listeners: null
    };
    m.stage.addEventListener('click', onStageClick);
    m.stage.addEventListener('contextmenu', onContext);
    m.stage.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    SAA.bus.on('settings:change', onSettings);
    document.body.classList.add('vn-active'); // トップバー非表示・ページスクロール抑止（story.css）
    updateMuteIcon();
    updateCtrls();
  }
  function unmount() {
    if (!S) return;
    haltRun();
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    SAA.bus.off('settings:change', onSettings);
    document.body.classList.remove('vn-active');
    if (S.m.stage.parentNode) S.m.stage.remove();
    S.mounted = false;
    S = null;
  }
  function render(container, params) {
    params = params || {};
    mount(container, params);
    if (params.chapter) { begin(params.chapter, params.step || 0); return; }
    const last = getP().last;
    if (last && last.chapter) { S.params.chapter = last.chapter; S.params.step = last.step || 0; begin(last.chapter, last.step || 0); return; }
    const first = (curriculum().chapters || [])[0];
    begin(first ? first.id : 'prologue', 0);
  }

  // ---------- 公開 API ----------
  function start(chapterId, opts) {
    const step = (opts && opts.step) || 0;
    if (!S || !S.mounted) { try { SAA.app.go('story', { chapter: chapterId, step: step }); } catch (e) { console.error(e); } return; }
    if (S.params) { S.params.chapter = chapterId; S.params.step = step; }
    begin(chapterId, step);
  }
  function resume() {
    const last = getP().last;
    if (last && last.chapter) start(last.chapter, { step: last.step || 0 });
    else {
      const first = (curriculum().chapters || [])[0];
      start(first ? first.id : 'prologue', { step: 0 });
    }
  }
  function stop() { haltRun(); }
  function isRunning() { return !!S && !!S.running; }

  // ---------- ドライラン（UI なしで検証） ----------
  function dryRun(chapterId) {
    const D = SAA.data;
    if (!chapterId) {
      const all = { ok: true, errors: [], steps: 0 };
      Object.keys(D.stories).forEach(function (id) {
        const r = dryRun(id);
        all.steps += r.steps;
        all.errors = all.errors.concat(r.errors);
      });
      all.ok = all.errors.length === 0;
      return all;
    }
    const errors = [];
    const story = D.stories[chapterId];
    if (!story || !Array.isArray(story.script)) return { ok: false, errors: [chapterId + ': ストーリーが登録されていません'], steps: 0 };
    const script = story.script;
    const cs = D.characters || {};
    const assets = D.assets || {};
    const cat = D.audioCatalog || { bgm: [], sfx: [] };
    const bgmIds = (cat.bgm || []).map(function (b) { return b.id; });
    const sfxIds = (cat.sfx || []).map(function (b) { return b.id; });
    const cur = curriculum();
    const chapterIds = (cur.chapters || []).map(function (c) { return c.id; });
    const labels = {};
    script.forEach(function (s, i) {
      if (s && has(s, 'label')) {
        if (typeof s.label !== 'string' || !s.label) errors.push(chapterId + '#' + i + ': label が不正です');
        else if (has(labels, s.label)) errors.push(chapterId + '#' + i + ': ラベル重複 ' + s.label);
        else labels[s.label] = i;
      }
    });
    let hasEnd = false;
    script.forEach(function (s, i) {
      const w = chapterId + '#' + i + ': ';
      const err = function (m) { errors.push(w + m); };
      const target = function (t, what) { if (typeof t !== 'string' || !has(labels, t)) err((what || 'jump') + ' 先のラベルがありません: ' + t); };
      const chk = function (cid, face) {
        const c = cs[cid];
        if (!c) { err('不明なキャラクター ' + cid); return; }
        if (face !== undefined && !(c.faces && has(c.faces, face))) err('不明な表情 ' + cid + '/' + face);
      };
      const sfxOpt = function () { if (has(s, 'sfx') && sfxIds.indexOf(s.sfx) < 0) err('不明な sfx ' + s.sfx); };
      const cmd = cmdOf(s);
      if (!cmd) { err('不明なコマンド ' + (s && typeof s === 'object' ? Object.keys(s).join(',') : String(s))); return; }
      switch (cmd) {
        case 'title': if (typeof s.title !== 'string' || !s.title) err('title が空です'); sfxOpt(); break;
        case 'bg':
          if (!assets[s.bg] || assets[s.bg].kind !== 'bg') err('不明な背景 ' + s.bg);
          if (has(s, 'fx') && TRANS.indexOf(s.fx) < 0) err('bg の fx は fade|cut です: ' + s.fx);
          break;
        case 'bgm': if (s.bgm !== null && bgmIds.indexOf(s.bgm) < 0) err('不明な BGM ' + s.bgm); break;
        case 'sfx': if (sfxIds.indexOf(s.sfx) < 0) err('不明な sfx ' + s.sfx); break;
        case 'show':
          chk(s.show, s.face);
          if (has(s, 'at') && POS[s.at] === undefined) err('不正な位置 ' + s.at);
          sfxOpt();
          break;
        case 'hide': if (s.hide !== '*' && !cs[s.hide]) err('不明なキャラクター ' + s.hide); break;
        case 'say':
          chk(s.say, s.face);
          if (typeof s.text !== 'string' || !s.text) err('text がありません');
          sfxOpt();
          break;
        case 'narr': if (typeof s.narr !== 'string' || !s.narr) err('narr が空です'); sfxOpt(); break;
        case 'cg':
          if (s.cg !== null && (!assets[s.cg] || assets[s.cg].kind !== 'cg')) err('不明な CG ' + s.cg);
          if (has(s, 'fx') && TRANS.indexOf(s.fx) < 0) err('cg の fx は fade|cut です: ' + s.fx);
          break;
        case 'slide': if (s.slide !== null && !D.slides[s.slide]) err('不明なスライド ' + s.slide); break;
        case 'quiz':
          if (Array.isArray(s.quiz)) {
            if (!s.quiz.length) err('quiz が空です');
            s.quiz.forEach(function (qid) { if (!D.qById[qid]) err('不明な問題 ' + qid); });
          } else {
            const ids = D.groups[s.quiz];
            if (!ids) { err('不明な問題グループ ' + s.quiz); break; }
            if (has(s, 'pick')) {
              if (!Array.isArray(s.pick) || !s.pick.length) err('pick は空でない配列にしてください');
              else s.pick.forEach(function (k) { if (typeof k !== 'number' || k < 0 || Math.floor(k) !== k || !ids[k]) err('pick ' + k + ' は ' + s.quiz + ' の範囲外です'); });
            } else if (!ids.length) err('問題グループ ' + s.quiz + ' に問題がありません');
          }
          break;
        case 'lab': if (!D.labs[s.lab]) err('不明なラボ ' + s.lab); break;
        case 'choice':
          if (!Array.isArray(s.choice) || s.choice.length < 2) { err('choice は2つ以上の選択肢が必要です'); break; }
          if (has(s, 'prompt') && typeof s.prompt !== 'string') err('prompt は文字列にしてください');
          s.choice.forEach(function (c, k) {
            if (!c || typeof c.text !== 'string' || !c.text) err('選択肢 ' + k + ' の text がありません');
            if (c && has(c, 'jump')) target(c.jump, '選択肢 ' + k + ' の jump');
            if (c && has(c, 'set') && (typeof c.set !== 'object' || c.set === null || Array.isArray(c.set))) err('選択肢 ' + k + ' の set はオブジェクトにしてください');
          });
          break;
        case 'label': break;
        case 'jump': target(s.jump); break;
        case 'if':
          if (typeof s.if !== 'string' || !s.if) err('if のフラグ名が空です');
          target(s.jump, 'if の jump');
          break;
        case 'fx': if (FX_LIST.indexOf(s.fx) < 0) err('不明な fx ' + s.fx); break;
        case 'wait': if (typeof s.wait !== 'number' || !(s.wait >= 0) || s.wait > 20000) err('wait は 0〜20000 の数値(ms)にしてください'); break;
        case 'mock': if (!(cur.mockExams || {})[s.mock]) err('不明な模擬試験 ' + s.mock); break;
        case 'branch':
          if (typeof s.branch !== 'string' || !s.branch) err('branch の変数名が空です');
          if (!Array.isArray(s.cases) || !s.cases.length) err('branch の cases がありません');
          else s.cases.forEach(function (c, k) {
            if (!c || typeof c !== 'object') { err('cases[' + k + '] が不正です'); return; }
            const cmp = ['gte', 'gt', 'lte', 'lt', 'eq'].filter(function (x) { return has(c, x); });
            if (!cmp.length) err('cases[' + k + '] に比較（gte/gt/lte/lt/eq）がありません');
            cmp.forEach(function (x) { if (typeof c[x] !== 'number') err('cases[' + k + '].' + x + ' は数値にしてください'); });
            target(c.jump, 'cases[' + k + '] の jump');
          });
          if (has(s, 'else')) target(s.else, 'else');
          break;
        case 'ending': if (ENDINGS.indexOf(s.ending) < 0) err('不明なエンディング ' + s.ending); break;
        case 'end':
          if (s.end) hasEnd = true;
          if (has(s, 'next') && chapterIds.indexOf(s.next) < 0) err('不明な次章 ' + s.next);
          break;
        default: break;
      }
    });
    if (!hasEnd) errors.push(chapterId + ': {end:true} がありません');
    return { ok: errors.length === 0, errors: errors, steps: script.length };
  }

  SAA.story = {
    start: start,
    resume: resume,
    stop: stop,
    isRunning: isRunning,
    _test: { dryRun: dryRun, cmdOf: cmdOf }
  };

  SAA.app.registerScreen('story', {
    title: 'ストーリー',
    topbar: false,
    render: render,
    leave: function () { unmount(); }
  });
})();
