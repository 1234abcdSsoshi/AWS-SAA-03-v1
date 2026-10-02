# SPEC — 『先輩、AWSを教えてください！ 〜SAA-C03 リベンジ・レッスン〜』

This is the single source of truth for every contributor (human or agent). Read it fully before writing code or content.
If something here conflicts with your instinct, follow this document. If something is missing, choose the simplest option that is consistent with it and note it in your report.

---

## 0. Product

**What**: A static web app that combines a visual-novel story, quizzes, hands-on labs, a mock exam, lecture notes, a glossary, a memo panel and a Q&A chat, to help a learner re-take **AWS Certified Solutions Architect – Associate (SAA-C03)**.

**Story premise**: 入社2年目のインフラエンジニア **七瀬あかり** は SAA-C03 に「あと一歩」で不合格。社内のテクニカルインストラクター（TI）兼シニアクラウドアーキテクト **氷室レン** が、14日後の再受験までの2週間、講義・演習・ハンズオンで指導する。職場の師弟もの＋ほんのり淡いラブコメ。健全・敬意ある関係（ハラスメント的描写は禁止）。

**Learner profile** (derived from the user's real score report — these are the ONLY facts you may use):
- Domain 1 セキュア (30%) と Domain 2 弾力性 (26%)：「コンピテンシーを満たしている」
- Domain 3 高性能 (24%) と Domain 4 コスト最適化 (20%)：「改善が必要」
- 合格ライン 720/1000 に「あと一歩」届かず。再受験は14日後から可能。
- → 問題配分は Domain 3・4 を厚く。ただし Domain 1・2 も配点の56%を占めるので維持練習できる量を確保する。

**PRIVACY — MUST**: The project root contains the user's real score report PDF. **Never open, quote, or copy it.** Never put the candidate's real name, candidate ID, registration number, exam date, or exact score anywhere (code, data, docs, comments, story). The heroine is fictional; say 「あと一歩」, never a number.

**Unofficial / original**: Not affiliated with AWS. All questions are original. Never reproduce real exam questions or third‑party question banks (受験者行動規範). No AWS logos or trademark artwork in images.

---

## 1. Technical constraints (hard rules)

1. **Static, no build step**: HTML + CSS + vanilla JavaScript (ES2020). No frameworks, no bundlers, no npm runtime deps.
2. **Must work by double‑clicking `index.html` (file://)** as well as from a local server. Therefore:
   - **Classic `<script>` tags only** — NO `type="module"`, NO `import`/`export`.
   - **NO `fetch()`/XHR of local files.** All data lives in `.js` files that register into `window.SAA`.
   - Images are loaded with `<img>`/CSS only (works on file://).
3. Every JS file is wrapped in an IIFE: `(function () { 'use strict'; ... })();`. The only globals are `window.SAA` (ours) and `window.Anthropic` (vendored SDK).
4. Style: 2‑space indent, semicolons, single quotes, `const`/`let`, no `var`. Small helper functions over clever code. Short comments (Japanese OK).
5. External network: only (a) optional Google Fonts `<link>` (app must look fine offline with fallbacks), (b) `https://api.anthropic.com` from the chat module. Nothing else.
6. Persistence only via `SAA.store` (localStorage with try/catch + in‑memory fallback). Never call `localStorage` directly elsewhere (exception: chat may use `sessionStorage` through `SAA.store.session`).
7. Defensive integration: modules must not crash if another module is missing. `js/core/namespace.js` installs **no‑op stubs** for every module API; real modules replace them. Always guard optional calls.
8. All UI text is Japanese. Responsive from 360px to 2560px wide; touch + mouse + keyboard. Respect `prefers-reduced-motion` (disable shake/flash/typewriter-heavy effects).
9. Security: escape all user‑provided or data text when inserting into HTML (`SAA.util.esc`) unless it is passed through `SAA.util.md()` (which escapes first, then applies the markdown‑lite subset). Never `eval`. Never inject API keys into DOM attributes or logs.
10. Each module must expose a `_test` object with the hooks listed in §8 so `js/selftest.js` can verify it headlessly.

### 1.1 File layout & ownership

```
index.html                     (foundation — load order is fixed; do not reorder)
docs/SPEC.md                   (this file)
css/base.css                   [core-shell]  tokens, reset, layout, buttons, forms, screens, topbar, modal, toast
css/story.css                  [vn-engine]
css/quiz.css                   [quiz-engine]
css/handson.css                [handson-engine]
css/audio.css                  [audio]
css/panels.css                 [memo-chat]
js/core/namespace.js           (foundation) SAA namespace, registries, bus, context, stubs
js/core/util.js                [core-shell]
js/core/store.js               [core-shell]
js/core/assets.js              [core-shell]
js/core/stats.js               [quiz-engine]
js/audio/audio.js              [audio]
js/story/engine.js             [vn-engine]
js/quiz/quiz.js                [quiz-engine]  question component
js/quiz/practice.js            [quiz-engine]  practice/review screen
js/quiz/mock.js                [quiz-engine]  mock exam
js/handson/widgets.js          [handson-engine]
js/handson/lab.js              [handson-engine]
js/panels/dock.js              [memo-chat]
js/panels/memo.js              [memo-chat]
js/panels/chat.js              [memo-chat]
js/app.js                      [core-shell]  router + core screens + boot (loaded last before selftest)
js/selftest.js                 [integration] runs only with ?selftest=1
data/curriculum.js             (foundation) domains, tasks, chapters, groups, mock exams
data/characters.js             (foundation) characters, faces, reaction pools
data/assets.js                 (foundation) image manifest
data/audio-catalog.js          (foundation) BGM/SFX ids
data/questions/<group>.js      [question writers] one file per group (see §3)
data/slides/slides-<chapter>.js[slide writers]
data/glossary-a.js, -b.js      [glossary writers]
data/labs/labs-a.js, -b.js     [lab writers]
data/story/<chapter>.js        [story writers] prologue, ch1..ch7
vendor/anthropic-sdk.min.js    (foundation) @anthropic-ai/sdk v0.131.0 IIFE → window.Anthropic
tools/validate.mjs             (foundation) Node data validator: `node tools/validate.mjs`
assets/images/...              (Codex/ChatGPT will add images — see Codex.md)
Codex.md, assets/image-prompts.json  [codex-writer]
README.md                      [integration]
```

Only edit files you own. If you need something from another module, use its API (§8) and guard it.

---

## 2. Global namespace (provided by `js/core/namespace.js`)

```js
SAA.version
SAA.data = {
  curriculum, characters, reactions, assets, audioCatalog,
  questions: [],      // all questions (registration order)
  qById: {},          // id -> question
  groups: {},         // groupId -> [questionId, ...] in authored order
  slides: {},         // slideId -> slide
  slideOrder: [],     // slide ids in registration order
  glossary: [],       // entries
  glossaryById: {},
  labs: {},           // labId -> lab
  labOrder: [],
  stories: {}         // chapterId -> { id, title, sub, script: [...] }
}
SAA.errors: string[]                       // registration problems (selftest fails if non-empty)
SAA.registerQuestions(groupId, list)
SAA.registerSlides(list)
SAA.registerGlossary(list)
SAA.registerLabs(list)
SAA.registerStory(chapterId, def)
SAA.bus.on(evt, fn) / off(evt, fn) / emit(evt, payload)
SAA.setContext(ctx) / SAA.getContext()    // learning context for memo & chat (§2.2)
SAA.isMockActive()                        // true while a mock exam is in progress (set by mock module via SAA.setMockActive(bool))
```

### 2.1 Bus events (names are fixed)

| event | payload | emitted by | consumed by |
|---|---|---|---|
| `app:ready` | `{}` | app | all |
| `screen:change` | `{ from, to, params }` | app | dock, audio |
| `context:change` | context object | namespace (`setContext`) | memo, chat |
| `quiz:answered` | `{ qid, correct, selected, mode }` | quiz | stats(app), story |
| `lab:completed` | `{ labId, score, total }` | labs | app |
| `mock:finished` | result object | mock | story, app |
| `settings:change` | `{ key, value }` | app/settings | audio, story, quiz |
| `dock:open` / `dock:close` | `{ tab }` | dock | — |
| `memo:append` | `{ text, title, contextKey }` | anyone (buttons) | memo |
| `chat:ask` | `{ text, autoSend: bool }` | anyone (buttons) | chat |

### 2.2 Context object

```js
{
  kind: 'question' | 'slide' | 'lab' | 'glossary' | 'story' | 'none',
  key: 'q:c3-storage-01',          // stable key, used as memo key
  id: 'c3-storage-01',
  title: '問題 c3-storage-01｜EBS gp3',   // short human title
  summary: '...',                  // plain-text context for the chat (question, options, and — only if reveal — answer/explanation)
  reveal: false                    // whether the answer may be shown to chat
}
```
Rules: the quiz component sets context when a question appears (`reveal:false`) and updates it after the user answers (`reveal:true`, include correct answer, the user's choice, explanation). During an active mock exam, the mock module sets `{kind:'none'}` and the chat must refuse to discuss the in‑progress questions (banner). Slides/glossary/lab viewers set their own context.

---

## 3. Curriculum, groups, question budget

Defined in `data/curriculum.js` (read it). Summary:

| group | chapter | domain/task | count | topics (one question per bullet, in this order) |
|---|---|---|---|---|
| `pro-diag` | prologue | D1–D4 | 4 | see curriculum.js |
| `c1-iam` | ch1 | 1.1 | 7 | |
| `c1-net` | ch1 | 1.2 | 7 | |
| `c1-data` | ch1 | 1.3 | 6 | |
| `c2-decouple` | ch2 | 2.1 | 9 | |
| `c2-ha` | ch2 | 2.2 | 9 | |
| `c3-storage` | ch3 | 3.1 | 10 | |
| `c3-compute` | ch3 | 3.2 | 10 | |
| `c4-db` | ch4 | 3.3 | 8 | |
| `c4-net` | ch4 | 3.4 | 8 | |
| `c4-data` | ch4 | 3.5 | 6 | |
| `c5-storage` | ch5 | 4.1 | 9 | |
| `c5-compute` | ch5 | 4.2 | 9 | |
| `c6-db` | ch6 | 4.3 | 7 | |
| `c6-net` | ch6 | 4.4 | 7 | |
| `mock-d1` | mockA | D1 | 20 | |
| `mock-d2` | mockA | D2 | 17 | |
| `mock-d3` | mockA | D3 | 15 | |
| `mock-d4` | mockA | D4 | 13 | |

Story bank 116 questions (D1 21, D2 19, D3 43, D4 33) + mock exam 65 (official 30/26/24/20 distribution) = **181**.
The exact topic list per group is in `SAA.data.curriculum.groups[groupId].topics` — follow it (you may sharpen a scenario, but do not swap topics or duplicate another group's topic).

---

## 4. Content schemas

### 4.1 Question — `data/questions/<groupId>.js`

```js
SAA.registerQuestions('c3-storage', [
  {
    id: 'c3-storage-01',            // `${groupId}-${NN}` two-digit, sequential from 01
    domain: 3,                      // 1..4 (must match group, except pro-diag where each q has its own)
    task: '3.1',                    // one of curriculum.tasks ids, must belong to domain
    topic: 'EBS gp3',               // short label (≤ 20 chars)
    difficulty: 2,                  // 1 基礎, 2 標準(本番レベル), 3 応用
    type: 'single',                 // 'single' | 'multi'
    question: '...',                // scenario + requirement + ask (see §4.1.1)
    options: ['...', '...', '...', '...'],  // single: exactly 4. multi: 5 (choose 2) or 6 (choose 3). NO "A." prefixes.
    answer: [2],                    // 0-based indices. single: length 1. multi: length 2 (5 options) or 3 (6 options)
    explanation: '...',             // markdown-lite (§4.6). Teach the concept, why the answer is best, decisive keywords.
    optionNotes: ['×…', '×…', '○…', '×…'],  // same length as options; each starts with ○ or × then the reason
    point: '...',                   // one-line exam tip (覚え方・キーワード→サービス)
    keywords: ['gp3', 'IOPS'],      // 2–6 search keywords (service names, concepts)
    intro: '...',                   // story only: Ren's lead-in line (1–2 sentences, no spoilers)
    onCorrect: '...',               // story only: Ren's line when correct (1 sentence)
    onWrong: '...'                  // story only: Ren's hint when wrong (1–2 sentences, kind, teaches the key)
  }
]);
```
Mock-exam questions (`mock-*`) omit `intro/onCorrect/onWrong`.

#### 4.1.1 Writing rules (all question writers & verifiers)
- **Japanese exam style** like the official Japanese SAA-C03: 「ある企業は…」「ソリューションアーキテクトは…必要があります。」「これらの要件を満たすソリューションはどれですか。」「最も運用上の効率が高い方法でこれらの要件を満たすソリューションはどれですか。」「最もコスト効率よく…」.
- Each scenario contains the **discriminating constraints** (e.g., 運用負荷を最小限に / 最もコスト効率が高い / ミリ秒単位のレイテンシー / 既存アプリの変更を最小限に / RPO 15分 / 12時間以内に取得) so exactly one answer is best. No trick ambiguity; no "all of the above".
- Multi-select questions end with 「（2つ選択してください。）」 or 「（3つ選択してください。）」. Aim for ~20–25% multi per group (at least 1 per group of ≥6).
- Distractors are plausible but wrong for a specific, explainable reason (violates a requirement, technically impossible, more ops overhead, more expensive, wrong layer). Avoid joke options. Keep option lengths similar (the correct one must not be conspicuously the longest).
- Explanations and notes **never refer to options by letter** ("選択肢A"…) because options are shuffled. Refer to them by content.
- **Accuracy first.** Use current (2025–2026) service names; mention the former name in parentheses where helpful: Amazon Data Firehose（旧 Kinesis Data Firehose）, Amazon Managed Service for Apache Flink（旧 Kinesis Data Analytics）, AWS IAM Identity Center（旧 AWS SSO）, Amazon ElastiCache（Valkey / Redis OSS / Memcached）, Amazon OpenSearch Service.
- Avoid features that are deprecated/closed to new customers (e.g., S3 Select, Glacier "vaults" as the primary answer for new designs, CodeCommit, Cloud9). Avoid niche services outside the SAA-C03 in-scope list.
- Numbers must be correct; only use well-established limits (e.g., SQS retention max 14 days & visibility timeout max 12 hours, Lambda timeout max 15 minutes & memory up to 10,240 MB, S3 object max 5 TB / single PUT max 5 GB, S3 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD per second per prefix, gp3 baseline 3,000 IOPS & 125 MiB/s, Kinesis shard write 1 MB/s or 1,000 records/s and read 2 MB/s, DynamoDB item max 400 KB, Spot interruption notice 2 minutes, Savings Plans/RI 1 or 3 years, S3 Standard-IA/One Zone-IA min 30 days & 128 KB billable, Glacier Instant/Flexible min 90 days, Deep Archive min 180 days). If unsure, rewrite to not depend on the number.
- Difficulty mix per group ≈ 20% 基礎 / 60% 標準 / 20% 応用.
- Explanation length: 150–400 Japanese characters. optionNotes: 30–120 chars each. point: ≤ 60 chars.
- Story lines (`intro/onCorrect/onWrong`) are in **Ren's voice** (§6).

### 4.2 Slide — `data/slides/slides-<chapterId>.js`

```js
SAA.registerSlides([
  {
    id: 'ch3-ebs-types', chapter: 'ch3',
    title: 'EBSボリュームタイプ早見表',
    layout: 'table',            // 'table' | 'bullets' | 'compare' | 'flow'
    lead: '…',                  // optional 1–2 sentence intro (markdown-lite)
    columns: ['タイプ','特徴','代表的な用途'],   // table only
    rows: [['gp3','…','…']],                    // table only (cells: markdown-lite)
    bullets: ['…'],                              // bullets only (markdown-lite; nesting via leading "  - ")
    items: [{ title:'…', body:'…', tag:'…' }],   // compare only (2–4 cards side by side)
    steps: [{ title:'…', body:'…' }],            // flow only (left→right / top→down arrows)
    note: '…',                   // exam tip box (markdown-lite)
    keywords: ['gp3','io2']
  }
]);
```
Slide ids are fixed in `curriculum.chapters[i].slides` — create exactly those ids. Rendered by `SAA.util.renderSlide(slide)`.

### 4.3 Glossary entry — `data/glossary-a.js` / `-b.js`

```js
SAA.registerGlossary([
  { id: 'ebs-gp3', term: 'Amazon EBS gp3', aliases: ['gp3','汎用SSD gp3'], category: 'storage',
    domains: [3,4], short: '1行の定義', detail: '2〜4文の説明（markdown-lite）', examTip: '試験での狙われ方・見分け方' }
]);
```
`category` ∈ `compute | storage | database | network | security | integration | analytics | management | cost | migration | ml | general`. ids are kebab-case, unique across both files.

### 4.4 Lab — `data/labs/labs-a.js` / `-b.js`

```js
SAA.registerLabs([
  {
    id: 'lab-asg-sim', chapter: 'ch3', domain: 3, task: '3.2',
    title: 'Auto Scaling チューニングラボ', summary: '1–2文',
    difficulty: 2, estMinutes: 10,
    scenario: '要件（markdown-lite）',
    steps: [ /* 2–5 steps, see widget schemas below */ ],
    debrief: '学びのまとめ（markdown-lite）'
  }
]);
```

Every step has `{ type, title, ... }`. Widget types (implemented in `js/handson/widgets.js`):

**`brief`** — reading step. `{ type:'brief', title, body }` → "次へ".

**`choice`** — mini question. `{ type:'choice', title, prompt, options:[…], answer:[i…], explain }` (multi if answer.length>1).

**`terminal`** — pseudo AWS CLI terminal.
```js
{ type:'terminal', title, prompt:'目的の説明',
  files: { 'lifecycle.json': '{\n  "Rules": [...]\n}' },      // optional; `cat`/`ls` show them
  tasks: [
    { instruction: 'バケット saa-lab-logs のバージョニングを有効化してください。',
      match: { all: ['aws s3api put-bucket-versioning', '--bucket saa-lab-logs', 'Status=Enabled'],
               any: [['--versioning-configuration']], none: [] },     // case-insensitive substring tests on the normalized command
      output: '（成功時の擬似出力。空なら何も表示しない）',
      hint: '…', answer: 'aws s3api put-bucket-versioning --bucket saa-lab-logs --versioning-configuration Status=Enabled',
      explain: '…' }
  ] }
```
Normalization: trim, collapse whitespace, strip a trailing `;`. A task passes when every `all` substring is present, at least one item of each `any` group is present, and no `none` substring is present. Built‑ins: `help`, `clear`, `hint`, `answer` (reveals and counts as assisted), `ls`, `cat <file>`. Wrong input → realistic-looking but generic error + after 2 misses show hint. **Commands must be real, correct AWS CLI v2 syntax.**

**`slots`** — architecture builder.
```js
{ type:'slots', title, prompt,
  zones: [ { id:'edge', label:'エッジ', kind:'edge' }, { id:'vpc', label:'VPC', kind:'vpc' },
           { id:'pub', label:'パブリックサブネット（2AZ）', kind:'public', parent:'vpc' },
           { id:'priv', label:'プライベートサブネット（2AZ）', kind:'private', parent:'vpc' } ],
  palette: [ { id:'alb', label:'Application Load Balancer', icon:'⚖️' }, … ],   // 6–10 items incl. distractors
  slots: [ { id:'s1', zone:'pub', label:'HTTPSを受けてパスで振り分ける', answer:['alb'], explain:'…' }, … ],  // 3–6 slots
  feedback: { nlb: 'NLBはL4のためパスベースルーティング不可', … } }   // optional per-component reason when misplaced
```
zone.kind ∈ `edge | region | az | vpc | public | private | onprem | aws` (visual style only).

**`calc`** — numeric answer(s).
```js
{ type:'calc', title, prompt, fields:[ { id:'rcu', label:'必要なRCU', unit:'RCU', answer:50, tolerance:0 } ],
  hint:'…', formula:'…', explain:'…' }
```

**`order`** — put steps in order. `{ type:'order', title, prompt, items:['正しい順の1番目', …], explain }` (UI shuffles).

**`match`** — assign each left item to a right option (many‑to‑one allowed).
```js
{ type:'match', title, prompt, left:[ { id:'w1', label:'…' } ], right:[ { id:'sp', label:'Compute Savings Plans' } ],
  answer:{ w1:'sp' }, explain:'…', notes:{ w1:'なぜその選択肢か' } }
```

**`verdict`** — evaluate cases against documents (IAM policies, SG/NACL rules…).
```js
{ type:'verdict', title, prompt,
  docs:[ { title:'IAMポリシー（DevRole）', kind:'json', content:{…} },
         { title:'NACL（インバウンド）', kind:'table', columns:['ルール#','タイプ','ポート','送信元','許可/拒否'], rows:[[…]] },
         { title:'補足', kind:'text', content:'…' } ],
  choices:['許可','拒否'],          // optional; default ['許可','拒否']
  cases:[ { id:'c1', desc:'DevRole が s3:GetObject を …', answer:'拒否', explain:'…' } ] }
```

**`sim`** — custom simulator. `{ type:'sim', title, sim:'asg' | 's3cost', params:{…}, goal:{…}, explain }`
- `asg` params: `{ profile:'office' | 'spiky' | 'steady' | 'batch', capacityPerInstance:100 /*req/s*/, hourlyCost:0.1, warmupMin:5, start:{min,max,desired} }`; the user picks policy type (固定 / ターゲット追跡 / ステップ / スケジュール / 予測) and parameters; output: 24h chart demand vs capacity, overload minutes, avg utilization, daily cost. `goal: { maxOverloadMin, maxDailyCost }`.
- `s3cost` params: `{ initialTB, monthlyGrowthTB, months, avgObjectKB, accessNote, retrievalRequirement:'ms' | 'minutes' | '12h' | '48h', prices:{…} }`; the user builds lifecycle transitions (days → class) and expiration; engine enforces S3 rules (Standard→IA/One Zone-IA ≥ 30 days, min storage durations, waterfall order, objects < 128 KB not transitioned by default); output: monthly cost chart vs all‑Standard baseline. `goal: { minSavingPct, retrievalRequirement }`.
- Prices used in sims are **approximate learning values** and must be labeled 「学習用の概算値」.

Lab ids are fixed in `curriculum.chapters[i].labs`.

### 4.5 Story script — `data/story/<chapterId>.js`

```js
SAA.registerStory('ch3', { title: '第3章', sub: '高性能アーキテクチャ① ストレージとコンピューティング', script: [ /* steps */ ] });
```

Commands (one key per step object determines the command; extra keys are options):

| step | meaning |
|---|---|
| `{ title:'第3章', sub:'…' }` | chapter title card (auto‑advances after ~2.5s or click) + `chapter_start` sfx |
| `{ bg:'bg_office_day', fx:'fade'\|'cut' }` | change background (asset key) |
| `{ bgm:'daily' }` / `{ bgm:null }` | change / stop BGM (crossfade) — ids from audio-catalog |
| `{ sfx:'correct' }` | play sound effect |
| `{ show:'akari', face:'smile', at:'left'\|'center'\|'right' }` | show/move character sprite |
| `{ hide:'akari' }` / `{ hide:'*' }` | hide one / all characters |
| `{ say:'ren', face:'explain', text:'…' }` | dialogue (face optional; updates sprite; auto-shows the char if hidden at its default side: akari=left, ren=right) |
| `{ say:'akari', inner:true, text:'…' }` | inner monologue, shown as （…） in italic |
| `{ narr:'…' }` | narration (no name) |
| `{ cg:'cg_whiteboard_lecture' }` / `{ cg:null }` | show / hide full-stage CG (marks it as seen for the gallery) |
| `{ slide:'ch3-ebs-types' }` / `{ slide:null }` | open / close the whiteboard slide panel (dialogue continues while open) |
| `{ quiz:'c3-storage', pick:[0,1,2] }` | run questions of a group in authored order (`pick` = 0-based indices; omit = all). Before each question Ren says its `intro` (if any). |
| `{ quiz:['c3-storage-01','c3-storage-02'] }` | run explicit questions |
| `{ lab:'lab-asg-sim' }` | open a lab; story resumes when it closes (completed or skipped) |
| `{ choice:[ { text:'…', jump:'label', set:{ flag:true } } ], prompt:'…' }` | branch / flavor choice (`prompt` optional) |
| `{ label:'name' }` / `{ jump:'name' }` | labels and unconditional jump (labels are local to the chapter) |
| `{ if:'flagName', jump:'label' }` | jump if flag truthy |
| `{ fx:'shake'\|'flash'\|'heart'\|'sparkle'\|'fadeout'\|'fadein' }` | screen effect |
| `{ wait:600 }` | pause (ms) |
| `{ mock:'mockA' }` | run the mock exam; sets vars `mockRate` (0–1) and `mockPassed` |
| `{ branch:'mockRate', cases:[ { gte:0.8, jump:'end_true' }, { gte:0.72, jump:'end_good' } ], else:'end_retry' }` | numeric branch on a var |
| `{ ending:'true'\|'good'\|'retry' }` | record an ending as seen |
| `{ end:true, next:'ch4' }` | chapter end → summary screen (next optional) |

Characters: `akari`, `ren`. Faces: see `data/characters.js`. Asset key of a sprite = `${char}_${face}`.

### 4.6 Markdown-lite (rendered by `SAA.util.md`)
Supported: paragraphs (blank line), line breaks (`\n`), `**bold**`, `` `code` ``, `- ` bullet lists (one nesting level with two leading spaces), `1. ` numbered lists, `> ` callout, and simple tables (`| a | b |` lines with a `|---|` separator). Nothing else (no links, no images, no HTML).

---

## 5. UI / visual design

### 5.1 Tokens (defined in `css/base.css`; every CSS file must use them, never hard-code theme colors)
```css
:root {
  --c-bg:#f6f3ee; --c-surface:#ffffff; --c-surface-2:#f1ede6; --c-border:#e4ddd2;
  --c-text:#1d2433; --c-text-dim:#5b6475; --c-navy:#1f2a44;
  --c-primary:#ff7a59; --c-primary-ink:#ffffff; --c-primary-soft:#ffe3da;
  --c-accent:#2f6fde; --c-accent-soft:#dce8ff;
  --c-ok:#1f9d6b; --c-ok-soft:#d9f3e8; --c-ng:#d64545; --c-ng-soft:#fbe0e0; --c-warn:#d99a00; --c-warn-soft:#fff1cc;
  --c-akari:#ff8fa3; --c-ren:#3a7bd5;
  --c-d1:#6c5ce7; --c-d2:#00a3a3; --c-d3:#ff7a59; --c-d4:#d99a00;
  --radius:14px; --radius-sm:8px; --shadow:0 6px 24px rgba(20,30,50,.12); --shadow-lg:0 18px 50px rgba(20,30,50,.22);
  --font-ui:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Noto Sans JP","Yu Gothic UI",system-ui,sans-serif;
  --font-body:"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo",system-ui,sans-serif;
  --font-mono:"JetBrains Mono","Consolas","Menlo",monospace;
  --topbar-h:56px; --dock-w:420px;
  --vn-box:rgba(18,24,42,.86); --vn-text:#f7f8fb; --vn-name:#ffd8cc;
}
```
Dark theme: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }` with the same token names (surfaces #12161f/#1a2030/#222a3d, text #e8ebf2, dim #9aa3b5, borders #2c3550; keep accent hues, adjust soft variants). `body` gets an explicit background. The VN dialogue box keeps its own dark style in both themes.

### 5.2 Layout & DOM (fixed by `index.html`)
```html
<body>
  <div id="app">
    <header id="topbar"></header>           <!-- core-shell renders: back, title, right buttons (🔊 / 📝 / 💬 / ⚙) -->
    <main id="screen-root"></main>          <!-- current screen renders here -->
  </div>
  <aside id="dock" aria-hidden="true"></aside>   <!-- memo/chat panel (memo-chat owns) -->
  <div id="overlay-root"></div>             <!-- modals, lab overlay, mock exam -->
  <div id="toast-root" aria-live="polite"></div>
  <noscript>…</noscript>
</body>
```
- The story screen hides the topbar and shows its own floating mini toolbar (≡, 📝, 💬, 🔊) top-right.
- Dock: right side sheet, width `var(--dock-w)` on ≥ 1024px (overlays content with shadow; Esc closes); full-screen sheet below 1024px.
- Overlay z-index scale: screen 1, story overlays 10–40, dock 50, overlay-root 60, toast 80.
- Visual direction: clean modern office + soft romance; rounded cards, gentle shadows, coral (Akari) & blue (Ren) accents, domain colors for badges. Domain badge text: `D1 セキュア`, `D2 弾力性`, `D3 高性能`, `D4 コスト`.

### 5.3 Screens (ids for `SAA.app.go(id, params)`)
| id | owner | content |
|---|---|---|
| `title` | core-shell | key visual (`cg_title` or animated gradient placeholder), logo text, subtitle, menu: はじめから / つづきから / チャプター選択 / 問題演習 / 模擬試験 / ハンズオンラボ / 講義ノート / 用語集 / 学習記録 / ギャラリー / サウンドルーム / 設定. First interaction shows 「タップしてはじめる」 to unlock audio. |
| `chapters` | core-shell | chapter cards (no., title, sub, domain badge, progress %, quiz accuracy, はじめから/つづきから). All chapters selectable; recommended order shown. |
| `story` | vn-engine | the VN stage (params `{ chapter, step }`) |
| `practice` | quiz-engine | filters + run + summary (params may preset filters: `{ domains:[3,4], tasks:[…], groups:[…], source:'wrong'|'bookmarked'|'unanswered'|'weak'|'all', count }`) |
| `mock` | quiz-engine | mock exam intro/run/results/history |
| `labs` | handson-engine | lab list by chapter; open lab overlay |
| `notes` | core-shell | lecture slides library by chapter, search, viewer (memo/chat buttons) |
| `glossary` | core-shell | search, category filter, expandable entries |
| `stats` | core-shell | 学習記録 dashboard (§5.4) |
| `gallery` | core-shell | CG gallery (seen CGs unlocked) |
| `sound` | audio | sound room |
| `settings` | core-shell | sections: 表示 / テキスト / 問題 / サウンド (via `SAA.audio.renderSettings`) / 質問チャット (via `SAA.chat.renderSettings`) / データ（エクスポート・インポート・リセット）/ 画像アセット（link to `assets`） |
| `assets` | core-shell | asset checker (via `SAA.assets.renderChecker`) |

### 5.4 Stats dashboard
- Overall: answered/total, accuracy, labs done, mock best.
- Domain bars with label 「コンピテンシーを満たしている」(rate ≥ 0.72 and ≥ 5 answered) / 「改善が必要」/「データ不足」; show the original report status as 「前回の本番: 改善が必要」 for D3/D4 and 「前回の本番: 満たしている」 for D1/D2.
- Task table (14 tasks) with accuracy heat colors and 「このタスクを練習」 → `practice` with that task.
- Mock history (date, 推定スコア, 合否目安). Weakest 5 questions → practice.

---

## 6. Characters & voice (story writers, question writers for intro/onCorrect/onWrong, chat persona)

**七瀬 あかり（ななせ あかり）** 24歳。株式会社スカイブリッジ（架空）インフラチーム2年目。明るく素直で努力家、ちょっとおっちょこちょい。セキュリティと可用性は得意、性能とコストの問題で「最も〜」の比較に迷いがち。一人称「私」。レンを「氷室先輩」または「先輩」と呼ぶ。口癖「よーし、がんばります！」。心の声は（ ）で、照れ・驚きが漏れる。
**氷室 レン（ひむろ れん）** 29歳。アーキテクチャ推進室のシニアクラウドアーキテクト兼社内テクニカルインストラクター（TI）。AWS認定全冠。落ち着いた低めの声、論理的、例え話が上手（倉庫・物流・レストラン等）。基本クールだが面倒見がよく、努力をきちんと褒める。たまに少しだけからかう。一人称「俺」。あかりを「七瀬」と呼ぶ。決め台詞「答えは、問題文の中にある」「要件を読め。制約を拾え。そうすれば選択肢は勝手に減る」。

Tone: wholesome workplace mentoring with light rom-com (blushing inner monologue, small jokes). No harassment, no physical contact beyond e.g. handing a coffee, no power-abuse tropes. Romance stays subtle; endings are warm and respectful.

Lecture style: Ren explains concepts *before* related questions using the whiteboard slides, then asks questions; after questions he adds one-line wrap-ups. Akari asks the questions a learner would ask and makes realistic mistakes (e.g., 「一番速そうだからio2で…」).

Timeline: 10月の2週間。Day 1–14。Prologue = 不合格通知を受けた日の夜。

---

## 7. Data store (`SAA.store`)

Keys (prefix `saa03.` added internally):
- `settings` → `{ theme:'auto'|'light'|'dark', textSpeed:40 /*chars/sec, 0=instant*/, autoDelay:1.2 /*sec*/, skipUnread:false, shuffleOptions:true, volume:{ master:0.8, bgm:0.55, sfx:0.8 }, muted:false, chat:{ model:'claude-opus-5-5', effort:'medium', keyMode:'local'|'session', includeContext:true } }` (deep-merge defaults on read)
- `chat.apiKey` (only when keyMode `local`; when `session` use `SAA.store.session`)
- `progress` → `{ last:{ chapter, step }, chapters:{ [id]:{ step, maxStep, done, startedAt, finishedAt } }, flags:{}, vars:{}, seenCg:[], endings:[] }`
- `stats` → `{ q:{ [qid]:{ n, c, last:1|0, lastAt, sel:[…] } }, labs:{ [labId]:{ done, score, total, at } }, mocks:[ { id, mockId, at, rate, scaled, byDomain:{1:{n,c},…}, durationSec, answers:{ [qid]:[…] }, flagged:[…] } ] }`
- `bookmarks` → `[qid]`
- `memo` → `{ global:'', items:{ [contextKey]:{ title, text, kind, refId, updatedAt } } }`
- `chat.history` → `[ { role:'user'|'assistant', text, at, ctxTitle? } ]` (keep last 60)

---

## 8. Module APIs (contracts)

### `SAA.util` (core-shell)
`el(tag, attrs?, ...children)` (attrs: class, text, html, on{Event}, dataset, style obj, aria-*) · `$(sel, root?)` · `$$(sel, root?)` · `esc(s)` · `md(s) → html string` · `shuffle(arr) → new array` · `clamp(n,a,b)` · `fmtTime(sec) → 'mm:ss' or 'h:mm:ss'` · `fmtDate(ts)` · `debounce(fn, ms)` · `sleep(ms)` · `download(filename, content, mime)` · `pickFile(accept) → Promise<string>` · `toast(msg, kind='info'|'ok'|'ng'|'warn')` · `modal({ title, body: el|html, buttons:[{ label, kind:'primary'|'ghost'|'danger', onClick, close:true }], wide }) → { close, el }` · `confirm(msg, { okLabel, danger }) → Promise<bool>` · `renderSlide(slide, { compact }) → HTMLElement` · `domainBadge(d) → el` · `stars(n) → el` · `charAvatar(charId, face?) → el` (uses `SAA.assets.img('face_'+charId)` with initial-letter fallback)
`_test`: `{ md: fn }` (selftest calls `SAA.util.md` on samples).

### `SAA.store` (core-shell)
`get(key, def)` · `set(key, val)` · `update(key, fn(def)→val, def)` · `remove(key)` · `getSettings()` (deep-merged defaults) · `setSetting(path, value)` (e.g. `'volume.bgm'`; emits `settings:change`) · `exportAll() → json string` · `importAll(json) → bool` · `resetAll()` · `session.get/set/remove` (sessionStorage w/ fallback) · `isPersistent() → bool`.

### `SAA.assets` (core-shell)
`img(key, { cls, alt }) → HTMLElement` (an `<img>` that falls back to a placeholder element if missing; tries `.png` → `.webp` → `.jpg` → `.jpeg` relative to the manifest path stem) · `resolve(key) → Promise<string|null>` (cached) · `applyBg(el, key)` (sets background image or placeholder gradient + label from manifest `ph`) · `sprite(charId, face) → HTMLElement` (img or styled SVG silhouette placeholder in char color with face label) · `has(key) → bool|undefined` (after resolve) · `renderChecker(container)`.
`_test`: `{ keys: () => Object.keys(manifest) }`.

### `SAA.audio` (audio)
`init()` (idempotent; call on first user gesture) · `playSfx(id, { volume })` · `playBgm(id, { fade=1.0 })` (no-op if already playing same id) · `stopBgm({ fade })` · `currentBgm()` · `setVolume(kind:'master'|'bgm'|'sfx', v)` · `getVolume(kind)` · `setMuted(bool)` · `isMuted()` · `renderWav(kind:'bgm'|'sfx', id, { loops=1 }) → Promise<Blob>` · `renderSettings(container)`.
Registers screen `sound`.
`_test`: `{ bgmIds(), sfxIds(), renderAll: async () => ({ ok, errors }) }` (renders each SFX and ~2s of each BGM via OfflineAudioContext if available).

### `SAA.stats` (quiz-engine)
`record(qid, { correct, selected, mode })` · `getQ(qid)` · `summary() → { answered, total, correct, rate }` · `byDomain() → { 1:{ n, c, rate, answeredQ, totalQ }, … }` · `byTask() → { '1.1':{…}, … }` · `status(domain) → 'meets'|'needs'|'nodata'` · `weakest(n) → [qid]` · `pickQuestions({ domains, tasks, groups, source, count, order }) → [qid]` · `estimateScaled(rate) → int` (= max(100, round(1000*rate))) · `recordLab(labId, { score, total })` · `labStatus(labId)` · `recordMock(result)` · `mocks()` · `chapterSummary(chapterId) → { answered, correct, total }`.
`_test`: `{}`.

### `SAA.quiz` (quiz-engine)
`mount(container, q, { mode:'story'|'practice'|'review'|'mock', shuffle, index, total, reaction:true }) → ctl`
- `ctl.answered: Promise<{ correct, selected, q }>` resolves when the user submits (not in `mock`, where answering is free‑form).
- In `story`/`practice`, after submit the component shows: colored options + each optionNote, explanation, `point` box, Ren's reaction bubble (q.onCorrect/onWrong or a random line from `SAA.data.reactions`), buttons 「📝 メモに追加」(emits `memo:append`), 「💬 この問題を質問」(emits `chat:ask` with a prompt about this question), 「🔖」bookmark toggle, 「次へ ▶」.
- `ctl.done: Promise<void>` resolves on 「次へ」. `ctl.destroy()`.
- Records stats via `SAA.stats.record` (except `mock`, which records at the end) and emits `quiz:answered`. Sets context (§2.2). Plays `correct`/`incorrect` SFX.
- Keyboard: 1–6 / A–F toggle options, Enter submit / next.
`SAA.quiz.runSequence(container, qids, opts) → Promise<results[]>` helper (used by practice).
`_test`: `{ check(q, selectedIdx[]) → bool }` (pure grading function used by component).

### `SAA.mock` (quiz-engine)
`start(mockId, { fromStory }) → Promise<result|null>` (opens in `#overlay-root` if fromStory, otherwise in the `mock` screen). 130-minute timer, flag for review, navigator grid, submit confirmation; results: 推定スコア, 合否目安 (≥720), domain table in the official report style (改善が必要 / コンピテンシーを満たしている), time used, review with explanations. Calls `SAA.setMockActive(true/false)`. Emits `mock:finished`. Records via `SAA.stats.recordMock`.
Modes: 「本番形式（公式配分・65問）」 using `mockA` groups; 「弱点強化（D3/D4多め・65問）」 drawing from all questions (D1 10, D2 10, D3 25, D4 20); 「ミニ模試（20問）」.
`_test`: `{ grade(answersMap, qids) → { rate, byDomain } }`.

### `SAA.labs` (handson-engine)
`open(labId) → Promise<{ completed, score, total }>` (full-screen overlay in `#overlay-root`; steps with progress, 「スキップ」 allowed, result screen + debrief; records via `SAA.stats.recordLab`; plays `handson` BGM while open and restores the previous BGM on close; emits `lab:completed`).
`widgets[type] = { mount(container, step, ctx) → { done: Promise<{ ok, score, total }>, destroy() } }`.
Registers screen `labs`.
`_test`: `{ solve(labId) → Promise<{ ok, errors }> }` — programmatically feeds each step's authored answer into the widget logic (no UI clicks needed; may call pure evaluators) and checks every step evaluates as correct.

### `SAA.story` (vn-engine)
`start(chapterId, { step=0 })` · `resume()` (from `progress.last`) · `stop()` · `isRunning()`.
Registers screen `story`. Saves `progress.chapters[id].step/maxStep` after every step and `progress.last`. Backlog (L), Auto (A), Skip (hold Ctrl or toggle; read lines only unless `skipUnread`), hide UI (H), menu (Esc): タイトルへ / チャプター選択 / 設定 / 学習記録. Chapter end summary: questions in chapter with ✓/✗, labs done, buttons 次の章へ / 苦手を復習 (practice with `source:'wrong'` & that chapter's groups) / タイトルへ.
`_test`: `{ dryRun(chapterId) → { ok, errors, steps } }` — walks every step and branch target without UI, validating commands & references (assets, bgm/sfx ids, characters/faces, slides, groups/qids, labs, labels).

### `SAA.dock` / `SAA.memo` / `SAA.chat` (memo-chat)
- `SAA.dock.open(tab:'memo'|'chat')` · `close()` · `toggle(tab)` · `isOpen()`.
- `SAA.memo.append(text, { title, contextKey })` · `get(contextKey)` · `set(contextKey, text, meta)` · `exportMarkdown() → string` · `renderPanel(container)`.
- `SAA.chat.ask(text, { autoSend=true })` · `renderPanel(container)` · `renderSettings(container)` · `testConnection() → Promise<{ ok, message }>` · `offlineAnswer(text, ctx) → string` (markdown-lite).
- `_test`: memo `{ roundTrip() → bool }`, chat `{ offline(text) → string }`.

### `SAA.app` (core-shell)
`go(screenId, params)` · `back()` · `registerScreen(id, { title, render(container, params), leave(), topbar:true|false })` · `current()` · `setTopbar({ title, back:true })`. Boot on `DOMContentLoaded`: apply theme, render topbar, register core screens, go to `title` (or a screen from `location.hash` like `#practice`), emit `app:ready`, init dock. First pointer/key event calls `SAA.audio.init()`.
Global keys (ignored while typing in inputs, and ignored when `e.defaultPrevented`): `M` memo, `C` chat, `Esc` closes dock (modals handle their own Esc first via `SAA.util`'s modal stack).
**Screen registry**: modules load before `app.js` and call `SAA.app.registerScreen` on the stub in `namespace.js`, which writes into the shared `SAA.screens` object. The real `app.js` MUST keep using `SAA.screens` (do not replace it with a private map) so earlier registrations are preserved. The stub `SAA.app.go` is a minimal router that lets a module render its own screen for testing before `app.js` exists.

### Foundation already written (do not rewrite; extend only if truly necessary and report it)
- `js/core/namespace.js`, `js/core/util.js` (full API in §8 `SAA.util`, plus `U.mdInline`, `U.clear`, `U.pct`, `U.isTyping`, `U.prefersReducedMotion`, `U.domain(d)`, `U.task(id)`, `U.chapter(id)`, `U.hasModal()`), `js/core/store.js` (also `S.keys()`, `S.defaults()`), `data/curriculum.js`, `data/characters.js`, `data/assets.js`, `data/audio-catalog.js`, `index.html`, `tools/validate.mjs`, `vendor/anthropic-sdk.min.js`.
- CSS for shared components produced by `SAA.util` lives in `css/base.css` (core-shell): `.btn .btn--primary|ghost|danger`, `.icon-btn`, `.badge .badge--d1..d4`, `.stars`, `.avatar .avatar__initial`, `.toast .toast--info|ok|ng|warn .is-show`, `.modal-backdrop .is-open .modal .modal--wide .modal__header|title|close|body|footer`, `.confirm-text`, `.md-table-wrap .md-table .md-list .md-callout`, `.slide .slide--table|bullets|compare|flow .slide--compact .slide__head|badge|title|lead|body|table-wrap|table|compare|card|tag|card-title|card-body|flow|step|step-no|step-main|step-title|step-body|note|note-label|note-body`, `.asset-ph`.

---

## 9. Audio (Claude-made, procedural)
All BGM/SFX are synthesized at runtime with the Web Audio API (no audio files). Ids and moods are in `data/audio-catalog.js`; implement **every** id. Quality bar: musical, pleasant, not harsh; loops 8–16 bars seamless with A/B variation; master limiter/compressor; BGM crossfades. Sound room lists all, plays them, and exports WAV (OfflineAudioContext → 16-bit PCM).

## 10. Chat (Claude API)
- Uses `window.Anthropic` (vendored SDK) **in the browser**: `new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })`.
- Request: `client.beta.messages.stream({ model, max_tokens: 16000, system, messages, cache_control:{ type:'ephemeral' }, output_config:{ effort }, betas:['server-side-fallback-2026-07-01'], fallbacks:'default' })` for `claude-opus-5-5` / `claude-sonnet-5-5`. For `claude-haiku-4-5` omit `output_config`, `betas`, `fallbacks`. Do not send `thinking` (adaptive by default on the 5.x models), no temperature, no assistant prefill.
- Stream with `for await (const ev of stream)`; render `content_block_delta` / `text_delta`; then `await stream.finalMessage()`; if `stop_reason === 'refusal'` show a polite in‑character message. Abort via `stream.abort()` (Stop button).
- Errors: `Anthropic.AuthenticationError` → APIキー確認, `RateLimitError` → 少し待って, `APIConnectionError` → ネットワーク不可→オフライン回答に切替, `APIError` → status + message.
- Models selectable in chat settings: `claude-opus-5-5`（既定・高精度）, `claude-sonnet-5-5`（高速・低コスト）, `claude-haiku-4-5`（最速）. Effort: low / medium（既定）/ high.
- Key storage: `local` (localStorage, default) or `session` (this tab only). Show a warning about shared PCs. Never log the key.
- System prompt (Japanese, fixed text — stable for caching): Ren persona (§6) as an AWS SAA-C03 tutor, answers in Japanese, concise (≈300–600字), accuracy first and says when unsure, highlights exam decision keywords, uses bullet lists/tables when helpful, addresses the user as 「君」, refuses to reproduce real exam questions or discuss NDA content, and never reveals mock answers when told a mock exam is in progress.
- Context injection: if `includeContext` and a context exists, prefix the user message with `<学習コンテキスト>…</学習コンテキスト>` built from `ctx.summary` (only reveal answers when `ctx.reveal`). Send the last 20 messages.
- Offline mode (no key, or network error): local retrieval over glossary + slides + question keywords/points (character-bigram + alias match), answer in Ren's voice with top 3 snippets and a note on enabling the API.

## 11. Images (ChatGPT-made, by Codex) — see `data/assets.js` and `Codex.md`
All images are optional at runtime: every asset has a placeholder. The manifest lists key → path, size, kind, description, placeholder gradient (`ph`) and label. Sprites 1024×1536 transparent PNG; backgrounds/CGs 1536×1024; faces 1024×1024.

## 12. Verification
- `node tools/validate.mjs` — static data validation (must print `OK` with 0 errors before you finish content work).
- `index.html?selftest=1` — in-browser self test; writes JSON into `#selftest-result` and sets `document.title` to `SELFTEST:PASS` or `SELFTEST:FAIL`. Headless run:
  `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-first-run --user-data-dir=<tmp> --virtual-time-budget=20000 --dump-dom "file:///C:/Users/pku11/Development/AWS-SAA-03/index.html?selftest=1"`
- Screenshots: `chrome --headless=new --screenshot=<png> --window-size=1366,768 <url>`.
