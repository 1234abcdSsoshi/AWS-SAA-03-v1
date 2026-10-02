/* 問題コンポーネント：出題・回答・採点・解説表示（ストーリー／演習／見直し／模試で共用） */
(function () {
  'use strict';

  const SAA = window.SAA;
  const U = SAA.util;
  const el = U.el;
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const COUNT_JA = { 1: '1 つ', 2: '2 つ', 3: '3 つ', 4: '4 つ' };

  let streak = 0;        // 連続正解数（ストーリー・演習をまたいで数える）
  const mounted = [];    // マウント中のコンポーネント（最後のものがキーボード操作の対象）

  // ---- 純粋関数 ----
  function norm(arr) {
    const set = {};
    (Array.isArray(arr) ? arr : []).forEach(function (i) { set[Number(i)] = true; });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }
  // 採点：選択した元インデックスの集合が正解の集合と完全一致するか
  function check(q, selected) {
    const a = norm(q && q.answer);
    const s = norm(selected);
    if (!a.length || a.length !== s.length) return false;
    return a.every(function (v, i) { return v === s[i]; });
  }
  function letter(i) { return LETTERS[i] || String(i + 1); }
  function sfx(id) {
    try { if (SAA.audio && SAA.audio.playSfx) SAA.audio.playSfx(id); } catch (e) { /* noop */ }
  }
  function pick(list) { return list && list.length ? list[Math.floor(Math.random() * list.length)] : null; }
  function plain(s) {
    return String(s || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s*\n+\s*/g, ' ').trim();
  }
  function excerpt(s, max) {
    const t = plain(s);
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
  function titleOf(q) { return '問題 ' + q.id + '｜' + (q.topic || ''); }

  // チャット用の文脈テキスト（選択肢は表示順 A〜）
  function buildSummary(q, order, selected, reveal) {
    const dom = U.domain(q.domain);
    const task = U.task(q.task);
    const lines = [];
    lines.push('【問題】' + q.id + '（第' + q.domain + '分野' + (dom ? ' ' + dom.short : '') + ' / タスク ' + q.task + (task ? ' ' + task.name : '') + ' / ' + (q.topic || '') + '）');
    lines.push(String(q.question || ''));
    lines.push('【選択肢】');
    order.forEach(function (oi, k) { lines.push(letter(k) + '. ' + q.options[oi]); });
    if (reveal) {
      const toLetters = function (arr) {
        return order.map(function (oi, k) { return arr.indexOf(oi) >= 0 ? letter(k) : null; }).filter(Boolean).join(', ');
      };
      const sel = norm(selected);
      lines.push('【正解】' + toLetters(norm(q.answer)));
      lines.push('【ユーザーの回答】' + (sel.length ? toLetters(sel) + '（' + (check(q, sel) ? '正解' : '不正解') + '）' : '未回答'));
      if (q.explanation) lines.push('【解説】' + plain(q.explanation));
      if (q.point) lines.push('【ポイント】' + plain(q.point));
    } else {
      lines.push('（ユーザーはまだ回答していません。答えを直接教えず、考え方のヒントを優先してください。）');
    }
    return lines.join('\n');
  }

  function setQuestionContext(q, order, selected, reveal) {
    try {
      SAA.setContext({
        kind: 'question', key: 'q:' + q.id, id: q.id, title: titleOf(q),
        summary: buildSummary(q, order, selected, reveal), reveal: !!reveal
      });
    } catch (e) { /* noop */ }
  }

  function settings() {
    try { return SAA.store.getSettings(); } catch (e) { return {}; }
  }

  // ---- キーボード（アクティブなコンポーネントだけが受け取る） ----
  function activeComp() {
    for (let i = mounted.length - 1; i >= 0; i--) {
      const c = mounted[i];
      if (c.root.isConnected && c.keys) return c;
    }
    return null;
  }
  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (U.isTyping(e) || (U.hasModal && U.hasModal())) return;
    const c = activeComp();
    if (!c) return;
    if (c.handleKey(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  function attachKeys() { document.addEventListener('keydown', onKeyDown, true); }
  function detachKeys() { document.removeEventListener('keydown', onKeyDown, true); }

  // ---- コンポーネント ----
  function mount(container, q, opts) {
    opts = opts || {};
    const mode = opts.mode || 'practice';
    const isMock = mode === 'mock';
    const isReview = mode === 'review';
    const answer = norm(q.answer);
    const need = Math.max(1, answer.length);
    const multi = need > 1;
    const base = (q.options || []).map(function (_, i) { return i; });
    let order = base;
    if (Array.isArray(opts.order) && opts.order.length === base.length) order = opts.order.slice();
    else if (opts.shuffle) order = U.shuffle(base);

    const sel = new Set(norm(opts.selected).filter(function (i) { return i < base.length; }));
    let submitted = false;
    let destroyed = false;
    let resAnswered; let resDone;
    const answered = new Promise(function (r) { resAnswered = r; });
    const done = new Promise(function (r) { resDone = r; });

    // -- ヘッダー --
    const task = U.task(q.task);
    const bmBtn = el('button', { type: 'button', class: 'qz__bm', 'aria-label': 'ブックマーク', title: 'ブックマーク（あとで復習）' }, '🔖');
    function paintBookmark() {
      let on = false;
      try { on = !!(SAA.stats.isBookmarked && SAA.stats.isBookmarked(q.id)); } catch (e) { on = false; }
      bmBtn.classList.toggle('is-on', on);
      bmBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    bmBtn.addEventListener('click', function () {
      if (!SAA.stats.toggleBookmark) return;
      const on = SAA.stats.toggleBookmark(q.id);
      paintBookmark();
      sfx('select');
      U.toast(on ? 'ブックマークに追加しました' : 'ブックマークを外しました', on ? 'ok' : 'info');
    });
    paintBookmark();

    const head = el('header', { class: 'qz__head' },
      el('div', { class: 'qz__meta' },
        U.domainBadge(q.domain),
        el('span', { class: 'qz__task', title: task ? task.name : '', text: 'タスク ' + q.task }),
        q.topic ? el('span', { class: 'qz__topic', text: q.topic }) : null,
        U.stars(q.difficulty)),
      el('div', { class: 'qz__head-right' },
        opts.total ? el('span', { class: 'qz__count' }, 'Q ', el('b', { text: String(opts.index || 1) }), ' / ' + opts.total) : null,
        bmBtn));

    // -- 問題文・選択肢 --
    const hint = el('p', { class: 'qz__hint' + (multi ? ' qz__hint--multi' : '') },
      multi ? el('span', { class: 'qz__hint-badge', text: COUNT_JA[need] + '選択' }) : null,
      el('span', { class: 'qz__hint-text', text: multi ? '正しいものを ' + COUNT_JA[need] + '選んでください' : '最も適切なものを 1 つ選んでください' }));
    const optsBox = el('div', { class: 'qz__opts', role: multi ? 'group' : 'radiogroup', 'aria-label': '選択肢' });
    const optEls = [];
    order.forEach(function (oi, k) {
      const btn = el('button', { type: 'button', class: 'qz__opt', dataset: { i: String(oi) }, role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false' },
        el('span', { class: 'qz__key', text: letter(k) }),
        el('span', { class: 'qz__opt-text', html: U.mdInline(q.options[oi]) }),
        el('span', { class: 'qz__mark', 'aria-hidden': 'true' }));
      const wrap = el('div', { class: 'qz__opt-wrap' }, btn);
      btn.addEventListener('click', function () { toggle(oi); });
      optsBox.appendChild(wrap);
      optEls.push({ oi: oi, k: k, btn: btn, wrap: wrap });
    });

    const submitBtn = el('button', { type: 'button', class: 'btn btn--primary btn--lg qz__submit', disabled: true, text: '回答する' });
    submitBtn.addEventListener('click', submit);
    const selInfo = el('span', { class: 'qz__sel-info' });
    const actions = el('div', { class: 'qz__actions' },
      el('span', { class: 'qz__keys' }, el('span', { class: 'kbd', text: '1' }), '–', el('span', { class: 'kbd', text: String(order.length) }), ' で選択・', el('span', { class: 'kbd', text: 'Enter' }), ' で決定'),
      selInfo,
      submitBtn);
    const result = el('div', { class: 'qz__result' });

    const root = el('article', { class: 'qz qz--' + mode + (multi ? ' qz--multi' : ''), dataset: { qid: q.id } },
      head,
      el('div', { class: 'qz__question', html: U.md(q.question || '') }),
      hint,
      optsBox,
      (isMock || isReview) ? null : actions,
      result);
    container.appendChild(root);

    function paintSelection() {
      optEls.forEach(function (o) {
        const on = sel.has(o.oi);
        o.btn.classList.toggle('is-sel', on);
        o.btn.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      submitBtn.disabled = sel.size !== need;
      selInfo.textContent = multi ? sel.size + ' / ' + need + ' 選択中' : '';
    }

    function toggle(oi) {
      if (submitted || destroyed || isReview) return;
      if (sel.has(oi)) {
        if (multi || isMock) sel.delete(oi);
      } else if (!multi) {
        sel.clear();
        sel.add(oi);
      } else if (sel.size < need) {
        sel.add(oi);
      } else {
        // これ以上選べない：ヒントを揺らして知らせる
        hint.classList.remove('is-nudge');
        void hint.offsetWidth;
        hint.classList.add('is-nudge');
        return;
      }
      sfx('select');
      paintSelection();
      if (opts.onChange) { try { opts.onChange(getSelection()); } catch (e) { console.error(e); } }
    }

    function getSelection() { return norm(Array.from(sel)); }
    function setSelection(arr) {
      if (submitted && !isMock) return;
      sel.clear();
      norm(arr).forEach(function (i) { if (i < base.length) sel.add(i); });
      paintSelection();
    }
    function lettersOf(arr) {
      return optEls.filter(function (o) { return arr.indexOf(o.oi) >= 0; }).map(function (o) { return letter(o.k); }).join(', ');
    }

    // 正誤の色付け＋選択肢ごとの解説
    function reveal(selected) {
      root.classList.add('is-answered');
      optEls.forEach(function (o) {
        const isAns = answer.indexOf(o.oi) >= 0;
        const chosen = selected.indexOf(o.oi) >= 0;
        o.btn.disabled = true;
        o.btn.classList.toggle('is-sel', chosen);
        o.btn.classList.toggle('is-correct', isAns);
        o.btn.classList.toggle('is-wrong', chosen && !isAns);
        o.btn.classList.toggle('is-dim', !isAns && !chosen);
        const mark = o.btn.querySelector('.qz__mark');
        mark.textContent = isAns ? '✓' : (chosen ? '✗' : '');
        if (chosen) o.btn.appendChild(el('span', { class: 'qz__yours', text: 'あなたの回答' }));
        const note = q.optionNotes && q.optionNotes[o.oi];
        if (note) {
          const m = String(note).match(/^\s*([○×〇✕])\s*(.*)$/);
          const ok = m ? (m[1] === '○' || m[1] === '〇') : isAns;
          o.wrap.appendChild(el('div', { class: 'qz__note ' + (ok ? 'is-ok' : 'is-ng') },
            el('span', { class: 'qz__note-mark', text: ok ? '○' : '×' }),
            el('span', { class: 'qz__note-text', html: U.mdInline(m ? m[2] : note) })));
        }
      });
    }

    function memoText() {
      const parts = [];
      if (q.point) parts.push('💡 ' + plain(q.point));
      parts.push('正解: ' + answer.map(function (i) { return plain(q.options[i]); }).join(' ／ '));
      if (q.explanation) parts.push(excerpt(q.explanation, 220));
      return parts.join('\n');
    }

    function extraButtons(selected) {
      return [
        el('button', {
          type: 'button', class: 'btn btn--ghost btn--sm', text: '📝 メモに追加',
          onClick: function () {
            SAA.bus.emit('memo:append', { title: titleOf(q), text: memoText(), contextKey: 'q:' + q.id });
            sfx('memo');
            U.toast('メモに追加しました', 'ok');
          }
        }),
        el('button', {
          type: 'button', class: 'btn btn--ghost btn--sm', text: '💬 この問題を質問',
          onClick: function () {
            if (SAA.isMockActive && SAA.isMockActive()) { U.toast('模擬試験中は質問できません', 'warn'); return; }
            setQuestionContext(q, order, selected, true);
            SAA.bus.emit('chat:ask', { text: 'この問題（' + (q.topic || q.id) + '）の正解の理由と、他の選択肢が誤りである理由を詳しく教えてください。', autoSend: true });
          }
        })
      ];
    }

    function renderFeedback(selected, correct, reaction) {
      U.clear(result);
      const unanswered = !selected.length;
      const banner = el('div', { class: 'qz__banner ' + (correct ? 'is-ok' : 'is-ng'), role: 'status' },
        el('span', { class: 'qz__banner-icon', 'aria-hidden': 'true', text: correct ? '○' : '×' }),
        el('div', { class: 'qz__banner-main' },
          el('strong', { class: 'qz__banner-title', text: correct ? '正解！' : (unanswered ? '未回答' : '不正解…') }),
          el('span', { class: 'qz__banner-sub' }, '正解は ', el('b', { text: lettersOf(answer) }),
            (!correct && !unanswered) ? '（あなたの回答：' + lettersOf(selected) + '）' : '')));
      result.appendChild(banner);

      if (reaction) {
        result.appendChild(el('div', { class: 'speech qz__ren' },
          U.charAvatar('ren', reaction.face),
          el('div', { class: 'speech__bubble' },
            el('span', { class: 'speech__name', text: '氷室 レン' }),
            el('p', { class: 'qz__ren-text', text: reaction.text }),
            reaction.extra ? el('p', { class: 'qz__ren-streak', text: reaction.extra }) : null)));
      }
      if (q.explanation) {
        result.appendChild(el('section', { class: 'qz__exp' },
          el('h4', { class: 'qz__sec-title', text: '解説' }),
          el('div', { class: 'qz__exp-body', html: U.md(q.explanation) })));
      }
      if (q.point) {
        result.appendChild(el('aside', { class: 'qz__point' },
          el('span', { class: 'qz__point-label', text: '💡 ポイント' }),
          el('div', { class: 'qz__point-body', html: U.mdInline(q.point) })));
      }
      const foot = el('div', { class: 'qz__foot' }, el('div', { class: 'qz__foot-tools' }, extraButtons(selected)));
      let nextBtn = null;
      if (!isReview || opts.showNext) {
        nextBtn = el('button', { type: 'button', class: 'btn btn--primary btn--lg qz__next', text: opts.nextLabel || '次へ ▶', onClick: next });
        foot.appendChild(nextBtn);
      }
      result.appendChild(foot);
      return { banner: banner, nextBtn: nextBtn };
    }

    function chooseReaction(correct) {
      if (opts.reaction === false) return null;
      const pool = (SAA.data.reactions || {})[correct ? 'correct' : 'wrong'];
      const generic = pick(pool && pool.ren) || { face: 'normal', text: correct ? '正解だ。' : '解説を読んで、決め手を確認しておけ。' };
      const own = correct ? q.onCorrect : q.onWrong;
      const r = own ? { face: correct ? 'smile' : 'explain', text: own } : { face: generic.face, text: generic.text };
      if (correct && streak >= 3) {
        const s = pick(SAA.data.reactions && SAA.data.reactions.streak && SAA.data.reactions.streak.ren);
        r.extra = '🔥 ' + streak + '問連続正解！' + (s ? ' ' + s.text : '');
      }
      return r;
    }

    function submit() {
      if (submitted || destroyed || isMock || isReview || sel.size !== need) return;
      submitted = true;
      const selected = getSelection();
      const correct = check(q, selected);
      streak = correct ? streak + 1 : 0;

      actions.remove();
      reveal(selected);
      const fb = renderFeedback(selected, correct, chooseReaction(correct));

      sfx(correct ? 'correct' : 'incorrect');
      if (correct && streak >= 3) setTimeout(function () { if (!destroyed) sfx('combo'); }, 420);
      try { SAA.stats.record(q.id, { correct: correct, selected: selected, mode: mode }); } catch (e) { console.error(e); }
      SAA.bus.emit('quiz:answered', { qid: q.id, correct: correct, selected: selected, mode: mode });
      setQuestionContext(q, order, selected, true);

      if (root.isConnected && fb.banner.scrollIntoView) {
        try { fb.banner.scrollIntoView({ block: 'nearest', behavior: U.prefersReducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* noop */ }
      }
      if (fb.nextBtn) { try { fb.nextBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
      resAnswered({ correct: correct, selected: selected, q: q });
    }

    function next() {
      if (destroyed) return;
      sfx('click');
      resDone();
    }

    // キー操作：true を返すと処理済み
    function handleKey(e) {
      const key = e.key;
      if (key === 'Enter') {
        const t = e.target;
        const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
        const interactive = tag === 'button' || tag === 'a' || tag === 'summary';
        if (interactive && !(t.classList && t.classList.contains('qz__opt') && root.contains(t))) return false;
        if (isMock) {
          if (opts.onEnter) { opts.onEnter(); return true; }
          return false;
        }
        if (!submitted) {
          if (sel.size !== need) return false;
          submit();
          return true;
        }
        next();
        return true;
      }
      if (submitted) return false;
      let k = -1;
      if (/^[1-9]$/.test(key)) k = Number(key) - 1;
      else if (/^[a-hA-H]$/.test(key)) k = key.toUpperCase().charCodeAt(0) - 65;
      if (k < 0 || k >= optEls.length) return false;
      toggle(optEls[k].oi);
      return true;
    }

    const comp = { root: root, keys: !isReview, handleKey: handleKey };
    if (!isReview) {
      if (!mounted.length) attachKeys();
      mounted.push(comp);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      const i = mounted.indexOf(comp);
      if (i >= 0) mounted.splice(i, 1);
      if (!mounted.length) detachKeys();
      root.remove();
      resAnswered(null);
      resDone();
    }

    // -- 初期表示 --
    paintSelection();
    if (isReview) {
      const selected = getSelection();
      const correct = check(q, selected);
      submitted = true;
      hint.remove();
      reveal(selected);
      renderFeedback(selected, correct, null);
      if (opts.context !== false) setQuestionContext(q, order, selected, true);
      resAnswered({ correct: correct, selected: selected, q: q });
    } else if (!isMock) {
      setQuestionContext(q, order, [], false);
    }

    return {
      answered: answered, done: done, destroy: destroy,
      getSelection: getSelection, setSelection: setSelection,
      order: order.slice(), el: root
    };
  }

  // 複数の問題を順番に出す（演習用）。戻り値の Promise に abort() が付く。
  function runSequence(container, qids, opts) {
    opts = opts || {};
    let aborted = false;
    let currentCtl = null;
    const results = [];
    const qs = (qids || []).map(function (id) { return SAA.data.qById[id]; }).filter(Boolean);
    const shuffle = opts.shuffle !== undefined ? !!opts.shuffle : settings().shuffleOptions !== false;

    const p = (async function () {
      for (let i = 0; i < qs.length; i++) {
        if (aborted) break;
        const q = qs[i];
        if (opts.onQuestion) { try { opts.onQuestion(i, q, results); } catch (e) { console.error(e); } }
        const ctl = mount(container, q, {
          mode: opts.mode || 'practice', shuffle: shuffle, index: i + 1, total: qs.length,
          reaction: opts.reaction, nextLabel: i === qs.length - 1 ? (opts.lastLabel || '結果を見る ▶') : undefined
        });
        currentCtl = ctl;
        const r = await ctl.answered;
        if (aborted || !r) { ctl.destroy(); break; }
        results.push({ qid: q.id, correct: r.correct, selected: r.selected, order: ctl.order });
        if (opts.onAnswer) { try { opts.onAnswer(results[results.length - 1], i, results); } catch (e) { console.error(e); } }
        await ctl.done;
        ctl.destroy();
        currentCtl = null;
        try { if (container.scrollIntoView && container.isConnected) window.scrollTo({ top: 0 }); } catch (e) { /* noop */ }
      }
      return results;
    })();
    p.abort = function () {
      aborted = true;
      if (currentCtl) currentCtl.destroy();
    };
    return p;
  }

  SAA.quiz = {
    mount: mount,
    runSequence: runSequence,
    _test: { check: check, buildSummary: buildSummary, resetStreak: function () { streak = 0; } }
  };
})();
