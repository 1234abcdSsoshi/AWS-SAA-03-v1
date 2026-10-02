/* BGM・効果音のカタログ（すべて Web Audio API でリアルタイム合成する。音声ファイルは使わない） */
(function () {
  'use strict';

  SAA.data.audioCatalog = {
    bgm: [
      { id: 'title', title: 'Cloud Nine Lesson', mood: '明るく希望に満ちたポップ。キラキラしたベルとピアノ、軽快なドラム', bpm: 112, key: 'D major', use: 'タイトル画面' },
      { id: 'daily', title: 'Office Daylight', mood: '穏やかなローファイ／ボサノバ風。エレピのセブンスコード、柔らかいベース', bpm: 88, key: 'F major', use: 'オフィスの日常会話' },
      { id: 'lecture', title: 'Whiteboard Theory', mood: '知的で落ち着いた。プラックのアルペジオとパッド、控えめなリズム', bpm: 92, key: 'G major', use: '講義・解説' },
      { id: 'quiz', title: 'Think Fast', mood: '集中・軽い緊張感。刻むベースとシンセのアルペジオ、ハイハット', bpm: 120, key: 'A minor', use: 'クイズ・問題演習' },
      { id: 'handson', title: 'Deploy!', mood: 'テック系アップビート。シンセアルペジオと四つ打ち気味のキック', bpm: 128, key: 'E minor', use: 'ハンズオンラボ' },
      { id: 'night', title: 'Midnight Commit', mood: 'しっとり切ない。ピアノ風の単音メロディとパッド、リズムなし〜ごく軽く', bpm: 72, key: 'Eb major', use: '夜のオフィス・感情的なシーン' },
      { id: 'exam', title: 'Exam Day', mood: 'シリアスで決意に満ちた。低音のパルスとストリングス風パッド、高揚するビルドアップ', bpm: 100, key: 'C minor', use: '模擬試験・本番' },
      { id: 'victory', title: 'Passed!', mood: '勝利のファンファーレから軽快なループへ。ブラス風リード', bpm: 132, key: 'C major', use: '合格・リザルト' },
      { id: 'ending', title: 'Beyond the Cloud', mood: '温かく感動的。ピアノとパッド、ゆったりしたベル', bpm: 80, key: 'D major', use: 'エンディング' }
    ],
    sfx: [
      { id: 'click', title: 'クリック' },
      { id: 'hover', title: 'ホバー' },
      { id: 'advance', title: 'テキスト送り' },
      { id: 'type', title: '文字表示（ごく小さく）' },
      { id: 'open', title: 'パネルを開く' },
      { id: 'close', title: 'パネルを閉じる' },
      { id: 'select', title: '選択' },
      { id: 'correct', title: '正解' },
      { id: 'incorrect', title: '不正解' },
      { id: 'combo', title: '連続正解' },
      { id: 'chapter_start', title: '章タイトル' },
      { id: 'chapter_clear', title: '章クリア' },
      { id: 'fanfare', title: 'ファンファーレ' },
      { id: 'drumroll', title: 'ドラムロール' },
      { id: 'stamp', title: '合格スタンプ' },
      { id: 'fail', title: '残念' },
      { id: 'notify', title: '通知' },
      { id: 'send', title: '送信' },
      { id: 'memo', title: 'メモ保存' },
      { id: 'page', title: 'スライドめくり' },
      { id: 'whoosh', title: '場面転換' },
      { id: 'shock', title: '衝撃' },
      { id: 'sparkle', title: 'キラキラ' },
      { id: 'heart', title: 'ドキッ' },
      { id: 'tick', title: 'タイマー' },
      { id: 'alarm', title: '残り時間警告' },
      { id: 'key', title: 'キー入力' },
      { id: 'enter', title: 'エンター' },
      { id: 'success', title: 'デプロイ成功' },
      { id: 'error', title: 'エラー' },
      { id: 'door', title: 'ドア' },
      { id: 'phone', title: 'スマホ通知' },
      { id: 'chime', title: 'チャイム' },
      { id: 'footsteps', title: '足音' }
    ]
  };
})();
