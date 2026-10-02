/* BGM・効果音（SAA.audio）：すべて Web Audio API でリアルタイム合成する（音声ファイルなし・Claude 作成）
   - BGM：楽曲データ（コード進行・リズムパターン）から小節単位でスケジューリング。メロディは決定的な乱数で生成
   - 効果音：短いシンセ音を関数で生成
   - 同じコードを OfflineAudioContext でも動かし、WAV に書き出せる */
(function () {
  'use strict';

  const U = SAA.util;
  const el = U.el;

  // =====================================================================
  // 1. 音楽の小物
  // =====================================================================
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10],
    sus4: [0, 5, 7], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
    '7sus4': [0, 5, 7, 10], '6': [0, 4, 7, 9], m7b5: [0, 3, 6, 10], madd9: [0, 3, 7, 14]
  };
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function parseChord(sym) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
    if (!m) return { root: 0, iv: QUAL[''] };
    let pc = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    pc = (pc + 12) % 12;
    return { root: pc, iv: QUAL[m[3]] || QUAL[''] };
  }
  // パッド用のボイシング（52〜76 の範囲に収める）
  function voicing(ch, lo, hi) {
    lo = lo || 52; hi = hi || 76;
    const base = 48 + ch.root;
    return ch.iv.map(function (i) {
      let n = base + i;
      while (n < lo) n += 12;
      while (n > hi) n -= 12;
      return n;
    }).sort(function (a, b) { return a - b; });
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // =====================================================================
  // 2. グラフ（リアルタイム／オフライン共通）
  // =====================================================================
  function makeImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    const r = rng(12345);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function makeNoise(ctx) {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const r = rng(777);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    return buf;
  }
  function buildGraph(ctx) {
    const g = { ctx: ctx };
    g.comp = ctx.createDynamicsCompressor();
    g.comp.threshold.value = -10; g.comp.knee.value = 10; g.comp.ratio.value = 4;
    g.comp.attack.value = 0.004; g.comp.release.value = 0.2;
    g.master = ctx.createGain();
    g.master.connect(g.comp);
    g.comp.connect(ctx.destination);
    g.bgm = ctx.createGain(); g.bgm.connect(g.master);
    g.sfx = ctx.createGain(); g.sfx.connect(g.master);
    // リバーブ（送り）
    g.reverb = ctx.createConvolver();
    g.reverb.buffer = makeImpulse(ctx, 1.8, 2.6);
    g.reverbIn = ctx.createGain(); g.reverbIn.gain.value = 1;
    const rvOut = ctx.createGain(); rvOut.gain.value = 0.32;
    g.reverbIn.connect(g.reverb); g.reverb.connect(rvOut); rvOut.connect(g.master);
    g.noise = makeNoise(ctx);
    return g;
  }

  // ---------- 音源 ----------
  function adsr(param, t, dur, a, d, s, r, peak) {
    const end = t + Math.max(dur, a + 0.01);
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.linearRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    param.setValueAtTime(Math.max(0.0001, peak * s), end);
    param.linearRampToValueAtTime(0.0001, end + r);
    return end + r;
  }
  function outWithSend(g, dest, sendAmt) {
    const n = g.ctx.createGain();
    n.connect(dest);
    if (sendAmt) { const s = g.ctx.createGain(); s.gain.value = sendAmt; n.connect(s); s.connect(g.reverbIn); }
    return n;
  }
  function osc(g, type, freq, t, stopAt, detune) {
    const o = g.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.start(t); o.stop(stopAt + 0.05);
    return o;
  }
  function noiseSrc(g, t, dur) {
    const s = g.ctx.createBufferSource();
    s.buffer = g.noise; s.loop = true;
    s.start(t, (t * 0.37) % 0.9); s.stop(t + dur + 0.05);
    return s;
  }

  const INST = {
    pad: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.5);
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500; f.Q.value = 0.4;
      const amp = g.ctx.createGain(); f.connect(amp); amp.connect(out);
      const end = adsr(amp.gain, t, dur, 0.45, 0.3, 0.8, 0.9, 0.045 * vel);
      [-8, 0, 7].forEach(function (dt, i) { osc(g, i === 1 ? 'triangle' : 'sawtooth', mtof(m), t, end, dt).connect(f); });
    },
    strings: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.6);
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; f.Q.value = 0.3;
      const amp = g.ctx.createGain(); f.connect(amp); amp.connect(out);
      const end = adsr(amp.gain, t, dur, 0.6, 0.2, 0.9, 1.1, 0.04 * vel);
      [-12, -4, 5, 11].forEach(function (dt) { osc(g, 'sawtooth', mtof(m), t, end, dt).connect(f); });
    },
    epiano: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.35);
      const fr = mtof(m);
      const amp = g.ctx.createGain(); amp.connect(out);
      const end = adsr(amp.gain, t, Math.min(dur, 1.6), 0.006, 0.9, 0.25, 0.6, 0.11 * vel);
      const car = osc(g, 'sine', fr, t, end);
      const mod = osc(g, 'sine', fr, t, end);
      const mg = g.ctx.createGain();
      mg.gain.setValueAtTime(fr * 1.6 * vel, t); mg.gain.exponentialRampToValueAtTime(fr * 0.15 + 1, t + 0.8);
      mod.connect(mg); mg.connect(car.frequency);
      car.connect(amp);
      const trem = osc(g, 'sine', 4.5, t, end);
      const tg = g.ctx.createGain(); tg.gain.value = 0.015 * vel; trem.connect(tg); tg.connect(amp.gain);
    },
    piano: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.4);
      const fr = mtof(m);
      const amp = g.ctx.createGain(); amp.connect(out);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.13 * vel, t + 0.005);
      amp.gain.exponentialRampToValueAtTime(0.04 * vel, t + 0.4);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.3) + 1.2);
      const end = t + Math.max(dur, 0.3) + 1.25;
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(1400, t + 1);
      f.connect(amp);
      osc(g, 'triangle', fr, t, end).connect(f);
      const h = g.ctx.createGain(); h.gain.value = 0.35; h.connect(f);
      osc(g, 'sine', fr * 2, t, end).connect(h);
    },
    pluck: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.3);
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.28);
      const amp = g.ctx.createGain(); f.connect(amp); amp.connect(out);
      amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(0.09 * vel, t + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.45 + dur * 0.3);
      osc(g, 'sawtooth', mtof(m), t, t + 0.5 + dur * 0.3).connect(f);
    },
    bell: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.55);
      const fr = mtof(m);
      [[1, 0.09, 1.6], [2.76, 0.03, 0.8], [5.4, 0.015, 0.4]].forEach(function (p) {
        const a = g.ctx.createGain(); a.connect(out);
        a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(p[1] * vel, t + 0.003);
        a.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
        osc(g, 'sine', fr * p[0], t, t + p[2]).connect(a);
      });
    },
    lead: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.35);
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; f.Q.value = 1;
      const amp = g.ctx.createGain(); f.connect(amp); amp.connect(out);
      const end = adsr(amp.gain, t, dur, 0.02, 0.15, 0.7, 0.18, 0.06 * vel);
      const o = osc(g, 'square', mtof(m), t, end);
      const o2 = osc(g, 'sawtooth', mtof(m), t, end, 6);
      const lfo = osc(g, 'sine', 5.2, t, end);
      const lg = g.ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(14, t + 0.35);
      lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
      const mix = g.ctx.createGain(); mix.gain.value = 0.6; o.connect(mix); o2.connect(mix); mix.connect(f);
    },
    brass: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.4);
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(3200, t + 0.08); f.frequency.linearRampToValueAtTime(1800, t + 0.4);
      const amp = g.ctx.createGain(); f.connect(amp); amp.connect(out);
      const end = adsr(amp.gain, t, dur, 0.04, 0.2, 0.75, 0.15, 0.07 * vel);
      [-5, 5].forEach(function (dt) { osc(g, 'sawtooth', mtof(m), t, end, dt).connect(f); });
    },
    bass: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0);
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.8;
      const amp = g.ctx.createGain(); f.connect(amp); amp.connect(out);
      const end = adsr(amp.gain, t, dur * 0.92, 0.008, 0.12, 0.7, 0.06, 0.2 * vel);
      osc(g, 'triangle', mtof(m), t, end).connect(f);
      const sub = g.ctx.createGain(); sub.gain.value = 0.5; sub.connect(f);
      osc(g, 'sine', mtof(m - 12), t, end).connect(sub);
    },
    synthbass: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0);
      const f = g.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
      f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(240, t + 0.16);
      const amp = g.ctx.createGain(); f.connect(amp); amp.connect(out);
      const end = adsr(amp.gain, t, dur * 0.9, 0.004, 0.1, 0.6, 0.05, 0.14 * vel);
      osc(g, 'sawtooth', mtof(m), t, end).connect(f);
    },
    // ---- ドラム ----
    kick: function (g, dest, t, m, dur, vel) {
      const a = g.ctx.createGain(); a.connect(dest);
      a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.55 * vel, t + 0.002);
      a.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      const o = osc(g, 'sine', 150, t, t + 0.4);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
      o.connect(a);
    },
    snare: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.18);
      const f = g.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
      const a = g.ctx.createGain(); f.connect(a); a.connect(out);
      a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.22 * vel, t + 0.002); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      noiseSrc(g, t, 0.22).connect(f);
      const b = g.ctx.createGain(); b.connect(out);
      b.gain.setValueAtTime(0.0001, t); b.gain.linearRampToValueAtTime(0.12 * vel, t + 0.002); b.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc(g, 'triangle', 185, t, t + 0.12).connect(b);
    },
    hat: function (g, dest, t, m, dur, vel) {
      const f = g.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7200;
      const a = g.ctx.createGain(); f.connect(a); a.connect(dest);
      const len = m === 1 ? 0.22 : 0.045;
      a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.07 * vel, t + 0.001); a.gain.exponentialRampToValueAtTime(0.0001, t + len);
      noiseSrc(g, t, len + 0.02).connect(f);
    },
    shaker: function (g, dest, t, m, dur, vel) {
      const f = g.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 1.2;
      const a = g.ctx.createGain(); f.connect(a); a.connect(dest);
      a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.045 * vel, t + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      noiseSrc(g, t, 0.09).connect(f);
    },
    rim: function (g, dest, t, m, dur, vel) {
      const a = g.ctx.createGain(); a.connect(dest);
      a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.1 * vel, t + 0.001); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc(g, 'triangle', 1100, t, t + 0.06).connect(a);
    },
    clap: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.25);
      const f = g.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.9;
      const a = g.ctx.createGain(); f.connect(a); a.connect(out);
      a.gain.setValueAtTime(0.0001, t);
      [0, 0.012, 0.024].forEach(function (o) { a.gain.linearRampToValueAtTime(0.18 * vel, t + o + 0.001); a.gain.exponentialRampToValueAtTime(0.02, t + o + 0.01); });
      a.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      noiseSrc(g, t, 0.2).connect(f);
    },
    crash: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.4);
      const f = g.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4200;
      const a = g.ctx.createGain(); f.connect(a); a.connect(out);
      a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.12 * vel, t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      noiseSrc(g, t, 1.7).connect(f);
    },
    timpani: function (g, dest, t, m, dur, vel) {
      const out = outWithSend(g, dest, 0.45);
      const a = g.ctx.createGain(); a.connect(out);
      a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.35 * vel, t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const o = osc(g, 'sine', mtof(m) * 1.04, t, t + 0.95);
      o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.1);
      o.connect(a);
    }
  };

  // =====================================================================
  // 3. 楽曲データ
  // =====================================================================
  // drums: 16 ステップの文字列（x=強、o=弱、.=休み）、arp: 16 ステップでコードトーンを刻む
  const SONGS = {
    title: { bpm: 112, scale: 'major', key: 2, gain: 0.9,
      prog: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Bm', 'G', 'D', 'A', 'Em7', 'G', 'Asus4', 'A'],
      pad: true, padInst: 'pad', bass: 'x.x.x.x.x.x.x.xo', bassInst: 'bass',
      arp: { inst: 'bell', pattern: 'x.x.x.x.x.x.x.x.', oct: 72, vel: 0.5 },
      drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', crashBars: [0, 8] },
      melody: { inst: 'lead', lo: 66, hi: 83, rhythm: ['x...x.x.x...x...', 'x.x.x...x...x.x.', 'x...x.x.x.x.x...', 'x.......x...x...'], vel: 0.85 } },
    daily: { bpm: 88, scale: 'major', key: 5, gain: 0.85, swing: 0.12,
      prog: ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7', 'Am7', 'Bbmaj7', 'C7sus4', 'Dm7', 'Gm7', 'Bbmaj7', 'C7'],
      comp: { inst: 'epiano', pattern: 'x..x..x...x..x..', vel: 0.75 }, bass: 'x......x..x.....', bassInst: 'bass', bassFifth: true,
      drums: { rim: '...x..x....x..x.', shaker: 'oxoxoxoxoxoxoxox', kick: 'x.......x.......' },
      melody: { inst: 'bell', lo: 69, hi: 84, rhythm: ['....x.x...x.....', 'x.......x...x...', '....x...x.x.....', 'x...............'], vel: 0.55 } },
    lecture: { bpm: 92, scale: 'major', key: 7, gain: 0.85,
      prog: ['Gmaj7', 'Cmaj7', 'Em7', 'D', 'Bm7', 'Em7', 'Am7', 'D7sus4'],
      pad: true, padInst: 'pad',
      arp: { inst: 'pluck', pattern: 'x.xxx.xxx.xxx.xx', oct: 64, vel: 0.6 }, bass: 'x.......x.......', bassInst: 'bass',
      drums: { kick: 'x.......x.......', hat: '..x...x...x...x.' },
      melody: { inst: 'epiano', lo: 67, hi: 81, rhythm: ['x.......x...x...', '....x.......x...', 'x...x...x.......', 'x...............'], vel: 0.6 } },
    quiz: { bpm: 120, scale: 'minor', key: 9, gain: 0.85,
      prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E7'],
      pad: true, padInst: 'pad', bass: 'xoxoxoxoxoxoxoxo', bassInst: 'synthbass',
      arp: { inst: 'pluck', pattern: 'xxxxxxxxxxxxxxxx', oct: 69, vel: 0.42 },
      drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'oxoxoxoxoxoxoxox' } },
    handson: { bpm: 128, scale: 'minor', key: 4, gain: 0.85, duck: true,
      prog: ['Em', 'C', 'D', 'Em', 'Em', 'Am', 'C', 'B7'],
      pad: true, padInst: 'pad', bass: '..x...x...x...x.', bassInst: 'synthbass',
      arp: { inst: 'pluck', pattern: 'x.xxx.xxx.xxx.xx', oct: 71, vel: 0.5 },
      drums: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'oooooooooooooooo' },
      melody: { inst: 'lead', lo: 71, hi: 86, rhythm: ['x..x..x.....x...', 'x..x..x...x.x...'], vel: 0.6, startBar: 4 } },
    night: { bpm: 72, scale: 'major', key: 3, gain: 0.9,
      prog: ['Ebmaj7', 'Cm7', 'Abmaj7', 'Bb7sus4', 'Ebmaj7', 'Gm7', 'Abmaj7', 'Bb7'],
      pad: true, padInst: 'strings',
      arp: { inst: 'piano', pattern: 'x...x...x...x...', oct: 60, vel: 0.55, spread: true }, bass: 'x...............', bassInst: 'bass',
      melody: { inst: 'piano', lo: 67, hi: 82, rhythm: ['x.....x.x.......', 'x.......x...x...', 'x.....x.....x...', 'x...............'], vel: 0.75 } },
    exam: { bpm: 100, scale: 'minor', key: 0, gain: 0.85,
      prog: ['Cm', 'Ab', 'Eb', 'Bb', 'Fm', 'Cm', 'G7', 'G7'],
      pad: true, padInst: 'strings', bass: 'x.x.x.x.x.x.x.x.', bassInst: 'synthbass',
      drums: { timpani: 'x.......x.......', hat: '..x...x...x...x.', snare: '............x...' },
      melody: { inst: 'brass', lo: 60, hi: 77, rhythm: ['x.......x...x...', 'x...............'], vel: 0.6, startBar: 2 } },
    victory: { bpm: 132, scale: 'major', key: 0, gain: 0.85,
      intro: [
        { inst: 'brass', notes: [[67, 0, 2], [67, 2, 2], [67, 4, 2], [72, 6, 10]], chord: 'C' },
        { inst: 'brass', notes: [[70, 0, 2], [70, 2, 2], [70, 4, 2], [74, 6, 3], [72, 9, 1], [74, 10, 6]], chord: 'Bb' },
        { inst: 'brass', notes: [[76, 0, 16]], chord: 'C', crash: true }
      ],
      prog: ['C', 'F', 'G', 'C', 'Am', 'F', 'Dm7', 'G'],
      pad: true, padInst: 'brass', padVel: 0.5, bass: 'x.x.x.x.x.x.x.x.', bassInst: 'bass',
      drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', crashBars: [0] },
      melody: { inst: 'lead', lo: 67, hi: 84, rhythm: ['x.x.x...x...x.x.', 'x...x.x.x.......'], vel: 0.8 } },
    ending: { bpm: 80, scale: 'major', key: 2, gain: 0.9,
      prog: ['Dmaj7', 'A', 'Bm7', 'Gmaj7', 'Dmaj7', 'Gmaj7', 'Em7', 'A7sus4'],
      pad: true, padInst: 'strings',
      arp: { inst: 'piano', pattern: 'x..x..x.x..x..x.', oct: 62, vel: 0.5, spread: true }, bass: 'x.......x.......', bassInst: 'bass',
      drums: { shaker: '..o...o...o...o.' },
      melody: { inst: 'bell', lo: 69, hi: 86, rhythm: ['x.....x.x.......', 'x.......x.......', 'x.....x...x.....', 'x...............'], vel: 0.6 } }
  };

  // ---------- 1 小節をスケジュール ----------
  function scheduleBar(g, dest, id, song, bar, t0) {
    const spb = 60 / song.bpm;
    const step = spb / 4;
    const barDur = spb * 4;
    const swing = song.swing || 0;
    const T = function (s) { return t0 + s * step + (s % 2 === 1 ? swing * step : 0); };
    const introLen = song.intro ? song.intro.length : 0;

    if (bar < introLen) {
      const it = song.intro[bar];
      const ch = parseChord(it.chord);
      voicing(ch, 48, 67).forEach(function (n) { INST.pad(g, dest, t0, n, barDur * 0.95, 0.9); });
      INST.bass(g, dest, t0, 36 + ch.root, barDur * 0.9, 0.9);
      it.notes.forEach(function (nt) { INST[it.inst](g, dest, T(nt[0] === undefined ? 0 : nt[1]), nt[0], nt[2] * step, 1); });
      INST.timpani(g, dest, t0, 36 + ch.root, 0.5, 0.9);
      if (it.crash) INST.crash(g, dest, t0, 0, 1, 1);
      return;
    }
    const b = bar - introLen;
    const chordSym = song.prog[b % song.prog.length];
    const ch = parseChord(chordSym);
    const scale = SCALES[song.scale].map(function (i) { return (i + song.key) % 12; });
    let duckGain = null;
    let target = dest;
    if (song.duck) {
      duckGain = g.ctx.createGain(); duckGain.connect(dest); target = duckGain;
      for (let k = 0; k < 4; k++) {
        const tk = t0 + k * spb;
        duckGain.gain.setValueAtTime(0.35, tk);
        duckGain.gain.linearRampToValueAtTime(1, tk + spb * 0.5);
      }
    }
    // パッド
    if (song.pad) {
      const inst = song.padInst || 'pad';
      voicing(ch, inst === 'brass' ? 55 : 52, inst === 'brass' ? 72 : 76).forEach(function (n) {
        if (inst === 'brass') { INST.brass(g, target, t0, n, step * 3, song.padVel || 0.5); INST.brass(g, target, T(8), n, step * 3, (song.padVel || 0.5) * 0.85); }
        else INST[inst](g, target, t0, n, barDur * 0.98, song.padVel || 1);
      });
    }
    // コンピング
    if (song.comp) {
      const v = voicing(ch, 55, 74);
      song.comp.pattern.split('').forEach(function (c, s) {
        if (c === '.') return;
        v.forEach(function (n) { INST[song.comp.inst](g, target, T(s), n, step * 2.5, song.comp.vel * (c === 'x' ? 1 : 0.7)); });
      });
    }
    // アルペジオ
    if (song.arp) {
      const a = song.arp;
      const tones = [];
      voicing(ch, a.oct - 7, a.oct + 9).forEach(function (n) { tones.push(n); });
      if (a.spread) tones.unshift(36 + 12 + ch.root);
      const order = tones.concat(tones.slice(1, -1).reverse());
      let k = 0;
      a.pattern.split('').forEach(function (c, s) {
        if (c === '.') return;
        const n = order[k % order.length]; k++;
        INST[a.inst](g, target, T(s), n, step * (a.spread ? 3 : 1), a.vel * (s % 4 === 0 ? 1 : 0.78));
      });
    }
    // ベース
    if (song.bass) {
      const root = 36 + ch.root;
      song.bass.split('').forEach(function (c, s) {
        if (c === '.') return;
        let n = root;
        if (song.bassFifth && s >= 8) n = root + 7;
        if (c === 'o') n = root + 12;
        INST[song.bassInst || 'bass'](g, target, T(s), n, step * (song.bass[s + 1] === '.' ? 2 : 1), c === 'o' ? 0.7 : 1);
      });
    }
    // ドラム
    const dr = song.drums || {};
    Object.keys(dr).forEach(function (name) {
      if (name === 'crashBars') return;
      const pat = dr[name];
      pat.split('').forEach(function (c, s) {
        if (c === '.') return;
        const vel = (c === 'x' ? 1 : 0.55) * (0.92 + ((bar * 7 + s * 3) % 5) * 0.02);
        INST[name](g, dest, T(s), name === 'timpani' ? 36 + ch.root : 0, step, vel);
      });
    });
    if (dr.crashBars && dr.crashBars.indexOf(b % song.prog.length) >= 0 && bar > 0) INST.crash(g, dest, t0, 0, 1, 0.8);
    // メロディ（決定的な乱数で、4 小節ごとに同じフレーズを繰り返す）
    if (song.melody && b >= (song.melody.startBar || 0)) {
      const mel = song.melody;
      const phrase = b % mel.rhythm.length;
      const r = rng(hash(id) + (b % 8) * 101);
      const pat = mel.rhythm[phrase];
      const onsets = [];
      pat.split('').forEach(function (c, s) { if (c !== '.' && c !== '-') onsets.push(s); });
      let prev = mel._last || Math.round((mel.lo + mel.hi) / 2);
      onsets.forEach(function (s, i) {
        const next = i + 1 < onsets.length ? onsets[i + 1] : 16;
        const strong = s % 4 === 0;
        const pool = [];
        for (let n = mel.lo; n <= mel.hi; n++) {
          const pc = n % 12;
          if (strong ? ch.iv.some(function (iv) { return (ch.root + iv) % 12 === pc; }) : scale.indexOf(pc) >= 0) pool.push(n);
        }
        if (!pool.length) return;
        pool.sort(function (x, y) { return Math.abs(x - prev) - Math.abs(y - prev); });
        const pick = pool[Math.min(pool.length - 1, Math.floor(r() * Math.min(3, pool.length)))];
        prev = pick;
        INST[mel.inst](g, target, T(s), pick, (next - s) * step * 0.95, mel.vel * (strong ? 1 : 0.82));
      });
      mel._last = prev;
    }
  }
  function songBars(song) { return (song.intro ? song.intro.length : 0) + song.prog.length; }
  function barDuration(song) { return 240 / song.bpm; }

  // =====================================================================
  // 4. 効果音
  // =====================================================================
  function tone(g, dest, type, f0, f1, t, dur, peak, attack) {
    const a = g.ctx.createGain(); a.connect(dest);
    a.gain.setValueAtTime(0.0001, t);
    a.gain.linearRampToValueAtTime(peak, t + (attack || 0.005));
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = osc(g, type, f0, t, t + dur);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
    o.connect(a);
  }
  function noiseHit(g, dest, t, dur, ftype, f0, f1, peak, q) {
    const f = g.ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const a = g.ctx.createGain(); f.connect(a); a.connect(dest);
    a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(peak, t + Math.min(0.02, dur / 4));
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noiseSrc(g, t, dur + 0.02).connect(f);
  }
  function arpeggio(g, dest, inst, notes, t, gap, dur, vel) {
    notes.forEach(function (n, i) { INST[inst](g, dest, t + i * gap, n, dur, vel); });
  }

  const SFX = {
    click: function (g, d, t) { tone(g, d, 'triangle', 1200, 900, t, 0.06, 0.12); },
    hover: function (g, d, t) { tone(g, d, 'sine', 1600, 1700, t, 0.04, 0.035); },
    advance: function (g, d, t) { tone(g, d, 'sine', 880, 1320, t, 0.07, 0.07); },
    type: function (g, d, t) { tone(g, d, 'square', 2200, 2000, t, 0.025, 0.025); },
    open: function (g, d, t) { tone(g, d, 'sine', 520, 980, t, 0.16, 0.08); noiseHit(g, d, t, 0.18, 'bandpass', 900, 3000, 0.03); },
    close: function (g, d, t) { tone(g, d, 'sine', 900, 480, t, 0.15, 0.07); },
    select: function (g, d, t) { arpeggio(g, d, 'bell', [84, 91], t, 0.05, 0.2, 0.7); },
    correct: function (g, d, t) { arpeggio(g, d, 'bell', [72, 76, 79, 84], t, 0.07, 0.4, 1); tone(g, d, 'triangle', 1046, 1046, t + 0.28, 0.5, 0.06); },
    incorrect: function (g, d, t) { tone(g, d, 'triangle', 330, 320, t, 0.22, 0.12); tone(g, d, 'triangle', 262, 250, t + 0.18, 0.35, 0.11); },
    combo: function (g, d, t) { arpeggio(g, d, 'bell', [79, 84, 88, 91, 96], t, 0.045, 0.3, 0.8); },
    chapter_start: function (g, d, t) { noiseHit(g, d, t, 0.7, 'bandpass', 300, 5000, 0.12, 1.2); arpeggio(g, d, 'bell', [76, 83, 88], t + 0.45, 0.12, 1, 0.9); },
    chapter_clear: function (g, d, t) { arpeggio(g, d, 'pluck', [72, 76, 79, 84, 88], t, 0.09, 0.3, 1); arpeggio(g, d, 'bell', [84, 88, 91], t + 0.5, 0.0, 1.2, 0.8); },
    fanfare: function (g, d, t) {
      [[67, 0, 0.14], [67, 0.16, 0.14], [67, 0.32, 0.14], [72, 0.5, 0.9]].forEach(function (n) { INST.brass(g, d, t + n[1], n[0], n[2], 1); INST.brass(g, d, t + n[1], n[0] - 5, n[2], 0.6); });
      [[70, 1.5, 0.3], [74, 1.85, 0.3], [79, 2.2, 0.9]].forEach(function (n) { INST.brass(g, d, t + n[1], n[0], n[2], 1); });
      INST.crash(g, d, t + 0.5, 0, 1, 0.8); INST.timpani(g, d, t + 0.5, 36, 0.5, 1); INST.timpani(g, d, t + 2.2, 43, 0.5, 1);
    },
    drumroll: function (g, d, t) {
      for (let i = 0; i < 40; i++) INST.snare(g, d, t + i * 0.05, 0, 0.05, 0.25 + 0.7 * (i / 40));
      INST.crash(g, d, t + 2.0, 0, 1, 1); INST.kick(g, d, t + 2.0, 0, 0.3, 1);
    },
    stamp: function (g, d, t) { INST.kick(g, d, t, 0, 0.2, 1.2); noiseHit(g, d, t, 0.15, 'lowpass', 1800, 300, 0.25); tone(g, d, 'sine', 120, 60, t, 0.25, 0.3); },
    fail: function (g, d, t) { tone(g, d, 'triangle', 392, 370, t, 0.35, 0.09); tone(g, d, 'triangle', 330, 311, t + 0.3, 0.45, 0.08); tone(g, d, 'triangle', 262, 247, t + 0.65, 0.8, 0.08); },
    notify: function (g, d, t) { arpeggio(g, d, 'bell', [88, 93], t, 0.09, 0.4, 0.6); },
    send: function (g, d, t) { tone(g, d, 'sine', 600, 1400, t, 0.12, 0.1); },
    memo: function (g, d, t) { noiseHit(g, d, t, 0.12, 'bandpass', 3000, 1200, 0.05, 1.5); tone(g, d, 'sine', 1320, 1760, t + 0.05, 0.12, 0.05); },
    page: function (g, d, t) { noiseHit(g, d, t, 0.22, 'bandpass', 1200, 4500, 0.22, 0.7); },
    whoosh: function (g, d, t) { noiseHit(g, d, t, 0.6, 'bandpass', 250, 3500, 0.4, 1.4); },
    shock: function (g, d, t) { tone(g, d, 'sawtooth', 880, 440, t, 0.25, 0.06); tone(g, d, 'square', 932, 466, t, 0.25, 0.04); noiseHit(g, d, t, 0.2, 'highpass', 3000, 3000, 0.05); },
    sparkle: function (g, d, t) { for (let i = 0; i < 6; i++) INST.bell(g, d, t + i * 0.06, 91 + (i * 5) % 12, 0.2, 0.45); },
    heart: function (g, d, t) { tone(g, d, 'sine', 90, 60, t, 0.16, 0.35); tone(g, d, 'sine', 90, 60, t + 0.22, 0.2, 0.28); arpeggio(g, d, 'bell', [84, 88], t + 0.3, 0.1, 0.5, 0.35); },
    tick: function (g, d, t) { tone(g, d, 'square', 1800, 1800, t, 0.025, 0.03); },
    alarm: function (g, d, t) { for (let i = 0; i < 3; i++) { tone(g, d, 'square', 988, 988, t + i * 0.28, 0.12, 0.05); tone(g, d, 'square', 784, 784, t + i * 0.28 + 0.13, 0.12, 0.05); } },
    key: function (g, d, t) { noiseHit(g, d, t, 0.035, 'bandpass', 3500, 2500, 0.14, 2); tone(g, d, 'square', 1900, 1700, t, 0.02, 0.02); },
    enter: function (g, d, t) { noiseHit(g, d, t, 0.06, 'bandpass', 2000, 1200, 0.08, 1.5); tone(g, d, 'sine', 300, 200, t, 0.06, 0.06); },
    success: function (g, d, t) { arpeggio(g, d, 'pluck', [72, 79, 84, 88], t, 0.06, 0.25, 1); tone(g, d, 'sine', 1760, 1760, t + 0.26, 0.4, 0.04); },
    error: function (g, d, t) { tone(g, d, 'square', 220, 210, t, 0.14, 0.05); tone(g, d, 'square', 196, 190, t + 0.16, 0.2, 0.05); },
    door: function (g, d, t) { noiseHit(g, d, t, 0.25, 'lowpass', 900, 200, 0.18); tone(g, d, 'sine', 140, 90, t + 0.02, 0.2, 0.18); noiseHit(g, d, t + 0.3, 0.08, 'bandpass', 2500, 2000, 0.06, 2); },
    phone: function (g, d, t) { for (let i = 0; i < 2; i++) { tone(g, d, 'sine', 1318, 1318, t + i * 0.18, 0.12, 0.07); tone(g, d, 'sine', 1760, 1760, t + i * 0.18 + 0.06, 0.1, 0.06); } },
    chime: function (g, d, t) { arpeggio(g, d, 'bell', [76, 72, 74, 67], t, 0.42, 1.4, 0.8); },
    footsteps: function (g, d, t) { for (let i = 0; i < 4; i++) { noiseHit(g, d, t + i * 0.32, 0.09, 'lowpass', 700, 250, 0.16); tone(g, d, 'sine', 110, 70, t + i * 0.32, 0.08, 0.09); } }
  };
  const SFX_LEN = { fanfare: 3.4, drumroll: 3.8, chime: 3, chapter_start: 1.9, chapter_clear: 2, footsteps: 1.5, fail: 1.7, alarm: 1, correct: 1.1, sparkle: 0.8, heart: 0.9, success: 0.8, stamp: 0.6, combo: 0.6 };

  // =====================================================================
  // 5. リアルタイム再生
  // =====================================================================
  let ctx = null;
  let G = null;
  let analyser = null;
  let current = null;      // { id, gain, timer, nextBarTime, bar }
  let muted = false;
  const vol = { master: 0.8, bgm: 0.55, sfx: 0.8 };
  let pendingBgm = null;

  function AC() { return window.AudioContext || window.webkitAudioContext; }

  function init() {
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(function () {}); return true; }
    const C = AC();
    if (!C) return false;
    try { ctx = new C({ latencyHint: 'interactive' }); } catch (e) { return false; }
    G = buildGraph(ctx);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    G.comp.disconnect();
    G.comp.connect(analyser);
    analyser.connect(ctx.destination);
    loadSettings();
    applyVolumes();
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (pendingBgm) { const p = pendingBgm; pendingBgm = null; playBgm(p.id, p.opts); }
    return true;
  }
  function loadSettings() {
    try {
      const s = SAA.store.getSettings();
      ['master', 'bgm', 'sfx'].forEach(function (k) { if (s.volume && typeof s.volume[k] === 'number') vol[k] = s.volume[k]; });
      muted = !!s.muted;
    } catch (e) { /* noop */ }
  }
  function applyVolumes() {
    if (!G) return;
    const t = ctx.currentTime;
    G.master.gain.setTargetAtTime(muted ? 0 : vol.master, t, 0.05);
    G.bgm.gain.setTargetAtTime(vol.bgm * 0.9, t, 0.05);
    G.sfx.gain.setTargetAtTime(vol.sfx, t, 0.05);
  }

  function playSfx(id, opts) {
    if (!ctx || !G || muted) return;
    const fn = SFX[id];
    if (!fn) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    try {
      const out = ctx.createGain();
      out.gain.value = (opts && typeof opts.volume === 'number') ? opts.volume : 1;
      out.connect(G.sfx);
      fn(G, out, ctx.currentTime + 0.01);
      setTimeout(function () { try { out.disconnect(); } catch (e) { /* noop */ } }, ((SFX_LEN[id] || 0.8) + 2) * 1000);
    } catch (e) { /* noop */ }
  }

  function playBgm(id, opts) {
    opts = opts || {};
    if (!SONGS[id]) return;
    if (!ctx) { pendingBgm = { id: id, opts: opts }; return; }
    if (current && current.id === id) return;
    const fade = typeof opts.fade === 'number' ? opts.fade : 1.0;
    stopBgm({ fade: fade });
    const song = SONGS[id];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(song.gain || 0.85, ctx.currentTime + Math.max(0.05, fade));
    gain.connect(G.bgm);
    const tr = { id: id, gain: gain, nextBarTime: ctx.currentTime + 0.12, bar: 0, timer: null };
    tr.timer = setInterval(function () { pump(tr); }, 25);
    current = tr;
    pump(tr);
  }
  function pump(tr) {
    if (!ctx || document.hidden) return;
    const song = SONGS[tr.id];
    const total = songBars(song);
    const introLen = song.intro ? song.intro.length : 0;
    while (tr.nextBarTime < ctx.currentTime + 0.25) {
      let bar = tr.bar;
      if (bar >= total) bar = introLen + ((bar - introLen) % song.prog.length);
      try { scheduleBar(G, tr.gain, tr.id, song, bar, tr.nextBarTime); } catch (e) { console.error('[audio]', e); }
      tr.nextBarTime += barDuration(song);
      tr.bar += 1;
    }
  }
  function stopBgm(opts) {
    pendingBgm = null;
    if (!current || !ctx) { current = null; return; }
    const tr = current;
    current = null;
    clearInterval(tr.timer);
    const fade = opts && typeof opts.fade === 'number' ? opts.fade : 1.0;
    const t = ctx.currentTime;
    tr.gain.gain.cancelScheduledValues(t);
    tr.gain.gain.setValueAtTime(Math.max(0.0001, tr.gain.gain.value), t);
    tr.gain.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.05, fade));
    setTimeout(function () { try { tr.gain.disconnect(); } catch (e) { /* noop */ } }, (Math.max(0.05, fade) + 4) * 1000);
  }

  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(function () {});
    else {
      ctx.resume().catch(function () {});
      if (current) current.nextBarTime = Math.max(current.nextBarTime, ctx.currentTime + 0.1);
    }
  });

  function setVolume(kind, v) {
    if (!(kind in vol)) return;
    vol[kind] = U.clamp(Number(v) || 0, 0, 1);
    applyVolumes();
    try { if (SAA.store.getSettings().volume[kind] !== vol[kind]) SAA.store.setSetting('volume.' + kind, vol[kind]); } catch (e) { /* noop */ }
  }
  function setMuted(m) {
    muted = !!m;
    applyVolumes();
    try { if (SAA.store.getSettings().muted !== muted) SAA.store.setSetting('muted', muted); } catch (e) { /* noop */ }
  }
  SAA.bus.on('settings:change', function (p) {
    if (!p || !p.key) return;
    if (p.key.indexOf('volume.') === 0) { const k = p.key.slice(7); if (k in vol && vol[k] !== p.value) { vol[k] = p.value; applyVolumes(); } }
    if (p.key === 'muted' && muted !== !!p.value) { muted = !!p.value; applyVolumes(); }
  });
  loadSettings();

  // =====================================================================
  // 6. オフライン描画と WAV 書き出し
  // =====================================================================
  function OAC() { return window.OfflineAudioContext || window.webkitOfflineAudioContext; }
  function renderBuffer(kind, id, seconds, loops) {
    const C = OAC();
    if (!C) return Promise.reject(new Error('OfflineAudioContext が使えません'));
    let dur;
    if (kind === 'bgm') {
      const song = SONGS[id];
      if (!song) return Promise.reject(new Error('unknown bgm ' + id));
      const bars = seconds ? Math.ceil(seconds / barDuration(song)) : songBars(song) + (loops > 1 ? (loops - 1) * song.prog.length : 0);
      dur = seconds || bars * barDuration(song) + 2.5;
      const oc = new C(2, Math.ceil(44100 * dur), 44100);
      const g = buildGraph(oc);
      g.bgm.gain.value = 0.9;
      g.master.gain.value = 0.9;
      const gain = oc.createGain(); gain.gain.value = song.gain || 0.85; gain.connect(g.bgm);
      const total = songBars(song);
      const introLen = song.intro ? song.intro.length : 0;
      let t = 0.05;
      for (let b = 0; b < bars; b++) {
        const bar = b >= total ? introLen + ((b - introLen) % song.prog.length) : b;
        scheduleBar(g, gain, id, song, bar, t);
        t += barDuration(song);
      }
      return oc.startRendering();
    }
    const fn = SFX[id];
    if (!fn) return Promise.reject(new Error('unknown sfx ' + id));
    dur = seconds || (SFX_LEN[id] || 0.8) + 0.8;
    const oc = new C(2, Math.ceil(44100 * dur), 44100);
    const g = buildGraph(oc);
    g.master.gain.value = 0.9;
    fn(g, g.sfx, 0.02);
    return oc.startRendering();
  }
  function toWav(buf) {
    const ch = buf.numberOfChannels;
    const len = buf.length;
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    function str(o, s) { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true);
    data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, len * ch * 2, true);
    const chans = [];
    for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]));
        data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        o += 2;
      }
    }
    return new Blob([data.buffer], { type: 'audio/wav' });
  }
  function renderWav(kind, id, opts) {
    return renderBuffer(kind, id, null, (opts && opts.loops) || 1).then(toWav);
  }
  function levels(buf) {
    let peak = 0; let sum = 0; let n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i += 4) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; }
    }
    return { peak: peak, rms: Math.sqrt(sum / Math.max(1, n)) };
  }

  // =====================================================================
  // 7. 設定 UI・サウンドルーム
  // =====================================================================
  function renderSettings(container) {
    U.clear(container);
    const rows = [['master', 'マスター'], ['bgm', 'BGM'], ['sfx', '効果音']].map(function (k) {
      const out = el('span', { class: 'snd-set__val', text: Math.round(vol[k[0]] * 100) + '%' });
      const r = el('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(vol[k[0]] * 100), 'aria-label': k[1] + 'の音量' });
      r.style.setProperty('--range-pct', r.value + '%');
      r.addEventListener('input', function () { init(); setVolume(k[0], r.value / 100); out.textContent = r.value + '%'; r.style.setProperty('--range-pct', r.value + '%'); });
      r.addEventListener('change', function () { if (k[0] === 'sfx' || k[0] === 'master') playSfx('correct'); });
      return el('label', { class: 'snd-set__row' }, el('span', { class: 'snd-set__label', text: k[1] }), r, out);
    });
    const mute = el('input', { type: 'checkbox' });
    mute.checked = muted;
    mute.addEventListener('change', function () { setMuted(mute.checked); });
    container.appendChild(el('div', { class: 'snd-set' }, rows,
      el('label', { class: 'snd-set__row' }, el('span', { class: 'snd-set__label', text: 'ミュート' }), el('span', null, mute, ' すべての音を消す')),
      el('div', { class: 'snd-set__actions' },
        el('button', { class: 'btn btn--ghost', type: 'button', text: '♪ BGM を試聴', onClick: function () { init(); playBgm('daily'); } }),
        el('button', { class: 'btn btn--ghost', type: 'button', text: '■ 停止', onClick: function () { stopBgm({ fade: 0.6 }); } }),
        el('button', { class: 'btn btn--ghost', type: 'button', text: '🔔 効果音を試聴', onClick: function () { init(); playSfx('correct'); } }))));
  }

  let viz = null;
  function renderSound(container) {
    init();
    const cat = SAA.data.audioCatalog || { bgm: [], sfx: [] };
    const canvas = el('canvas', { class: 'snd-viz', width: 600, height: 80, 'aria-hidden': 'true' });
    const nowLabel = el('span', { class: 'snd-now__title', text: current ? titleOf(current.id) : '停止中' });
    const bgmCards = el('div', { class: 'snd-grid' });
    function titleOf(id) { const b = cat.bgm.find(function (x) { return x.id === id; }); return b ? b.title : id; }
    function refresh() {
      U.$$('.snd-card', bgmCards).forEach(function (c) {
        const on = current && current.id === c.dataset.id;
        c.classList.toggle('is-playing', !!on);
        const b = c.querySelector('.snd-card__play');
        b.textContent = on ? '■ 停止' : '▶ 再生';
      });
      nowLabel.textContent = current ? '♪ ' + titleOf(current.id) : '停止中';
    }
    cat.bgm.forEach(function (b) {
      const play = el('button', { class: 'btn btn--primary snd-card__play', type: 'button', text: '▶ 再生', onClick: function () {
        init();
        if (current && current.id === b.id) stopBgm({ fade: 0.6 }); else playBgm(b.id, { fade: 0.6 });
        refresh();
      } });
      const dl = el('button', { class: 'btn btn--ghost', type: 'button', text: '⬇ WAV で保存' });
      dl.addEventListener('click', function () {
        dl.disabled = true; dl.textContent = '書き出し中…';
        renderWav('bgm', b.id, { loops: 2 }).then(function (blob) { U.download('saa03-bgm-' + b.id + '.wav', blob, 'audio/wav'); })
          .catch(function (e) { U.toast('書き出しに失敗しました：' + e.message, 'ng'); })
          .then(function () { dl.disabled = false; dl.textContent = '⬇ WAV で保存'; });
      });
      bgmCards.appendChild(el('article', { class: 'snd-card', dataset: { id: b.id } },
        el('div', { class: 'snd-card__head' }, el('h3', { class: 'snd-card__title', text: b.title }), el('span', { class: 'snd-card__bpm', text: b.bpm + ' BPM · ' + b.key })),
        el('p', { class: 'snd-card__mood', text: b.mood }),
        el('p', { class: 'snd-card__use', text: '使用場面：' + b.use }),
        el('div', { class: 'snd-card__actions' }, play, dl)));
    });
    const sfxGrid = el('div', { class: 'snd-sfx' });
    cat.sfx.forEach(function (s) {
      const b = el('button', { class: 'snd-sfx__btn', type: 'button', title: s.id, onClick: function () { init(); playSfx(s.id); } },
        el('span', { class: 'snd-sfx__name', text: s.title }), el('span', { class: 'snd-sfx__id', text: s.id }));
      const dl = el('button', { class: 'snd-sfx__dl', type: 'button', 'aria-label': s.title + ' を WAV で保存', title: 'WAV で保存', text: '⬇', onClick: function () {
        renderWav('sfx', s.id).then(function (blob) { U.download('saa03-sfx-' + s.id + '.wav', blob, 'audio/wav'); }).catch(function (e) { U.toast('書き出しに失敗しました：' + e.message, 'ng'); });
      } });
      sfxGrid.appendChild(el('div', { class: 'snd-sfx__item' }, b, dl));
    });
    container.appendChild(el('div', { class: 'snd' },
      el('header', { class: 'screen-header' }, el('h1', { class: 'section-title', text: '🎵 サウンドルーム' }),
        el('p', { class: 'snd-note', text: 'BGM・効果音はすべてブラウザ上でリアルタイム合成しています（Claude 作成）。音声ファイルは使っていません。「WAV で保存」で書き出すこともできます。' })),
      el('div', { class: 'snd-now' }, nowLabel, canvas,
        el('button', { class: 'btn btn--ghost', type: 'button', text: '■ すべて停止', onClick: function () { stopBgm({ fade: 0.5 }); refresh(); } })),
      el('section', null, el('h2', { class: 'snd-h2', text: 'BGM（' + cat.bgm.length + '曲）' }), bgmCards),
      el('section', null, el('h2', { class: 'snd-h2', text: '効果音（' + cat.sfx.length + '種）' }), sfxGrid),
      el('section', null, el('h2', { class: 'snd-h2', text: '音量' }), (function () { const box = el('div', { class: 'card' }); renderSettings(box); return box; })())));
    refresh();
    startViz(canvas);
  }
  function startViz(canvas) {
    stopViz();
    const c2 = canvas.getContext('2d');
    const data = new Uint8Array(512);
    viz = { raf: 0 };
    function draw() {
      viz.raf = requestAnimationFrame(draw);
      const w = canvas.width; const h = canvas.height;
      c2.clearRect(0, 0, w, h);
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      const bars = 48;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor(i * 6)] / 255;
        const bh = Math.max(2, v * h);
        c2.fillStyle = 'hsl(' + (12 + i * 4) + ',85%,' + (55 + v * 15) + '%)';
        c2.fillRect(i * bw + 1, h - bh, bw - 2, bh);
      }
    }
    draw();
  }
  function stopViz() { if (viz) { cancelAnimationFrame(viz.raf); viz = null; } }

  SAA.app.registerScreen('sound', { title: 'サウンドルーム', render: renderSound, leave: stopViz });

  // =====================================================================
  // 8. 公開
  // =====================================================================
  SAA.audio = {
    init: init,
    playSfx: playSfx,
    playBgm: playBgm,
    stopBgm: stopBgm,
    currentBgm: function () { return current ? current.id : (pendingBgm ? pendingBgm.id : null); },
    setVolume: setVolume,
    getVolume: function (k) { return vol[k]; },
    setMuted: setMuted,
    isMuted: function () { return muted; },
    renderWav: renderWav,
    renderSettings: renderSettings,
    _test: {
      bgmIds: function () { return Object.keys(SONGS); },
      sfxIds: function () { return Object.keys(SFX); },
      levels: function (kind, id, seconds) { return renderBuffer(kind, id, seconds).then(levels); },
      renderAll: function () {
        const errors = [];
        const cat = SAA.data.audioCatalog || { bgm: [], sfx: [] };
        cat.bgm.forEach(function (b) { if (!SONGS[b.id]) errors.push('bgm not implemented: ' + b.id); });
        cat.sfx.forEach(function (s) { if (!SFX[s.id]) errors.push('sfx not implemented: ' + s.id); });
        const jobs = [];
        Object.keys(SFX).forEach(function (id) { jobs.push(['sfx', id, null]); });
        Object.keys(SONGS).forEach(function (id) { jobs.push(['bgm', id, 2.5]); });
        let chain = Promise.resolve();
        const report = {};
        jobs.forEach(function (j) {
          chain = chain.then(function () {
            return renderBuffer(j[0], j[1], j[2]).then(function (buf) {
              const lv = levels(buf);
              report[j[0] + ':' + j[1]] = { peak: +lv.peak.toFixed(3), rms: +lv.rms.toFixed(4) };
              if (lv.peak < 0.003) errors.push(j[0] + ':' + j[1] + ' is silent');
              if (lv.peak >= 0.995) errors.push(j[0] + ':' + j[1] + ' clips (peak ' + lv.peak.toFixed(3) + ')');
            }).catch(function (e) { errors.push(j[0] + ':' + j[1] + ' ' + e.message); });
          });
        });
        return chain.then(function () { return { ok: errors.length === 0, errors: errors, report: report }; });
      }
    }
  };
})();
