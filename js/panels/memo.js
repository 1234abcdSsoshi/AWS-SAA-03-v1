/* メモ（SAA.memo）：全体ノート・画面ごとのメモ・一覧／書き出し
   保存先：SAA.store 'memo' = { global: '', items: { [contextKey]: { title, text, kind, refId, updatedAt } } } */
(function () {
  'use strict';

  const U = SAA.util;
  const el = U.el;
  const KIND_ICON = { question: '❓', slide: '📋', lab: '🧪', glossary: '📖', story: '📕', none: '🗒️' };

  // ---------- データ ----------
  function load() {
    const d = SAA.store.get('memo', { global: '', items: {} }) || {};
    if (typeof d.global !== 'string') d.global = '';
    if (!d.items || typeof d.items !== 'object') d.items = {};
    return d;
  }
  function save(d) { SAA.store.set('memo', d); }
  function stamp(ts) { return U.fmtDate(ts || Date.now()); }

  function getGlobal() { return load().global; }
  function setGlobal(text) {
    const d = load();
    d.global = String(text || '');
    d.globalUpdatedAt = Date.now();
    save(d);
  }
  function get(key) {
    if (!key) return '';
    const it = load().items[key];
    return it ? it.text : '';
  }
  function set(key, text, meta) {
    if (!key) return;
    const d = load();
    const prev = d.items[key] || {};
    const t = String(text || '');
    if (!t.trim()) delete d.items[key];
    else {
      d.items[key] = {
        title: (meta && meta.title) || prev.title || key,
        kind: (meta && meta.kind) || prev.kind || kindOfKey(key),
        refId: (meta && meta.refId) || prev.refId || key.replace(/^[a-z]+:/, ''),
        text: t,
        updatedAt: Date.now()
      };
    }
    save(d);
  }
  function remove(key) {
    const d = load();
    delete d.items[key];
    save(d);
  }
  function kindOfKey(key) {
    const p = String(key).split(':')[0];
    return { q: 'question', slide: 'slide', lab: 'lab', glossary: 'glossary', story: 'story' }[p] || 'none';
  }
  function append(text, opts) {
    opts = opts || {};
    const d = load();
    const head = '### ' + (opts.title || 'メモ') + '（' + stamp() + '）';
    d.global = (d.global ? d.global.replace(/\s+$/, '') + '\n\n' : '') + head + '\n' + String(text || '').trim() + '\n';
    d.globalUpdatedAt = Date.now();
    save(d);
    if (panel) panel.refreshNote();
  }

  function exportMarkdown() {
    const d = load();
    const lines = ['# SAA-C03 学習メモ', '', '書き出し日時：' + stamp(), ''];
    lines.push('## 全体ノート', '', d.global.trim() || '（なし）', '');
    const items = Object.keys(d.items).map(function (k) { return Object.assign({ key: k }, d.items[k]); })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (items.length) {
      lines.push('## 画面ごとのメモ', '');
      items.forEach(function (it) {
        lines.push('### ' + (KIND_ICON[it.kind] || '🗒️') + ' ' + it.title, '', '更新：' + stamp(it.updatedAt), '', it.text.trim(), '');
      });
    }
    return lines.join('\n');
  }

  function dateTag() {
    const d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }

  // ---------- 画面 ----------
  let panel = null;

  function renderPanel(container) {
    U.clear(container);
    let sub = 'note';
    let pinnedKey = null;      // 一覧から開いたメモ（現在のコンテキストより優先）
    let pinnedMeta = null;

    const subTabs = el('div', { class: 'memo__subtabs', role: 'tablist' });
    const views = {};
    const subBtn = {};
    [['note', 'ノート'], ['ctx', 'この画面'], ['list', '一覧']].forEach(function (t) {
      subBtn[t[0]] = el('button', { class: 'memo__subtab', type: 'button', role: 'tab', text: t[1], onClick: function () { show(t[0]); } });
      subTabs.appendChild(subBtn[t[0]]);
    });
    const menuBtn = el('button', { class: 'icon-btn memo__menu-btn', type: 'button', 'aria-label': '書き出し・読み込み', title: '書き出し・読み込み', text: '⋯', onClick: toggleMenu });
    const menu = el('div', { class: 'memo__menu', hidden: true },
      el('button', { type: 'button', text: '⬇ Markdown で書き出す', onClick: function () { hideMenu(); U.download('saa03-memo-' + dateTag() + '.md', exportMarkdown(), 'text/markdown;charset=utf-8'); } }),
      el('button', { type: 'button', text: '⬇ JSON でバックアップ', onClick: function () { hideMenu(); U.download('saa03-memo-' + dateTag() + '.json', JSON.stringify({ app: 'saa03-memo', data: load() }, null, 2), 'application/json'); } }),
      el('button', { type: 'button', text: '⬆ JSON から読み込む（統合）', onClick: function () { hideMenu(); importJson(); } }));
    function toggleMenu() { menu.hidden = !menu.hidden; }
    function hideMenu() { menu.hidden = true; }

    // ---- ノート ----
    const note = el('textarea', { class: 'memo__textarea', 'aria-label': '全体ノート', placeholder: '気づいたこと、覚えたいキーワード、間違えた理由などを自由に書こう。\n例）## 第3章\n- gp3 は容量と別に IOPS を買える', spellcheck: 'false', 'data-autofocus': '' });
    const noteStatus = el('span', { class: 'memo__status' });
    const preview = el('div', { class: 'memo__preview md', hidden: true });
    const previewBtn = el('button', { class: 'chip', type: 'button', text: '👁 プレビュー', onClick: togglePreview });
    function toolBtn(label, title, fn) { return el('button', { class: 'memo__tool', type: 'button', title: title, text: label, onClick: fn }); }
    const tools = el('div', { class: 'memo__tools' },
      toolBtn('見出し', '見出し（## ）', function () { insertLinePrefix(note, '## '); }),
      toolBtn('・箇条書き', '箇条書き（- ）', function () { insertLinePrefix(note, '- '); }),
      toolBtn('太字', '太字（**…**）', function () { wrapSelection(note, '**', '**', '太字'); }),
      toolBtn('🕒 日時', '日時を挿入', function () { insertText(note, stamp()); }),
      previewBtn);
    const saveNote = U.debounce(function () { setGlobal(note.value); noteSaved(); }, 500);
    note.addEventListener('input', function () { noteStatus.textContent = '入力中…'; saveNote(); updateCount(); });
    note.addEventListener('blur', function () { setGlobal(note.value); noteSaved(); });
    const count = el('span', { class: 'memo__count' });
    function updateCount() { count.textContent = [...note.value].length + ' 文字'; }
    function noteSaved() { noteStatus.textContent = '保存済み ' + new Date().toTimeString().slice(0, 5); }
    function togglePreview() {
      const on = preview.hidden;
      preview.hidden = !on;
      note.hidden = on;
      previewBtn.classList.toggle('is-active', on);
      if (on) preview.innerHTML = note.value.trim() ? U.md(note.value) : '<p class="memo__muted">（まだ何も書かれていません）</p>';
    }
    views.note = el('div', { class: 'memo__view' }, tools, note, preview,
      el('div', { class: 'memo__foot' }, noteStatus, count));

    // ---- この画面 ----
    const ctxTitle = el('div', { class: 'memo__ctx-title' });
    const ctxHint = el('p', { class: 'memo__hint' });
    const ctxArea = el('textarea', { class: 'memo__textarea memo__textarea--ctx', 'aria-label': 'この画面のメモ', spellcheck: 'false' });
    const ctxStatus = el('span', { class: 'memo__status' });
    const ctxBack = el('button', { class: 'chip', type: 'button', text: '↩ 現在の画面に戻る', hidden: true, onClick: function () { pinnedKey = null; pinnedMeta = null; refreshCtx(); } });
    let ctxKey = null;
    let ctxMeta = null;
    const saveCtx = U.debounce(function () { if (ctxKey) { set(ctxKey, ctxArea.value, ctxMeta); ctxStatus.textContent = '保存済み ' + new Date().toTimeString().slice(0, 5); if (sub === 'list') renderList(); } }, 500);
    ctxArea.addEventListener('input', function () { ctxStatus.textContent = '入力中…'; saveCtx(); });
    ctxArea.addEventListener('blur', function () { if (ctxKey) set(ctxKey, ctxArea.value, ctxMeta); });
    views.ctx = el('div', { class: 'memo__view' }, el('div', { class: 'memo__ctx-head' }, ctxTitle, ctxBack), ctxHint, ctxArea,
      el('div', { class: 'memo__foot' }, ctxStatus));

    function currentTarget() {
      if (pinnedKey) return { key: pinnedKey, meta: pinnedMeta };
      const c = SAA.getContext ? SAA.getContext() : { kind: 'none' };
      if (c && c.key && c.kind !== 'none') {
        return { key: c.key, meta: { title: c.title || c.key, kind: c.kind, refId: c.id } };
      }
      return null;
    }
    function refreshCtx() {
      if (ctxKey) set(ctxKey, ctxArea.value, ctxMeta);
      const t = currentTarget();
      ctxBack.hidden = !pinnedKey;
      if (!t) {
        ctxKey = null; ctxMeta = null;
        ctxTitle.textContent = '🗒️ 対象なし';
        ctxHint.textContent = '問題・講義スライド・ラボ・用語・ストーリーを表示しているときに、その画面専用のメモを書けます。全体のメモは「ノート」タブへ。';
        ctxArea.value = '';
        ctxArea.disabled = true;
        ctxArea.placeholder = '';
        return;
      }
      ctxKey = t.key; ctxMeta = t.meta;
      ctxTitle.textContent = (KIND_ICON[t.meta.kind] || '🗒️') + ' ' + t.meta.title;
      ctxHint.textContent = pinnedKey ? '一覧から開いたメモです。' : 'いま表示している内容に紐づくメモです（自動保存）。';
      ctxArea.disabled = false;
      ctxArea.placeholder = 'この' + ({ question: '問題', slide: 'スライド', lab: 'ラボ', glossary: '用語', story: '章' }[t.meta.kind] || '画面') + 'について、自分の言葉でまとめておこう。';
      ctxArea.value = get(ctxKey);
      ctxStatus.textContent = ctxArea.value ? '保存済み' : '';
    }

    // ---- 一覧 ----
    const search = el('input', { class: 'memo__search', type: 'search', placeholder: 'メモを検索', 'aria-label': 'メモを検索' });
    const list = el('ul', { class: 'memo__list' });
    search.addEventListener('input', U.debounce(renderList, 150));
    views.list = el('div', { class: 'memo__view' }, search, list);
    function renderList() {
      const d = load();
      const q = search.value.trim().toLowerCase();
      const items = Object.keys(d.items).map(function (k) { return Object.assign({ key: k }, d.items[k]); })
        .filter(function (it) { return !q || (it.title + '\n' + it.text).toLowerCase().indexOf(q) >= 0; })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      U.clear(list);
      if (!items.length) {
        list.appendChild(el('li', { class: 'memo__empty', text: q ? '該当するメモはありません。' : 'まだ画面ごとのメモはありません。問題やスライドを開いて「この画面」タブから書いてみよう。' }));
        return;
      }
      items.forEach(function (it) {
        const delBtn = el('button', { class: 'memo__item-del', type: 'button', 'aria-label': '削除', title: '削除', text: '🗑' });
        const li = el('li', { class: 'memo__item' },
          el('button', { class: 'memo__item-main', type: 'button', onClick: function () {
            pinnedKey = it.key; pinnedMeta = { title: it.title, kind: it.kind, refId: it.refId };
            show('ctx');
          } },
            el('span', { class: 'memo__item-title', text: (KIND_ICON[it.kind] || '🗒️') + ' ' + it.title }),
            el('span', { class: 'memo__item-excerpt', text: it.text.replace(/\s+/g, ' ').slice(0, 80) }),
            el('span', { class: 'memo__item-date', text: stamp(it.updatedAt) })),
          delBtn);
        // ドックの上でも確実に見えるよう、確認はインラインで行う
        delBtn.addEventListener('click', function () {
          if (delBtn.dataset.armed) { remove(it.key); renderList(); return; }
          delBtn.dataset.armed = '1';
          delBtn.textContent = '削除する？';
          delBtn.classList.add('is-armed');
          setTimeout(function () { if (delBtn.isConnected) { delete delBtn.dataset.armed; delBtn.textContent = '🗑'; delBtn.classList.remove('is-armed'); } }, 3000);
        });
        list.appendChild(li);
      });
    }

    function show(id) {
      sub = id;
      Object.keys(views).forEach(function (k) {
        views[k].hidden = k !== id;
        subBtn[k].classList.toggle('is-active', k === id);
        subBtn[k].setAttribute('aria-selected', k === id ? 'true' : 'false');
      });
      if (id === 'ctx') refreshCtx();
      if (id === 'list') renderList();
      if (id === 'note') refreshNote();
    }
    function refreshNote() {
      if (document.activeElement !== note) note.value = getGlobal();
      updateCount();
      if (!preview.hidden) preview.innerHTML = U.md(note.value);
    }

    function importJson() {
      U.pickFile('application/json,.json').then(function (txt) {
        let obj = null;
        try { obj = JSON.parse(txt); } catch (e) { U.toast('JSON を読み込めませんでした', 'ng'); return; }
        const data = obj && obj.data ? obj.data : obj;
        if (!data || typeof data !== 'object') { U.toast('メモのバックアップではないようです', 'ng'); return; }
        const d = load();
        if (typeof data.global === 'string' && data.global.trim() && d.global.indexOf(data.global.trim()) < 0) {
          d.global = (d.global ? d.global.replace(/\s+$/, '') + '\n\n' : '') + data.global.trim() + '\n';
        }
        let n = 0;
        Object.keys(data.items || {}).forEach(function (k) {
          const it = data.items[k];
          if (!it || typeof it.text !== 'string') return;
          const cur = d.items[k];
          if (!cur || (it.updatedAt || 0) > (cur.updatedAt || 0)) { d.items[k] = it; n++; }
        });
        save(d);
        refreshNote();
        if (sub === 'list') renderList();
        U.toast('メモを読み込みました（' + n + ' 件を統合）', 'ok');
      }).catch(function () { /* キャンセル */ });
    }

    container.appendChild(el('div', { class: 'memo' },
      el('div', { class: 'memo__bar' }, subTabs, el('div', { class: 'memo__menu-wrap' }, menuBtn, menu)),
      views.note, views.ctx, views.list));

    SAA.bus.on('context:change', function () { if (!pinnedKey && sub === 'ctx') refreshCtx(); else if (!pinnedKey && ctxKey) { set(ctxKey, ctxArea.value, ctxMeta); } });
    SAA.bus.on('dock:open', function (p) { if (p && p.tab === 'memo') { if (sub === 'ctx') refreshCtx(); if (sub === 'note') refreshNote(); } });

    panel = { refreshNote: refreshNote };
    // 何かのコンテキストを表示中なら「この画面」から始める
    const c = SAA.getContext ? SAA.getContext() : null;
    show(c && c.kind && c.kind !== 'none' ? 'ctx' : 'note');
    refreshNote();
  }

  // ---------- テキスト操作 ----------
  function insertText(ta, text) {
    const s = ta.selectionStart; const e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }
  function insertLinePrefix(ta, prefix) {
    const s = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
    ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    ta.selectionStart = ta.selectionEnd = s + prefix.length;
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }
  function wrapSelection(ta, a, b, placeholder) {
    const s = ta.selectionStart; const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || placeholder;
    ta.value = ta.value.slice(0, s) + a + sel + b + ta.value.slice(e);
    ta.selectionStart = s + a.length;
    ta.selectionEnd = s + a.length + sel.length;
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }

  SAA.memo = {
    append: append,
    get: get,
    set: set,
    remove: remove,
    getGlobal: getGlobal,
    exportMarkdown: exportMarkdown,
    renderPanel: renderPanel,
    _test: {
      roundTrip: function () {
        const before = SAA.store.get('memo', null);
        try {
          set('test:roundtrip', 'テストメモ', { title: 'テスト', kind: 'none' });
          const ok1 = get('test:roundtrip') === 'テストメモ';
          append('追記テスト', { title: 'セルフテスト' });
          const ok2 = getGlobal().indexOf('追記テスト') >= 0;
          const ok3 = exportMarkdown().indexOf('テストメモ') >= 0;
          return ok1 && ok2 && ok3;
        } finally {
          if (before === null) SAA.store.remove('memo'); else SAA.store.set('memo', before);
        }
      }
    }
  };
})();
