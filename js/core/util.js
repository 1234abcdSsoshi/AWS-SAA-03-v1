/* 共通ユーティリティ：DOM 生成、エスケープ、markdown-lite、モーダル、トースト、スライド描画など */
(function () {
  'use strict';

  const U = {};

  // ---- DOM ----
  function appendChildren(node, children) {
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) appendChildren(node, c);
      else if (c instanceof Node) node.appendChild(c);
      else node.appendChild(document.createTextNode(String(c)));
    });
  }

  U.el = function (tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class' || k === 'className') node.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') {
          Object.keys(v).forEach(function (sk) {
            if (sk.indexOf('--') === 0) node.style.setProperty(sk, v[sk]);
            else node.style[sk] = v[sk];
          });
        } else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      });
    }
    appendChildren(node, Array.prototype.slice.call(arguments, 2));
    return node;
  };
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  U.clear = function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };

  // ---- markdown-lite（入力は必ずエスケープしてから整形する） ----
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codes[+i] + '</code>'; });
    return s;
  }
  function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }
  const LIST_RE = /^(\s*)(-|\d+\.)\s+(.*)$/;
  const QUOTE_RE = /^&gt;\s?/;
  function isTableStart(lines, i) {
    return /^\s*\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]);
  }

  U.mdInline = function (src) {
    if (src === null || src === undefined) return '';
    return U.esc(String(src)).replace(/\r\n?/g, '\n').split('\n').map(inline).join('<br>');
  };

  U.md = function (src) {
    if (src === null || src === undefined) return '';
    const lines = U.esc(String(src)).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      if (isTableStart(lines, i)) {
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        out.push('<div class="md-table-wrap"><table class="md-table"><thead><tr>' +
          head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div>');
        continue;
      }
      if (LIST_RE.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && LIST_RE.test(lines[i])) {
          const m = lines[i].match(LIST_RE);
          if (m[1].length >= 2 && items.length) items[items.length - 1].children.push(m[3]);
          else items.push({ text: m[3], children: [] });
          i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + ' class="md-list">' + items.map(function (it) {
          return '<li>' + inline(it.text) + (it.children.length ? '<ul>' + it.children.map(function (c) { return '<li>' + inline(c) + '</li>'; }).join('') + '</ul>' : '') + '</li>';
        }).join('') + '</' + tag + '>');
        continue;
      }
      if (QUOTE_RE.test(line)) {
        const buf = [];
        while (i < lines.length && QUOTE_RE.test(lines[i])) { buf.push(lines[i].replace(QUOTE_RE, '')); i++; }
        out.push('<blockquote class="md-callout">' + buf.map(inline).join('<br>') + '</blockquote>');
        continue;
      }
      const para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !LIST_RE.test(lines[i]) && !QUOTE_RE.test(lines[i]) && !isTableStart(lines, i)) {
        para.push(lines[i]);
        i++;
      }
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    }
    return out.join('');
  };

  // ---- 小物 ----
  U.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  U.clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  U.debounce = function (fn, ms) {
    let t = null;
    return function () {
      const args = arguments; const self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };
  let uidSeq = 0;
  U.uid = function (prefix) { uidSeq += 1; return (prefix || 'id') + '-' + uidSeq + '-' + Math.random().toString(36).slice(2, 7); };
  U.fmtTime = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    const p = function (n) { return String(n).padStart(2, '0'); };
    return h ? h + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s);
  };
  U.fmtDate = function (ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  U.pct = function (rate) { return Math.round((rate || 0) * 100) + '%'; };
  U.isTyping = function (e) {
    const t = e && e.target;
    if (!t || !t.tagName) return false;
    const tag = t.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  };
  U.prefersReducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  // ---- カリキュラム参照 ----
  U.domain = function (d) {
    const cur = SAA.data.curriculum;
    return cur ? cur.domains.find(function (x) { return x.id === d; }) : null;
  };
  U.task = function (id) {
    const cur = SAA.data.curriculum;
    return cur ? cur.tasks.find(function (x) { return x.id === id; }) : null;
  };
  U.chapter = function (id) {
    const cur = SAA.data.curriculum;
    return cur ? cur.chapters.find(function (x) { return x.id === id; }) : null;
  };

  // ---- ファイル ----
  U.download = function (filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = U.el('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };
  U.pickFile = function (accept) {
    return new Promise(function (resolve, reject) {
      const input = U.el('input', { type: 'file', accept: accept || '', style: { display: 'none' } });
      input.addEventListener('change', function () {
        const f = input.files && input.files[0];
        input.remove();
        if (!f) { reject(new Error('ファイルが選択されませんでした')); return; }
        const r = new FileReader();
        r.onload = function () { resolve(String(r.result)); };
        r.onerror = function () { reject(r.error); };
        r.readAsText(f);
      });
      document.body.appendChild(input);
      input.click();
    });
  };

  // ---- トースト ----
  U.toast = function (msg, kind) {
    const root = document.getElementById('toast-root') || document.body;
    const t = U.el('div', { class: 'toast toast--' + (kind || 'info'), role: 'status', text: msg });
    root.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-show'); });
    setTimeout(function () {
      t.classList.remove('is-show');
      setTimeout(function () { t.remove(); }, 400);
    }, kind === 'ng' ? 4200 : 2800);
  };

  // ---- モーダル（スタック管理：Esc は最前面だけを閉じる） ----
  const modalStack = [];
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !modalStack.length) return;
    const top = modalStack[modalStack.length - 1];
    if (top.dismissible === false) return;
    e.preventDefault();
    e.stopPropagation();
    top.close();
  }, true);
  U.hasModal = function () { return modalStack.length > 0; };

  U.modal = function (opts) {
    opts = opts || {};
    const root = document.getElementById('overlay-root') || document.body;
    const prevFocus = document.activeElement;
    const backdrop = U.el('div', { class: 'modal-backdrop' });
    const box = U.el('div', { class: 'modal' + (opts.wide ? ' modal--wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'ダイアログ' });
    const entry = { dismissible: opts.dismissible !== false, close: null };
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      const i = modalStack.indexOf(entry);
      if (i >= 0) modalStack.splice(i, 1);
      backdrop.classList.remove('is-open');
      setTimeout(function () { backdrop.remove(); }, 180);
      if (opts.onClose) { try { opts.onClose(); } catch (e) { console.error(e); } }
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* noop */ } }
    }
    entry.close = close;
    const header = U.el('div', { class: 'modal__header' },
      U.el('h2', { class: 'modal__title', text: opts.title || '' }),
      entry.dismissible ? U.el('button', { class: 'icon-btn modal__close', type: 'button', 'aria-label': '閉じる', text: '✕', onClick: close }) : null);
    const body = U.el('div', { class: 'modal__body' });
    if (opts.body instanceof Node) body.appendChild(opts.body);
    else if (opts.body) body.innerHTML = opts.body;
    const buttons = opts.buttons || [{ label: '閉じる', kind: 'primary' }];
    const footer = U.el('div', { class: 'modal__footer' });
    buttons.forEach(function (b) {
      footer.appendChild(U.el('button', {
        class: 'btn btn--' + (b.kind || 'ghost'), type: 'button', text: b.label,
        onClick: function () {
          Promise.resolve(b.onClick ? b.onClick() : undefined).then(function (r) {
            if (b.close !== false && r !== false) close();
          });
        }
      }));
    });
    box.appendChild(header);
    box.appendChild(body);
    if (buttons.length) box.appendChild(footer);
    backdrop.appendChild(box);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop && entry.dismissible) close(); });
    root.appendChild(backdrop);
    modalStack.push(entry);
    requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    const focusable = box.querySelector('input, textarea, select, .modal__footer .btn--primary, button');
    if (focusable) setTimeout(function () { try { focusable.focus(); } catch (e) { /* noop */ } }, 30);
    return { close: close, el: box, body: body };
  };

  U.confirm = function (msg, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      let result = false;
      U.modal({
        title: opts.title || '確認',
        body: U.el('p', { class: 'confirm-text', text: msg }),
        buttons: [
          { label: opts.cancelLabel || 'キャンセル', kind: 'ghost', onClick: function () { result = false; } },
          { label: opts.okLabel || 'OK', kind: opts.danger ? 'danger' : 'primary', onClick: function () { result = true; } }
        ],
        onClose: function () { resolve(result); }
      });
    });
  };

  // ---- 表示部品 ----
  U.domainBadge = function (d) {
    const dom = U.domain(d);
    return U.el('span', { class: 'badge badge--d' + d, title: dom ? dom.name : '' , text: 'D' + d + ' ' + (dom ? dom.short : '') });
  };
  U.stars = function (n) {
    n = U.clamp(n || 1, 1, 3);
    return U.el('span', { class: 'stars', 'aria-label': '難易度 ' + n + '/3', text: '★'.repeat(n) + '☆'.repeat(3 - n) });
  };
  U.charAvatar = function (charId) {
    const c = (SAA.data.characters || {})[charId] || { short: '?', color: '#8a93a6' };
    const box = U.el('span', { class: 'avatar avatar--' + charId, style: { '--avatar-color': c.color }, 'aria-hidden': 'true' },
      U.el('span', { class: 'avatar__initial', text: String(c.short || '?').slice(0, 1) }));
    if (SAA.assets && SAA.assets.resolve) {
      SAA.assets.resolve('face_' + charId).then(function (url) {
        if (!url) return;
        U.clear(box);
        box.appendChild(U.el('img', { src: url, alt: '' }));
      });
    }
    return box;
  };

  U.renderSlide = function (s, opts) {
    opts = opts || {};
    const ch = U.chapter(s.chapter);
    const wrap = U.el('article', { class: 'slide slide--' + s.layout + (opts.compact ? ' slide--compact' : ''), dataset: { slide: s.id } });
    wrap.appendChild(U.el('header', { class: 'slide__head' },
      U.el('span', { class: 'slide__badge', text: ch ? ch.title : '' }),
      U.el('h3', { class: 'slide__title', text: s.title })));
    if (s.lead) wrap.appendChild(U.el('div', { class: 'slide__lead', html: U.md(s.lead) }));
    const body = U.el('div', { class: 'slide__body' });
    if (s.layout === 'table') {
      body.appendChild(U.el('div', { class: 'slide__table-wrap' },
        U.el('table', { class: 'slide__table' },
          U.el('thead', null, U.el('tr', null, (s.columns || []).map(function (c) { return U.el('th', { html: U.mdInline(c) }); }))),
          U.el('tbody', null, (s.rows || []).map(function (r) {
            return U.el('tr', null, r.map(function (c) { return U.el('td', { html: U.mdInline(c) }); }));
          })))));
    } else if (s.layout === 'bullets') {
      body.innerHTML = U.md((s.bullets || []).map(function (b) { return /^\s{2,}-\s/.test(b) ? b : '- ' + b; }).join('\n'));
    } else if (s.layout === 'compare') {
      body.appendChild(U.el('div', { class: 'slide__compare' }, (s.items || []).map(function (it) {
        return U.el('section', { class: 'slide__card' },
          it.tag ? U.el('span', { class: 'slide__tag', text: it.tag }) : null,
          U.el('h4', { class: 'slide__card-title', text: it.title }),
          U.el('div', { class: 'slide__card-body', html: U.md(it.body) }));
      })));
    } else if (s.layout === 'flow') {
      body.appendChild(U.el('ol', { class: 'slide__flow' }, (s.steps || []).map(function (st, i) {
        return U.el('li', { class: 'slide__step' },
          U.el('span', { class: 'slide__step-no', text: String(i + 1) }),
          U.el('div', { class: 'slide__step-main' },
            U.el('strong', { class: 'slide__step-title', text: st.title }),
            st.body ? U.el('div', { class: 'slide__step-body', html: U.md(st.body) }) : null));
      })));
    }
    wrap.appendChild(body);
    if (s.note) {
      wrap.appendChild(U.el('aside', { class: 'slide__note' },
        U.el('span', { class: 'slide__note-label', text: '試験のツボ' }),
        U.el('div', { class: 'slide__note-body', html: U.md(s.note) })));
    }
    return wrap;
  };

  U._test = { md: U.md };
  SAA.util = U;
})();
