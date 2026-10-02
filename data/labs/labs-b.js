// ハンズオンラボ（第4〜6章）
(function () {
  'use strict';
  SAA.registerLabs([
    // ------------------------------------------------------------------
    {
      id: 'lab-dynamodb-capacity', chapter: 'ch4', domain: 3, task: '3.3',
      title: 'DynamoDB キャパシティ計算ラボ',
      summary: 'RCU・WCU の計算ルール（4 KB／1 KB 単位の切り上げ、整合性、トランザクション）を手を動かして身につけます。',
      difficulty: 2, estMinutes: 10,
      scenario: 'ゲームのプレイヤーデータを DynamoDB（プロビジョンドキャパシティモード）に保存します。必要な読み取り・書き込みキャパシティを計算しましょう。\n\n**計算ルール**\n- 1 RCU ＝ **4 KB まで**の項目を、**強力な整合性**で毎秒1回読み取る（結果整合性なら毎秒2回）\n- 1 WCU ＝ **1 KB まで**の項目を毎秒1回書き込む\n- サイズは単位ごとに**切り上げ**。トランザクションは**2倍**のキャパシティを消費',
      steps: [
        {
          type: 'calc',
          title: '読み取りキャパシティ（RCU）',
          prompt: '1項目のサイズは **6 KB**。ピーク時に毎秒 **400 回**読み取る。必要な RCU は？',
          fields: [
            { id: 'strong', label: '強力な整合性で読み取る場合', unit: 'RCU', answer: 800, tolerance: 0 },
            { id: 'eventual', label: '結果整合性で読み取る場合', unit: 'RCU', answer: 400, tolerance: 0 }
          ],
          hint: '6 KB は 4 KB 単位でいくつ分？（切り上げ）',
          formula: '1回あたりの RCU ＝ ⌈6 ÷ 4⌉ ＝ 2。強力な整合性：2 × 400、結果整合性：その半分',
          explain: '6 KB ÷ 4 KB ＝ 1.5 → **切り上げて 2 RCU**。強力な整合性：2 × 400 ＝ **800 RCU**。結果整合性は半分で **400 RCU**。整合性の要件がゆるければ、読み取りコストは半分になる。'
        },
        {
          type: 'calc',
          title: '書き込みキャパシティ（WCU）',
          prompt: '1項目のサイズは **2.5 KB**。毎秒 **150 回**書き込む。必要な WCU は？',
          fields: [
            { id: 'normal', label: '通常の書き込み', unit: 'WCU', answer: 450, tolerance: 0 },
            { id: 'tx', label: 'すべてトランザクション書き込みの場合', unit: 'WCU', answer: 900, tolerance: 0 }
          ],
          hint: '2.5 KB は 1 KB 単位でいくつ分？（切り上げ）',
          formula: '1回あたりの WCU ＝ ⌈2.5 ÷ 1⌉ ＝ 3。通常：3 × 150、トランザクション：その2倍',
          explain: '2.5 KB → **切り上げて 3 WCU**。通常：3 × 150 ＝ **450 WCU**。トランザクション（TransactWriteItems）は2倍で **900 WCU**。'
        },
        {
          type: 'choice',
          title: 'さらに速くするには？',
          prompt: 'ランキング画面の表示で同じ項目が繰り返し読まれ、応答時間を**マイクロ秒**にしたい。アプリの変更を最小限にするなら？',
          options: [
            'DynamoDB Accelerator（DAX）を導入し、DAX クライアントで読み取る',
            'RCU を2倍にプロビジョニングする',
            'グローバルセカンダリインデックスを追加する',
            'オンデマンドキャパシティモードに切り替える'
          ],
          answer: [0],
          explain: 'キャパシティを増やしても1回の応答時間は1桁ミリ秒のまま。**マイクロ秒**は DynamoDB 専用インメモリキャッシュの **DAX** の領域で、API 互換なのでアプリの変更も小さい。'
        }
      ],
      debrief: '**ポイントの整理**\n- RCU：4 KB 単位で切り上げ、強力な整合性は1倍・結果整合性は0.5倍\n- WCU：1 KB 単位で切り上げ\n- トランザクションは読み書きとも2倍\n- 「マイクロ秒」→ DAX'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-global-network', chapter: 'ch4', domain: 3, task: '3.4',
      title: 'グローバル配信アーキテクチャラボ',
      summary: 'CloudFront・Global Accelerator・Route 53 を使い分けて、世界中のプレイヤー向けの配信構成を組み立て、CLI でキャッシュを無効化します。',
      difficulty: 3, estMinutes: 12,
      scenario: '世界展開するオンラインゲームの配信基盤を設計します。\n- 画像・動画などの静的アセットを世界中に低レイテンシーで配信し、**S3 は直接公開しない**\n- 対戦サーバーは **UDP**。プレイヤーの接続先 **IP アドレスは固定**、リージョン障害時は**数十秒で切り替え**\n- REST API（HTTPS）は東京・フランクフルト・オレゴンにあり、**最も遅延の小さいリージョン**へ DNS で振り分ける',
      steps: [
        {
          type: 'slots',
          title: '配信構成を組み立てよう',
          prompt: '各スロットに最適なサービス・機能を配置しよう。',
          zones: [
            { id: 'edge', label: 'エッジ（世界中のプレイヤーの近く）', kind: 'edge' },
            { id: 'dns', label: 'DNS', kind: 'aws' },
            { id: 'region', label: 'AWS リージョン', kind: 'region' }
          ],
          palette: [
            { id: 'cf', label: 'Amazon CloudFront', icon: '🌐' },
            { id: 'oac', label: 'オリジンアクセスコントロール（OAC）', icon: '🔐' },
            { id: 'ga', label: 'AWS Global Accelerator', icon: '🚀' },
            { id: 'nlb', label: 'Network Load Balancer', icon: '🔀' },
            { id: 'alb', label: 'Application Load Balancer', icon: '⚖️' },
            { id: 'r53lat', label: 'Route 53 レイテンシーベースルーティング', icon: '⏱️' },
            { id: 'r53geo', label: 'Route 53 位置情報ルーティング', icon: '🗺️' },
            { id: 's3ta', label: 'S3 Transfer Acceleration', icon: '📤' }
          ],
          slots: [
            { id: 's1', zone: 'edge', label: '静的アセットをエッジでキャッシュして配信', answer: ['cf'], explain: 'CloudFront がエッジでキャッシュし、プレイヤーの近くから配信する。' },
            { id: 's2', zone: 'edge', label: 'S3 を非公開のまま、CloudFront 経由のアクセスだけを許可', answer: ['oac'], explain: 'OAC とバケットポリシーで、CloudFront（このディストリビューション）からのアクセスだけを許可する。' },
            { id: 's3', zone: 'edge', label: 'UDP の対戦通信を固定 IP で受け、AWS のネットワークに乗せる', answer: ['ga'], explain: 'Global Accelerator は2つの静的エニーキャスト IP を持ち、TCP/UDP をサポート。ヘルスチェックで数十秒以内に切り替わる。' },
            { id: 's4', zone: 'region', label: 'リージョン内で UDP を受けて対戦サーバーへ分散', answer: ['nlb'], explain: 'UDP を扱えるのは L4 の NLB。Global Accelerator のエンドポイントに登録する。' },
            { id: 's5', zone: 'dns', label: 'REST API を最も遅延の小さいリージョンへ振り分け', answer: ['r53lat'], explain: '計測されたレイテンシーに基づいて最速のリージョンを返す。' }
          ],
          feedback: {
            alb: 'ALB は HTTP/HTTPS（L7）のロードバランサーで、UDP は扱えない。',
            r53geo: '位置情報ルーティングは国・地域で決める方式（規制やローカライズ向け）。「最も速い」ならレイテンシーベース。',
            s3ta: 'Transfer Acceleration は S3 への転送（主にアップロード）を速める機能で、配信用のキャッシュではない。'
          }
        },
        {
          type: 'terminal',
          title: 'キャッシュを無効化しよう',
          prompt: '画像を差し替えたので、ディストリビューション **E2ABCDEF123456** のキャッシュから `/images/` 配下をすべて無効化しよう。',
          tasks: [
            {
              instruction: 'ディストリビューション E2ABCDEF123456 で、パス /images/* のキャッシュ無効化を作成してください。',
              match: {
                all: ['aws cloudfront create-invalidation', '--distribution-id e2abcdef123456', '--paths'],
                any: [['/images/*']]
              },
              output: '{\n    "Location": "https://cloudfront.amazonaws.com/2020-05-31/distribution/E2ABCDEF123456/invalidation/I2J0I21PCUYOIK",\n    "Invalidation": {\n        "Id": "I2J0I21PCUYOIK",\n        "Status": "InProgress",\n        "CreateTime": "2026-10-08T10:15:00.000Z",\n        "InvalidationBatch": {\n            "Paths": { "Quantity": 1, "Items": ["/images/*"] },\n            "CallerReference": "cli-1791454500"\n        }\n    }\n}',
              hint: 'aws cloudfront create-invalidation --distribution-id <ID> --paths "<パス>" の形です。ワイルドカード * が使えます。',
              answer: 'aws cloudfront create-invalidation --distribution-id E2ABCDEF123456 --paths "/images/*"',
              explain: '無効化はパス単位で、ワイルドカードも使える（無効化パスの数に応じて料金がかかる場合がある）。頻繁に更新するファイルは、ファイル名にバージョンを付ける（例：logo.v2.png）方式も有効。'
            }
          ]
        }
      ],
      debrief: '**ポイントの整理**\n- 静的コンテンツのキャッシュ配信 → CloudFront（S3 は OAC で保護）\n- 固定 IP・TCP/UDP・高速フェイルオーバー → Global Accelerator（＋NLB）\n- 最速のリージョンへ DNS で → Route 53 レイテンシーベース\n- 同じ「エッジ」でも、CloudFront はキャッシュ、Global Accelerator は経路の高速化'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-kinesis-pipeline', chapter: 'ch4', domain: 3, task: '3.5',
      title: 'ストリーミング分析パイプラインラボ',
      summary: 'Kinesis のシャード数を計算し、リアルタイム分析から S3 データレイク・Athena までのパイプラインを組み立てます。',
      difficulty: 3, estMinutes: 12,
      scenario: '工場の IoT センサーから、毎秒 **4,000 レコード**（1件あたり平均 **0.5 KB**）のデータが届きます。\n- 異常値を**数秒以内**に検知してアラートを出す\n- 生データは**運用負荷なく** S3 に保存し、**Athena で安く速く**分析したい\n\n**シャードの上限**：書き込みは 1シャードあたり **毎秒 1 MB または 1,000 レコード**（どちらか先に達したほう）。',
      steps: [
        {
          type: 'calc',
          title: '必要なシャード数（プロビジョンドモード）',
          prompt: '書き込みに必要なシャード数を、データ量とレコード数の両方から計算しよう（1 MB ＝ 1,000 KB として概算してよい）。',
          fields: [
            { id: 'byMb', label: 'データ量から見たシャード数', unit: 'シャード', answer: 2, tolerance: 0 },
            { id: 'byRec', label: 'レコード数から見たシャード数', unit: 'シャード', answer: 4, tolerance: 0 },
            { id: 'need', label: '必要なシャード数', unit: 'シャード', answer: 4, tolerance: 0 }
          ],
          hint: 'データ量：4,000 × 0.5 KB ＝ ？ KB/秒。レコード数：4,000 ÷ 1,000。必要数は「大きいほう」。',
          formula: 'データ量 ⌈2,000 KB/秒 ÷ 1,000⌉ ＝ 2、レコード数 ⌈4,000 ÷ 1,000⌉ ＝ 4 → max(2, 4) ＝ 4',
          explain: 'データ量は 4,000 × 0.5 KB ＝ 2,000 KB/秒 → **2 シャード**。レコード数は 4,000 ÷ 1,000 → **4 シャード**。上限は「どちらか先に達したほう」なので、**大きいほうの 4 シャード**が必要。小さなレコードが大量に来る場合はレコード数が効く。シャード管理をしたくなければ**オンデマンドモード**も選べる。'
        },
        {
          type: 'slots',
          title: 'パイプラインを組み立てよう',
          prompt: '取り込みから分析までの各スロットに、最適なサービスを配置しよう。',
          zones: [
            { id: 'ingest', label: '取り込み', kind: 'aws' },
            { id: 'process', label: 'リアルタイム処理と配信', kind: 'aws' },
            { id: 'lake', label: 'データレイクと分析', kind: 'aws' }
          ],
          palette: [
            { id: 'kds', label: 'Kinesis Data Streams', icon: '🌊' },
            { id: 'flink', label: 'Managed Service for Apache Flink', icon: '⚡' },
            { id: 'firehose', label: 'Amazon Data Firehose', icon: '🚚' },
            { id: 's3', label: 'Amazon S3（Parquet）', icon: '🪣' },
            { id: 'glue', label: 'AWS Glue Data Catalog', icon: '📚' },
            { id: 'athena', label: 'Amazon Athena', icon: '🔍' },
            { id: 'sqs', label: 'Amazon SQS', icon: '📥' },
            { id: 'rds', label: 'Amazon RDS', icon: '🗄️' }
          ],
          slots: [
            { id: 'p1', zone: 'ingest', label: 'センサーデータを順序付きで取り込み、複数の処理で読む', answer: ['kds'], explain: 'Kinesis Data Streams は複数のコンシューマーが同じデータを読め、順序とリプレイも可能。' },
            { id: 'p2', zone: 'process', label: '数秒以内に異常値をウィンドウ集計で検知', answer: ['flink'], explain: 'ストリームのまま時間ウィンドウで集計・検知できるのは Managed Service for Apache Flink。' },
            { id: 'p3', zone: 'process', label: '運用負荷なく S3 へ配信（Parquet に変換）', answer: ['firehose'], explain: 'Data Firehose はバッファリングして S3 へ自動配信し、Parquet への形式変換もできる。' },
            { id: 'p4', zone: 'lake', label: '列指向形式で保存するデータレイク', answer: ['s3'], explain: 'S3 に Parquet で保存すると、分析時のスキャン量が減る。' },
            { id: 'p5', zone: 'lake', label: 'テーブル定義（スキーマ）を管理する', answer: ['glue'], explain: 'Glue Data Catalog がテーブル定義を持ち、Firehose の形式変換と Athena の両方が参照する。' },
            { id: 'p6', zone: 'lake', label: 'サーバーなしで S3 を SQL 分析', answer: ['athena'], explain: 'Athena はスキャン量課金のサーバーレス SQL。Parquet＋パーティションで速く安くなる。' }
          ],
          feedback: {
            sqs: 'SQS は1つのメッセージを1つのコンシューマーが処理して消す。複数の処理で同じデータを読む用途やリプレイには向かない。',
            rds: '大量のセンサーデータを RDB に入れると、スケールとコストの面で不利。分析は S3＋Athena が定石。'
          }
        }
      ],
      debrief: '**ポイントの整理**\n- シャード数は「データ量」と「レコード数」の**大きいほう**で決まる\n- 取り込み KDS → 分析 Flink → 配信 Firehose（Parquet 変換）→ S3 → Glue Catalog → Athena\n- Athena のコストはスキャン量。列指向＋パーティションで削減'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-s3-lifecycle', chapter: 'ch5', domain: 4, task: '4.1',
      title: 'S3 ライフサイクル・コストラボ',
      summary: 'ログデータのライフサイクルルールを設計して保管コストを半分以下に抑え、CLI で設定します。',
      difficulty: 3, estMinutes: 15,
      scenario: 'アプリケーションのログを S3 に保存しています（現在 **50 TB**、毎月 **5 TB** 増加、平均 **512 KB**/オブジェクト）。\n- 作成後30日間は障害調査で**頻繁に参照**\n- 30日を過ぎるとまれにしか参照しない\n- 監査のため**7年間（2,555日）保管**。監査時は**12時間以内**に取得できればよい\n\n目標：**3年間の保管コストを、すべて S3 Standard に置いた場合と比べて50%以上削減**すること。',
      steps: [
        {
          type: 'sim',
          sim: 's3cost',
          title: 'ライフサイクルルールを設計しよう',
          prompt: '移行のルール（日数とストレージクラス）と有効期限を設定し、コストと制約を確認しよう。まずは Standard-IA だけに移すルールで試してみよう。',
          params: { initialTB: 50, monthlyGrowthTB: 5, months: 36, avgObjectKB: 512, accessNote: '30日間は頻繁に参照、その後はまれ。監査時は12時間以内に取得できればよい。', retrievalRequirement: '12h' },
          goal: { minSavingPct: 50, retrievalRequirement: '12h' },
          reference: { transitions: [{ days: 30, storageClass: 'STANDARD_IA' }, { days: 90, storageClass: 'GLACIER' }, { days: 180, storageClass: 'DEEP_ARCHIVE' }], expirationDays: 2555 },
          explain: 'Standard-IA だけでは約39%の削減にとどまる。「30日→Standard-IA、90日→Glacier Flexible Retrieval、180日→Glacier Deep Archive、2,555日で削除」のように段階的に移すと、12時間以内の取得という要件を満たしたまま50%以上削減できる。料金は学習用の概算値。'
        },
        {
          type: 'terminal',
          title: 'ルールをバケットに設定しよう',
          prompt: '設計したルールを **lifecycle.json** に用意した。バケット **saa-lab-logs** に適用しよう（`cat lifecycle.json` で中身を確認できる）。',
          files: {
            'lifecycle.json': '{\n  "Rules": [\n    {\n      "ID": "logs-archive",\n      "Filter": { "Prefix": "logs/" },\n      "Status": "Enabled",\n      "Transitions": [\n        { "Days": 30, "StorageClass": "STANDARD_IA" },\n        { "Days": 90, "StorageClass": "GLACIER" },\n        { "Days": 180, "StorageClass": "DEEP_ARCHIVE" }\n      ],\n      "Expiration": { "Days": 2555 },\n      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }\n    }\n  ]\n}'
          },
          tasks: [
            {
              instruction: 'lifecycle.json の内容で、バケット saa-lab-logs にライフサイクル設定を適用してください。',
              match: {
                all: ['aws s3api put-bucket-lifecycle-configuration', '--bucket saa-lab-logs', '--lifecycle-configuration', 'file://lifecycle.json']
              },
              output: '',
              hint: 'aws s3api put-bucket-lifecycle-configuration --bucket <バケット名> --lifecycle-configuration file://<ファイル名>',
              answer: 'aws s3api put-bucket-lifecycle-configuration --bucket saa-lab-logs --lifecycle-configuration file://lifecycle.json',
              explain: 'JSON ファイルは file:// で渡す。この設定はバケットのライフサイクル設定全体を**置き換える**ので、既存のルールがあれば含めておくこと。'
            },
            {
              instruction: '適用されたことを確認するため、saa-lab-logs のライフサイクル設定を取得してください。',
              match: { all: ['aws s3api get-bucket-lifecycle-configuration', '--bucket saa-lab-logs'] },
              output: '{\n    "Rules": [\n        {\n            "ID": "logs-archive",\n            "Filter": { "Prefix": "logs/" },\n            "Status": "Enabled",\n            "Transitions": [\n                { "Days": 30, "StorageClass": "STANDARD_IA" },\n                { "Days": 90, "StorageClass": "GLACIER" },\n                { "Days": 180, "StorageClass": "DEEP_ARCHIVE" }\n            ],\n            "Expiration": { "Days": 2555 },\n            "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }\n        }\n    ]\n}',
              hint: 'put を get に変えるだけ。--bucket を指定します。',
              answer: 'aws s3api get-bucket-lifecycle-configuration --bucket saa-lab-logs',
              explain: 'API 上の StorageClass は GLACIER が Glacier Flexible Retrieval、DEEP_ARCHIVE が Glacier Deep Archive。AbortIncompleteMultipartUpload で、途中で失敗したアップロードの残骸も自動で掃除できる。'
            }
          ]
        }
      ],
      debrief: '**ポイントの整理**\n- アクセス頻度の変化に合わせて段階的に移行（Standard → IA → Glacier → Deep Archive → 削除）\n- 取り出し時間の要件で「どこまで奥の棚に置けるか」が決まる（12時間以内 → Deep Archive も可）\n- IA 系は作成後30日以上、最小保存期間と 128 KB の最小課金サイズに注意\n- 不完全なマルチパートアップロードの削除も忘れずに'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-purchase-options', chapter: 'ch5', domain: 4, task: '4.2',
      title: '購入オプション最適化ラボ',
      summary: '6つのワークロードに最適な購入オプションを選び、Savings Plans の年間削減額を計算します。',
      difficulty: 2, estMinutes: 10,
      scenario: '社内の EC2 ワークロードの購入方法を見直します。**要件（中断できるか・何を変える予定か・容量やライセンスの条件）**を満たす中で、最もコスト効率の高い購入オプションを選びましょう。',
      steps: [
        {
          type: 'match',
          title: 'ワークロードと購入オプション',
          prompt: '各ワークロードに最適な購入オプションを選ぼう。',
          left: [
            { id: 'w1', label: '2週間だけのキャンペーンサイト。中断は許されない' },
            { id: 'w2', label: '24時間365日の Web 基盤。来年 Fargate と Lambda への移行を予定' },
            { id: 'w3', label: '3年間、東京リージョンの M ファミリーで稼働し続ける基幹システム' },
            { id: 'w4', label: '特定の AZ で必ず容量を確保したい、1年間常時稼働のシステム' },
            { id: 'w5', label: '夜間の動画エンコード。中断されても再処理できる' },
            { id: 'w6', label: '物理ソケット単位のライセンスを持ち込む商用ソフトウェア' }
          ],
          right: [
            { id: 'od', label: 'オンデマンド' },
            { id: 'csp', label: 'Compute Savings Plans' },
            { id: 'esp', label: 'EC2 Instance Savings Plans' },
            { id: 'zri', label: 'ゾーンのスタンダード RI' },
            { id: 'spot', label: 'スポットインスタンス' },
            { id: 'dh', label: 'Dedicated Hosts' }
          ],
          answer: { w1: 'od', w2: 'csp', w3: 'esp', w4: 'zri', w5: 'spot', w6: 'dh' },
          notes: {
            w1: '短期間で中断不可 → 約束なしのオンデマンド。',
            w2: 'Fargate・Lambda にも適用される → Compute Savings Plans。',
            w3: 'リージョンとファミリーが固定 → 割引の大きい EC2 Instance Savings Plans。',
            w4: '容量予約が付くのはゾーン RI（またはオンデマンドキャパシティ予約）。',
            w5: '中断 OK・ステートレス → スポットで最大90%割引。',
            w6: 'ソケット・コアが見えるのは Dedicated Hosts。'
          },
          explain: '購入オプションは「約束できる範囲」と「中断・容量・ライセンスの条件」で選ぶ。'
        },
        {
          type: 'calc',
          title: '年間の削減額を計算しよう',
          prompt: 'オンデマンド料金 **$0.20/時** のインスタンスを **10台**、**24時間365日（8,760時間）** 稼働させている。Savings Plans で **40%** 割引になった場合の金額は？（学習用の概算値）',
          fields: [
            { id: 'od', label: 'オンデマンドの年間コスト', unit: 'USD', answer: 17520, tolerance: 1 },
            { id: 'save', label: 'Savings Plans による年間削減額', unit: 'USD', answer: 7008, tolerance: 1 }
          ],
          hint: '年間コスト ＝ 単価 × 台数 × 時間。削減額 ＝ 年間コスト × 割引率。',
          formula: '0.20 × 10 × 8,760 ＝ 17,520、17,520 × 0.40 ＝ 7,008',
          explain: '年間コストは 0.20 × 10 × 8,760 ＝ **$17,520**。40% 割引で **$7,008** の削減（支払いは $10,512）。常時稼働の土台をコミットで割り引くだけで、大きな効果がある。'
        }
      ],
      debrief: '**ポイントの整理**\n- 短期・中断不可 → オンデマンド、中断 OK → スポット\n- 常時稼働 → Savings Plans／RI（変化の予定で種類を選ぶ）\n- 容量予約 → ゾーン RI またはキャパシティ予約、ソケット/コア BYOL → Dedicated Hosts'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-db-cost', chapter: 'ch6', domain: 4, task: '4.3',
      title: 'データベースコスト最適化ラボ',
      summary: 'DB ワークロードの性質から最適な料金モデルを選び、DynamoDB のオンデマンドとプロビジョンドの月額を比較します。',
      difficulty: 2, estMinutes: 10,
      scenario: '社内のデータベースの請求額を見直します。ワークロードの**負荷の形（安定・断続的・予測不能）**と、**コストの内訳**に注目しましょう。',
      steps: [
        {
          type: 'match',
          title: 'ワークロードと打ち手',
          prompt: '各ワークロードに最適なコスト最適化の打ち手を選ぼう。',
          left: [
            { id: 'w1', label: '月末の数日だけ負荷が集中する会計システム（Aurora）' },
            { id: 'w2', label: '24時間365日、負荷が安定した受注 DB（RDS、今後も構成変更なし）' },
            { id: 'w3', label: '新規サービスの DynamoDB。トラフィックがまったく予測できない' },
            { id: 'w4', label: '1年分の実績があり、時間帯ごとに予測可能な DynamoDB テーブル' },
            { id: 'w5', label: 'ストレージ料金が大半を占め、古い項目はほとんど読まれない DynamoDB テーブル' }
          ],
          right: [
            { id: 'asv2', label: 'Aurora Serverless v2' },
            { id: 'ri', label: 'リザーブド DB インスタンス' },
            { id: 'ddbod', label: 'DynamoDB オンデマンド' },
            { id: 'ddbprov', label: 'DynamoDB プロビジョンド＋Auto Scaling' },
            { id: 'ddbia', label: 'DynamoDB Standard-IA テーブルクラス' }
          ],
          answer: { w1: 'asv2', w2: 'ri', w3: 'ddbod', w4: 'ddbprov', w5: 'ddbia' },
          notes: {
            w1: '断続的な負荷 → 使った ACU だけ課金の Serverless v2。',
            w2: '常時・安定・変更なし → リザーブドで長期割引。',
            w3: '予測不能・新規 → 計画不要のオンデマンド。',
            w4: '予測可能 → プロビジョンド＋Auto Scaling のほうが安い。',
            w5: 'ストレージ主体 → ストレージ単価の安い Standard-IA テーブルクラス。'
          },
          explain: '同じ DB でも「負荷の形」と「お金がかかっている場所」で打ち手が変わる。'
        },
        {
          type: 'calc',
          title: 'DynamoDB：オンデマンド vs プロビジョンド',
          prompt: '1 KB の項目を、**毎秒200回**、30日間ずっと書き込むテーブルがある（学習用の概算単価）。\n- オンデマンド：書き込み **100万回あたり $0.625**\n- プロビジョンド：**1 WCU あたり $0.00065/時**。余裕を持たせて **250 WCU** をプロビジョニングする\n\nそれぞれの月額（30日＝720時間）は？',
          fields: [
            { id: 'od', label: 'オンデマンドの月額', unit: 'USD', answer: 324, tolerance: 0.5 },
            { id: 'prov', label: 'プロビジョンドの月額', unit: 'USD', answer: 117, tolerance: 0.5 }
          ],
          hint: '1か月の書き込み回数 ＝ 200 × 60 × 60 × 24 × 30。プロビジョンドは WCU × 時間 × 単価。',
          formula: 'オンデマンド：200 × 2,592,000 ＝ 5億1,840万回 → 518.4 × 0.625 ＝ 324。プロビジョンド：250 × 720 × 0.00065 ＝ 117',
          explain: '月の書き込みは 200 × 2,592,000 秒 ＝ 518,400,000 回。オンデマンドは 518.4 × $0.625 ＝ **$324**。プロビジョンドは 250 × 720 × $0.00065 ＝ **$117**。安定した負荷なら、余裕を持たせてもプロビジョンドのほうが大幅に安い。'
        }
      ],
      debrief: '**ポイントの整理**\n- 断続的 → Serverless v2、安定・常時 → リザーブド\n- DynamoDB：予測不能・新規 → オンデマンド、予測可能 → プロビジョンド＋Auto Scaling\n- ストレージ主体 → Standard-IA テーブルクラス、期限切れデータ → TTL（無料）'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-nat-endpoint', chapter: 'ch6', domain: 4, task: '4.4',
      title: 'NAT ゲートウェイ コスト削減ラボ',
      summary: 'NAT ゲートウェイのデータ処理料金を計算し、S3 のゲートウェイ型エンドポイントを作成して、どの通信が NAT に残るかを判定します。',
      difficulty: 3, estMinutes: 12,
      scenario: 'プライベートサブネット（ルートテーブル rtb-0123456789abcdef0、VPC vpc-0a1b2c3d4e5f67890）のバッチサーバーが、毎月 **30 TB** のデータを**同じリージョン（東京）の S3** と送受信しています。この通信はすべて NAT ゲートウェイを経由しています。\n\n学習用の概算単価：NAT ゲートウェイの**データ処理料金 $0.062/GB**（時間料金は別）。',
      steps: [
        {
          type: 'calc',
          title: 'NAT のデータ処理料金はいくら？',
          prompt: '30 TB（1 TB ＝ 1,024 GB として計算）が NAT ゲートウェイを通過した場合の、月あたりのデータ処理料金は？',
          fields: [
            { id: 'cost', label: 'NAT のデータ処理料金', unit: 'USD/月', answer: 1904.64, tolerance: 1 }
          ],
          hint: '30 × 1,024 GB × 単価',
          formula: '30 × 1,024 ＝ 30,720 GB、30,720 × 0.062 ＝ 1,904.64',
          explain: '30,720 GB × $0.062 ＝ **約 $1,905/月**。S3 との通信をゲートウェイ型エンドポイントに切り替えれば、この料金はなくなる（エンドポイント自体も無料、同一リージョンの EC2–S3 間の転送も無料）。'
        },
        {
          type: 'terminal',
          title: 'S3 のゲートウェイ型エンドポイントを作成しよう',
          prompt: 'VPC vpc-0a1b2c3d4e5f67890 に、東京リージョンの S3 用**ゲートウェイ型 VPC エンドポイント**を作成し、ルートテーブル rtb-0123456789abcdef0 に関連付けよう。',
          tasks: [
            {
              instruction: 'S3（com.amazonaws.ap-northeast-1.s3）のゲートウェイ型エンドポイントを作成し、rtb-0123456789abcdef0 に関連付けてください。',
              match: {
                all: ['aws ec2 create-vpc-endpoint', '--vpc-id vpc-0a1b2c3d4e5f67890', '--service-name com.amazonaws.ap-northeast-1.s3', '--route-table-ids rtb-0123456789abcdef0'],
                none: ['interface']
              },
              output: '{\n    "VpcEndpoint": {\n        "VpcEndpointId": "vpce-0f1e2d3c4b5a69788",\n        "VpcEndpointType": "Gateway",\n        "VpcId": "vpc-0a1b2c3d4e5f67890",\n        "ServiceName": "com.amazonaws.ap-northeast-1.s3",\n        "State": "available",\n        "RouteTableIds": ["rtb-0123456789abcdef0"]\n    }\n}',
              hint: 'aws ec2 create-vpc-endpoint に --vpc-id、--service-name、--route-table-ids を指定します（--vpc-endpoint-type Gateway は既定値なので省略可）。',
              answer: 'aws ec2 create-vpc-endpoint --vpc-id vpc-0a1b2c3d4e5f67890 --vpc-endpoint-type Gateway --service-name com.amazonaws.ap-northeast-1.s3 --route-table-ids rtb-0123456789abcdef0',
              explain: '作成するとルートテーブルに S3 のプレフィックスリスト（pl-xxxx）宛ての経路が追加され、S3 宛ての通信は NAT を経由しなくなる。'
            }
          ]
        },
        {
          type: 'verdict',
          title: 'NAT を通り続ける通信は？',
          prompt: 'S3 のゲートウェイ型エンドポイントだけを作成した。次の通信は、どちらを経由する？',
          docs: [
            { title: 'ルートテーブル（rtb-0123456789abcdef0）', kind: 'table', columns: ['宛先', 'ターゲット'], rows: [
              ['10.0.0.0/16', 'local'],
              ['pl-61a54008（S3：ap-northeast-1）', 'vpce-0f1e2d3c4b5a69788'],
              ['0.0.0.0/0', 'nat-0abc1234def567890']
            ] }
          ],
          choices: ['エンドポイント経由', 'NAT 経由'],
          cases: [
            { id: 'n1', desc: '同じ東京リージョンの S3 バケットへのアップロード', answer: 'エンドポイント経由', explain: 'S3（ap-northeast-1）のプレフィックスリスト宛ての経路がエンドポイントを向いている。' },
            { id: 'n2', desc: '同じリージョンの DynamoDB テーブルへの書き込み', answer: 'NAT 経由', explain: 'DynamoDB 用のゲートウェイ型エンドポイントは作っていないので、0.0.0.0/0 の NAT へ。DynamoDB 用も作れば無料で切り替えられる。' },
            { id: 'n3', desc: 'バージニア北部（us-east-1）の S3 バケットへのアクセス', answer: 'NAT 経由', explain: 'ゲートウェイ型エンドポイントは**同じリージョン**のサービス用。他リージョンの S3 は NAT 経由になる。' },
            { id: 'n4', desc: '外部の決済代行会社の API（インターネット）への通信', answer: 'NAT 経由', explain: 'インターネット宛ての通信は NAT ゲートウェイを通る。' },
            { id: 'n5', desc: 'Amazon ECR API（コンテナイメージのメタデータ取得）', answer: 'NAT 経由', explain: 'ECR はゲートウェイ型の対象外。NAT を避けたいならインターフェイス型エンドポイント（ecr.api / ecr.dkr）を作成する。' }
          ]
        }
      ],
      debrief: '**ポイントの整理**\n- NAT ゲートウェイはデータ処理量（GB）に課金される\n- S3・DynamoDB（同一リージョン）→ **ゲートウェイ型エンドポイント**で無料に\n- それ以外の AWS サービス → インターフェイス型エンドポイント（有料だが NAT より安いことが多い）\n- 他リージョンやインターネット宛ては NAT のまま'
    }
  ]);
})();
