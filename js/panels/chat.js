/* 質問チャット（SAA.chat）：氷室レンに質問する。
   - Claude API（同梱の @anthropic-ai/sdk をブラウザから直接利用・ストリーミング）
   - API キーが無い／接続できないときは、用語集・講義スライド・問題のポイントから答えるオフラインモード */
(function () {
  'use strict';

  const U = SAA.util;
  const el = U.el;
  const HISTORY_KEY = 'chat.history';
  const MAX_HISTORY = 60;
  const SEND_TURNS = 20;
  const MODELS = [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（既定・高精度）', short: 'Opus 5.5', effort: true },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（高速・低コスト）', short: 'Sonnet 5.5', effort: true },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5（最速）', short: 'Haiku 4.5', effort: false }
  ];

  // プロンプトキャッシュが効くよう、システムプロンプトは固定文字列にする
  const SYSTEM_PROMPT = [
    'あなたは「氷室レン」です。株式会社スカイブリッジのシニアクラウドアーキテクト兼・社内テクニカルインストラクター（TI）で、AWS 認定をすべて取得しています。',
    'いま、AWS Certified Solutions Architect – Associate（SAA-C03）の再受験に向けて学習している相手（ユーザー）の質問に答えています。',
    '',
    '# 話し方',
    '- 一人称は「俺」、相手は「君」と呼ぶ。落ち着いた先輩らしい口調（「〜だ」「〜だな」「〜してみろ」）で、論理的かつ親切に。',
    '- ときどき身近な例え（倉庫、物流、レストラン、高速道路など）を使ってわかりやすく説明する。',
    '- 日本語で、要点を先に。目安は 300〜600 字。比較が役立つときは箇条書きや Markdown の表（| 区切り）を使う。',
    '',
    '# 回答方針',
    '- 正確さを最優先する。AWS の仕様・数値・料金は変わることがあるため、自信がない点は「公式ドキュメントで確認してほしい」と正直に伝える。料金は概算であることを明示する。',
    '- 試験対策として、問題文のどのキーワード（要件・制約）がどのサービス選択につながるのかを示す。紛らわしいサービスとの違いを1〜2行で添える。',
    '- <学習コンテキスト> が与えられたら、それを踏まえて答える。コンテキストに正解が含まれていない場合は、正解を断定せず考え方のヒントにとどめる。',
    '- 実際の試験問題の再現・共有や、受験者行動規範（NDA）に反する依頼には応じない。オリジナルの例題や考え方の説明に切り替える。',
    '- 模擬試験の受験中であると伝えられた場合は、その試験問題の答えにつながる内容は答えず、受験後に復習するよう促す。',
    '- 学習と無関係な話題には短く応じ、学習に話を戻す。'
  ].join('\n');

  // ---------- 状態 ----------
  let history = loadHistory();
  let busy = false;
  let currentStream = null;
  let ui = null;   // renderPanel で作る DOM 参照

  function loadHistory() {
    const h = SAA.store.get(HISTORY_KEY, []);
    return Array.isArray(h) ? h.filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string'; }) : [];
  }
  function saveHistory() {
    if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
    SAA.store.set(HISTORY_KEY, history);
  }
  function chatSettings() { return (SAA.store.getSettings().chat) || {}; }
  function modelInfo(id) { return MODELS.find(function (m) { return m.id === id; }) || MODELS[0]; }
  function getKey() {
    const s = chatSettings();
    const k = s.keyMode === 'session' ? SAA.store.session.get('chat.apiKey', '') : SAA.store.get('chat.apiKey', '');
    return typeof k === 'string' ? k.trim() : '';
  }
  function setKey(key, mode) {
    SAA.store.remove('chat.apiKey');
    SAA.store.session.remove('chat.apiKey');
    if (!key) return;
    if (mode === 'session') SAA.store.session.set('chat.apiKey', key);
    else SAA.store.set('chat.apiKey', key);
  }
  function maskKey(k) { return k ? (k.slice(0, 7) + '…' + k.slice(-4)) : ''; }
  function apiAvailable() { return !!(getKey() && window.Anthropic); }

  function sfx(id) { try { SAA.audio.playSfx(id); } catch (e) { /* noop */ } }

  // ---------- 学習コンテキスト ----------
  function contextBlock() {
    if (!chatSettings().includeContext) return '';
    if (SAA.isMockActive && SAA.isMockActive()) return '';
    const c = SAA.getContext ? SAA.getContext() : null;
    if (!c || c.kind === 'none' || !c.summary) return '';
    const kindLabel = { question: '問題', slide: '講義スライド', lab: 'ハンズオンラボ', glossary: '用語', story: 'ストーリー' }[c.kind] || '画面';
    return '<学習コンテキスト>\n種別：' + kindLabel + '\n' + (c.title ? 'タイトル：' + c.title + '\n' : '') +
      String(c.summary).slice(0, 6000) + (c.kind === 'question' && !c.reveal ? '\n（ユーザーはまだ解答していないため、正解は伏せられている）' : '') +
      '\n</学習コンテキスト>\n\n';
  }

  // ---------- オフライン回答 ----------
  function norm(s) {
    return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s、。・,.!?！？「」『』（）()［］\[\]【】:：;；"'`/\\|-]+/g, '');
  }
  function bigrams(s) {
    const t = norm(s);
    const set = new Set();
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
    return set;
  }
  function overlap(a, b) {
    if (!a.size || !b.size) return 0;
    let n = 0;
    a.forEach(function (x) { if (b.has(x)) n++; });
    return n / Math.sqrt(b.size);
  }
  function plainSlide(s) {
    return [s.title, s.lead, (s.columns || []).join(' '), (s.rows || []).map(function (r) { return r.join(' '); }).join(' '),
      (s.bullets || []).join(' '), (s.items || []).map(function (i) { return i.title + ' ' + i.body; }).join(' '),
      (s.steps || []).map(function (i) { return i.title + ' ' + (i.body || ''); }).join(' '), s.note, (s.keywords || []).join(' ')].join(' ');
  }
  function stripMd(s) { return String(s || '').replace(/\*\*|`/g, '').replace(/\n+/g, ' '); }

  function search(text) {
    const qn = norm(text);
    const qb = bigrams(text);
    const hits = [];
    const D = SAA.data;
    (D.glossary || []).forEach(function (g) {
      let sc = 0;
      [g.term].concat(g.aliases || []).forEach(function (a) {
        const an = norm(a);
        if (an.length >= 2 && qn.indexOf(an) >= 0) sc += 6 + Math.min(an.length, 12) / 2;
      });
      sc += overlap(qb, bigrams(g.term + ' ' + (g.aliases || []).join(' '))) * 3;
      sc += overlap(qb, bigrams(g.short + ' ' + g.detail)) * 1.2;
      if (sc > 1.2) hits.push({ type: 'glossary', score: sc, item: g });
    });
    (D.slideOrder || []).forEach(function (id) {
      const s = D.slides[id];
      let sc = 0;
      (s.keywords || []).forEach(function (k) { const kn = norm(k); if (kn.length >= 2 && qn.indexOf(kn) >= 0) sc += 3; });
      sc += overlap(qb, bigrams(s.title)) * 2.5 + overlap(qb, bigrams(plainSlide(s))) * 0.8;
      if (sc > 1.5) hits.push({ type: 'slide', score: sc, item: s });
    });
    (D.questions || []).forEach(function (q) {
      let sc = 0;
      (q.keywords || []).forEach(function (k) { const kn = norm(k); if (kn.length >= 2 && qn.indexOf(kn) >= 0) sc += 2.5; });
      sc += overlap(qb, bigrams(q.topic)) * 2 + overlap(qb, bigrams(q.point)) * 1.2;
      if (sc > 2) hits.push({ type: 'question', score: sc, item: q });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    // 同じ種類ばかりにならないよう、種類ごとに最大2件
    const per = {};
    return hits.filter(function (h) { per[h.type] = (per[h.type] || 0) + 1; return per[h.type] <= 2; }).slice(0, 3);
  }

  function offlineAnswer(text, ctx) {
    const parts = [];
    const q = ctx && ctx.kind === 'question' && ctx.reveal && ctx.id ? SAA.data.qById[ctx.id] : null;
    if (q) {
      parts.push('この問題の決め手から整理しよう。');
      parts.push('**ポイント**：' + q.point);
      parts.push('> ' + stripMd(q.explanation).slice(0, 220) + (stripMd(q.explanation).length > 220 ? '…' : ''));
    }
    const hits = search(text + (q ? ' ' + q.topic + ' ' + (q.keywords || []).join(' ') : ''));
    if (hits.length) {
      parts.push(q ? '関連する講義ノートも挙げておく。' : 'いい質問だ。手元の講義ノートから関係しそうなものを集めたぞ。');
      hits.forEach(function (h) {
        if (h.type === 'glossary') {
          parts.push('**📖 ' + h.item.term + '**\n' + h.item.short + '\n- 試験のツボ：' + stripMd(h.item.examTip));
        } else if (h.type === 'slide') {
          parts.push('**📋 講義スライド「' + h.item.title + '」**\n' + (h.item.note ? stripMd(h.item.note) : '講義ノート画面で全体を確認できる。'));
        } else {
          parts.push('**❓ 関連問題のポイント（' + h.item.topic + '）**\n' + h.item.point);
        }
      });
    } else if (!q) {
      parts.push('すまない、その内容は手元の講義ノートでは見つからなかった。サービス名やキーワード（例：「gp3」「NAT ゲートウェイ」「可視性タイムアウト」）を入れて、もう一度聞いてみてくれ。');
    }
    parts.push('_（オフラインモードの簡易回答です。設定 → 質問チャットで Claude API キーを登録すると、詳しく対話できます）_'.replace(/_/g, ''));
    return parts.join('\n\n');
  }

  // ---------- API 呼び出し ----------
  function buildMessages() {
    const recent = history.slice(-SEND_TURNS);
    const msgs = [];
    recent.forEach(function (m) {
      if (m.error) return;
      const content = m.role === 'user' ? (m.ctxBlock || '') + m.text : m.text;
      if (!content.trim()) return;
      const last = msgs[msgs.length - 1];
      if (last && last.role === m.role) last.content += '\n\n' + content;
      else msgs.push({ role: m.role, content: content });
    });
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    return msgs;
  }
  function buildParams(minimal) {
    const s = chatSettings();
    const info = modelInfo(s.model);
    const p = { model: info.id, max_tokens: 16000, system: SYSTEM_PROMPT, messages: buildMessages() };
    if (!minimal) {
      p.cache_control = { type: 'ephemeral' };
      if (info.effort) {
        p.output_config = { effort: ['low', 'medium', 'high'].indexOf(s.effort) >= 0 ? s.effort : 'medium' };
        p.betas = ['server-side-fallback-2026-07-01'];
        p.fallbacks = 'default';
      }
    }
    return p;
  }
  function makeClient() {
    return new window.Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true, maxRetries: 1 });
  }
  function errorText(err) {
    const A = window.Anthropic || {};
    if (A.APIUserAbortError && err instanceof A.APIUserAbortError) return { abort: true, text: '（回答を停止しました）' };
    if (A.AuthenticationError && err instanceof A.AuthenticationError) return { text: 'API キーが無効のようだ。設定 → 質問チャットで、キーをもう一度確認してくれ。' };
    if (A.PermissionDeniedError && err instanceof A.PermissionDeniedError) return { text: 'この API キーでは、選んだモデルを使う権限がないようだ。設定で別のモデルを試してくれ。' };
    if (A.NotFoundError && err instanceof A.NotFoundError) return { text: '選択したモデルが見つからなかった。設定 → 質問チャットでモデルを変えてみてくれ。' };
    if (A.RateLimitError && err instanceof A.RateLimitError) return { text: '今は混み合っているようだ（レート制限）。少し時間をおいてから、もう一度聞いてくれ。' };
    if (A.APIConnectionError && err instanceof A.APIConnectionError) return { offline: true, text: 'Claude API に接続できなかった（ネットワークを確認してくれ）。代わりに、手元のノートから答えておく。' };
    if (A.APIError && err instanceof A.APIError) return { text: 'API エラーが発生した（' + (err.status || '?') + '）：' + String(err.message || '').slice(0, 200) };
    return { text: '予期しないエラーが発生した：' + String((err && err.message) || err).slice(0, 200) };
  }
  function isParamError(err) {
    const A = window.Anthropic || {};
    return A.BadRequestError && err instanceof A.BadRequestError && /cache_control|fallback|output_config|effort|beta/i.test(String(err.message || ''));
  }

  async function streamReply(msgEntry, onDelta) {
    const client = makeClient();
    let minimal = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const params = buildParams(minimal);
        const stream = client.beta.messages.stream(params);
        currentStream = stream;
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') onDelta(ev.delta.text);
        }
        const final = await stream.finalMessage();
        return final;
      } catch (err) {
        // 未対応のパラメータで弾かれた場合は、最小構成で1回だけ再試行する
        if (attempt === 0 && !msgEntry.text && isParamError(err)) { minimal = true; continue; }
        throw err;
      } finally {
        currentStream = null;
      }
    }
    return null;
  }

  // ---------- 送信 ----------
  async function send(rawText) {
    const text = String(rawText || '').trim();
    if (!text || busy) return;
    const mock = SAA.isMockActive && SAA.isMockActive();
    const c = SAA.getContext ? SAA.getContext() : null;
    const ctxBlock = contextBlock();
    const userMsg = { role: 'user', text: text, at: Date.now() };
    if (ctxBlock) { userMsg.ctxBlock = ctxBlock; userMsg.ctxTitle = c && c.title; }
    if (mock) userMsg.ctxBlock = '（注：ユーザーは現在、模擬試験を受験中です。試験問題の答えにつながる内容には答えないでください。）\n\n';
    history.push(userMsg);
    saveHistory();
    sfx('send');
    renderMessages();

    if (!apiAvailable()) {
      const ans = { role: 'assistant', text: offlineAnswer(text, c), at: Date.now(), offline: true };
      history.push(ans);
      saveHistory();
      renderMessages();
      sfx('notify');
      return;
    }

    busy = true;
    updateBusy();
    const reply = { role: 'assistant', text: '', at: Date.now(), model: modelInfo(chatSettings().model).short };
    history.push(reply);
    const node = renderMessages(true);
    let pending = false;
    function paint() {
      pending = false;
      if (node) {
        node.body.innerHTML = reply.text ? U.md(reply.text) : '';
        node.body.classList.toggle('is-thinking', !reply.text);
        scrollDown();
      }
    }
    try {
      const final = await streamReply(reply, function (t) {
        reply.text += t;
        if (!pending) { pending = true; requestAnimationFrame(paint); }
      });
      if (final && final.stop_reason === 'refusal') {
        reply.text = (reply.text ? reply.text + '\n\n' : '') + 'すまない、その質問には答えられないようだ。聞き方を変えるか、AWS の学習に関する質問にしてくれ。';
      } else if (final && final.stop_reason === 'max_tokens') {
        reply.text += '\n\n（長くなったので、ここで区切った。続きが必要なら「続けて」と言ってくれ。）';
      }
      if (!reply.text.trim()) reply.text = '……うまく言葉にできなかった。もう一度聞いてくれるか？';
      sfx('notify');
    } catch (err) {
      const info = errorText(err);
      if (info.abort) {
        reply.text = (reply.text ? reply.text + '\n\n' : '') + info.text;
      } else if (info.offline) {
        reply.text = info.text + '\n\n' + offlineAnswer(text, c);
        reply.offline = true;
      } else {
        reply.text = info.text;
        reply.error = true;
      }
      sfx(info.abort ? 'close' : 'error');
    } finally {
      busy = false;
      saveHistory();
      renderMessages();
      updateBusy();
    }
  }

  function stop() {
    if (currentStream) { try { currentStream.abort(); } catch (e) { /* noop */ } }
  }

  async function testConnection() {
    if (!window.Anthropic) return { ok: false, message: 'SDK（vendor/anthropic-sdk.min.js）が読み込まれていません。' };
    if (!getKey()) return { ok: false, message: 'API キーが設定されていません。' };
    const s = chatSettings();
    const info = modelInfo(s.model);
    try {
      const params = { model: info.id, max_tokens: 64, messages: [{ role: 'user', content: '接続テストです。「OK」とだけ返してください。' }] };
      if (info.effort) params.output_config = { effort: 'low' };
      const res = await makeClient().messages.create(params);
      return { ok: true, message: '接続できました（' + (res.model || info.id) + '）。' };
    } catch (err) {
      return { ok: false, message: errorText(err).text };
    }
  }

  // ---------- 画面 ----------
  function ask(text, opts) {
    opts = opts || {};
    if (!ui) {
      // パネル未描画なら送信だけ行う
      if (opts.autoSend !== false) send(text);
      return;
    }
    ui.input.value = text;
    autoGrow();
    if (opts.autoSend !== false) { ui.input.value = ''; autoGrow(); send(text); }
    else ui.input.focus();
  }

  function renderPanel(container) {
    U.clear(container);
    const avatar = U.charAvatar('ren');
    const modeBadge = el('span', { class: 'chat__mode' });
    const gear = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'チャットの設定', title: '設定', text: '⚙', onClick: function () { settingsBox.hidden = !settingsBox.hidden; if (!settingsBox.hidden) renderSettings(settingsBox, true); } });
    const clearBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': '履歴をクリア', title: '履歴をクリア', text: '🧹', onClick: clearHistory });
    const header = el('header', { class: 'chat__head' }, avatar,
      el('div', { class: 'chat__head-text' }, el('strong', { text: '氷室レンに質問' }), modeBadge), clearBtn, gear);
    const settingsBox = el('div', { class: 'chat__settings', hidden: true });

    const ctxToggle = el('input', { type: 'checkbox', 'aria-label': '学習コンテキストを質問に含める' });
    const ctxLabel = el('span', { class: 'chat__ctx-title' });
    const ctxChip = el('label', { class: 'chat__ctx', title: '表示中の問題やスライドの内容を質問に添えます' }, ctxToggle, el('span', { text: '📎 参照中：' }), ctxLabel);
    ctxToggle.addEventListener('change', function () { SAA.store.setSetting('chat.includeContext', ctxToggle.checked); });
    const mockBanner = el('div', { class: 'chat__banner', hidden: true, text: '📝 模擬試験中は、試験問題についての質問には答えられません（一般的な質問は OK）。' });
    const setup = el('div', { class: 'chat__setup', hidden: true });
    const list = el('div', { class: 'chat__list', role: 'log', 'aria-live': 'polite' });
    const chips = el('div', { class: 'chat__chips' });
    const input = el('textarea', { class: 'chat__input', rows: 1, placeholder: '質問を入力（Enter で送信 / Shift+Enter で改行）', 'aria-label': '質問を入力', 'data-autofocus': '' });
    const sendBtn = el('button', { class: 'btn btn--primary chat__send', type: 'button', text: '送信' });
    const stopBtn = el('button', { class: 'btn btn--danger chat__stop', type: 'button', text: '■ 停止', hidden: true, onClick: stop });
    const form = el('div', { class: 'chat__form' }, input, sendBtn, stopBtn);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        submit();
      }
    });
    input.addEventListener('input', autoGrow);
    sendBtn.addEventListener('click', submit);
    function submit() {
      const t = input.value;
      if (!t.trim() || busy) return;
      input.value = '';
      autoGrow();
      send(t);
    }

    container.appendChild(el('div', { class: 'chat' }, header, settingsBox, mockBanner, setup, ctxChip, list, chips, form));
    ui = { container: container, list: list, input: input, sendBtn: sendBtn, stopBtn: stopBtn, modeBadge: modeBadge, ctxChip: ctxChip, ctxLabel: ctxLabel, ctxToggle: ctxToggle, mockBanner: mockBanner, setup: setup, chips: chips, settingsBox: settingsBox };

    refreshHeader();
    refreshContext();
    renderSetup();
    renderMessages();
    SAA.bus.on('context:change', refreshContext);
    SAA.bus.on('settings:change', function (p) { if (p && String(p.key).indexOf('chat') === 0) { refreshHeader(); refreshContext(); renderSetup(); } });
    SAA.bus.on('dock:open', function (p) { if (p && p.tab === 'chat') { refreshContext(); renderSetup(); scrollDown(); } });
  }

  function autoGrow() {
    if (!ui) return;
    ui.input.style.height = 'auto';
    ui.input.style.height = Math.min(ui.input.scrollHeight, 160) + 'px';
  }

  function refreshHeader() {
    if (!ui) return;
    const on = apiAvailable();
    ui.modeBadge.textContent = on ? 'Claude · ' + modelInfo(chatSettings().model).short : 'オフラインモード';
    ui.modeBadge.classList.toggle('is-online', on);
  }

  function refreshContext() {
    if (!ui) return;
    const c = SAA.getContext ? SAA.getContext() : null;
    const mock = SAA.isMockActive && SAA.isMockActive();
    ui.mockBanner.hidden = !mock;
    const has = c && c.kind !== 'none' && c.title && !mock;
    ui.ctxChip.hidden = !has;
    ui.ctxLabel.textContent = has ? c.title : '';
    ui.ctxToggle.checked = !!chatSettings().includeContext;
    renderChips(c && !mock ? c : null);
  }

  function renderChips(c) {
    if (!ui) return;
    U.clear(ui.chips);
    let items;
    if (c && c.kind === 'question') {
      items = c.reveal
        ? ['なぜこれが正解？', '他の選択肢がダメな理由は？', '覚え方のコツは？', '似たサービスとの違いは？']
        : ['この問題、どこに注目すればいい？', '問題文のキーワードを教えて'];
    } else if (c && c.kind === 'slide') {
      items = ['このスライドの要点をまとめて', '試験でどう問われる？', '例え話で説明して'];
    } else if (c && c.kind === 'lab') {
      items = ['このラボのヒントをちょうだい', 'このラボで学ぶポイントは？'];
    } else {
      items = ['今日の学習プランを提案して', '第3分野（高性能）の頻出ポイントは？', '第4分野（コスト最適化）の頻出ポイントは？', '問題文の読み方のコツは？'];
    }
    items.forEach(function (t) {
      ui.chips.appendChild(el('button', { class: 'chip chat__chip', type: 'button', text: t, onClick: function () { if (!busy) send(t); } }));
    });
  }

  function renderSetup() {
    if (!ui) return;
    refreshHeader();
    const need = !getKey();
    ui.setup.hidden = !need;
    if (!need) { U.clear(ui.setup); return; }
    if (ui.setup.dataset.built) return;
    ui.setup.dataset.built = '1';
    U.clear(ui.setup);
    if (SAA.store.get('chat.setupDismissed', false)) {
      ui.setup.appendChild(el('button', { class: 'chat__setup-mini', type: 'button', text: '🔌 Claude API 未設定（オフラインモード）— タップして設定', onClick: function () {
        SAA.store.set('chat.setupDismissed', false);
        delete ui.setup.dataset.built;
        renderSetup();
      } }));
      return;
    }
    const keyInput = el('input', { type: 'password', class: 'chat__key-input', placeholder: 'sk-ant-…', autocomplete: 'off', 'aria-label': 'Claude API キー' });
    const modeSel = el('select', { class: 'chat__key-mode', 'aria-label': 'キーの保存先' },
      el('option', { value: 'local', text: 'このブラウザに保存' }), el('option', { value: 'session', text: 'このタブだけ（閉じると消える）' }));
    modeSel.value = chatSettings().keyMode === 'session' ? 'session' : 'local';
    ui.setup.appendChild(el('div', { class: 'chat__setup-card' },
      el('strong', { text: '💡 いまはオフラインモードです' }),
      el('p', { text: '手元の用語集・講義スライド・問題のポイントから簡易的に答えます。Claude API キーを登録すると、レンが質問に合わせて詳しく解説します（API 利用料がかかります）。' }),
      el('p', { class: 'chat__setup-small', text: 'キーは Claude Console（https://platform.claude.com/）で発行できます。キーは Anthropic の API 以外には送信されません。共有 PC では「このタブだけ」を選んでください。' }),
      el('div', { class: 'chat__setup-row' }, keyInput, modeSel,
        el('button', { class: 'btn btn--primary', type: 'button', text: '登録', onClick: function () {
          const k = keyInput.value.trim();
          if (!/^sk-/.test(k)) { U.toast('API キーの形式が正しくないようです（sk- で始まります）', 'warn'); return; }
          SAA.store.setSetting('chat.keyMode', modeSel.value);
          setKey(k, modeSel.value);
          keyInput.value = '';
          delete ui.setup.dataset.built;
          renderSetup();
          U.toast('API キーを登録しました', 'ok');
        } })),
      el('button', { class: 'chat__setup-later', type: 'button', text: 'あとで（オフラインで続ける）', onClick: function () {
        SAA.store.set('chat.setupDismissed', true);
        delete ui.setup.dataset.built;
        renderSetup();
      } })));
  }

  function clearHistory() {
    if (!history.length) return;
    const btn = ui && ui.container.querySelector('.chat__head [title="履歴をクリア"]');
    if (btn && !btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = '消す？';
      setTimeout(function () { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = '🧹'; } }, 3000);
      return;
    }
    if (btn) { delete btn.dataset.armed; btn.textContent = '🧹'; }
    stop();
    history = [];
    saveHistory();
    renderMessages();
  }

  function scrollDown() {
    if (ui) ui.list.scrollTop = ui.list.scrollHeight;
  }

  function renderMessages(returnLast) {
    if (!ui) return null;
    U.clear(ui.list);
    if (!history.length) {
      ui.list.appendChild(el('div', { class: 'chat__welcome' }, U.charAvatar('ren'),
        el('div', { class: 'chat__bubble chat__bubble--ren' }, el('div', { class: 'chat__body', html: U.md('質問があれば何でも聞いてくれ。\n問題や講義スライドを開いた状態で聞けば、その内容を踏まえて答える。') }))));
      return null;
    }
    let lastNode = null;
    history.forEach(function (m, i) {
      if (m.role === 'user') {
        ui.list.appendChild(el('div', { class: 'chat__msg chat__msg--user' },
          el('div', { class: 'chat__bubble chat__bubble--user' },
            m.ctxTitle ? el('div', { class: 'chat__msg-ctx', text: '📎 ' + m.ctxTitle }) : null,
            el('div', { class: 'chat__body', text: m.text }))));
        return;
      }
      const body = el('div', { class: 'chat__body' + (m.text ? '' : ' is-thinking'), html: m.text ? U.md(m.text) : '' });
      const actions = el('div', { class: 'chat__actions' },
        el('button', { type: 'button', class: 'chat__act', text: 'コピー', onClick: function () { copyText(m.text); } }),
        el('button', { type: 'button', class: 'chat__act', text: '📝 メモに保存', onClick: function () {
          const prev = history[i - 1];
          SAA.memo.append(m.text, { title: 'レンへの質問：' + (prev && prev.role === 'user' ? prev.text.slice(0, 30) : '回答') });
          U.toast('メモに保存しました', 'ok');
          sfx('memo');
        } }));
      const node = el('div', { class: 'chat__msg chat__msg--ren' + (m.error ? ' is-error' : '') }, U.charAvatar('ren'),
        el('div', { class: 'chat__bubble chat__bubble--ren' },
          body,
          el('div', { class: 'chat__meta' }, el('span', { text: m.offline ? 'オフライン' : (m.model || '') }), m.text && !(busy && i === history.length - 1) ? actions : null)));
      ui.list.appendChild(node);
      lastNode = { node: node, body: body };
    });
    scrollDown();
    return returnLast ? lastNode : null;
  }

  function updateBusy() {
    if (!ui) return;
    ui.sendBtn.hidden = busy;
    ui.stopBtn.hidden = !busy;
    ui.input.disabled = false;
  }

  function copyText(t) {
    const done = function () { U.toast('コピーしました', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback);
    else fallback();
    function fallback() {
      const ta = el('textarea', { style: { position: 'fixed', left: '-9999px' } });
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* noop */ }
      ta.remove();
    }
  }

  // ---------- 設定（設定画面とチャット内で共用） ----------
  function renderSettings(container, compact) {
    U.clear(container);
    const s = chatSettings();
    const key = getKey();
    const modelSel = el('select', { 'aria-label': 'モデル' }, MODELS.map(function (m) { return el('option', { value: m.id, text: m.label }); }));
    modelSel.value = modelInfo(s.model).id;
    const effortSel = el('select', { 'aria-label': '思考の深さ（effort）' },
      el('option', { value: 'low', text: 'low（速い）' }), el('option', { value: 'medium', text: 'medium（既定）' }), el('option', { value: 'high', text: 'high（じっくり）' }));
    effortSel.value = ['low', 'medium', 'high'].indexOf(s.effort) >= 0 ? s.effort : 'medium';
    effortSel.disabled = !modelInfo(modelSel.value).effort;
    modelSel.addEventListener('change', function () { SAA.store.setSetting('chat.model', modelSel.value); effortSel.disabled = !modelInfo(modelSel.value).effort; });
    effortSel.addEventListener('change', function () { SAA.store.setSetting('chat.effort', effortSel.value); });

    const keyInput = el('input', { type: 'password', autocomplete: 'off', placeholder: key ? maskKey(key) + '（登録済み）' : 'sk-ant-…', 'aria-label': 'API キー' });
    const showBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: '表示', onClick: function () { keyInput.type = keyInput.type === 'password' ? 'text' : 'password'; showBtn.textContent = keyInput.type === 'password' ? '表示' : '隠す'; } });
    const modeLocal = el('input', { type: 'radio', name: 'chat-key-mode-' + (compact ? 'c' : 's'), value: 'local' });
    const modeSession = el('input', { type: 'radio', name: 'chat-key-mode-' + (compact ? 'c' : 's'), value: 'session' });
    (s.keyMode === 'session' ? modeSession : modeLocal).checked = true;
    function mode() { return modeSession.checked ? 'session' : 'local'; }
    [modeLocal, modeSession].forEach(function (r) {
      r.addEventListener('change', function () {
        const k = getKey();
        SAA.store.setSetting('chat.keyMode', mode());
        if (k) setKey(k, mode());
      });
    });
    const status = el('p', { class: 'chat-set__status', text: key ? '登録済み：' + maskKey(key) : '未登録（オフラインモード）' });
    const ctxSw = el('input', { type: 'checkbox' });
    ctxSw.checked = !!s.includeContext;
    ctxSw.addEventListener('change', function () { SAA.store.setSetting('chat.includeContext', ctxSw.checked); });

    const saveBtn = el('button', { class: 'btn btn--primary', type: 'button', text: '保存', onClick: function () {
      const k = keyInput.value.trim();
      if (!k) { U.toast('API キーを入力してください', 'warn'); return; }
      if (!/^sk-/.test(k)) { U.toast('API キーの形式が正しくないようです（sk- で始まります）', 'warn'); return; }
      setKey(k, mode());
      SAA.store.setSetting('chat.keyMode', mode());
      keyInput.value = '';
      keyInput.placeholder = maskKey(k) + '（登録済み）';
      status.textContent = '登録済み：' + maskKey(k);
      U.toast('API キーを保存しました', 'ok');
    } });
    const testBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: '接続テスト', onClick: function () {
      testBtn.disabled = true;
      status.textContent = '接続を確認しています…';
      testConnection().then(function (r) {
        status.textContent = (r.ok ? '✅ ' : '⚠ ') + r.message;
        testBtn.disabled = false;
      });
    } });
    const delBtn = el('button', { class: 'btn btn--danger', type: 'button', text: 'キーを削除', onClick: function () {
      setKey('', mode());
      keyInput.placeholder = 'sk-ant-…';
      status.textContent = '未登録（オフラインモード）';
      SAA.bus.emit('settings:change', { key: 'chat.apiKey', value: '' });
      U.toast('API キーを削除しました', 'ok');
    } });

    container.appendChild(el('div', { class: 'chat-set' + (compact ? ' chat-set--compact' : '') },
      el('label', { class: 'chat-set__row' }, el('span', { class: 'chat-set__label', text: 'モデル' }), modelSel),
      el('label', { class: 'chat-set__row' }, el('span', { class: 'chat-set__label', text: '思考の深さ' }), effortSel),
      el('div', { class: 'chat-set__row' }, el('span', { class: 'chat-set__label', text: 'API キー' }),
        el('div', { class: 'chat-set__key' }, keyInput, showBtn, saveBtn)),
      el('div', { class: 'chat-set__row' }, el('span', { class: 'chat-set__label', text: '保存先' }),
        el('div', { class: 'chat-set__radios' },
          el('label', null, modeLocal, ' このブラウザに保存'),
          el('label', null, modeSession, ' このタブだけ'))),
      el('label', { class: 'chat-set__row' }, el('span', { class: 'chat-set__label', text: '学習コンテキスト' }),
        el('span', { class: 'chat-set__check' }, ctxSw, ' 表示中の問題・スライドの内容を質問に添える')),
      status,
      el('div', { class: 'chat-set__actions' }, testBtn, delBtn),
      el('p', { class: 'chat-set__note', text: 'キーはこのブラウザの中だけに保存され、Anthropic の API（api.anthropic.com）以外へは送信されません。データのエクスポートにも含まれません。共有 PC では「このタブだけ」を選んでください。Claude Opus 5.5 / Sonnet 5.5 では、安全上の理由で回答が拒否された場合に自動で別モデルへ切り替える「フォールバック」を有効にしています。' })));
  }

  SAA.chat = {
    ask: ask,
    send: send,
    stop: stop,
    renderPanel: renderPanel,
    renderSettings: renderSettings,
    testConnection: testConnection,
    offlineAnswer: offlineAnswer,
    isBusy: function () { return busy; },
    _test: {
      offline: function (text) { return offlineAnswer(text, null); },
      buildParams: buildParams,
      systemPrompt: SYSTEM_PROMPT
    }
  };
})();
