/* SAA 名前空間・データ登録・イベントバス・学習コンテキスト・モジュールのスタブ。最初に読み込むこと。 */
(function () {
  'use strict';

  const SAA = window.SAA = window.SAA || {};
  SAA.version = '1.0.0';

  SAA.data = SAA.data || {
    curriculum: null,
    characters: {},
    reactions: {},
    assets: {},
    audioCatalog: { bgm: [], sfx: [] },
    questions: [],
    qById: {},
    groups: {},
    slides: {},
    slideOrder: [],
    glossary: [],
    glossaryById: {},
    labs: {},
    labOrder: [],
    stories: {}
  };

  SAA.errors = SAA.errors || [];
  function regError(msg) {
    SAA.errors.push(msg);
    if (window.console) console.warn('[SAA] ' + msg);
  }

  // ---- データ登録 ----
  SAA.registerQuestions = function (groupId, list) {
    if (!Array.isArray(list)) { regError('registerQuestions(' + groupId + '): list is not an array'); return; }
    const ids = SAA.data.groups[groupId] || (SAA.data.groups[groupId] = []);
    list.forEach(function (q, i) {
      if (!q || typeof q.id !== 'string') { regError('question #' + i + ' in ' + groupId + ' has no id'); return; }
      if (SAA.data.qById[q.id]) { regError('duplicate question id: ' + q.id); return; }
      q.group = groupId;
      SAA.data.questions.push(q);
      SAA.data.qById[q.id] = q;
      ids.push(q.id);
    });
  };

  SAA.registerSlides = function (list) {
    if (!Array.isArray(list)) { regError('registerSlides: list is not an array'); return; }
    list.forEach(function (s, i) {
      if (!s || typeof s.id !== 'string') { regError('slide #' + i + ' has no id'); return; }
      if (SAA.data.slides[s.id]) { regError('duplicate slide id: ' + s.id); return; }
      SAA.data.slides[s.id] = s;
      SAA.data.slideOrder.push(s.id);
    });
  };

  SAA.registerGlossary = function (list) {
    if (!Array.isArray(list)) { regError('registerGlossary: list is not an array'); return; }
    list.forEach(function (g, i) {
      if (!g || typeof g.id !== 'string') { regError('glossary #' + i + ' has no id'); return; }
      if (SAA.data.glossaryById[g.id]) { regError('duplicate glossary id: ' + g.id); return; }
      SAA.data.glossary.push(g);
      SAA.data.glossaryById[g.id] = g;
    });
  };

  SAA.registerLabs = function (list) {
    if (!Array.isArray(list)) { regError('registerLabs: list is not an array'); return; }
    list.forEach(function (lab, i) {
      if (!lab || typeof lab.id !== 'string') { regError('lab #' + i + ' has no id'); return; }
      if (SAA.data.labs[lab.id]) { regError('duplicate lab id: ' + lab.id); return; }
      SAA.data.labs[lab.id] = lab;
      SAA.data.labOrder.push(lab.id);
    });
  };

  SAA.registerStory = function (chapterId, def) {
    if (!def || !Array.isArray(def.script)) { regError('registerStory(' + chapterId + '): script is not an array'); return; }
    if (SAA.data.stories[chapterId]) { regError('duplicate story: ' + chapterId); return; }
    def.id = chapterId;
    SAA.data.stories[chapterId] = def;
  };

  // ---- イベントバス ----
  const handlers = {};
  SAA.bus = {
    on: function (evt, fn) { (handlers[evt] || (handlers[evt] = [])).push(fn); return fn; },
    off: function (evt, fn) {
      const list = handlers[evt];
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit: function (evt, payload) {
      (handlers[evt] || []).slice().forEach(function (fn) {
        try { fn(payload || {}); } catch (e) { if (window.console) console.error('[SAA bus] ' + evt, e); }
      });
    }
  };

  // ---- 学習コンテキスト（メモ・チャット用） ----
  let context = { kind: 'none', key: '', id: '', title: '', summary: '', reveal: false };
  SAA.setContext = function (ctx) {
    context = Object.assign({ kind: 'none', key: '', id: '', title: '', summary: '', reveal: false }, ctx || {});
    SAA.bus.emit('context:change', context);
  };
  SAA.getContext = function () { return context; };

  let mockActive = false;
  SAA.setMockActive = function (v) { mockActive = !!v; };
  SAA.isMockActive = function () { return mockActive; };

  // ---- モジュールのスタブ（実体のファイルが読み込まれると置き換わる） ----
  const noop = function () {};
  const resolvedNull = function () { return Promise.resolve(null); };
  const stubCtl = function () {
    return { answered: new Promise(noop), done: Promise.resolve(), destroy: noop };
  };

  // 画面レジストリ（モジュールは app.js より先に読み込まれるため、登録先は共通の SAA.screens）
  SAA.screens = SAA.screens || {};
  SAA.app = SAA.app || {
    registerScreen: function (id, def) { SAA.screens[id] = def; },
    // 最小限のスタブ・ルーター（app.js 未完成でもモジュール単体の画面確認ができるように）
    go: function (id, params) {
      const root = document.getElementById('screen-root');
      const def = SAA.screens[id];
      if (!root || !def) return;
      root.innerHTML = '';
      def.render(root, params || {});
    },
    back: noop,
    current: function () { return null; },
    setTopbar: noop
  };

  SAA.assets = SAA.assets || {
    img: function (key) {
      const s = document.createElement('span');
      s.className = 'asset-ph';
      s.textContent = key;
      return s;
    },
    resolve: resolvedNull,
    applyBg: noop,
    sprite: function (charId, face) {
      const s = document.createElement('span');
      s.className = 'asset-ph asset-ph--sprite';
      s.textContent = charId + ':' + face;
      return s;
    },
    has: function () { return undefined; },
    renderChecker: noop,
    _test: { keys: function () { return Object.keys(SAA.data.assets || {}); } }
  };

  SAA.audio = SAA.audio || {
    init: noop, playSfx: noop, playBgm: noop, stopBgm: noop, currentBgm: function () { return null; },
    setVolume: noop, getVolume: function () { return 0; }, setMuted: noop, isMuted: function () { return true; },
    renderWav: resolvedNull, renderSettings: noop, _test: {}
  };
  SAA.stats = SAA.stats || {
    record: noop, getQ: function () { return null; }, summary: function () { return { answered: 0, total: 0, correct: 0, rate: 0 }; },
    byDomain: function () { return {}; }, byTask: function () { return {}; }, status: function () { return 'nodata'; },
    weakest: function () { return []; }, pickQuestions: function () { return []; }, estimateScaled: function () { return 100; },
    recordLab: noop, labStatus: function () { return null; }, recordMock: noop, mocks: function () { return []; },
    chapterSummary: function () { return { answered: 0, correct: 0, total: 0 }; }, _test: {}
  };
  SAA.quiz = SAA.quiz || { mount: stubCtl, runSequence: function () { return Promise.resolve([]); }, _test: {} };
  SAA.mock = SAA.mock || { start: resolvedNull, _test: {} };
  SAA.labs = SAA.labs || { open: function () { return Promise.resolve({ completed: false, score: 0, total: 0 }); }, widgets: {}, _test: {} };
  SAA.story = SAA.story || { start: noop, resume: noop, stop: noop, isRunning: function () { return false; }, _test: {} };
  SAA.dock = SAA.dock || { open: noop, close: noop, toggle: noop, isOpen: function () { return false; } };
  SAA.memo = SAA.memo || { append: noop, get: function () { return ''; }, set: noop, exportMarkdown: function () { return ''; }, renderPanel: noop, _test: {} };
  SAA.chat = SAA.chat || { ask: noop, renderPanel: noop, renderSettings: noop, testConnection: resolvedNull, offlineAnswer: function () { return ''; }, _test: {} };
})();
