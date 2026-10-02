/* 永続化（localStorage を try/catch で包み、使えない環境ではメモリに退避する） */
(function () {
  'use strict';

  const PREFIX = 'saa03.';

  function makeBackend(getStorage) {
    const mem = {};
    let storage = null;
    try {
      storage = getStorage();
      const k = PREFIX + '__probe';
      storage.setItem(k, '1');
      storage.removeItem(k);
    } catch (e) {
      storage = null;
    }
    return {
      persistent: !!storage,
      get: function (key) {
        if (storage) {
          try { const v = storage.getItem(PREFIX + key); return v === null ? undefined : v; } catch (e) { /* fallthrough */ }
        }
        return mem[key];
      },
      set: function (key, str) {
        if (storage) {
          try { storage.setItem(PREFIX + key, str); return true; } catch (e) { /* 容量超過など */ }
        }
        mem[key] = str;
        return false;
      },
      remove: function (key) {
        if (storage) { try { storage.removeItem(PREFIX + key); } catch (e) { /* noop */ } }
        delete mem[key];
      },
      keys: function () {
        const out = Object.keys(mem);
        if (storage) {
          try {
            for (let i = 0; i < storage.length; i++) {
              const k = storage.key(i);
              if (k && k.indexOf(PREFIX) === 0 && k !== PREFIX + '__probe') out.push(k.slice(PREFIX.length));
            }
          } catch (e) { /* noop */ }
        }
        return Array.from(new Set(out));
      }
    };
  }

  const local = makeBackend(function () { return window.localStorage; });
  const session = makeBackend(function () { return window.sessionStorage; });

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function deepMerge(base, over) {
    if (!isObj(over)) return base;
    Object.keys(over).forEach(function (k) {
      if (isObj(base[k]) && isObj(over[k])) base[k] = deepMerge(base[k], over[k]);
      else if (over[k] !== undefined) base[k] = over[k];
    });
    return base;
  }
  function setPath(obj, path, value) {
    const parts = String(path).split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isObj(o[parts[i]])) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  }

  const DEFAULT_SETTINGS = {
    theme: 'auto',
    textSpeed: 40,
    autoDelay: 1.2,
    skipUnread: false,
    shuffleOptions: true,
    volume: { master: 0.8, bgm: 0.55, sfx: 0.8 },
    muted: false,
    chat: { model: 'claude-opus-5-5', effort: 'medium', keyMode: 'local', includeContext: true }
  };

  function parse(raw, def) {
    if (raw === undefined) return clone(def);
    try { return JSON.parse(raw); } catch (e) { return clone(def); }
  }

  const S = {
    get: function (key, def) { return parse(local.get(key), def); },
    set: function (key, val) { local.set(key, JSON.stringify(val)); return val; },
    update: function (key, fn, def) {
      const cur = S.get(key, def);
      const next = fn(cur);
      S.set(key, next === undefined ? cur : next);
      return S.get(key, def);
    },
    remove: function (key) { local.remove(key); },
    keys: function () { return local.keys(); },
    defaults: function () { return clone(DEFAULT_SETTINGS); },
    getSettings: function () { return deepMerge(clone(DEFAULT_SETTINGS), S.get('settings', {})); },
    setSetting: function (path, value) {
      const s = S.getSettings();
      setPath(s, path, value);
      S.set('settings', s);
      SAA.bus.emit('settings:change', { key: path, value: value });
      return s;
    },
    exportAll: function () {
      const data = {};
      local.keys().forEach(function (k) {
        if (k === 'chat.apiKey') return; // API キーはエクスポートしない
        data[k] = S.get(k, null);
      });
      return JSON.stringify({ app: 'saa03', version: SAA.version, exportedAt: new Date().toISOString(), data: data }, null, 2);
    },
    importAll: function (json) {
      try {
        const obj = JSON.parse(json);
        if (!obj || obj.app !== 'saa03' || !isObj(obj.data)) return false;
        Object.keys(obj.data).forEach(function (k) { if (k !== 'chat.apiKey') S.set(k, obj.data[k]); });
        return true;
      } catch (e) {
        return false;
      }
    },
    resetAll: function () { local.keys().forEach(function (k) { local.remove(k); }); },
    isPersistent: function () { return local.persistent; },
    session: {
      get: function (key, def) { return parse(session.get(key), def); },
      set: function (key, val) { session.set(key, JSON.stringify(val)); return val; },
      remove: function (key) { session.remove(key); }
    }
  };

  SAA.store = S;
})();
