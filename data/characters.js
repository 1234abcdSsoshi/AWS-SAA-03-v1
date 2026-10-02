/* 登場人物と表情・汎用リアクション台詞 */
(function () {
  'use strict';

  SAA.data.characters = {
    akari: {
      id: 'akari',
      name: '七瀬 あかり',
      short: 'あかり',
      reading: 'ななせ あかり',
      color: '#ff8fa3',
      side: 'left',
      defaultFace: 'normal',
      faces: {
        normal: '通常', smile: '笑顔', happy: '大喜び', surprised: '驚き', troubled: '困り顔',
        thinking: '考え中', sad: '落ち込み', blush: '照れ', determined: 'やる気'
      },
      profile: '入社2年目のインフラエンジニア（株式会社スカイブリッジ・インフラチーム）。24歳。明るく素直な努力家で、ちょっとおっちょこちょい。SAA-C03 に「あと一歩」で不合格。セキュリティと可用性は得意だが、性能とコストの「最も〜」問題で迷いがち。'
    },
    ren: {
      id: 'ren',
      name: '氷室 レン',
      short: 'レン',
      reading: 'ひむろ れん',
      color: '#3a7bd5',
      side: 'right',
      defaultFace: 'normal',
      faces: {
        normal: '通常', smile: '微笑み', explain: '解説', serious: '真剣', smirk: 'からかい',
        surprised: '驚き', impressed: '感心', thinking: '思案'
      },
      profile: 'アーキテクチャ推進室のシニアクラウドアーキテクト兼・社内テクニカルインストラクター（TI）。29歳。AWS 認定全冠。落ち着いていて論理的、例え話が上手。クールだが面倒見がよく、努力をきちんと褒める。'
    }
  };

  // 問題回答後などに使う汎用リアクション（問題個別の onCorrect / onWrong が無い場合に使用）
  SAA.data.reactions = {
    correct: {
      ren: [
        { face: 'smile', text: '正解だ。要件をちゃんと拾えていたな。' },
        { face: 'impressed', text: 'いいぞ。その判断の軸を忘れるな。' },
        { face: 'smile', text: 'よく考えたな。本番でも同じ手順で読めばいい。' },
        { face: 'normal', text: '正解。……ふっ、及第点どころか満点だ。' },
        { face: 'impressed', text: '迷わず選べたなら本物だ。次も行くぞ。' }
      ],
      akari: [
        { face: 'happy', text: 'やった！ 当たりました！' },
        { face: 'smile', text: 'キーワード、ちゃんと見えました！' },
        { face: 'determined', text: 'この調子でいきます！' }
      ]
    },
    wrong: {
      ren: [
        { face: 'serious', text: '惜しい。問題文の制約をもう一度読んでみろ。答えはそこにある。' },
        { face: 'explain', text: '間違えた問題こそ伸びしろだ。解説で「なぜ他がダメか」まで押さえておけ。' },
        { face: 'normal', text: '焦るな。要件を一つずつ満たしているか、選択肢ごとに確かめるんだ。' },
        { face: 'smile', text: '今ここで間違えておけば、本番では間違えない。それで十分だ。' },
        { face: 'explain', text: '「最も」が付いたら比較の軸を決めろ。コストか、運用負荷か、性能か。' }
      ],
      akari: [
        { face: 'troubled', text: 'うう……また引っかかりました……。' },
        { face: 'sad', text: 'そっちだったかぁ……。' },
        { face: 'thinking', text: 'なるほど、そこが決め手なんですね……メモしておきます。' }
      ]
    },
    streak: {
      ren: [
        { face: 'impressed', text: '連続正解か。流れが来てるな。' },
        { face: 'smile', text: 'その集中力、本番まで取っておけよ。' }
      ]
    }
  };
})();
