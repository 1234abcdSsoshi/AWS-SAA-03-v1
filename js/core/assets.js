/* 画像アセット：マニフェストの解決（拡張子フォールバック）、プレースホルダー、背景、立ち絵、チェッカー */
(function () {
  'use strict';

  const U = SAA.util;
  const el = U.el;
  const EXTS = ['.png', '.webp', '.jpg', '.jpeg'];
  const DEFAULT_PH = 'linear-gradient(160deg,#dfe7f1 0%,#f7f9fc 55%,#c9d3e2 100%)';
  const KIND_LABEL = { sprite: '立ち絵', face: '顔アイコン', bg: '背景', cg: 'イベントCG' };
  const KIND_ORDER = ['sprite', 'face', 'bg', 'cg'];

  const cache = new Map();    // key -> url | null
  const sizes = new Map();    // key -> { w, h }（見つかった画像の実寸）
  const pending = new Map();  // key -> Promise
  let epoch = 0;              // 再チェックで古いコールバックを無効化する

  function manifest() { return SAA.data.assets || {}; }
  function chars() { return SAA.data.characters || {}; }

  function candidates(path) {
    const stem = String(path).replace(/\.[a-z0-9]+$/i, '');
    const list = [path].concat(EXTS.map(function (x) { return stem + x; }));
    return list.filter(function (p, i) { return list.indexOf(p) === i; });
  }

  function tryLoad(url) {
    return new Promise(function (resolve) {
      const im = new Image();
      im.onload = function () { resolve(im.naturalWidth > 0 ? { url: url, w: im.naturalWidth, h: im.naturalHeight } : null); };
      im.onerror = function () { resolve(null); };
      im.src = url;
    });
  }

  function resolve(key) {
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    const a = manifest()[key];
    if (!a || !a.path) { cache.set(key, null); return Promise.resolve(null); }
    const mine = epoch;
    const list = candidates(a.path);
    const p = (async function () {
      let found = null;
      for (let i = 0; i < list.length && !found; i++) found = await tryLoad(list[i]);
      if (mine === epoch) {
        cache.set(key, found ? found.url : null);
        if (found) sizes.set(key, { w: found.w, h: found.h });
        pending.delete(key);
      }
      return found ? found.url : null;
    })();
    pending.set(key, p);
    return p;
  }

  function has(key) { return cache.has(key) ? !!cache.get(key) : undefined; }
  function cssUrl(url) { return 'url("' + String(url).replace(/["\\\n]/g, '') + '")'; }

  // ---- 立ち絵プレースホルダー（インライン SVG のバストシルエット） ----
  let svgSeq = 0;
  function silhouette(charId) {
    svgSeq += 1;
    const g = 'sprg' + svgSeq;
    const mix = function (pct, other) { return 'fill:color-mix(in srgb, var(--sprite-c) ' + pct + '%, ' + other + ')'; };
    const isRen = charId === 'ren';
    const hairBack = isRen ? '' :
      '<path style="' + mix(62, '#3b2a3a') + '" d="M50 112C42 44 158 44 150 112c5 46 3 78-9 92H59c-12-14-14-46-9-92z"/>';
    const hairTop = isRen
      ? '<path style="' + mix(45, '#141c30') + '" d="M55 104C48 48 150 42 146 102c-7-20-22-31-48-28-18 2-34 11-43 30z"/>'
      : '<path style="' + mix(62, '#3b2a3a') + '" d="M55 108c-2-50 92-52 90 0-13-20-28-27-44-27-18 0-34 9-46 27z"/>';
    const extra = isRen
      ? '<g fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.4"><rect x="70" y="102" width="24" height="15" rx="5"/><rect x="106" y="102" width="24" height="15" rx="5"/><path d="M94 108h12"/></g>' +
        '<path fill="rgba(255,255,255,.55)" d="M100 184l-9 14 9 62 9-62z"/><path fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2.4" d="M76 184l24 24 24-24"/>'
      : '<circle cx="139" cy="84" r="6" fill="rgba(255,255,255,.85)"/>' +
        '<path fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2.4" d="M80 186q20 22 40 0"/>' +
        '<rect x="74" y="232" width="52" height="40" rx="5" fill="rgba(255,255,255,.4)"/>';
    return '<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" style="stop-color:color-mix(in srgb, var(--sprite-c) 58%, #ffffff)"/>' +
      '<stop offset="1" style="stop-color:var(--sprite-c)"/></linearGradient></defs>' +
      hairBack +
      '<path fill="url(#' + g + ')" d="M26 300c0-78 26-118 74-118s74 40 74 118z"/>' +
      '<rect x="88" y="146" width="24" height="44" rx="11" style="' + mix(38, '#ffffff') + '"/>' +
      '<ellipse cx="100" cy="108" rx="41" ry="47" style="' + mix(30, '#ffffff') + '"/>' +
      hairTop + extra + '</svg>';
  }

  function spriteLabel(charId, face) {
    const c = chars()[charId];
    if (!c) return charId + (face ? '・' + face : '');
    const f = c.faces && c.faces[face];
    return c.short + (f ? '・' + f : '');
  }

  function sprite(charId, face) {
    const c = chars()[charId] || {};
    const f = face || c.defaultFace || 'normal';
    const key = charId + '_' + f;
    const label = spriteLabel(charId, f);
    const box = el('span', {
      class: 'sprite sprite--' + charId, style: { '--sprite-c': c.color || '#8a93a6' },
      dataset: { char: charId, face: f, asset: key }, role: 'img', 'aria-label': label
    });
    const addImg = function (url) {
      box.appendChild(el('img', { class: 'sprite__img', src: url, alt: '', draggable: 'false' }));
      box.classList.add('is-loaded');
    };
    const known = cache.get(key);
    if (known) { addImg(known); return box; }
    box.appendChild(el('span', { class: 'sprite__ph', html: silhouette(charId) }, el('span', { class: 'sprite__chip', text: label })));
    if (!cache.has(key)) resolve(key).then(function (url) { if (url) addImg(url); });
    return box;
  }

  // ---- 種類別プレースホルダー ----
  function placeholder(key, a) {
    if (!a) return el('span', { class: 'asset-ph', text: key });
    if (a.kind === 'sprite') {
      const c = chars()[a.char] || {};
      return el('span', { class: 'sprite__ph', style: { '--sprite-c': c.color || '#8a93a6' }, html: silhouette(a.char) });
    }
    if (a.kind === 'face') {
      const c = chars()[a.char] || {};
      const col = c.color || '#8a93a6';
      return el('span', {
        class: 'asset-face-ph',
        style: { background: 'radial-gradient(circle at 30% 25%, color-mix(in srgb, ' + col + ' 50%, #fff) 0%, ' + col + ' 72%)' },
        text: String(c.short || '?').slice(0, 1)
      });
    }
    return el('span', { class: 'asset-fill', style: { backgroundImage: a.ph || DEFAULT_PH } },
      el('span', { class: 'asset-fill__icon', 'aria-hidden': 'true', text: a.icon || '🖼️' }),
      el('span', { class: 'asset-fill__label', text: a.label || key }));
  }

  // 常にラッパー要素を返す（画像が見つかれば差し替え）。画面側のサムネイル向け。
  function box(key, opts) {
    opts = opts || {};
    const a = manifest()[key];
    const kind = a ? a.kind : 'unknown';
    const alt = opts.alt !== undefined ? opts.alt : (a && a.label) || key;
    const wrap = el('span', {
      class: 'asset asset--' + kind + (opts.cls ? ' ' + opts.cls : ''),
      dataset: { asset: key }, role: 'img', 'aria-label': alt
    });
    const show = function (url) {
      U.clear(wrap);
      wrap.appendChild(el('img', { class: 'asset__img', src: url, alt: '', draggable: 'false' }));
      wrap.classList.add('is-loaded');
    };
    const known = cache.get(key);
    if (known) { show(known); return wrap; }
    wrap.appendChild(placeholder(key, a));
    if (a && !cache.has(key)) resolve(key).then(function (url) { if (url) show(url); });
    return wrap;
  }

  // 解決済みで画像がある場合は <img> そのもの、それ以外はプレースホルダー付きラッパー
  function img(key, opts) {
    opts = opts || {};
    const url = cache.get(key);
    if (url) {
      const a = manifest()[key] || {};
      return el('img', {
        class: 'asset-img asset-img--' + (a.kind || 'unknown') + (opts.cls ? ' ' + opts.cls : ''),
        src: url, alt: opts.alt !== undefined ? opts.alt : (a.label || ''), draggable: 'false', dataset: { asset: key }
      });
    }
    return box(key, opts);
  }

  // ---- 背景 ----
  function applyBg(node, key, opts) {
    if (!node) return;
    opts = opts || {};
    const a = manifest()[key];
    Array.prototype.slice.call(node.children).forEach(function (c) {
      if (c.classList && c.classList.contains('asset-bg__deco')) c.remove();
    });
    node.classList.add('asset-bg');
    node.classList.remove('is-loaded');
    node.dataset.assetKey = key || '';
    const setImage = function (url) {
      node.style.backgroundImage = cssUrl(url);
      node.style.backgroundSize = 'cover';
      node.style.backgroundPosition = 'center';
      node.style.backgroundRepeat = 'no-repeat';
      node.classList.add('is-loaded');
    };
    const known = cache.get(key);
    if (known) { setImage(known); return; }
    node.style.backgroundImage = (a && a.ph) || DEFAULT_PH;
    const noDeco = opts.deco === false || /backdrop/.test(node.className || '');
    let deco = null;
    if (!noDeco) {
      deco = el('div', { class: 'asset-bg__deco', 'aria-hidden': 'true' },
        el('span', { class: 'asset-bg__icon', text: (a && a.icon) || '🖼️' }),
        el('span', { class: 'asset-bg__label', text: '📍 ' + ((a && a.label) || key || '背景') }));
      node.appendChild(deco);
    }
    if (!a || cache.has(key)) return;
    resolve(key).then(function (url) {
      if (!url || node.dataset.assetKey !== key) return;
      if (deco) deco.remove();
      setImage(url);
    });
  }

  // ---- アセットチェッカー ----
  function judge(key, a) {
    const url = cache.get(key);
    if (!url) return { cls: 'is-missing', text: '✗ 未作成', found: false };
    const s = sizes.get(key);
    if (!s || !a.w || !a.h) return { cls: 'is-ok', text: '✓ 見つかりました', found: true };
    const ratioOff = Math.abs((s.w / s.h) / (a.w / a.h) - 1);
    const actual = '（実際 ' + s.w + '×' + s.h + '）';
    if (ratioOff > 0.03) return { cls: 'is-warn', text: '⚠ サイズ違い：縦横比が異なります' + actual, found: true };
    if (s.w < a.w * 0.5) return { cls: 'is-warn', text: '⚠ サイズ違い：解像度が小さめです' + actual, found: true };
    return { cls: 'is-ok', text: '✓ 見つかりました' + (s.w === a.w && s.h === a.h ? '' : actual), found: true };
  }

  function renderChecker(container) {
    if (!container) return;
    U.clear(container);
    const man = manifest();
    const keys = Object.keys(man);
    const total = keys.length;
    const mine = epoch;
    let done = 0;
    let found = 0;
    let warn = 0;

    const count = el('div', { class: 'checker__count' });
    const bar = el('div', { class: 'progress__bar' });
    const state = el('div', { class: 'small muted', text: '確認中…' });
    const paint = function () {
      U.clear(count);
      count.append(String(found), el('small', { text: ' / ' + total + ' 枚' }));
      bar.style.width = (total ? Math.round(found / total * 100) : 0) + '%';
      if (done < total) state.textContent = '確認中…（' + done + ' / ' + total + '）';
      else if (found === total && !warn) state.textContent = 'すべての画像がそろっています。';
      else state.textContent = '未作成 ' + (total - found) + ' 枚' + (warn ? '・サイズ違い ' + warn + ' 枚' : '') + '。未作成の画像はプレースホルダーで表示されます。';
    };

    const wrap = el('div', { class: 'checker' });
    wrap.appendChild(el('div', { class: 'card checker__summary' },
      count,
      el('div', { class: 'checker__meter' },
        el('div', { class: 'progress progress--lg', style: { '--progress-c': 'var(--c-ok)' } }, bar), state),
      el('button', {
        class: 'btn', type: 'button', text: '🔄 再チェック',
        onClick: function () {
          epoch += 1; cache.clear(); sizes.clear(); pending.clear();
          renderChecker(container);
        }
      })));
    wrap.appendChild(el('div', { class: 'md-callout checker__note' },
      el('strong', { text: '画像の作り方：' }),
      '画像は ChatGPT / Codex で ', el('code', { text: 'Codex.md' }), ' の手順に沿って作成し、',
      el('code', { text: 'assets/images/' }), ' 以下の指定パスに置いてください。拡張子は .png のほか .webp / .jpg / .jpeg でも自動で見つけます。',
      '画像が無くてもアプリはプレースホルダーで動作します。'));

    KIND_ORDER.concat(keys.map(function (k) { return man[k].kind; })
      .filter(function (k, i, arr) { return KIND_ORDER.indexOf(k) < 0 && arr.indexOf(k) === i; }))
      .forEach(function (kind) {
        const ks = keys.filter(function (k) { return man[k].kind === kind; });
        if (!ks.length) return;
        const aside = el('span', { class: 'section-title__aside', text: '確認中…' });
        let gFound = 0;
        let gDone = 0;
        const list = el('div', { class: 'checker__list' });
        ks.forEach(function (key) {
          const a = man[key];
          const status = el('span', { class: 'checker__status is-pending', text: '… 確認中' });
          const item = el('div', { class: 'checker__item', dataset: { key: key } },
            el('div', { class: 'checker__thumb' }, box(key, { alt: '' })),
            el('div', { class: 'checker__meta' },
              el('span', { class: 'checker__key', text: key }),
              el('span', { class: 'checker__label', text: a.label || '' }),
              el('span', { class: 'checker__path', text: a.path }),
              el('span', { class: 'checker__size', text: '想定サイズ ' + a.w + '×' + a.h + (a.alpha ? '・透過PNG' : '') }),
              status));
          list.appendChild(item);
          resolve(key).then(function () {
            if (mine !== epoch) return;
            const j = judge(key, a);
            status.className = 'checker__status ' + j.cls;
            status.textContent = j.text;
            item.classList.add(j.cls === 'is-missing' ? 'is-missing' : j.cls);
            done += 1; gDone += 1;
            if (j.found) { found += 1; gFound += 1; }
            if (j.cls === 'is-warn') warn += 1;
            aside.textContent = gDone < ks.length ? '確認中…' : gFound + ' / ' + ks.length + ' 枚';
            paint();
          });
        });
        wrap.appendChild(el('section', { class: 'checker__group' },
          el('h2', { class: 'section-title' }, (KIND_LABEL[kind] || kind), aside),
          list));
      });

    paint();
    container.appendChild(wrap);
  }

  SAA.assets = {
    img: img,
    box: box,
    resolve: resolve,
    applyBg: applyBg,
    sprite: sprite,
    has: has,
    renderChecker: renderChecker,
    _test: {
      keys: function () { return Object.keys(manifest()); },
      candidates: candidates
    }
  };
})();
