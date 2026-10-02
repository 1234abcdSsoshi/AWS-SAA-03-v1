// ハンズオンラボ（第1〜3章）
(function () {
  'use strict';
  SAA.registerLabs([
    // ------------------------------------------------------------------
    {
      id: 'lab-iam-eval', chapter: 'ch1', domain: 1, task: '1.1',
      title: 'IAM ポリシー評価ラボ',
      summary: 'アイデンティティポリシー・SCP・権限の境界・バケットポリシーを読み解き、リクエストが許可されるかを判定します。',
      difficulty: 2, estMinutes: 12,
      scenario: '開発者が使う IAM ロール **DevRole**（アカウント 111111111111、組織の Dev OU に所属）には、次のポリシーが関係しています。\n- アイデンティティベースポリシー（DevRole にアタッチ）\n- SCP（Dev OU に適用）\n- 権限の境界（DevRole に設定）\n- 経理部のアカウント（222222222222）の S3 バケット **finance-share** のバケットポリシー\n\nリクエストごとに、最終的に **許可** されるか **拒否** されるかを判定してください。',
      steps: [
        {
          type: 'verdict',
          title: 'リクエストを判定しよう',
          prompt: '評価の順番を思い出そう：**明示的な Deny → SCP → リソースベースポリシー → アイデンティティベースポリシー → 権限の境界**。どこにも Allow がなければ暗黙的に拒否。',
          docs: [
            { title: 'アイデンティティベースポリシー（DevRole）', kind: 'json', content: {
              Version: '2012-10-17',
              Statement: [
                { Sid: 'AppData', Effect: 'Allow', Action: 's3:*', Resource: ['arn:aws:s3:::app-data', 'arn:aws:s3:::app-data/*'] },
                { Sid: 'Describe', Effect: 'Allow', Action: 'ec2:Describe*', Resource: '*' },
                { Sid: 'NoBucketDelete', Effect: 'Deny', Action: 's3:DeleteBucket', Resource: '*' }
              ] } },
            { title: 'SCP（Dev OU）', kind: 'json', content: {
              Version: '2012-10-17',
              Statement: [
                { Sid: 'AllowAll', Effect: 'Allow', Action: '*', Resource: '*' },
                { Sid: 'TokyoOnly', Effect: 'Deny', NotAction: ['iam:*', 'sts:*', 'organizations:*'], Resource: '*',
                  Condition: { StringNotEquals: { 'aws:RequestedRegion': 'ap-northeast-1' } } }
              ] } },
            { title: '権限の境界（DevRole）', kind: 'json', content: {
              Version: '2012-10-17',
              Statement: [
                { Effect: 'Allow', Action: ['s3:*', 'ec2:Describe*', 'cloudwatch:*'], Resource: '*' }
              ] } },
            { title: 'バケットポリシー（finance-share／アカウント 222222222222）', kind: 'json', content: {
              Version: '2012-10-17',
              Statement: [
                { Effect: 'Allow', Principal: { AWS: 'arn:aws:iam::111111111111:role/DevRole' }, Action: 's3:GetObject', Resource: 'arn:aws:s3:::finance-share/reports/*' }
              ] } }
          ],
          choices: ['許可', '拒否'],
          cases: [
            { id: 'c1', desc: 'DevRole が東京リージョンで `s3:GetObject`（arn:aws:s3:::app-data/report.csv）', answer: '許可', explain: 'Deny に該当せず、SCP・アイデンティティポリシー・権限の境界のすべてで許可されている。' },
            { id: 'c2', desc: 'DevRole が東京リージョンで `s3:DeleteBucket`（app-data）', answer: '拒否', explain: 'アイデンティティポリシーに `s3:*` の Allow があっても、**明示的な Deny（NoBucketDelete）が最優先**。' },
            { id: 'c3', desc: 'DevRole がバージニア北部（us-east-1）で `ec2:DescribeInstances`', answer: '拒否', explain: 'SCP の TokyoOnly が ap-northeast-1 以外のリクエストを Deny する。SCP の Deny はアカウント内のどの Allow より強い。' },
            { id: 'c4', desc: 'DevRole が `iam:CreateUser`', answer: '拒否', explain: 'SCP の Deny の対象外（NotAction）だが、アイデンティティポリシーにも権限の境界にも Allow がない → **暗黙的な拒否**。' },
            { id: 'c5', desc: 'DevRole が東京リージョンで `cloudwatch:PutMetricData`', answer: '拒否', explain: '権限の境界には cloudwatch:* があるが、**境界は権限を与えない**（上限を決めるだけ）。アイデンティティポリシーに Allow がないため拒否。' },
            { id: 'c6', desc: 'DevRole が東京リージョンで `s3:GetObject`（arn:aws:s3:::finance-share/reports/q3.pdf）', answer: '拒否', explain: '別アカウントのバケットへのアクセスは、**相手のバケットポリシーと自分のアイデンティティポリシーの両方**で許可が必要。DevRole のポリシーは app-data しか許可していない。' }
          ]
        },
        {
          type: 'choice',
          title: '権限を正しく追加しよう',
          prompt: 'DevRole が東京リージョンで `cloudwatch:PutMetricData` を実行できるようにしたい。**最小限の変更**はどれ？',
          options: [
            'DevRole のアイデンティティベースポリシーに cloudwatch:PutMetricData の Allow を追加する',
            '権限の境界に cloudwatch:PutMetricData の Allow を追加する',
            'SCP に cloudwatch:PutMetricData の Allow を追加する',
            'DevRole の権限の境界を削除する'
          ],
          answer: [0],
          explain: '権限の境界と SCP は「上限（ガードレール）」で、すでに cloudwatch は範囲内。足りないのは**アイデンティティベースポリシーの Allow** だけ。境界を削除するのは、委任の安全装置を外すことになり不適切。'
        }
      ],
      debrief: '**ポイントの整理**\n- 明示的な Deny は常に最優先（SCP・アイデンティティ・リソースのどこにあっても）\n- SCP と権限の境界は**権限を与えない**。「この範囲までなら OK」という上限\n- クロスアカウントは**両側の許可**が必要（相手のリソースポリシー＋自分の IAM ポリシー）\n- どこにも Allow がなければ暗黙的な拒否'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-sg-nacl', chapter: 'ch1', domain: 1, task: '1.2',
      title: 'SG と NACL のパケット判定ラボ',
      summary: 'ステートフルなセキュリティグループとステートレスなネットワーク ACL の組み合わせで、通信が通るかを判定し、最後に CLI でルールを追加します。',
      difficulty: 2, estMinutes: 12,
      scenario: 'パブリックサブネットに Web サーバー（10.0.1.10）があります。セキュリティグループ（SG）とネットワーク ACL（NACL）は右の表のとおりです。\n\n- SG は**ステートフル**：許可した通信の戻りは自動で許可\n- NACL は**ステートレス**：行き・戻りの両方を許可する必要がある（戻りはエフェメラルポート 1024–65535）',
      steps: [
        {
          type: 'verdict',
          title: '通信は通る？',
          prompt: '各通信の**往復**が成立するかを、SG と NACL の両方で確認しよう。',
          docs: [
            { title: 'セキュリティグループ（web-sg）', kind: 'table', columns: ['方向', 'プロトコル', 'ポート', '相手'], rows: [
              ['インバウンド', 'TCP', '443', '0.0.0.0/0'],
              ['インバウンド', 'TCP', '22', '203.0.113.10/32'],
              ['アウトバウンド', 'すべて', 'すべて', '0.0.0.0/0']
            ] },
            { title: 'NACL（インバウンド）', kind: 'table', columns: ['ルール#', 'プロトコル', 'ポート', '送信元', '許可/拒否'], rows: [
              ['100', 'TCP', '443', '0.0.0.0/0', '許可'],
              ['110', 'TCP', '22', '203.0.113.0/24', '許可'],
              ['120', 'TCP', '1024-65535', '0.0.0.0/0', '許可'],
              ['*', 'すべて', 'すべて', '0.0.0.0/0', '拒否']
            ] },
            { title: 'NACL（アウトバウンド）', kind: 'table', columns: ['ルール#', 'プロトコル', 'ポート', '宛先', '許可/拒否'], rows: [
              ['100', 'TCP', '1024-65535', '0.0.0.0/0', '許可'],
              ['110', 'TCP', '443', '0.0.0.0/0', '許可'],
              ['*', 'すべて', 'すべて', '0.0.0.0/0', '拒否']
            ] }
          ],
          choices: ['通る', '通らない'],
          cases: [
            { id: 'c1', desc: 'インターネットの利用者（198.51.100.7:50123）→ Web サーバー:443（HTTPS）', answer: '通る', explain: '行き：SG 443 許可、NACL in 100 許可。戻り：SG はステートフルで自動許可、NACL out 100（1024–65535）で許可。' },
            { id: 'c2', desc: '管理者（203.0.113.10）→ Web サーバー:22（SSH）', answer: '通る', explain: 'SG は /32 で許可、NACL in 110 は /24 で許可。戻りも NACL out 100 で許可。' },
            { id: 'c3', desc: '同じネットワークの別端末（203.0.113.99）→ Web サーバー:22（SSH）', answer: '通らない', explain: 'NACL は /24 なので通過するが、**SG は 203.0.113.10/32 だけ**を許可しているため SG で拒否される。' },
            { id: 'c4', desc: 'Web サーバー → 外部のパッケージリポジトリ（192.0.2.80:443）へ HTTPS でアップデート', answer: '通る', explain: '行き：SG アウトバウンドは全許可、NACL out 110（443）で許可。戻り（送信元 443 → 宛先の一時ポート）は NACL in 120（1024–65535）で許可。' },
            { id: 'c5', desc: 'Web サーバー → 外部の NTP サーバー（UDP 123）', answer: '通らない', explain: 'NACL のアウトバウンドは TCP しか許可しておらず、UDP は最後の * ルールで拒否される。' },
            { id: 'c6', desc: 'インターネットの利用者 → Web サーバー:80（HTTP）', answer: '通らない', explain: 'SG にも NACL にも 80 番の許可がない。' }
          ]
        },
        {
          type: 'terminal',
          title: 'ALB からの通信だけを許可しよう',
          prompt: 'Web サーバーを ALB の背後に移すことになった。Web サーバーのセキュリティグループ（sg-0123456789abcdef0）に、**ALB のセキュリティグループ（sg-0aaaabbbbccccdddd）からの TCP 443 だけ**を許可するルールを追加しよう。',
          tasks: [
            {
              instruction: 'sg-0123456789abcdef0 に、送信元を sg-0aaaabbbbccccdddd とする TCP 443 のインバウンドルールを追加してください。',
              match: {
                all: ['aws ec2 authorize-security-group-ingress', '--group-id sg-0123456789abcdef0', '--source-group sg-0aaaabbbbccccdddd'],
                any: [['--protocol tcp'], ['--port 443']],
                none: ['0.0.0.0/0']
              },
              output: '{\n    "Return": true,\n    "SecurityGroupRules": [\n        {\n            "SecurityGroupRuleId": "sgr-0f1e2d3c4b5a69788",\n            "GroupId": "sg-0123456789abcdef0",\n            "IsEgress": false,\n            "IpProtocol": "tcp",\n            "FromPort": 443,\n            "ToPort": 443,\n            "ReferencedGroupInfo": { "GroupId": "sg-0aaaabbbbccccdddd" }\n        }\n    ]\n}',
              hint: 'aws ec2 authorize-security-group-ingress に、--group-id（追加先）、--protocol、--port、--source-group（送信元の SG）を指定します。',
              answer: 'aws ec2 authorize-security-group-ingress --group-id sg-0123456789abcdef0 --protocol tcp --port 443 --source-group sg-0aaaabbbbccccdddd',
              explain: '送信元に**セキュリティグループを指定**すると、その SG が付いたリソース（ALB）からの通信だけを許可できる。IP アドレスが変わっても設定を変えずに済み、3層構成の基本テクニック。'
            }
          ]
        }
      ],
      debrief: '**ポイントの整理**\n- SG はステートフル（戻りは自動許可）、NACL はステートレス（戻りのエフェメラルポートを明示的に許可）\n- 通信は **SG と NACL の両方**を通過して初めて成立する\n- 特定 IP の「拒否」は NACL（または WAF）。SG は許可のみ\n- 3層構成では、**SG を送信元に指定**して必要最小限の通信だけを許可する'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-decouple', chapter: 'ch2', domain: 2, task: '2.1',
      title: '注文処理の疎結合化ラボ',
      summary: 'API Gateway・Lambda・SNS・SQS を配置して、スパイクに強く、後続システムが止まっても注文を失わない構成を組み立てます。',
      difficulty: 2, estMinutes: 12,
      scenario: 'EC サイトの注文 API をサーバーレスで作り直します。要件は次のとおりです。\n- 注文の受付はサーバー管理なしで、急なアクセス増にも自動で対応する\n- 1つの注文を**在庫・配送・分析**の3システムへ確実に届ける（どれかが止まっていても後から処理できる）\n- 何度処理しても失敗する注文は隔離し、ほかの注文の処理を妨げない',
      steps: [
        {
          type: 'slots',
          title: 'アーキテクチャを組み立てよう',
          prompt: '各スロットに最適なコンポーネントを配置しよう（同じコンポーネントを複数回使ってもよい）。',
          zones: [
            { id: 'client', label: 'インターネット', kind: 'edge' },
            { id: 'region', label: 'AWS リージョン（ap-northeast-1）', kind: 'region' },
            { id: 'front', label: '受付', kind: 'aws', parent: 'region' },
            { id: 'fan', label: '配信とバッファ', kind: 'aws', parent: 'region' }
          ],
          palette: [
            { id: 'apigw', label: 'Amazon API Gateway', icon: '🚪' },
            { id: 'lambda', label: 'AWS Lambda', icon: 'λ' },
            { id: 'sns', label: 'Amazon SNS トピック', icon: '📣' },
            { id: 'sqs', label: 'Amazon SQS キュー', icon: '📥' },
            { id: 'dlq', label: 'SQS デッドレターキュー', icon: '🧯' },
            { id: 'ec2', label: 'Amazon EC2（固定 1 台）', icon: '🖥️' },
            { id: 'kinesis', label: 'Kinesis Data Streams', icon: '🌊' },
            { id: 'rds', label: 'Amazon RDS', icon: '🗄️' }
          ],
          slots: [
            { id: 's1', zone: 'front', label: '注文を受け付ける REST API の入口（スロットリングも設定）', answer: ['apigw'], explain: 'API Gateway はサーバー管理不要で、スロットリングや使用量プランも設定できる。' },
            { id: 's2', zone: 'front', label: '注文を検証してイベントを発行する処理', answer: ['lambda'], explain: 'イベント駆動・自動スケールの Lambda なら急増にも対応できる。' },
            { id: 's3', zone: 'fan', label: '1つの注文イベントを3システムへ一斉に配信する', answer: ['sns'], explain: 'SNS トピックに発行すると、サブスクライブした各キューへ複製して配信される（ファンアウト）。' },
            { id: 's4', zone: 'fan', label: '在庫システムが止まっていても注文を保持するバッファ', answer: ['sqs'], explain: 'システムごとに SQS キューを用意すれば、停止中のメッセージも保持され、復旧後に処理できる。' },
            { id: 's5', zone: 'fan', label: '何度処理しても失敗する注文の隔離先', answer: ['dlq'], explain: 'maxReceiveCount を超えたメッセージを DLQ に移せば、正常な注文の処理を妨げない。' }
          ],
          feedback: {
            ec2: '固定台数の EC2 では急増に追従できず、サーバー管理も必要。',
            kinesis: 'Kinesis もストリームを複数で読めるが、このケースはメッセージ単位の確実な配信と隔離（SNS＋SQS＋DLQ）が素直。',
            rds: 'DB をキュー代わりにすると、排他制御や再試行を自前で作ることになる。'
          }
        },
        {
          type: 'choice',
          title: '可視性タイムアウトを決めよう',
          prompt: '在庫システムのワーカーは、1件の注文処理に**最大4分**かかる。SQS キューの可視性タイムアウトとして最も適切なのは？',
          options: ['30秒（既定値のまま）', '1分', '6分', '12時間'],
          answer: [2],
          explain: '可視性タイムアウトは**最大処理時間より少し長く**する。短すぎると処理中にメッセージが再び見え、別のワーカーが重複して処理してしまう。長すぎると、ワーカーが落ちたときの再処理が遅れる。'
        },
        {
          type: 'terminal',
          title: 'CLI で設定しよう',
          prompt: 'キュー order-inventory（URL：https://sqs.ap-northeast-1.amazonaws.com/123456789012/order-inventory）の可視性タイムアウトを **360 秒**に変更しよう。',
          tasks: [
            {
              instruction: 'order-inventory キューの VisibilityTimeout を 360 秒に設定してください。',
              match: {
                all: ['aws sqs set-queue-attributes', '--queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/order-inventory', '--attributes'],
                any: [['visibilitytimeout=360', '"visibilitytimeout":"360"', '"visibilitytimeout": "360"']]
              },
              output: '',
              hint: 'aws sqs set-queue-attributes --queue-url <URL> --attributes VisibilityTimeout=<秒数> の形です。',
              answer: 'aws sqs set-queue-attributes --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/order-inventory --attributes VisibilityTimeout=360',
              explain: 'set-queue-attributes は成功しても何も出力しない。確認したいときは get-queue-attributes --attribute-names VisibilityTimeout を使う。'
            }
          ]
        }
      ],
      debrief: '**ポイントの整理**\n- 1対多の確実な配信は **SNS → 複数の SQS（ファンアウト）**\n- SQS は止まっている相手の分までメッセージを預かるバッファ\n- 可視性タイムアウトは**最大処理時間より長く**、失敗し続けるメッセージは **DLQ** へ\n- 入口は API Gateway、処理は Lambda でサーバー管理なし・自動スケール'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-dr-strategy', chapter: 'ch2', domain: 2, task: '2.2',
      title: 'DR 戦略セレクター',
      summary: '業務ごとの RTO・RPO・予算から最適な DR 戦略を選び、パイロットライトのフェイルオーバー手順を組み立てます。',
      difficulty: 2, estMinutes: 10,
      scenario: '社内の5つのシステムについて、災害対策（別リージョンへの DR）を設計します。**要件を満たす中で最もコストの低い戦略**を選びましょう。\n\n- **バックアップと復元**：バックアップだけを別リージョンへ。RTO/RPO は数時間\n- **パイロットライト**：データは常時複製、サーバーは停止（最小限）。RTO 数十分\n- **ウォームスタンバイ**：縮小構成で常時稼働。RTO 数分\n- **マルチサイト**：両リージョンで本番規模が稼働。RTO/RPO ほぼゼロ',
      steps: [
        {
          type: 'match',
          title: 'システムに合う DR 戦略は？',
          prompt: '各システムに、要件を満たす中で最も低コストな戦略を選ぼう。',
          left: [
            { id: 'w1', label: '経費精算システム：RTO 24時間・RPO 24時間。DR の予算は最小限' },
            { id: 'w2', label: '受発注システム：RTO 1時間・RPO 5分。平常時の DR 側の費用はできるだけ抑えたい' },
            { id: 'w3', label: 'EC サイト：RTO 10分・RPO 1分。DR 側で縮小構成を常時動かす予算はある' },
            { id: 'w4', label: '決済 API：RTO・RPO ほぼゼロ。平常時から両リージョンでトラフィックを処理する' },
            { id: 'w5', label: '社内ポータル（ほぼ静的）：RTO 8時間・RPO 1日' }
          ],
          right: [
            { id: 'backup', label: 'バックアップと復元' },
            { id: 'pilot', label: 'パイロットライト' },
            { id: 'warm', label: 'ウォームスタンバイ' },
            { id: 'multi', label: 'マルチサイト（アクティブ/アクティブ）' }
          ],
          answer: { w1: 'backup', w2: 'pilot', w3: 'warm', w4: 'multi', w5: 'backup' },
          notes: {
            w1: '時間に余裕があり予算は最小 → バックアップと復元。',
            w2: 'RPO 5分のためデータの常時複製は必要。RTO 1時間ならサーバーは停止のままでよい → パイロットライト。',
            w3: 'RTO 10分ではサーバーの起動・構成を待てない → 縮小構成で動かしておくウォームスタンバイ。',
            w4: 'ほぼゼロの RTO/RPO と常時の両系処理 → マルチサイト。',
            w5: '時間に余裕がある → バックアップと復元で十分。'
          },
          explain: 'DR 戦略は「速いほど高い」。**要件ぎりぎりを満たす一番安い戦略**を選ぶのが試験の定石。'
        },
        {
          type: 'order',
          title: 'パイロットライトのフェイルオーバー手順',
          prompt: '東京リージョンで障害が発生した。大阪リージョンのパイロットライト環境へ切り替える手順を、正しい順に並べよう。',
          items: [
            '障害を検知し、DR リージョンへの切り替えを判断する',
            'DR リージョンのデータベース（クロスリージョンのレプリカ）をスタンドアロンに昇格させる',
            '停止しているアプリケーションサーバーを起動し、Auto Scaling で本番規模まで拡張する',
            'Route 53 のレコードを DR リージョンのエンドポイントへ切り替える',
            '動作を確認し、利用者へ復旧を通知する'
          ],
          explain: 'まずデータ（DB の昇格）、次に処理能力（サーバーの起動・拡張）、準備が整ってから**最後にトラフィック（DNS）**を切り替える。順番を間違えると、準備前の環境にユーザーが流れ込む。'
        }
      ],
      debrief: '**ポイントの整理**\n- DR の4戦略はコストと RTO/RPO のトレードオフ\n- 「縮小版が稼働」＝ウォームスタンバイ、「データだけ複製・サーバー停止」＝パイロットライト\n- 切り替えは **データ → 処理能力 → トラフィック** の順'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-storage-select', chapter: 'ch3', domain: 3, task: '3.1',
      title: 'ストレージ選定ラボ',
      summary: '7つのワークロードに最適なストレージを選び、gp3 に必要な追加プロビジョニング量を計算します。',
      difficulty: 2, estMinutes: 10,
      scenario: 'あなたは社内のストレージ選定レビューを任されました。ワークロードごとに、**要件を満たし、かつ無駄のない**ストレージを選びましょう。',
      steps: [
        {
          type: 'match',
          title: 'ワークロードとストレージの組み合わせ',
          prompt: '各ワークロードに最適なストレージを選ぼう。',
          left: [
            { id: 'w1', label: '一般的な Web サーバーのブートボリューム' },
            { id: 'w2', label: '200,000 IOPS・サブミリ秒が必要な基幹 DB（耐久性 99.999%）' },
            { id: 'w3', label: '数 TB のログを毎日シーケンシャルに処理する分析サーバー' },
            { id: 'w4', label: '再生成できるレンダリングの一時ファイル。最高のランダム I/O が欲しい' },
            { id: 'w5', label: '複数 AZ の数百台の Linux から同じファイルを読み書き' },
            { id: 'w6', label: 'S3 上のデータを HPC クラスターが並列に高速処理' },
            { id: 'w7', label: 'Active Directory と連携する Windows のファイル共有（SMB）' }
          ],
          right: [
            { id: 'gp3', label: 'EBS gp3' },
            { id: 'io2', label: 'EBS io2 Block Express' },
            { id: 'st1', label: 'EBS st1' },
            { id: 'inst', label: 'インスタンスストア' },
            { id: 'efs', label: 'Amazon EFS' },
            { id: 'lustre', label: 'FSx for Lustre' },
            { id: 'fsxw', label: 'FSx for Windows File Server' },
            { id: 's3', label: 'Amazon S3' }
          ],
          answer: { w1: 'gp3', w2: 'io2', w3: 'st1', w4: 'inst', w5: 'efs', w6: 'lustre', w7: 'fsxw' },
          notes: {
            w1: '汎用の既定は gp3。HDD はブートに使えない。',
            w2: '最高クラスの IOPS・サブミリ秒・99.999% は io2 Block Express。',
            w3: '大容量のシーケンシャル処理は HDD の st1 が安くて速い。',
            w4: '消えてもよい一時データ＋最速 → インスタンスストア。',
            w5: '複数 AZ の Linux で共有 → EFS（NFS）。',
            w6: 'HPC の並列処理＋S3 連携 → FSx for Lustre。',
            w7: 'SMB と AD 統合 → FSx for Windows File Server。'
          },
          explain: '「アクセスの仕方（ランダム/シーケンシャル）」「共有の有無とプロトコル」「永続性」の3つの軸で選ぶと迷わない。'
        },
        {
          type: 'calc',
          title: 'gp3 の追加プロビジョニング量',
          prompt: 'ある DB サーバーの gp3 ボリューム（500 GiB）に、**8,000 IOPS** と **250 MiB/秒**が必要になった。gp3 のベースラインは **3,000 IOPS・125 MiB/秒**（容量に関係なく含まれる）。追加でプロビジョニングすべき量は？',
          fields: [
            { id: 'iops', label: '追加する IOPS', unit: 'IOPS', answer: 5000, tolerance: 0 },
            { id: 'tput', label: '追加するスループット', unit: 'MiB/秒', answer: 125, tolerance: 0 }
          ],
          hint: '必要な値からベースラインを引くだけ。容量は増やさなくてよいのが gp3 の強み。',
          formula: '追加 IOPS ＝ 8,000 − 3,000、追加スループット ＝ 250 − 125',
          explain: '8,000 − 3,000 ＝ **5,000 IOPS**、250 − 125 ＝ **125 MiB/秒**。gp2 なら 8,000 IOPS のために約 2,667 GiB（3 IOPS/GiB）もの容量が必要になるところを、gp3 は容量 500 GiB のまま性能だけ買える。'
        }
      ],
      debrief: '**ポイントの整理**\n- 既定は gp3。性能だけ足りなければ容量はそのままで IOPS/スループットを追加\n- 最高性能＋高耐久 → io2 Block Express、シーケンシャル大容量 → st1、一時データ → インスタンスストア\n- 共有ファイル：Linux は EFS、Windows/SMB は FSx for Windows、HPC は FSx for Lustre'
    },
    // ------------------------------------------------------------------
    {
      id: 'lab-asg-sim', chapter: 'ch3', domain: 3, task: '3.2',
      title: 'Auto Scaling チューニングラボ',
      summary: '朝9時に急増する社内システムを題材に、スケーリングポリシーを試して「過負荷ゼロ」と「コスト」を両立させます。',
      difficulty: 3, estMinutes: 15,
      scenario: '社内業務システムは、平日の**8時45分から9時15分にかけてアクセスが急増**します（夜間は 120 req/秒、日中は最大 900 req/秒）。\n- インスタンス1台の処理能力：**100 req/秒**\n- インスタンスの起動と準備に**10分**かかる\n- 料金：1台あたり **$0.10/時**（学習用の概算値）\n\n目標：**過負荷（需要＞処理能力）を1日5分以内**に抑え、**1日のコストを $19 以下**にすること。',
      steps: [
        {
          type: 'brief',
          title: 'ポリシーのおさらい',
          body: '- **固定**：台数を決め打ち。足りなければ過負荷、多すぎれば無駄\n- **ターゲット追跡**：指標（使用率）を目標値に保つ。ただし負荷が上がって**から**反応する\n- **スケジュール**：決まった時刻に最小台数を変える（**先回り**）\n- **予測**：過去のパターンから先回りして起動する\n\n起動に10分かかるアプリでは、「上がってから反応する」だけでは朝の急増に間に合わない。グラフを見ながら試してみよう。'
        },
        {
          type: 'sim',
          sim: 'asg',
          title: 'シミュレーターで目標を達成しよう',
          prompt: 'まずは**ターゲット追跡だけ**で実行し、朝に何が起きるかを確認しよう。そのあとスケジュールや予測を組み合わせて、目標を達成しよう。',
          params: { profile: 'office', capacityPerInstance: 100, hourlyCost: 0.1, warmupMin: 10, start: { min: 2, max: 20, desired: 2 } },
          goal: { maxOverloadMin: 5, maxDailyCost: 19 },
          reference: { policy: 'target', targetUtil: 70, min: 2, max: 20, schedule: [{ at: '08:30', min: 13 }, { at: '19:30', min: 2 }], predictive: false },
          explain: 'ターゲット追跡（70%）だけだと、朝の急増に起動が間に合わず**約20分の過負荷**が出る。8時30分に最小台数を13台に引き上げる**スケジュール**を組み合わせると、ピーク前に準備が整い、過負荷ゼロ・約 $17/日で目標を達成できる。台数を固定で増やすと過負荷はなくなるが、コストが倍以上になる。'
        },
        {
          type: 'choice',
          title: '試験ならどう答える？',
          prompt: '「毎朝決まった時刻に負荷が急増し、インスタンスの起動に時間がかかる」システム。ピーク時の性能を確保する方法として最も適切なのは？',
          options: [
            'ターゲット追跡スケーリングの目標値を下げて、早めにスケールアウトさせる',
            'スケジュールされたスケーリング（または予測スケーリング）でピーク前に容量を確保し、ターゲット追跡と組み合わせる',
            'インスタンスタイプを大きくして、台数を固定で運用する',
            'ステップスケーリングに切り替えて、1回の増加台数を大きくする'
          ],
          answer: [1],
          explain: '負荷が上がってから反応するポリシー（ターゲット追跡・ステップ）だけでは、起動時間の分だけ必ず遅れる。**予測できるピークには先回り**（スケジュール・予測スケーリング）を組み合わせるのが正解。'
        }
      ],
      debrief: '**ポイントの整理**\n- ターゲット追跡は「上がってから反応」。起動が遅いと間に合わない\n- 時刻が決まったピーク → **スケジュール**、周期的なパターン → **予測スケーリング**\n- 予告なしの急増で起動が遅い → **ウォームプール**\n- 台数の固定は、過負荷かコストの無駄のどちらかを生む'
    }
  ]);
})();
