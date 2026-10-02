/* 右側ドック：「📝 メモ」と「💬 質問」のタブを持つパネル（SAA.dock） */
(function () {
  'use strict';

  const U = SAA.util;
  const el = U.el;
  const TABS = [
    { id: 'memo', label: '📝 メモ' },
    { id: 'chat', label: '💬 質問' }
  ];

  let root = null;
  let inited = false;
  let opened = false;
  let tab = 'memo';
  const views = {};
  const tabBtns = {};
  const rendered = {};

  function sfx(id) { try { SAA.audio.playSfx(id); } catch (e) { /* noop */ } }

  function init() {
    if (inited) return;
    root = document.getElementById('dock');
    if (!root) return;
    inited = true;
    try { tab = SAA.store.get('dock.tab', 'memo') === 'chat' ? 'chat' : 'memo'; } catch (e) { /* noop */ }

    root.className = 'dock';
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', 'メモと質問チャット');
    root.setAttribute('aria-hidden', 'true');
    root.inert = true;

    const tabs = el('div', { class: 'dock__tabs', role: 'tablist' });
    TABS.forEach(function (t) {
      const b = el('button', {
        class: 'dock__tab', type: 'button', role: 'tab', id: 'dock-tab-' + t.id, 'aria-controls': 'dock-view-' + t.id,
        text: t.label, onClick: function () { select(t.id); }
      });
      tabBtns[t.id] = b;
      tabs.appendChild(b);
    });
    const head = el('header', { class: 'dock__head' }, tabs,
      el('button', { class: 'icon-btn dock__close', type: 'button', 'aria-label': 'パネルを閉じる（Esc）', title: '閉じる（Esc）', text: '✕', onClick: close }));
    const body = el('div', { class: 'dock__body' });
    TABS.forEach(function (t) {
      views[t.id] = el('section', { class: 'dock__view dock__view--' + t.id, id: 'dock-view-' + t.id, role: 'tabpanel', 'aria-labelledby': 'dock-tab-' + t.id });
      body.appendChild(views[t.id]);
    });
    root.appendChild(el('div', { class: 'dock__panel' }, head, body));

    // ほかの画面からの依頼
    SAA.bus.on('memo:append', function (p) {
      if (!p || !p.text) return;
      try { SAA.memo.append(p.text, { title: p.title, contextKey: p.contextKey }); } catch (e) { console.error(e); return; }
      U.toast('メモに追加しました（📝 メモ → ノート）', 'ok');
      sfx('memo');
    });
    SAA.bus.on('chat:ask', function (p) {
      if (!p || !p.text) return;
      open('chat');
      try { SAA.chat.ask(p.text, { autoSend: p.autoSend !== false }); } catch (e) { console.error(e); }
    });
    select(tab, true);
  }

  function ensureRendered(id) {
    if (rendered[id]) return;
    rendered[id] = true;
    try {
      if (id === 'memo') SAA.memo.renderPanel(views.memo);
      else SAA.chat.renderPanel(views.chat);
    } catch (e) {
      console.error('[dock] render ' + id, e);
      views[id].appendChild(el('p', { class: 'empty-state', text: 'パネルの表示に失敗しました。' }));
    }
  }

  function select(id, silent) {
    if (!views[id]) return;
    tab = id;
    try { SAA.store.set('dock.tab', id); } catch (e) { /* noop */ }
    TABS.forEach(function (t) {
      const on = t.id === id;
      tabBtns[t.id].classList.toggle('is-active', on);
      tabBtns[t.id].setAttribute('aria-selected', on ? 'true' : 'false');
      views[t.id].hidden = !on;
    });
    if (opened || !silent) ensureRendered(id);
    if (!silent) SAA.bus.emit('dock:tab', { tab: id });
  }

  function open(id) {
    if (!inited) init();
    if (!root) return;
    if (id) select(id, true);
    ensureRendered(tab);
    if (!opened) {
      opened = true;
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      root.inert = false;
      document.body.classList.add('dock-open');
      sfx('open');
      SAA.bus.emit('dock:open', { tab: tab });
    }
    // 入力欄にフォーカス（チャット）
    setTimeout(function () {
      const f = views[tab] && views[tab].querySelector('[data-autofocus]');
      if (f && !f.disabled) { try { f.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
    }, 80);
  }

  function close() {
    if (!opened || !root) return;
    opened = false;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    if (root.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (e) { /* noop */ } }
    root.inert = true;
    document.body.classList.remove('dock-open');
    sfx('close');
    SAA.bus.emit('dock:close', { tab: tab });
  }

  function toggle(id) {
    if (opened && (!id || id === tab)) close();
    else open(id || tab);
  }

  // Esc で閉じる（モーダルが開いているときはモーダル優先）
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !opened || e.defaultPrevented) return;
    if (U.hasModal && U.hasModal()) return;
    if (root && root.contains(e.target) && e.target.tagName === 'TEXTAREA' && e.target.value) return;
    e.preventDefault();
    close();
  });

  SAA.dock = {
    init: init,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function () { return opened; },
    currentTab: function () { return tab; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
