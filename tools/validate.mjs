#!/usr/bin/env node
// データ整合性チェッカー（アプリと同じデータファイルを Node の VM に読み込んで検証する）
// 使い方:
//   node tools/validate.mjs                 全体を検証（エラーがあれば exit 1）
//   node tools/validate.mjs --only=c3-storage   メッセージをその文字列を含むものに絞る（担当ファイルの確認用）
//   node tools/validate.mjs --quiet          警告を表示しない
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const QUIET = args.includes('--quiet');

const errors = [];
const warnings = [];
const infos = [];
const pass = (where) => !ONLY || where.includes(ONLY);
const err = (where, msg) => { if (pass(where)) errors.push(`${where}: ${msg}`); };
const warn = (where, msg) => { if (pass(where)) warnings.push(`${where}: ${msg}`); };
const info = (msg) => infos.push(msg);

// ---------- load ----------
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const dataFiles = ['js/core/namespace.js', ...srcs.filter((s) => s.startsWith('data/'))];

const sandbox = { console: { log() {}, warn() {}, error() {}, info() {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const rel of dataFiles) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { err(rel, 'file is missing'); continue; }
  try {
    vm.runInContext(fs.readFileSync(abs, 'utf8'), sandbox, { filename: rel });
  } catch (e) {
    err(rel, `script error: ${e.message}`);
  }
}
const SAA = sandbox.SAA;
if (!SAA) { console.error('namespace failed to load'); process.exit(2); }
for (const e of SAA.errors) err('register', e);

const D = SAA.data;
const cur = D.curriculum;
if (!cur) { console.error('curriculum missing'); process.exit(2); }
const taskById = Object.fromEntries(cur.tasks.map((t) => [t.id, t]));
const chapterById = Object.fromEntries(cur.chapters.map((c) => [c.id, c]));
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const len = (s) => [...String(s || '')].length;

// ---------- questions ----------
const letterRef = /選択肢\s*[A-FＡ-Ｆ1-6１-６]|(^|[^A-Za-z0-9_])[A-F]\s*(が正解|は誤り|は不正解|が誤り)/;
const optPrefix = /^\s*[A-FＡ-Ｆ]\s*[\.\)．）:：]/;
const seenStems = new Map();
const domainTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
const groupRows = [];
for (const [gid, g] of Object.entries(cur.groups)) {
  const where = `questions/${gid}`;
  const ids = D.groups[gid] || [];
  groupRows.push(`${gid.padEnd(12)} ${String(ids.length).padStart(3)}/${g.count}`);
  if (ids.length !== g.count) err(where, `expected ${g.count} questions, found ${ids.length}`);
  let multi = 0;
  const diff = { 1: 0, 2: 0, 3: 0 };
  ids.forEach((qid, i) => {
    const q = D.qById[qid];
    const w = `${where}/${qid}`;
    const expectId = `${gid}-${String(i + 1).padStart(2, '0')}`;
    if (qid !== expectId) err(w, `id should be ${expectId}`);
    if (![1, 2, 3, 4].includes(q.domain)) err(w, 'domain must be 1..4');
    if (g.domain && q.domain !== g.domain) err(w, `domain must be ${g.domain}`);
    if (!g.tasks.includes(q.task)) err(w, `task ${q.task} not in group tasks ${g.tasks.join(',')}`);
    if (taskById[q.task] && taskById[q.task].domain !== q.domain) err(w, `task ${q.task} does not belong to domain ${q.domain}`);
    if (![1, 2, 3, 4].includes(q.domain)) {} else domainTotals[q.domain]++;
    if (!isStr(q.topic)) err(w, 'topic missing'); else if (len(q.topic) > 24) warn(w, `topic is long (${len(q.topic)} chars)`);
    if (![1, 2, 3].includes(q.difficulty)) err(w, 'difficulty must be 1..3'); else diff[q.difficulty]++;
    if (!isStr(q.question)) err(w, 'question missing');
    if (!Array.isArray(q.options)) { err(w, 'options missing'); return; }
    if (!Array.isArray(q.answer) || !q.answer.length) { err(w, 'answer missing'); return; }
    if (q.type === 'single') {
      if (q.options.length !== 4) err(w, 'single must have 4 options');
      if (q.answer.length !== 1) err(w, 'single must have 1 answer');
    } else if (q.type === 'multi') {
      multi++;
      const need = q.options.length === 5 ? 2 : q.options.length === 6 ? 3 : -1;
      if (need < 0) err(w, 'multi must have 5 or 6 options');
      if (q.answer.length !== need) err(w, `multi with ${q.options.length} options must have ${need} answers`);
      if (!q.question.includes(`${need}つ選択`)) err(w, `question must say （${need}つ選択してください。）`);
    } else err(w, `unknown type ${q.type}`);
    const uniq = new Set(q.answer);
    if (uniq.size !== q.answer.length) err(w, 'duplicate answer index');
    q.answer.forEach((a) => { if (!Number.isInteger(a) || a < 0 || a >= q.options.length) err(w, `answer index ${a} out of range`); });
    q.options.forEach((o, k) => {
      if (!isStr(o)) err(w, `option ${k} empty`);
      else if (optPrefix.test(o)) err(w, `option ${k} must not start with a letter label`);
    });
    if (new Set(q.options.map((o) => String(o).trim())).size !== q.options.length) err(w, 'duplicate options');
    if (!Array.isArray(q.optionNotes) || q.optionNotes.length !== q.options.length) err(w, 'optionNotes length must equal options');
    else {
      q.optionNotes.forEach((n, k) => {
        const mark = String(n).trim()[0];
        if (mark !== '○' && mark !== '×') err(w, `optionNotes[${k}] must start with ○ or ×`);
        else if ((mark === '○') !== q.answer.includes(k)) err(w, `optionNotes[${k}] mark ${mark} contradicts answer`);
      });
    }
    if (!isStr(q.explanation)) err(w, 'explanation missing');
    else if (len(q.explanation) < 120) warn(w, `explanation short (${len(q.explanation)} chars)`);
    else if (len(q.explanation) > 700) warn(w, `explanation long (${len(q.explanation)} chars)`);
    [q.explanation, ...(q.optionNotes || []), q.point].forEach((t) => { if (letterRef.test(String(t || ''))) err(w, `refers to an option by letter: "${String(t).slice(0, 40)}…"`); });
    if (!isStr(q.point)) err(w, 'point missing'); else if (len(q.point) > 80) warn(w, `point long (${len(q.point)} chars)`);
    if (!Array.isArray(q.keywords) || q.keywords.length < 2 || q.keywords.length > 8) warn(w, 'keywords should have 2–6 items');
    if (!gid.startsWith('mock-')) {
      ['intro', 'onCorrect', 'onWrong'].forEach((k) => { if (!isStr(q[k])) warn(w, `${k} missing (story line)`); });
    }
    const stem = String(q.question).replace(/\s/g, '').slice(0, 50);
    if (seenStems.has(stem)) warn(w, `question stem looks duplicated with ${seenStems.get(stem)}`); else seenStems.set(stem, qid);
  });
  if (ids.length >= 6 && multi === 0) warn(where, 'no multi-select question in this group');
  if (ids.length >= 5 && (diff[1] === 0 || diff[3] === 0)) warn(where, `difficulty mix 1/2/3 = ${diff[1]}/${diff[2]}/${diff[3]}`);
}
for (const q of D.questions) if (!cur.groups[q.group]) err(`questions/${q.group}`, `unknown group for ${q.id}`);

// ---------- slides ----------
const plannedSlides = new Set();
for (const ch of cur.chapters) {
  for (const sid of ch.slides) {
    plannedSlides.add(sid);
    const s = D.slides[sid];
    const w = `slides/${ch.id}/${sid}`;
    if (!s) { err(w, 'slide missing'); continue; }
    if (s.chapter !== ch.id) err(w, `chapter must be ${ch.id}`);
    if (!isStr(s.title)) err(w, 'title missing');
    switch (s.layout) {
      case 'table':
        if (!Array.isArray(s.columns) || s.columns.length < 2) err(w, 'table needs columns');
        else if (!Array.isArray(s.rows) || !s.rows.length) err(w, 'table needs rows');
        else s.rows.forEach((r, i) => { if (!Array.isArray(r) || r.length !== s.columns.length) err(w, `row ${i} must have ${s.columns.length} cells`); });
        break;
      case 'bullets': if (!Array.isArray(s.bullets) || s.bullets.length < 2) err(w, 'bullets needs ≥2 items'); break;
      case 'compare': if (!Array.isArray(s.items) || s.items.length < 2 || s.items.length > 4) err(w, 'compare needs 2–4 items'); else s.items.forEach((it, i) => { if (!isStr(it.title) || !isStr(it.body)) err(w, `item ${i} needs title/body`); }); break;
      case 'flow': if (!Array.isArray(s.steps) || s.steps.length < 2) err(w, 'flow needs ≥2 steps'); else s.steps.forEach((st, i) => { if (!isStr(st.title)) err(w, `step ${i} needs title`); }); break;
      default: err(w, `unknown layout ${s.layout}`);
    }
    if (!isStr(s.note)) warn(w, 'note (exam tip) missing');
  }
}
for (const sid of D.slideOrder) if (!plannedSlides.has(sid)) warn(`slides/${D.slides[sid].chapter}/${sid}`, 'slide not in curriculum plan');

// ---------- glossary ----------
const CATS = ['compute', 'storage', 'database', 'network', 'security', 'integration', 'analytics', 'management', 'cost', 'migration', 'ml', 'general'];
const termSeen = new Map();
for (const g of D.glossary) {
  const w = `glossary/${g.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id)) err(w, 'id must be kebab-case');
  ['term', 'short', 'detail', 'examTip'].forEach((k) => { if (!isStr(g[k])) err(w, `${k} missing`); });
  if (!CATS.includes(g.category)) err(w, `bad category ${g.category}`);
  if (!Array.isArray(g.domains) || g.domains.some((d) => ![1, 2, 3, 4].includes(d))) err(w, 'domains must be subset of 1..4');
  if (g.aliases && !Array.isArray(g.aliases)) err(w, 'aliases must be an array');
  const key = String(g.term || '').toLowerCase().replace(/\s/g, '');
  if (termSeen.has(key)) warn(w, `term duplicated with ${termSeen.get(key)}`); else termSeen.set(key, g.id);
}
if (D.glossary.length < 120) warn('glossary', `only ${D.glossary.length} entries (target ≥ 150)`);

// ---------- labs ----------
const normCmd = (s) => String(s).trim().replace(/\s+/g, ' ').replace(/;+$/, '').toLowerCase();
function terminalPasses(task, cmd) {
  const c = normCmd(cmd);
  const m = task.match || {};
  if (!(m.all || []).every((x) => c.includes(normCmd(x)))) return false;
  if (!(m.any || []).every((grp) => grp.some((x) => c.includes(normCmd(x))))) return false;
  if ((m.none || []).some((x) => c.includes(normCmd(x)))) return false;
  return true;
}
const plannedLabs = new Set();
for (const ch of cur.chapters) {
  for (const lid of ch.labs) {
    plannedLabs.add(lid);
    const lab = D.labs[lid];
    const w = `labs/${lid}`;
    if (!lab) { err(w, 'lab missing'); continue; }
    if (lab.chapter !== ch.id) err(w, `chapter must be ${ch.id}`);
    ['title', 'summary', 'scenario', 'debrief'].forEach((k) => { if (!isStr(lab[k])) err(w, `${k} missing`); });
    if (!taskById[lab.task]) err(w, `bad task ${lab.task}`);
    if (!Array.isArray(lab.steps) || lab.steps.length < 2 || lab.steps.length > 6) { err(w, 'steps must have 2–6 items'); continue; }
    lab.steps.forEach((st, i) => {
      const sw = `${w}/step${i + 1}(${st.type})`;
      if (!isStr(st.title)) err(sw, 'title missing');
      switch (st.type) {
        case 'brief': if (!isStr(st.body)) err(sw, 'body missing'); break;
        case 'choice':
          if (!Array.isArray(st.options) || st.options.length < 2) err(sw, 'options missing');
          else if (!Array.isArray(st.answer) || !st.answer.length || st.answer.some((a) => a < 0 || a >= st.options.length)) err(sw, 'bad answer');
          if (!isStr(st.explain)) warn(sw, 'explain missing');
          break;
        case 'terminal':
          if (!Array.isArray(st.tasks) || !st.tasks.length) { err(sw, 'tasks missing'); break; }
          st.tasks.forEach((t, k) => {
            if (!t.match || !Array.isArray(t.match.all) || !t.match.all.length) err(sw, `task ${k} needs match.all`);
            if (!isStr(t.answer)) err(sw, `task ${k} needs answer`);
            else if (!terminalPasses(t, t.answer)) err(sw, `task ${k} answer does not satisfy its own match rules`);
            if (!isStr(t.instruction)) err(sw, `task ${k} needs instruction`);
            if (!/^aws\s/.test(String(t.answer || '').trim())) warn(sw, `task ${k} answer is not an aws CLI command`);
          });
          break;
        case 'slots': {
          const zones = new Set((st.zones || []).map((z) => z.id));
          const pal = new Set((st.palette || []).map((p) => p.id));
          if (!zones.size || !pal.size) err(sw, 'zones/palette missing');
          (st.zones || []).forEach((z) => { if (z.parent && !zones.has(z.parent)) err(sw, `zone ${z.id} parent ${z.parent} missing`); });
          if (!Array.isArray(st.slots) || st.slots.length < 2) err(sw, 'slots missing');
          (st.slots || []).forEach((s) => {
            if (!zones.has(s.zone)) err(sw, `slot ${s.id} zone ${s.zone} missing`);
            if (!Array.isArray(s.answer) || !s.answer.length || s.answer.some((a) => !pal.has(a))) err(sw, `slot ${s.id} answer not in palette`);
          });
          Object.keys(st.feedback || {}).forEach((k) => { if (!pal.has(k)) warn(sw, `feedback key ${k} not in palette`); });
          break;
        }
        case 'calc':
          if (!Array.isArray(st.fields) || !st.fields.length) err(sw, 'fields missing');
          else st.fields.forEach((f) => { if (typeof f.answer !== 'number' || !isFinite(f.answer)) err(sw, `field ${f.id} answer must be a number`); });
          break;
        case 'order': if (!Array.isArray(st.items) || st.items.length < 3) err(sw, 'order needs ≥3 items'); break;
        case 'match': {
          const L = (st.left || []).map((x) => x.id); const R = new Set((st.right || []).map((x) => x.id));
          if (L.length < 2 || R.size < 2) err(sw, 'left/right missing');
          L.forEach((id) => { if (!st.answer || !R.has(st.answer[id])) err(sw, `answer for ${id} missing or not in right`); });
          break;
        }
        case 'verdict': {
          const choices = st.choices || ['許可', '拒否'];
          if (!Array.isArray(st.docs) || !st.docs.length) err(sw, 'docs missing');
          (st.docs || []).forEach((d, k) => { if (!['json', 'table', 'text'].includes(d.kind)) err(sw, `doc ${k} bad kind`); });
          if (!Array.isArray(st.cases) || st.cases.length < 2) err(sw, 'cases missing');
          (st.cases || []).forEach((c) => { if (!choices.includes(c.answer)) err(sw, `case ${c.id} answer not in choices`); });
          break;
        }
        case 'sim':
          if (!['asg', 's3cost'].includes(st.sim)) err(sw, `unknown sim ${st.sim}`);
          if (!st.params || typeof st.params !== 'object') err(sw, 'params missing');
          if (!st.goal || typeof st.goal !== 'object') err(sw, 'goal missing');
          break;
        default: err(sw, `unknown step type ${st.type}`);
      }
    });
  }
}
for (const lid of D.labOrder) if (!plannedLabs.has(lid)) warn(`labs/${lid}`, 'lab not in curriculum plan');

// ---------- stories ----------
const bgmIds = new Set(D.audioCatalog.bgm.map((b) => b.id));
const sfxIds = new Set(D.audioCatalog.sfx.map((s) => s.id));
const CMDS = ['title', 'bg', 'bgm', 'sfx', 'show', 'hide', 'say', 'narr', 'cg', 'slide', 'quiz', 'lab', 'choice', 'label', 'jump', 'if', 'fx', 'wait', 'mock', 'branch', 'ending', 'end'];
const FX = ['shake', 'flash', 'heart', 'sparkle', 'fadeout', 'fadein'];
for (const ch of cur.chapters) {
  const w = `story/${ch.id}`;
  const st = D.stories[ch.id];
  if (!st) { err(w, 'story missing'); continue; }
  const script = st.script;
  const labels = new Map();
  script.forEach((s, i) => { if (s && 'label' in s) { if (labels.has(s.label)) err(w, `duplicate label ${s.label}`); labels.set(s.label, i); } });
  const usedSlides = new Set(); const usedQ = new Set(); const usedLabs = new Set();
  let hasEnd = false; let lines = 0;
  script.forEach((s, i) => {
    const sw = `${w}#${i}`;
    if (!s || typeof s !== 'object') { err(sw, 'step must be an object'); return; }
    const cmd = CMDS.find((c) => c in s);
    if (!cmd) { err(sw, `unknown command keys ${Object.keys(s).join(',')}`); return; }
    const chk = (cid, face) => {
      const c = D.characters[cid];
      if (!c) return err(sw, `unknown character ${cid}`);
      if (face && !(face in c.faces)) err(sw, `unknown face ${cid}/${face}`);
    };
    switch (cmd) {
      case 'bg': if (!D.assets[s.bg] || D.assets[s.bg].kind !== 'bg') err(sw, `unknown bg ${s.bg}`); break;
      case 'bgm': if (s.bgm !== null && !bgmIds.has(s.bgm)) err(sw, `unknown bgm ${s.bgm}`); break;
      case 'sfx': if (!sfxIds.has(s.sfx)) err(sw, `unknown sfx ${s.sfx}`); break;
      case 'show': chk(s.show, s.face); if (s.at && !['left', 'center', 'right'].includes(s.at)) err(sw, `bad position ${s.at}`); break;
      case 'hide': if (s.hide !== '*' && !D.characters[s.hide]) err(sw, `unknown character ${s.hide}`); break;
      case 'say': chk(s.say, s.face); if (!isStr(s.text)) err(sw, 'text missing'); lines++; break;
      case 'narr': if (!isStr(s.narr)) err(sw, 'narr text missing'); lines++; break;
      case 'cg': if (s.cg !== null && (!D.assets[s.cg] || D.assets[s.cg].kind !== 'cg')) err(sw, `unknown cg ${s.cg}`); break;
      case 'slide': if (s.slide !== null) { if (!D.slides[s.slide]) err(sw, `unknown slide ${s.slide}`); usedSlides.add(s.slide); } break;
      case 'quiz':
        if (Array.isArray(s.quiz)) s.quiz.forEach((qid) => { if (!D.qById[qid]) err(sw, `unknown question ${qid}`); usedQ.add(qid); });
        else {
          const ids = D.groups[s.quiz];
          if (!ids) { err(sw, `unknown quiz group ${s.quiz}`); break; }
          const pick = s.pick || ids.map((_, k) => k);
          pick.forEach((k) => { if (!ids[k]) err(sw, `pick index ${k} out of range for ${s.quiz}`); else usedQ.add(ids[k]); });
        }
        break;
      case 'lab': if (!D.labs[s.lab]) err(sw, `unknown lab ${s.lab}`); usedLabs.add(s.lab); break;
      case 'choice':
        if (!Array.isArray(s.choice) || s.choice.length < 2) err(sw, 'choice needs ≥2 options');
        else s.choice.forEach((c) => { if (!isStr(c.text)) err(sw, 'choice text missing'); if (c.jump && !labels.has(c.jump)) err(sw, `jump target ${c.jump} missing`); });
        break;
      case 'jump': if (!labels.has(s.jump)) err(sw, `jump target ${s.jump} missing`); break;
      case 'if': if (!labels.has(s.jump)) err(sw, `jump target ${s.jump} missing`); break;
      case 'fx': if (!FX.includes(s.fx)) err(sw, `unknown fx ${s.fx}`); break;
      case 'mock': if (!cur.mockExams[s.mock]) err(sw, `unknown mock ${s.mock}`); break;
      case 'branch':
        (s.cases || []).forEach((c) => { if (!labels.has(c.jump)) err(sw, `branch target ${c.jump} missing`); });
        if (s.else && !labels.has(s.else)) err(sw, `branch else ${s.else} missing`);
        break;
      case 'ending': if (!['true', 'good', 'retry'].includes(s.ending)) err(sw, `unknown ending ${s.ending}`); break;
      case 'end': hasEnd = true; if (s.next && !chapterById[s.next]) err(sw, `unknown next chapter ${s.next}`); break;
      default: break;
    }
  });
  if (!hasEnd) err(w, 'no {end:true} step');
  ch.slides.forEach((sid) => { if (!usedSlides.has(sid)) warn(w, `slide ${sid} is never shown`); });
  ch.groups.forEach((gid) => (D.groups[gid] || []).forEach((qid) => { if (!usedQ.has(qid)) warn(w, `question ${qid} is never asked`); }));
  ch.labs.forEach((lid) => { if (!usedLabs.has(lid)) warn(w, `lab ${lid} is never opened`); });
  info(`${w}: ${script.length} steps, ${lines} lines`);
}

// ---------- assets ----------
let present = 0; let missing = 0;
for (const [key, a] of Object.entries(D.assets)) {
  const stem = a.path.replace(/\.[a-z]+$/, '');
  const found = ['.png', '.webp', '.jpg', '.jpeg'].some((ext) => fs.existsSync(path.join(ROOT, stem + ext)));
  if (found) present++; else missing++;
  if (!a.label) warn(`assets/${key}`, 'label missing');
}
info(`images: ${present} present, ${missing} not yet created (placeholders will be used)`);

// ---------- report ----------
console.log('— Question groups —');
console.log(groupRows.join('\n'));
console.log(`domains: D1 ${domainTotals[1]}, D2 ${domainTotals[2]}, D3 ${domainTotals[3]}, D4 ${domainTotals[4]} / total ${D.questions.length}`);
console.log(`slides ${D.slideOrder.length}, glossary ${D.glossary.length}, labs ${D.labOrder.length}, stories ${Object.keys(D.stories).length}`);
infos.forEach((m) => console.log('info  ' + m));
if (!QUIET) warnings.forEach((m) => console.log('WARN  ' + m));
errors.forEach((m) => console.log('ERROR ' + m));
console.log(errors.length ? `\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s)` : `\nOK: 0 errors, ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
