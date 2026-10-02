/* 画像アセットのマニフェスト（画像は ChatGPT/Codex が Codex.md に従って作成して配置する）
   - 画像が無い場合はアプリ側でプレースホルダー（ph のグラデーション＋ラベル）を表示する
   - 拡張子は .png を基本とし、無ければ .webp → .jpg → .jpeg の順に自動で探す */
(function () {
  'use strict';

  const C = 'assets/images/characters/';
  const F = 'assets/images/faces/';
  const B = 'assets/images/backgrounds/';
  const G = 'assets/images/cg/';

  function sprite(ch, face, label, desc) {
    return { path: C + ch + '_' + face + '.png', kind: 'sprite', char: ch, face: face, w: 1024, h: 1536, alpha: true, label: label, desc: desc };
  }
  function bg(key, label, icon, ph, desc) {
    return { path: B + key + '.png', kind: 'bg', w: 1536, h: 1024, alpha: false, label: label, icon: icon, ph: ph, desc: desc };
  }
  function cg(key, label, icon, ph, desc) {
    return { path: G + key + '.png', kind: 'cg', w: 1536, h: 1024, alpha: false, label: label, icon: icon, ph: ph, desc: desc };
  }

  SAA.data.assets = {
    // ---- 立ち絵：七瀬あかり（膝上・正面やや右向き・全差分で同じポーズ/スケール/位置） ----
    akari_normal: sprite('akari', 'normal', 'あかり（通常）', '穏やかな自然な表情。両手でノートを胸の前に持つ基本ポーズ。'),
    akari_smile: sprite('akari', 'smile', 'あかり（笑顔）', '目を細めた明るい笑顔。'),
    akari_happy: sprite('akari', 'happy', 'あかり（大喜び）', '満面の笑みで小さくガッツポーズ（片手は胸の前でノートを持ったまま）。頬がほんのり赤い。'),
    akari_surprised: sprite('akari', 'surprised', 'あかり（驚き）', '目を大きく見開き、口を小さく開けて驚く。'),
    akari_troubled: sprite('akari', 'troubled', 'あかり（困り顔）', '眉を下げた困り顔、苦笑い。汗マーク程度の軽いコミカルさ。'),
    akari_thinking: sprite('akari', 'thinking', 'あかり（考え中）', '視線を斜め上に向け、ペンを顎に当てて考える。'),
    akari_sad: sprite('akari', 'sad', 'あかり（落ち込み）', 'うつむき気味で目が潤んでいる。涙はこぼれていない程度。'),
    akari_blush: sprite('akari', 'blush', 'あかり（照れ）', '頬を赤らめ、視線を少しそらして照れる。'),
    akari_determined: sprite('akari', 'determined', 'あかり（やる気）', 'きりっとした決意の表情、拳を軽く握る。'),

    // ---- 立ち絵：氷室レン（膝上・正面やや左向き・全差分で同じポーズ/スケール/位置） ----
    ren_normal: sprite('ren', 'normal', 'レン（通常）', 'クールで落ち着いた無表情寄りの表情。片手をスラックスのポケットに入れた基本ポーズ。'),
    ren_smile: sprite('ren', 'smile', 'レン（微笑み）', '口元だけでふっと笑う優しい微笑み。'),
    ren_explain: sprite('ren', 'explain', 'レン（解説）', 'ホワイトボード用マーカーを持ち、人差し指を軽く立てて説明する。'),
    ren_serious: sprite('ren', 'serious', 'レン（真剣）', '目を少し細めた真剣な表情。'),
    ren_smirk: sprite('ren', 'smirk', 'レン（からかい）', '片方の口角を上げた、少しいたずらっぽい笑み。'),
    ren_surprised: sprite('ren', 'surprised', 'レン（驚き）', '目をわずかに見開いた、控えめな驚き。'),
    ren_impressed: sprite('ren', 'impressed', 'レン（感心）', '腕を組み、感心したように小さくうなずく。'),
    ren_thinking: sprite('ren', 'thinking', 'レン（思案）', '眼鏡のブリッジに指を添えて考える。'),

    // ---- 顔アイコン（チャット・名前欄用、正方形のバストアップ） ----
    face_akari: { path: F + 'face_akari.png', kind: 'face', char: 'akari', w: 1024, h: 1024, alpha: false, label: 'あかり（アイコン）', desc: 'あかりの笑顔のバストアップ。淡いピンクの単色背景。' },
    face_ren: { path: F + 'face_ren.png', kind: 'face', char: 'ren', w: 1024, h: 1024, alpha: false, label: 'レン（アイコン）', desc: 'レンの微笑みのバストアップ。淡いブルーの単色背景。' },

    // ---- 背景（人物なし・16:9 でトリミングされても成立する構図） ----
    bg_office_day: bg('bg_office_day', 'オフィス（昼）', '🏢', 'linear-gradient(180deg,#cfe6ff 0%,#eef6ff 55%,#e3ddd0 100%)',
      '明るいモダンなIT企業のオフィス。窓から秋の日差し、観葉植物、デュアルモニターのデスクが並ぶ。'),
    bg_office_night: bg('bg_office_night', 'オフィス（夜）', '🌃', 'linear-gradient(180deg,#0f1a33 0%,#1d2b4f 60%,#3a3550 100%)',
      '夜のオフィス。ほとんど消灯し、1つのデスクだけデスクライトとモニターの光。窓の外に街の夜景。'),
    bg_meeting_room: bg('bg_meeting_room', '会議室', '🧑‍🏫', 'linear-gradient(180deg,#f4f1ea 0%,#ffffff 50%,#d9e4f2 100%)',
      'ガラス張りの小会議室。大きなホワイトボード（アーキテクチャ図の落書き風、文字は判読不能）と大型モニター、長机。'),
    bg_lab: bg('bg_lab', '検証ラボ', '🖥️', 'linear-gradient(180deg,#0e2233 0%,#123b4f 55%,#1d5a6b 100%)',
      '社内のクラウド検証ルーム。複数のモニターにダッシュボードやターミナル風の画面（文字は判読不能）。青緑の間接照明。'),
    bg_cafe: bg('bg_cafe', 'カフェラウンジ', '☕', 'linear-gradient(180deg,#f3e3cf 0%,#fff6ea 55%,#d8b894 100%)',
      '社内のカフェラウンジ。木目のテーブル、コーヒーマシン、窓際のカウンター席。'),
    bg_rooftop_evening: bg('bg_rooftop_evening', '屋上（夕暮れ）', '🌇', 'linear-gradient(180deg,#ff9a6b 0%,#ffc58f 45%,#6d5a8c 100%)',
      'オフィスビルの屋上。フェンス越しに夕焼けのビル街、オレンジから紫のグラデーションの空。'),
    bg_home_night: bg('bg_home_night', 'あかりの部屋（夜）', '🏠', 'linear-gradient(180deg,#2a2440 0%,#3f3560 60%,#f0c98a 100%)',
      'あかりのワンルーム。机にノートPCと参考書と付箋、デスクライト、窓の外は夜。可愛らしいが落ち着いたインテリア。'),
    bg_station_morning: bg('bg_station_morning', '駅前（朝）', '🚉', 'linear-gradient(180deg,#bfe3ff 0%,#eaf6ff 55%,#c9d6c3 100%)',
      '朝の駅前ロータリー。澄んだ秋の青空、街路樹が少し色づいている。'),
    bg_test_center: bg('bg_test_center', 'テストセンター前', '📝', 'linear-gradient(180deg,#dfe7f1 0%,#f7f9fc 55%,#b9c6d6 100%)',
      '試験会場が入るオフィスビルのエントランス（架空・ロゴや看板の文字なし）。整然とした落ち着いた雰囲気。'),
    bg_park_autumn: bg('bg_park_autumn', '紅葉の公園（夕方）', '🍁', 'linear-gradient(180deg,#ffb36b 0%,#ffd9a0 45%,#b5603a 100%)',
      '夕方の公園の並木道。紅葉したイチョウとモミジ、落ち葉の道、柔らかな逆光。'),

    // ---- イベントCG（二人が描かれる場面。ロゴ・判読できる文字は入れない） ----
    cg_title: cg('cg_title', 'タイトル', '✨', 'radial-gradient(120% 120% at 70% 20%,#ffd1c2 0%,#9fc3ff 45%,#1f2a44 100%)',
      'タイトル用キービジュアル。夕方のオフィスの窓際で、ホワイトボードの前に立つレンと、ノートを抱えて振り向くあかり。背後に光るクラウドの抽象的なネットワーク図（ロゴなし）。画面右側1/3にタイトル文字を重ねるための余白。'),
    cg_prologue_result: cg('cg_prologue_result', '不合格通知', '💧', 'linear-gradient(180deg,#1a2442 0%,#2c3a63 60%,#4b3f5f 100%)',
      '夜のオフィスで、ノートPCの画面（文字は判読不能）を見つめて肩を落とすあかり。目が潤んでいる。画面の光が顔を照らす。'),
    cg_whiteboard_lecture: cg('cg_whiteboard_lecture', 'ホワイトボード講義', '🧑‍🏫', 'linear-gradient(180deg,#eef3fb 0%,#ffffff 55%,#d9e4f2 100%)',
      '会議室でホワイトボードにアーキテクチャ図（四角と矢印のみ）を描きながら振り返って説明するレン。手前でノートを取りながら目を輝かせるあかり。'),
    cg_late_night_study: cg('cg_late_night_study', '夜の自習', '🌙', 'linear-gradient(180deg,#141d36 0%,#24345e 60%,#f0c98a 100%)',
      '夜のオフィス、デスクライトの下で並んでノートPCに向かう二人。あかりが問題集を指差して質問し、レンが少し身をかがめて画面を見る。湯気の立つコーヒー2つ。'),
    cg_rooftop_talk: cg('cg_rooftop_talk', '屋上での会話', '🌇', 'linear-gradient(180deg,#ff9a6b 0%,#ffc58f 45%,#6d5a8c 100%)',
      '夕焼けの屋上でフェンスにもたれて話す二人。缶コーヒーを持つレンと、照れくさそうに笑うあかり。逆光で温かい雰囲気。'),
    cg_handson_lab: cg('cg_handson_lab', 'ハンズオン', '🖥️', 'linear-gradient(180deg,#0e2233 0%,#123b4f 55%,#1d5a6b 100%)',
      '検証ラボで、キーボードを打つあかりの後ろから、レンがモニターを指差してアドバイスしている。モニターには図やグラフ風の画面（文字は判読不能）。'),
    cg_exam_morning: cg('cg_exam_morning', '試験当日の朝', '🌅', 'linear-gradient(180deg,#bfe3ff 0%,#eaf6ff 55%,#ffd9a0 100%)',
      '試験当日の朝、駅前で深呼吸して前を向くあかり。手にスマートフォン（画面は見えない）と付箋だらけのノート。決意の表情。'),
    cg_pass_celebration: cg('cg_pass_celebration', '合格', '🎉', 'radial-gradient(120% 120% at 50% 30%,#fff3c4 0%,#ffc2a8 45%,#ff8fa3 100%)',
      'オフィスで、スマートフォンを両手で掲げて満面の笑みのあかりと、その横で微笑んで小さく拍手するレン。紙吹雪のような光。画面の文字は判読不能。'),
    cg_ending: cg('cg_ending', 'エンディング', '🍁', 'linear-gradient(180deg,#ffb36b 0%,#ffd9a0 45%,#b5603a 100%)',
      'トゥルーエンド。夕方の紅葉の並木道を並んで歩く二人の後ろ姿〜斜め後ろ。あかりがレンを見上げて笑い、レンも優しく見下ろす。落ち葉が舞う。'),
    cg_retry_end: cg('cg_retry_end', 'リトライエンド', '🔁', 'linear-gradient(180deg,#2a2440 0%,#3f3560 60%,#f0c98a 100%)',
      '夜の自室で、付箋だらけの参考書を前に、ハチマキ代わりのヘアバンドを締めて気合を入れ直すあかり。机の端にレンから借りたメモ。前向きで明るい表情。')
  };
})();
