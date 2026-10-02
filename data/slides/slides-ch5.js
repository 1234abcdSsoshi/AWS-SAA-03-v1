// 講義スライド：第5章 コスト最適化①（ストレージとコンピューティング）
(function () {
  'use strict';
  SAA.registerSlides([
    {
      id: 'ch5-s3-classes', chapter: 'ch5',
      title: 'S3 ストレージクラス一覧',
      layout: 'table',
      lead: '倉庫にたとえると、手前の棚ほど保管料が高く取り出しが速い。奥の棚ほど保管料が安く、取り出しに時間とお金がかかる。',
      columns: ['クラス', '取り出し', '最小保存期間', 'こんなデータに'],
      rows: [
        ['Standard', 'ミリ秒', 'なし', '頻繁にアクセス'],
        ['Intelligent-Tiering', 'ミリ秒（アーカイブ階層は除く）', 'なし', '**パターンが不明・変化**（取り出し料金なし）'],
        ['Standard-IA', 'ミリ秒（取り出し料金あり）', '30日', 'まれだがすぐ必要'],
        ['One Zone-IA', 'ミリ秒（取り出し料金あり）', '30日', '**再作成できる**データ（1 AZ）'],
        ['Glacier Instant Retrieval', 'ミリ秒', '90日', '四半期に1回程度'],
        ['Glacier Flexible Retrieval', '数分〜数時間', '90日', '年に数回、待てる'],
        ['Glacier Deep Archive', '12時間以内（大容量は48時間）', '180日', '**長期保管・最安**']
      ],
      note: 'IA 系と Glacier Instant Retrieval は **128 KB の最小課金サイズ**がある。小さくて短命なオブジェクトは Standard のままが安い。',
      keywords: ['S3 ストレージクラス', 'Intelligent-Tiering', 'Standard-IA', 'Glacier', 'Deep Archive']
    },
    {
      id: 'ch5-lifecycle', chapter: 'ch5',
      title: 'ライフサイクルルール設計のコツ',
      layout: 'flow',
      lead: 'データの一生に合わせて、自動で棚を移していく。',
      steps: [
        { title: '作成：Standard', body: '作成直後はよく使う。' },
        { title: '30日後：Standard-IA', body: 'IA 系への移行は**作成後30日以上**から。' },
        { title: '90日後：Glacier Flexible Retrieval', body: 'IA の最小保存期間（30日）を考え、IA への移行から**30日以上**あけて移行。' },
        { title: '1年後：Glacier Deep Archive', body: '長期保管はいちばん奥の棚へ。' },
        { title: '7年後：削除（有効期限）', body: '保管義務が終わったら自動で削除。' }
      ],
      note: '注意点：①最小保存期間より前に移行・削除すると残り期間分も課金 ②**128 KB 未満のオブジェクトは既定で移行されない** ③**非現行バージョン**と**不完全なマルチパートアップロード**も削除ルールで掃除する。',
      keywords: ['ライフサイクルルール', '有効期限', '最小保存期間', '非現行バージョン', 'マルチパートアップロード']
    },
    {
      id: 'ch5-ebs-cost', chapter: 'ch5',
      title: 'EBS とスナップショットのコスト最適化',
      layout: 'bullets',
      bullets: [
        '**gp2 → gp3**：GiB 単価が約20%安く、ベースライン 3,000 IOPS・125 MiB/s。性能は容量と独立に必要な分だけ',
        '**未アタッチのボリューム**を削除（インスタンスを止めても・消しても、ボリュームの料金は続く）',
        '**過剰な IOPS／サイズ**を見直す（Compute Optimizer は EBS の推奨も出す）',
        '**Amazon Data Lifecycle Manager**：スナップショットの作成・保持・削除を自動化',
        '**スナップショットアーカイブ**：めったに使わない長期保管を最大75%削減（最低90日、復元に24〜72時間）',
        '**ごみ箱**：誤って削除したスナップショットや AMI を復旧（保持期間中も料金はかかる）'
      ],
      note: 'EBS の料金は「プロビジョニングした量」に対して発生する。**使っていなくても、確保している限り払い続ける**のが EBS。',
      keywords: ['EBS', 'gp3', 'Data Lifecycle Manager', 'スナップショットアーカイブ', '未アタッチ']
    },
    {
      id: 'ch5-purchase-options', chapter: 'ch5',
      title: 'EC2 購入オプション比較',
      layout: 'table',
      lead: '電車の切符にたとえると、当日券＝オンデマンド、定期券＝Savings Plans／RI、空席待ち＝スポット。',
      columns: ['オプション', '割引の目安', 'コミット', '向いているもの'],
      rows: [
        ['オンデマンド', 'なし', 'なし', '短期・予測不能・中断不可'],
        ['Savings Plans', '最大72%', '1/3年・$/時', '安定した使用量（柔軟）'],
        ['リザーブドインスタンス', '最大72%', '1/3年・インスタンス属性', '安定した使用量（ゾーン RI は容量予約付き）'],
        ['スポット', '最大90%', 'なし（2分前通知で中断）', '中断 OK・ステートレス・柔軟'],
        ['Dedicated Hosts', '—（RI/SP で割引可）', '任意', '**ソケット/コア単位の BYOL**、コンプライアンス'],
        ['Dedicated Instances', '—', '任意', 'ハードウェアを他アカウントと共有しない'],
        ['オンデマンドキャパシティ予約', 'なし（SP/RI と併用で割引）', 'なし', '特定 AZ の**容量確保**']
      ],
      note: '常時稼働の土台は Savings Plans／RI、変動分はオンデマンド、中断に強い処理はスポット——を**組み合わせる**のが基本。',
      keywords: ['オンデマンド', 'Savings Plans', 'リザーブドインスタンス', 'スポット', 'Dedicated Hosts']
    },
    {
      id: 'ch5-savings-plans', chapter: 'ch5',
      title: 'Savings Plans と RI の違い',
      layout: 'compare',
      items: [
        { title: 'Compute Savings Plans', tag: '柔軟性 最大', body: 'リージョン・ファミリー・サイズ・OS を問わず EC2 に適用。**Fargate と Lambda にも適用**。' },
        { title: 'EC2 Instance Savings Plans', tag: '割引 最大', body: '**特定リージョンの特定ファミリー**に適用。その中ならサイズ・OS・テナンシーは変更可。' },
        { title: 'スタンダード RI', tag: '割引 大', body: 'インスタンス属性を指定。ゾーン RI は**容量予約**付き。マーケットプレイスで売却可。' },
        { title: 'コンバーティブル RI', tag: '交換可能', body: '期間中に別のファミリー・OS などへ**交換**できる。割引はスタンダードより小さい。' }
      ],
      note: '「ファミリーを変える・Fargate/Lambda へ移る予定」→ Compute SP。「何も変えない」→ EC2 Instance SP。「特定 AZ で容量を確保」→ ゾーン RI（またはキャパシティ予約）。',
      keywords: ['Compute Savings Plans', 'EC2 Instance Savings Plans', 'スタンダード RI', 'コンバーティブル RI', '容量予約']
    },
    {
      id: 'ch5-cost-tools', chapter: 'ch5',
      title: 'コスト管理ツール',
      layout: 'table',
      columns: ['ツール', 'できること'],
      rows: [
        ['AWS Cost Explorer', 'コストと使用量の**可視化・分析・予測**、RI/SP の推奨'],
        ['AWS Budgets', '予算を設定し**しきい値で通知**、予算アクションで自動対応'],
        ['Cost Anomaly Detection', '機械学習で**異常な支出**を検知して通知'],
        ['Data Exports（CUR）', '最も詳細なコスト・使用量データを S3 に出力し、Athena などで分析'],
        ['AWS Compute Optimizer', 'EC2・EBS・Lambda などの**ライトサイジング**推奨'],
        ['AWS Trusted Advisor', 'コスト・セキュリティ・性能などのベストプラクティスチェック'],
        ['コスト配分タグ', 'タグごと（部門・プロジェクト）にコストを集計']
      ],
      note: '「どれくらい使った？」→ Cost Explorer、「超えたら知らせて」→ Budgets、「いつもと違う」→ Anomaly Detection、「何に変える？」→ Compute Optimizer。',
      keywords: ['Cost Explorer', 'AWS Budgets', 'Cost Anomaly Detection', 'Compute Optimizer', 'コスト配分タグ']
    }
  ]);
})();
