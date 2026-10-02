/* カリキュラム定義：分野・タスク・章・問題グループ・講義スライド・ラボ・模擬試験（全コンテンツの設計図） */
(function () {
  'use strict';

  SAA.data.curriculum = {
    exam: { code: 'SAA-C03', name: 'AWS Certified Solutions Architect - Associate', questions: 65, minutes: 130, passScaled: 720, scaledMin: 100, scaledMax: 1000, meetsRate: 0.72 },

    domains: [
      { id: 1, name: 'セキュアなアーキテクチャの設計', short: 'セキュア', weight: 30, lastResult: 'meets' },
      { id: 2, name: '弾力性に優れたアーキテクチャの設計', short: '弾力性', weight: 26, lastResult: 'meets' },
      { id: 3, name: '高性能アーキテクチャの設計', short: '高性能', weight: 24, lastResult: 'needs' },
      { id: 4, name: 'コストを最適化したアーキテクチャの設計', short: 'コスト', weight: 20, lastResult: 'needs' }
    ],

    tasks: [
      { id: '1.1', domain: 1, name: 'AWS リソースへのセキュアなアクセスを設計する' },
      { id: '1.2', domain: 1, name: 'セキュアなワークロードとアプリケーションを設計する' },
      { id: '1.3', domain: 1, name: '適切なデータセキュリティコントロールを判断する' },
      { id: '2.1', domain: 2, name: 'スケーラブルで疎結合なアーキテクチャを設計する' },
      { id: '2.2', domain: 2, name: '高可用性またはフォールトトレラントなアーキテクチャを設計する' },
      { id: '3.1', domain: 3, name: '高性能でスケーラブルなストレージソリューションを決定する' },
      { id: '3.2', domain: 3, name: '高性能で伸縮性のあるコンピューティングソリューションを設計する' },
      { id: '3.3', domain: 3, name: '高性能なデータベースソリューションを決定する' },
      { id: '3.4', domain: 3, name: '高性能でスケーラブルなネットワークアーキテクチャを決定する' },
      { id: '3.5', domain: 3, name: '高性能なデータ取り込みと変換のソリューションを決定する' },
      { id: '4.1', domain: 4, name: 'コストを最適化したストレージソリューションを設計する' },
      { id: '4.2', domain: 4, name: 'コストを最適化したコンピューティングソリューションを設計する' },
      { id: '4.3', domain: 4, name: 'コストを最適化したデータベースソリューションを設計する' },
      { id: '4.4', domain: 4, name: 'コストを最適化したネットワークアーキテクチャを設計する' }
    ],

    chapters: [
      { id: 'prologue', no: 0, title: 'プロローグ', sub: '不合格通知と、先輩の提案', day: 'Day 0', domain: null,
        groups: ['pro-diag'], slides: ['pro-score-report', 'pro-study-plan', 'pro-question-reading'], labs: [] },
      { id: 'ch1', no: 1, title: '第1章', sub: 'セキュアなアーキテクチャ ～最小権限という約束～', day: 'Day 1–2', domain: 1,
        groups: ['c1-iam', 'c1-net', 'c1-data'],
        slides: ['ch1-iam-eval', 'ch1-iam-identities', 'ch1-sg-nacl', 'ch1-vpc-endpoints', 'ch1-threat-services', 'ch1-encryption'],
        labs: ['lab-iam-eval', 'lab-sg-nacl'] },
      { id: 'ch2', no: 2, title: '第2章', sub: '弾力性に優れたアーキテクチャ ～壊れても止まらない～', day: 'Day 3–4', domain: 2,
        groups: ['c2-decouple', 'c2-ha'],
        slides: ['ch2-decoupling', 'ch2-sqs-tips', 'ch2-ha-db', 'ch2-dr-strategies', 'ch2-route53'],
        labs: ['lab-decouple', 'lab-dr-strategy'] },
      { id: 'ch3', no: 3, title: '第3章', sub: '高性能アーキテクチャ① ～ストレージとコンピューティング～', day: 'Day 5–6', domain: 3,
        groups: ['c3-storage', 'c3-compute'],
        slides: ['ch3-ebs-types', 'ch3-file-storage', 'ch3-s3-performance', 'ch3-ec2-families', 'ch3-asg-policies', 'ch3-lambda-containers'],
        labs: ['lab-storage-select', 'lab-asg-sim'] },
      { id: 'ch4', no: 4, title: '第4章', sub: '高性能アーキテクチャ② ～データベース・ネットワーク・データ分析～', day: 'Day 7–8', domain: 3,
        groups: ['c4-db', 'c4-net', 'c4-data'],
        slides: ['ch4-db-select', 'ch4-caching', 'ch4-elb', 'ch4-edge', 'ch4-hybrid-network', 'ch4-streaming', 'ch4-analytics'],
        labs: ['lab-dynamodb-capacity', 'lab-global-network', 'lab-kinesis-pipeline'] },
      { id: 'ch5', no: 5, title: '第5章', sub: 'コスト最適化① ～ストレージとコンピューティング～', day: 'Day 9–10', domain: 4,
        groups: ['c5-storage', 'c5-compute'],
        slides: ['ch5-s3-classes', 'ch5-lifecycle', 'ch5-ebs-cost', 'ch5-purchase-options', 'ch5-savings-plans', 'ch5-cost-tools'],
        labs: ['lab-s3-lifecycle', 'lab-purchase-options'] },
      { id: 'ch6', no: 6, title: '第6章', sub: 'コスト最適化② ～データベースとネットワーク～', day: 'Day 11–12', domain: 4,
        groups: ['c6-db', 'c6-net'],
        slides: ['ch6-db-cost', 'ch6-data-transfer', 'ch6-nat-endpoints', 'ch6-network-cost'],
        labs: ['lab-db-cost', 'lab-nat-endpoint'] },
      { id: 'ch7', no: 7, title: '最終章', sub: '模擬試験、そして本番へ', day: 'Day 13–14', domain: null,
        groups: [], slides: ['ch7-final-checklist', 'ch7-exam-tactics'], labs: [], mock: 'mockA' }
    ],

    // 問題グループ。topics の1行 = 1問（この順番で作成）。
    groups: {
      'pro-diag': { chapter: 'prologue', domain: null, tasks: ['1.1', '2.1', '3.3', '4.2'], count: 4, title: '実力診断テスト',
        topics: [
          '[D1/1.1] EC2 上のアプリが S3 にアクセス：アクセスキーを埋め込まず IAM ロール（インスタンスプロファイル）を使う',
          '[D2/2.1] 注文のスパイクで Web 層が詰まる：SQS でバッファリングしてワーカーを独立にスケール',
          '[D3/3.3] 読み取りが多い RDS の性能改善：リードレプリカ（読み取り専用エンドポイント）へオフロード',
          '[D4/4.2] 24時間365日、構成が安定した EC2 群のコスト削減：Savings Plans（または RI）'
        ] },

      'c1-iam': { chapter: 'ch1', domain: 1, tasks: ['1.1'], count: 7, title: 'IAM とアクセス管理',
        topics: [
          'IAM ポリシー評価ロジック：明示的な Deny が常に優先、Allow がなければ暗黙的に拒否',
          'クロスアカウントアクセス：信頼ポリシー付き IAM ロールを AssumeRole（外部 ID でサードパーティを保護）',
          'AWS Organizations の SCP：ガードレールであり権限を付与しない（例：特定リージョン以外の利用を禁止）',
          'IAM Identity Center + 外部 IdP（SAML/SCIM）で複数アカウントへのシングルサインオン',
          '権限の境界（Permissions boundary）で開発者に IAM ロール作成を安全に委任',
          'MFA の強制とルートユーザーの保護（aws:MultiFactorAuthPresent 条件、ルートは日常利用しない）',
          'Amazon Cognito：ユーザープールで認証、ID プールで一時的な AWS 認証情報を発行しモバイルから S3 にアクセス'
        ] },
      'c1-net': { chapter: 'ch1', domain: 1, tasks: ['1.2'], count: 7, title: 'VPC セキュリティと脅威対策',
        topics: [
          'セキュリティグループ（ステートフル）と NACL（ステートレス・エフェメラルポートの戻り許可）で通信できない原因を特定',
          '特定の IP アドレス範囲からの不正アクセスをブロック：NACL の拒否ルール（SG は拒否ルールを持てない）または WAF の IP セット',
          'プライベートサブネットの EC2 からインターネットを経由せず S3 へ：ゲートウェイ型 VPC エンドポイント + aws:SourceVpce 条件のバケットポリシー',
          'Web アプリを SQL インジェクション・XSS・HTTP フラッドから保護：AWS WAF（マネージドルール＋レートベースルール）と Shield Advanced',
          'DB 認証情報をコードに埋め込まず自動ローテーション：AWS Secrets Manager（Parameter Store との違い）',
          '脅威検出・機密データ検出・脆弱性スキャンの使い分け：GuardDuty / Macie / Inspector',
          'Direct Connect 経由の通信を暗号化：DX 上の Site-to-Site VPN（IPsec）または MACsec'
        ] },
      'c1-data': { chapter: 'ch1', domain: 1, tasks: ['1.3'], count: 6, title: 'データ保護と暗号化',
        topics: [
          'S3 の暗号化方式の選択：SSE-S3 / SSE-KMS（キー使用の監査とキーポリシーによる制御）/ SSE-C',
          'KMS カスタマーマネージドキー：自動キーローテーション、キーポリシー、別アカウントへの使用許可',
          '暗号化されていない既存の EBS ボリューム／RDS を暗号化：スナップショットを暗号化してコピー → 復元',
          'S3 Object Lock（コンプライアンスモード＋保持期間）で WORM 保存、ルートユーザーでも削除不可',
          'ACM による TLS 証明書（ALB・CloudFront、自動更新）：CloudFront 用は us-east-1 で発行',
          'CloudTrail（組織の証跡・ログファイルの整合性検証）と AWS Config（構成変更の記録・ルール評価）の使い分け'
        ] },

      'c2-decouple': { chapter: 'ch2', domain: 2, tasks: ['2.1'], count: 9, title: '疎結合とスケーラビリティ',
        topics: [
          'SQS で Web 層と処理層を疎結合化し、トラフィックスパイクを吸収',
          'SQS FIFO キュー（順序保証・重複排除）と標準キューの選択',
          '可視性タイムアウトを処理時間より長く設定し、処理に失敗し続けるメッセージは DLQ（maxReceiveCount）へ',
          'SNS + SQS のファンアウトで、1つのイベントを複数システムへ確実に配信',
          'Amazon EventBridge によるイベント駆動（SaaS 連携、イベントパターンのルール、スケジュール）',
          'AWS Step Functions でリトライ・エラーハンドリング・人の承認を含むワークフローを構成',
          'API Gateway + Lambda のサーバーレス API とスロットリング／使用量プラン',
          'ステートレス化：セッションを ElastiCache または DynamoDB に外出しして Auto Scaling でスケールアウト',
          'ECS on Fargate でマイクロサービス化（サーバー管理不要）＋ ALB のパスベースルーティング'
        ] },
      'c2-ha': { chapter: 'ch2', domain: 2, tasks: ['2.2'], count: 9, title: '高可用性と災害対策',
        topics: [
          'RDS マルチ AZ（同期レプリケーション・自動フェイルオーバー）とリードレプリカ（非同期・読み取りスケール）の違い',
          'Aurora Global Database：RPO 秒単位・RTO 1分程度のリージョン間 DR',
          'DR 戦略の選択：バックアップと復元 / パイロットライト / ウォームスタンバイ / マルチサイト（RTO・RPO・コスト）',
          'Route 53 フェイルオーバールーティング＋ヘルスチェックで、障害時に S3 の静的メンテナンスページへ切り替え',
          'ALB ＋ 複数 AZ にまたがる Auto Scaling グループで AZ 障害に耐える構成',
          'S3 クロスリージョンレプリケーション（バージョニング必須、既存オブジェクトは S3 バッチレプリケーション）',
          'DynamoDB グローバルテーブルでマルチリージョンのアクティブ/アクティブ',
          'AWS Backup のバックアッププランでクロスリージョン／クロスアカウントコピーを一元管理',
          '単一 EC2 上のファイル共有を伴うアプリを高可用化：Amazon EFS ＋ マルチ AZ の Auto Scaling'
        ] },

      'c3-storage': { chapter: 'ch3', domain: 3, tasks: ['3.1'], count: 10, title: '高性能ストレージ',
        topics: [
          'EBS gp3：容量と独立して IOPS とスループットをプロビジョニング（gp2 からの移行）',
          'io2 Block Express：最高クラスの IOPS とサブミリ秒レイテンシーが必要なミッションクリティカル DB',
          'st1 と sc1：大容量のシーケンシャル処理（ログ・ビッグデータ）とコールドデータの低コスト保管',
          'インスタンスストア：永続性不要な一時データ・バッファで最高のランダム I/O',
          'Amazon EFS：複数 AZ の多数の Linux インスタンスから共有（NFS）、Elastic スループット',
          'FSx for Lustre：HPC/機械学習向けの高スループット並列ファイルシステム（S3 とのデータリポジトリ連携）',
          'FSx for Windows File Server（SMB・Active Directory 統合）と FSx for NetApp ONTAP（マルチプロトコル）の使い分け',
          'S3 マルチパートアップロードと S3 Transfer Acceleration（遠隔地からの大容量アップロード）',
          'S3 のリクエスト性能：プレフィックスごとのスケーリングとバイト範囲フェッチによる並列ダウンロード',
          'EBS 高速スナップショット復元（FSR）で、スナップショットから作成したボリュームの初回アクセス遅延を解消'
        ] },
      'c3-compute': { chapter: 'ch3', domain: 3, tasks: ['3.2'], count: 10, title: '高性能コンピューティング',
        topics: [
          'EC2 インスタンスファミリーの選択（C:コンピューティング / R:メモリ / I:ストレージ I/O / P・G:GPU / M:汎用）',
          'プレイスメントグループ：クラスター（低レイテンシー HPC）/ パーティション（HDFS・Cassandra）/ スプレッド（少数の重要インスタンスの分離）',
          'EC2 Auto Scaling のターゲット追跡スケーリング（平均 CPU 使用率を維持）とステップスケーリングの違い',
          'スケジュールされたスケーリング（毎朝9時の予測可能なピーク）と予測スケーリング（周期的パターン）',
          '起動に時間がかかるアプリのスケールアウト高速化：Auto Scaling のウォームプール',
          'Lambda のメモリ設定と CPU の比例関係、最大実行時間 15 分（長時間処理は Fargate や Batch へ）',
          'Lambda のコールドスタート対策：プロビジョニングされた同時実行（予約された同時実行との違い）',
          'ECS の起動タイプ：Fargate（サーバー管理不要）と EC2（GPU や特定インスタンスが必要）',
          'AWS Batch：大量のバッチジョブをジョブキューで管理し、スポットも活用してコンピューティングを自動調整',
          'HPC の MPI 通信：Elastic Fabric Adapter（EFA）とクラスタープレイスメントグループ'
        ] },

      'c4-db': { chapter: 'ch4', domain: 3, tasks: ['3.3'], count: 8, title: '高性能データベース',
        topics: [
          '読み取りが多い RDS：リードレプリカを追加し、アプリの読み取りをレプリカへ分離',
          'RDS Proxy：Lambda からの大量同時接続を接続プーリングで吸収し、フェイルオーバー時間も短縮',
          'Aurora：最大 15 の Aurora レプリカ、リーダーエンドポイント、レプリカの Auto Scaling',
          'Aurora Serverless v2：予測不能な負荷に対して容量を細かく即時に自動調整',
          'DynamoDB Accelerator（DAX）：読み取り集中ワークロードでマイクロ秒レベルの応答',
          'DynamoDB のテーブル設計：高カーディナリティのパーティションキーでホットパーティション回避、GSI で新しいアクセスパターン',
          'ElastiCache：Redis OSS/Valkey（データ構造・レプリケーション・永続化、ランキングはソート済みセット）と Memcached（シンプル・マルチスレッド）',
          'キャッシュ戦略：遅延読み込み（Lazy loading）と書き込みスルー、TTL による鮮度管理'
        ] },
      'c4-net': { chapter: 'ch4', domain: 3, tasks: ['3.4'], count: 8, title: '高性能ネットワーク',
        topics: [
          'CloudFront で静的・動的コンテンツをエッジ配信し、オリジンアクセスコントロール（OAC）で S3 を保護',
          'AWS Global Accelerator：静的エニーキャスト IP、TCP/UDP、AWS グローバルネットワーク経由での高速化とリージョン間フェイルオーバー',
          'Route 53 レイテンシーベースルーティング（マルチリージョンで最速リージョンへ）と位置情報ルーティングの違い',
          'NLB：超低レイテンシー・静的 IP（Elastic IP）・TCP/UDP の大量接続、ALB（L7）との使い分け',
          'AWS Direct Connect（安定した帯域・低レイテンシー）＋ Site-to-Site VPN のバックアップ',
          'Transit Gateway（多数の VPC とオンプレのハブ＆スポーク）と VPC ピアリング（推移的ルーティング不可）',
          'AWS PrivateLink：自社サービスを多数の VPC（他アカウント）へ、CIDR 重複があってもプライベートに公開',
          'CloudFront のキャッシュヒット率向上：キャッシュキー（クエリ文字列・Cookie・ヘッダー）の最小化と Origin Shield'
        ] },
      'c4-data': { chapter: 'ch4', domain: 3, tasks: ['3.5'], count: 6, title: 'データ取り込みと変換',
        topics: [
          'Kinesis Data Streams（リアルタイム・順序・複数コンシューマー・リプレイ）と Amazon Data Firehose（ニアリアルタイム配信・運用不要）の選択',
          'Amazon Data Firehose で S3 へ配信：Lambda による変換と Parquet へのデータ形式変換',
          'Amazon Managed Service for Apache Flink でストリームをリアルタイム分析（異常検知・ウィンドウ集計）',
          'AWS Glue（サーバーレス ETL・クローラー・Data Catalog）と Athena（Parquet・パーティション分割で高速化）',
          '大量データ移行：DataSync（オンラインで NFS/SMB → S3/EFS/FSx）、Snowball Edge（帯域不足時のオフライン）、Transfer Family（SFTP）',
          'S3 データレイク＋ AWS Lake Formation で列レベルのきめ細かなアクセス制御、Athena でクエリ'
        ] },

      'c5-storage': { chapter: 'ch5', domain: 4, tasks: ['4.1'], count: 9, title: 'ストレージのコスト最適化',
        topics: [
          'アクセスパターンが不明・変化する：S3 Intelligent-Tiering（取り出し料金なし、少額のモニタリング料金）',
          'ライフサイクルルール：30日後に Standard-IA、90日後に Glacier Flexible Retrieval、7年後に削除',
          'Glacier Instant Retrieval（四半期に1回・ミリ秒取得）/ Flexible Retrieval（分〜時間）/ Deep Archive（12時間以内でよい長期保管）の選択',
          'S3 One Zone-IA：再作成可能なデータ（サムネイル・変換済みファイル）を低コストで',
          '最小保存期間と最小課金サイズの罠：短期間で削除する小さなオブジェクトは IA に移さない',
          'EBS gp2 → gp3 への移行でコスト削減、未アタッチボリュームの削除と Data Lifecycle Manager によるスナップショット管理',
          'EBS スナップショットアーカイブ：めったに使わない長期保管スナップショットのコスト削減（復元に時間がかかる）',
          'S3 リクエスタ支払い：データを取得する側に転送料金とリクエスト料金を負担させる',
          'EFS ライフサイクル管理：アクセスの少ないファイルを Infrequent Access／Archive クラスへ自動移動'
        ] },
      'c5-compute': { chapter: 'ch5', domain: 4, tasks: ['4.2'], count: 9, title: 'コンピューティングのコスト最適化',
        topics: [
          'Compute Savings Plans（ファミリー・リージョン・Fargate・Lambda に柔軟）と EC2 Instance Savings Plans（特定ファミリー・リージョンで割引大）',
          'リザーブドインスタンス：スタンダード vs コンバーティブル、容量予約が必要ならゾーン RI またはオンデマンドキャパシティ予約',
          'スポットインスタンス：中断可能・ステートレス・柔軟なバッチ処理、2分前の中断通知',
          'Auto Scaling の混合インスタンスポリシー：オンデマンドのベース容量＋スポット、複数インスタンスタイプ、容量最適化配分',
          'Dedicated Hosts：ソケット/コア単位の BYOL ライセンス要件（Dedicated Instances との違い）',
          '適切なサイジング：AWS Compute Optimizer の推奨に基づくダウンサイジング',
          'Graviton（Arm）インスタンスへの移行で価格性能比を改善',
          '開発環境を夜間・週末に停止（Instance Scheduler または EventBridge スケジュール＋自動化）',
          '断続的な処理を常時稼働の EC2 からイベント駆動の Lambda／Fargate へ移してアイドルコストを削減'
        ] },

      'c6-db': { chapter: 'ch6', domain: 4, tasks: ['4.3'], count: 7, title: 'データベースのコスト最適化',
        topics: [
          '断続的・予測不能な負荷の DB：Aurora Serverless v2（ACU 単位の課金で自動スケール）',
          '24時間365日安定稼働の RDS：リザーブド DB インスタンス',
          'DynamoDB オンデマンド vs プロビジョンド：予測可能なトラフィックはプロビジョンド＋Auto Scaling が安価',
          'DynamoDB Standard-IA テーブルクラス（ストレージ主体のテーブル）と TTL による期限切れ項目の無料削除',
          '商用 DB のライセンス費削減：Oracle/SQL Server から Aurora PostgreSQL へ（AWS SCT ＋ AWS DMS）',
          'ElastiCache で読み取りをオフロードし、DB インスタンスのスケールアップを回避',
          'Aurora I/O-Optimized：I/O 料金の比率が高いワークロードでのコスト予測性と削減'
        ] },
      'c6-net': { chapter: 'ch6', domain: 4, tasks: ['4.4'], count: 7, title: 'ネットワークのコスト最適化',
        topics: [
          'NAT ゲートウェイのデータ処理料金を削減：S3/DynamoDB 向けはゲートウェイ型 VPC エンドポイント（追加料金なし）',
          'インターフェイス型 VPC エンドポイント（時間＋データ処理料金）と NAT ゲートウェイ経由の比較',
          'AZ 間データ転送料金：通信が頻繁なコンポーネントの配置と、可用性とのトレードオフ',
          'CloudFront でオリジンからのデータ転送アウト料金とオリジン負荷を削減',
          'Direct Connect：大量のデータ転送アウトで、インターネット経由より低い転送料金',
          'VPC ピアリング（時間料金なし）と Transit Gateway（アタッチメント時間料金＋データ処理料金）のコスト比較',
          'NAT ゲートウェイの配置：AZ ごとに配置して AZ 間転送料金と AZ 障害の影響を回避（コストと可用性のバランス）'
        ] },

      'mock-d1': { mock: 'mockA', domain: 1, tasks: ['1.1', '1.2', '1.3'], count: 20, title: '模擬試験 第1分野',
        topics: [
          '[1.1] S3 署名付き URL で一時的なアップロード／ダウンロードを許可',
          '[1.1] CloudFront 署名付き Cookie で会員限定の複数ファイルを配信（OAC と組み合わせ）',
          '[1.1] IAM Access Analyzer：外部と共有されているリソースの検出・ポリシーの検証',
          '[1.1] AWS Control Tower でマルチアカウントのランディングゾーンとガードレール',
          '[1.1] Lambda 関数のリソースベースポリシー：別アカウントの S3 イベントからの呼び出しを許可',
          '[1.1] RDS の IAM データベース認証（短期の認証トークン）',
          '[1.1] タグを使った ABAC で、プロジェクト増加に強い権限設計',
          '[1.2] Systems Manager Session Manager：踏み台なし・インバウンドポート開放なしで EC2 に接続し操作ログを記録',
          '[1.2] AWS Network Firewall：VPC のステートフル検査とドメインベースのアウトバウンド制御',
          '[1.2] CloudFront ＋ WAF の前段配置と、ALB への直接アクセス防止（カスタムヘッダー／マネージドプレフィックスリスト）',
          '[1.2] VPC フローログで拒否された通信を分析',
          '[1.2] AWS Security Hub：セキュリティ基準のチェックと検出結果の集約',
          '[1.2] 3 層構成でセキュリティグループを参照元に指定し、必要最小限の通信だけ許可',
          '[1.2] ALB の認証アクション ＋ Cognito ユーザープールでアプリ改修なしにログインを追加',
          '[1.3] S3 ブロックパブリックアクセス（アカウントレベル）で誤公開を防止',
          '[1.3] EBS のデフォルト暗号化（リージョン単位の設定）',
          '[1.3] KMS マルチリージョンキーでリージョン間の暗号化データ移動を簡素化',
          '[1.3] Macie で個人情報を検出し EventBridge で通知・自動対応',
          '[1.3] S3 バージョニング ＋ Object Lock ガバナンスモードで誤削除・改ざんを防止（特権ユーザーは解除可能）',
          '[1.3] AWS Backup Vault Lock でバックアップの削除を防止し保持を強制'
        ] },
      'mock-d2': { mock: 'mockA', domain: 2, tasks: ['2.1', '2.2'], count: 17, title: '模擬試験 第2分野',
        topics: [
          '[2.1] SQS ロングポーリングで空の受信を減らす',
          '[2.1] SNS メッセージフィルタリングで購読者ごとに必要なメッセージだけ配信',
          '[2.1] Kinesis Data Streams と SQS の選択：レコード順序・リプレイ・複数アプリの同時読み取り',
          '[2.1] Lambda 非同期呼び出しの失敗時処理：失敗時の送信先（on-failure destination）/ DLQ',
          '[2.1] Step Functions Express ワークフローと Standard ワークフローの選択（高頻度・短時間）',
          '[2.1] SQS のキューの深さ（インスタンスあたりのバックログ）に基づくスケーリング',
          '[2.1] Amazon MQ：既存の JMS/AMQP アプリをコード変更最小で移行',
          '[2.1] S3 イベント通知 → SQS → Lambda でアップロード処理を疎結合化',
          '[2.1] Auto Scaling のライフサイクルフック：スケールイン前にログを退避',
          '[2.2] ELB ヘルスチェックを Auto Scaling のヘルスチェックに使い、異常インスタンスを自動置換',
          '[2.2] RDS マルチ AZ DB クラスター（読み取り可能なスタンバイ2つ）とマルチ AZ DB インスタンスの違い',
          '[2.2] CloudFront のオリジンフェイルオーバー（オリジングループ）',
          '[2.2] AWS Elastic Disaster Recovery：オンプレサーバーの DR（RPO 秒単位・RTO 分単位）',
          '[2.2] DynamoDB ポイントインタイムリカバリで誤った更新から復旧',
          '[2.2] EBS スナップショットのクロスリージョンコピーを Data Lifecycle Manager で自動化',
          '[2.2] Aurora のフェイルオーバー優先度（ティア）とレプリカ配置',
          '[2.2] 静的安定性：AZ 障害時も容量不足にならないよう複数 AZ に事前プロビジョニング'
        ] },
      'mock-d3': { mock: 'mockA', domain: 3, tasks: ['3.1', '3.2', '3.3', '3.4', '3.5'], count: 15, title: '模擬試験 第3分野',
        topics: [
          '[3.1] Storage Gateway（S3 ファイルゲートウェイ）：オンプレから NFS/SMB で S3 を使いローカルキャッシュで低レイテンシー',
          '[3.1] FSx for OpenZFS：オンプレの ZFS/NFS ワークロードを低レイテンシーのまま移行',
          '[3.1] EBS マルチアタッチ（io2）でクラスター対応アプリから同一ボリュームを共有',
          '[3.2] ゴールデン AMI（EC2 Image Builder）でブートストラップを減らし起動を高速化',
          '[3.2] EC2 休止（ハイバネーション）でメモリ状態を保持して高速再開',
          '[3.2] Lambda の予約された同時実行で下流のデータベースを保護',
          '[3.3] Aurora Global Database のセカンダリリージョンで遠隔ユーザーに低レイテンシー読み取り',
          '[3.3] Amazon Redshift：列指向 DWH と同時実行スケーリング',
          '[3.3] Amazon OpenSearch Service：全文検索とログ分析',
          '[3.4] Lambda@Edge／CloudFront Functions でエッジ処理（ヘッダー操作・リダイレクト）',
          '[3.4] Route 53 Resolver のインバウンド／アウトバウンドエンドポイントでハイブリッド DNS',
          '[3.4] API Gateway のエンドポイントタイプ（エッジ最適化 / リージョン / プライベート）の選択',
          '[3.5] Kinesis Data Streams の拡張ファンアウトで複数コンシューマーに専用スループット',
          '[3.5] Amazon EMR：大規模 Spark 処理（タスクノードにスポット）',
          '[3.5] Amazon MSK：既存の Kafka アプリを移行'
        ] },
      'mock-d4': { mock: 'mockA', domain: 4, tasks: ['4.1', '4.2', '4.3', '4.4'], count: 13, title: '模擬試験 第4分野',
        topics: [
          '[4.1] Storage Gateway テープゲートウェイで物理テープを置き換え（Glacier/Deep Archive に保管）',
          '[4.1] S3 Intelligent-Tiering のアーカイブアクセス階層（オプトイン）',
          '[4.1] S3 Glacier Deep Archive の一括取得（最も低コストな取得オプション）',
          '[4.1] AWS Backup のライフサイクルでコールドストレージへ移行',
          '[4.2] AWS Budgets のアラートと予算アクションでコスト超過を自動抑止',
          '[4.2] EC2 フリート／スポットの配分戦略（price-capacity-optimized）',
          '[4.2] Lambda を Arm（Graviton）アーキテクチャへ切り替え＋ Compute Optimizer でメモリ最適化',
          '[4.3] 開発用 RDS の停止（最大7日で自動起動）と、スナップショット化して削除する選択',
          '[4.3] RDS のストレージ自動スケーリングで過剰プロビジョニングを回避',
          '[4.3] Redshift Serverless：不定期な分析クエリで使った分だけ支払う',
          '[4.4] CloudFront の価格クラスで配信エッジを限定してコスト削減',
          '[4.4] リージョン間データ転送料金：DR 用レプリケーションの対象を必要なデータに絞る',
          '[4.4] IPv6 ＋ Egress-Only インターネットゲートウェイ（時間料金なし）でアウトバウンド専用通信'
        ] }
    },

    mockExams: {
      mockA: { title: '模擬試験（本番形式・65問）', groups: ['mock-d1', 'mock-d2', 'mock-d3', 'mock-d4'], minutes: 130 }
    },

    // 講義スライドの設計（slide writers はこの id・タイトル・内容で作る）
    slidePlans: {
      'pro-score-report': { chapter: 'prologue', layout: 'table', title: 'スコアレポートの読み方', plan: '4分野（配点30/26/24/20）・前回の判定（D1/D2 満たしている、D3/D4 改善が必要）・今回の方針を表に。note: 補整スコアリングで分野ごとの合否ラインはない／720点が合格ライン／弱点2分野で44%を占める' },
      'pro-study-plan': { chapter: 'prologue', layout: 'flow', title: '2週間リベンジ計画', plan: 'Day0 診断 → Day1–2 第1分野 → Day3–4 第2分野 → Day5–8 第3分野 → Day9–12 第4分野 → Day13 模擬試験 → Day14 本番。各ステップに狙いを一言' },
      'pro-question-reading': { chapter: 'prologue', layout: 'table', title: '問題文の読み方：要件 → 制約 → キーワード', plan: '頻出フレーズ → 選ぶべき方向（運用上のオーバーヘッドが最も少ない→マネージド/サーバーレス、最もコスト効率が高い→要件を満たす最安、高可用性→マルチAZ、疎結合→SQS/SNS/EventBridge、リアルタイム→Kinesis、マイクロ秒→DAX、一時的な認証情報→IAMロール/STS、変更を最小限に→互換サービス）' },
      'ch1-iam-eval': { chapter: 'ch1', layout: 'flow', title: 'IAM ポリシー評価ロジック', plan: '明示的Denyの確認 → SCP → リソースベースポリシー → アイデンティティベースポリシー → 権限の境界 → セッションポリシー → 最終判定（暗黙的Deny）。同一アカウント/クロスアカウントの違いを note で' },
      'ch1-iam-identities': { chapter: 'ch1', layout: 'compare', title: 'ユーザー・グループ・ロール・フェデレーション', plan: 'IAMユーザー（長期認証情報）/ IAMグループ / IAMロール（一時的な認証情報・AssumeRole）/ IAM Identity Center とフェデレーション（SAML・OIDC）' },
      'ch1-sg-nacl': { chapter: 'ch1', layout: 'table', title: 'セキュリティグループ vs ネットワーク ACL', plan: '適用単位・ステートフル/ステートレス・許可/拒否ルール・評価方法・戻りトラフィック・既定の動作を比較' },
      'ch1-vpc-endpoints': { chapter: 'ch1', layout: 'compare', title: 'VPC エンドポイント：ゲートウェイ型 vs インターフェイス型', plan: '対応サービス（S3/DynamoDB vs 多数）・仕組み（ルートテーブル vs ENI+プライベートIP）・料金・オンプレからの利用可否・ポリシー' },
      'ch1-threat-services': { chapter: 'ch1', layout: 'table', title: 'セキュリティサービスの使い分け', plan: 'WAF / Shield Standard・Advanced / GuardDuty / Macie / Inspector / Security Hub / Network Firewall / Firewall Manager：何を守る・何を検出する' },
      'ch1-encryption': { chapter: 'ch1', layout: 'table', title: '暗号化とシークレット管理', plan: 'SSE-S3 / SSE-KMS / DSSE-KMS / SSE-C / クライアント側暗号化、KMS（CMK・ローテーション・キーポリシー）、ACM、Secrets Manager vs Parameter Store' },
      'ch2-decoupling': { chapter: 'ch2', layout: 'table', title: 'メッセージング＆イベントサービス比較', plan: 'SQS / SNS / EventBridge / Kinesis Data Streams / Step Functions / Amazon MQ：モデル・典型ユースケース・キーワード' },
      'ch2-sqs-tips': { chapter: 'ch2', layout: 'bullets', title: 'SQS 頻出ポイント', plan: '標準とFIFO、可視性タイムアウト、DLQとmaxReceiveCount、ロングポーリング、遅延キュー、保持期間（既定4日・最大14日）、メッセージ重複排除ID/グループID（メッセージサイズ上限の数値は書かない）' },
      'ch2-ha-db': { chapter: 'ch2', layout: 'table', title: 'RDS マルチ AZ・リードレプリカ・Aurora', plan: 'レプリケーション方式・読み取り可否・フェイルオーバー・クロスリージョン・用途の比較（マルチAZ DBインスタンス / マルチAZ DBクラスター / リードレプリカ / Aurora レプリカ / Aurora Global Database）' },
      'ch2-dr-strategies': { chapter: 'ch2', layout: 'table', title: 'DR 4 戦略（RTO / RPO / コスト）', plan: 'バックアップと復元 / パイロットライト / ウォームスタンバイ / マルチサイト（アクティブ/アクティブ）：RTO・RPO の目安、常時稼働しているもの、コスト' },
      'ch2-route53': { chapter: 'ch2', layout: 'table', title: 'Route 53 ルーティングポリシー', plan: 'シンプル / 加重 / レイテンシー / フェイルオーバー / 位置情報 / 地理的近接性 / 複数値回答 / IPベース：使いどころ' },
      'ch3-ebs-types': { chapter: 'ch3', layout: 'table', title: 'EBS ボリュームタイプ早見表', plan: 'gp3 / gp2 / io2 Block Express / io1 / st1 / sc1：種別（SSD/HDD）・特徴・代表用途・ブート可否。gp3 はベースライン 3,000 IOPS・125 MiB/s で容量と独立に追加可能' },
      'ch3-file-storage': { chapter: 'ch3', layout: 'table', title: 'EFS / FSx / S3 / インスタンスストアの使い分け', plan: 'EFS / FSx for Windows File Server / FSx for Lustre / FSx for NetApp ONTAP / FSx for OpenZFS / S3 / インスタンスストア：プロトコル・特徴・キーワード' },
      'ch3-s3-performance': { chapter: 'ch3', layout: 'bullets', title: 'S3 パフォーマンス最適化', plan: 'プレフィックスあたり 3,500 PUT/COPY/POST/DELETE・5,500 GET/HEAD 毎秒、プレフィックス分散、マルチパートアップロード（100MB 超で推奨・5GB 超は必須）、Transfer Acceleration、バイト範囲フェッチ、CloudFront' },
      'ch3-ec2-families': { chapter: 'ch3', layout: 'table', title: 'EC2 インスタンスファミリーとプレイスメントグループ', plan: 'M/C/R/X/I/D/P/G/Inf/Trn の用途、クラスター/パーティション/スプレッドの特徴と用途、EFA/ENA' },
      'ch3-asg-policies': { chapter: 'ch3', layout: 'table', title: 'Auto Scaling ポリシーの種類', plan: 'ターゲット追跡 / ステップ / シンプル / スケジュール / 予測スケーリング：仕組みと使いどころ、ウォームプール、ウォームアップ、クールダウン' },
      'ch3-lambda-containers': { chapter: 'ch3', layout: 'table', title: 'Lambda / Fargate / ECS / EKS / Batch の選び方', plan: '実行時間・管理負荷・スケール特性・料金モデル・キーワード（最大15分、プロビジョニングされた同時実行、Kubernetes 互換、バッチジョブ）' },
      'ch4-db-select': { chapter: 'ch4', layout: 'table', title: '目的別データベースの選び方', plan: 'RDS / Aurora / DynamoDB / ElastiCache / Redshift / Neptune / DocumentDB / Keyspaces / Timestream / OpenSearch：データモデル・キーワード' },
      'ch4-caching': { chapter: 'ch4', layout: 'compare', title: 'キャッシュ戦略', plan: '遅延読み込み / 書き込みスルー / TTL の組み合わせの長所短所、DAX と ElastiCache の使い分け' },
      'ch4-elb': { chapter: 'ch4', layout: 'table', title: 'ALB / NLB / GWLB 比較', plan: 'レイヤー・プロトコル・ルーティング・静的IP・ターゲット・典型ユースケース' },
      'ch4-edge': { chapter: 'ch4', layout: 'compare', title: 'CloudFront vs Global Accelerator vs Route 53', plan: 'キャッシュの有無・対象プロトコル・IP・フェイルオーバー速度・ユースケース' },
      'ch4-hybrid-network': { chapter: 'ch4', layout: 'table', title: 'ハイブリッド接続と VPC 間接続', plan: 'Site-to-Site VPN / Direct Connect / Transit Gateway / VPC ピアリング / PrivateLink：特徴・推移性・帯域・キーワード' },
      'ch4-streaming': { chapter: 'ch4', layout: 'table', title: 'ストリーミングサービス比較', plan: 'Kinesis Data Streams / Amazon Data Firehose / Managed Service for Apache Flink / Amazon MSK：レイテンシー・管理負荷・用途' },
      'ch4-analytics': { chapter: 'ch4', layout: 'table', title: '分析とデータ移行サービス', plan: 'Glue / Athena / EMR / Redshift / Lake Formation / QuickSight / DataSync / Snowball Edge / Transfer Family / DMS：一言でいうと・キーワード' },
      'ch5-s3-classes': { chapter: 'ch5', layout: 'table', title: 'S3 ストレージクラス一覧', plan: 'Standard / Intelligent-Tiering / Standard-IA / One Zone-IA / Glacier Instant Retrieval / Glacier Flexible Retrieval / Glacier Deep Archive：取得時間・最小保存期間・取り出し料金・AZ数・用途' },
      'ch5-lifecycle': { chapter: 'ch5', layout: 'flow', title: 'ライフサイクルルール設計のコツ', plan: '作成 → 30日 Standard-IA → 90日 Glacier Flexible → 365日 Deep Archive → 削除 の例。note: IA系への移行は作成後30日以上、最小保存期間の課金、128KB未満は既定で移行されない、非現行バージョンや不完全なマルチパートの削除' },
      'ch5-ebs-cost': { chapter: 'ch5', layout: 'bullets', title: 'EBS とスナップショットのコスト最適化', plan: 'gp2→gp3、未アタッチボリューム、過剰プロビジョニングのIOPS、Data Lifecycle Manager、スナップショットアーカイブ（最低90日・復元に時間）、ごみ箱（誤削除対策）' },
      'ch5-purchase-options': { chapter: 'ch5', layout: 'table', title: 'EC2 購入オプション比較', plan: 'オンデマンド / Savings Plans / リザーブドインスタンス / スポット / Dedicated Hosts / Dedicated Instances / オンデマンドキャパシティ予約：割引の目安・コミット・向くワークロード' },
      'ch5-savings-plans': { chapter: 'ch5', layout: 'compare', title: 'Savings Plans と RI の違い', plan: 'Compute Savings Plans / EC2 Instance Savings Plans / スタンダード RI / コンバーティブル RI：柔軟性と割引率のトレードオフ、容量予約の有無' },
      'ch5-cost-tools': { chapter: 'ch5', layout: 'table', title: 'コスト管理ツール', plan: 'Cost Explorer / AWS Budgets / Cost Anomaly Detection / Data Exports（CUR）/ Compute Optimizer / Trusted Advisor / コスト配分タグ：何がわかる・何ができる' },
      'ch6-db-cost': { chapter: 'ch6', layout: 'table', title: 'データベースのコスト最適化', plan: 'Aurora Serverless v2 / リザーブド DB インスタンス / DynamoDB オンデマンド・プロビジョンド / Standard-IA テーブルクラス / TTL / Aurora I/O-Optimized / ElastiCache オフロード / 商用DBからの移行' },
      'ch6-data-transfer': { chapter: 'ch6', layout: 'table', title: 'データ転送料金マップ', plan: 'インバウンド / 同一AZ（プライベートIP）/ AZ間 / リージョン間 / インターネットへのアウト / CloudFront 経由 / Direct Connect：課金の有無と傾向（数値は「概算・リージョンにより異なる」と明記し、細かな単価は書かない）' },
      'ch6-nat-endpoints': { chapter: 'ch6', layout: 'compare', title: 'NAT ゲートウェイ vs VPC エンドポイントのコスト', plan: 'NAT（時間＋処理GB）/ ゲートウェイ型エンドポイント（追加料金なし）/ インターフェイス型（時間＋処理GB）/ Egress-Only IGW（IPv6）：使い分け' },
      'ch6-network-cost': { chapter: 'ch6', layout: 'table', title: 'VPC 接続方式のコスト比較', plan: 'VPC ピアリング / Transit Gateway / PrivateLink / Site-to-Site VPN / Direct Connect：料金要素とスケール時の考え方' },
      'ch7-final-checklist': { chapter: 'ch7', layout: 'table', title: '直前チェック：キーワード → サービス対応表', plan: '全分野の頻出キーワード 15〜20 行（例：ミリ秒→DAX/ElastiCache、静的IP＋TCP→NLB/Global Accelerator、順序保証→SQS FIFO/Kinesis、アクセス頻度不明→Intelligent-Tiering など）' },
      'ch7-exam-tactics': { chapter: 'ch7', layout: 'bullets', title: '本番の戦い方', plan: '65問130分（1問2分ペース）、まず最後の一文で問われていることを確認、要件/制約に線を引く、消去法、迷ったらフラグ、見直しの順番、体調管理' }
    },

    // ハンズオンラボの設計（lab writers はこの id で作る）
    labPlans: {
      'lab-iam-eval': { chapter: 'ch1', domain: 1, task: '1.1', title: 'IAM ポリシー評価ラボ', plan: 'verdict：アイデンティティポリシー＋SCP＋権限の境界＋S3バケットポリシーを提示し、6〜8ケースを許可/拒否判定（明示的Deny・Allowなし・SCPで制限・境界で制限・クロスアカウント）。最後に choice 1問' },
      'lab-sg-nacl': { chapter: 'ch1', domain: 1, task: '1.2', title: 'SG と NACL のパケット判定ラボ', plan: 'verdict：SG（ステートフル）と NACL（ステートレス、エフェメラルポート 1024-65535）の表で、往路・復路の通信を判定。続いて terminal：aws ec2 authorize-security-group-ingress で ALB の SG からのみ 443 を許可' },
      'lab-decouple': { chapter: 'ch2', domain: 2, task: '2.1', title: '注文処理の疎結合化ラボ', plan: 'slots：API Gateway → Lambda → SNS → 複数SQS（ファンアウト）→ ワーカー、DLQ の配置。choice：可視性タイムアウト。terminal：aws sqs set-queue-attributes で VisibilityTimeout を設定' },
      'lab-dr-strategy': { chapter: 'ch2', domain: 2, task: '2.2', title: 'DR 戦略セレクター', plan: 'match：5つの業務シナリオ（RTO/RPO/予算）→ バックアップと復元 / パイロットライト / ウォームスタンバイ / マルチサイト。order：パイロットライトのフェイルオーバー手順を並べ替え' },
      'lab-storage-select': { chapter: 'ch3', domain: 3, task: '3.1', title: 'ストレージ選定ラボ', plan: 'match：6つのワークロード → gp3 / io2 Block Express / st1 / インスタンスストア / EFS / FSx for Lustre / FSx for Windows File Server / S3。calc：gp3 で 8,000 IOPS・250 MiB/s に必要な追加プロビジョニング量（ベースライン 3,000 IOPS・125 MiB/s）' },
      'lab-asg-sim': { chapter: 'ch3', domain: 3, task: '3.2', title: 'Auto Scaling チューニングラボ', plan: 'brief → sim asg（office プロファイル：朝9時の急増）で過負荷とコストの目標を満たす → choice：予測可能な朝のピークに最適なポリシー' },
      'lab-dynamodb-capacity': { chapter: 'ch4', domain: 3, task: '3.3', title: 'DynamoDB キャパシティ計算ラボ', plan: 'calc：RCU（強力な整合性/結果整合性、4KB 単位の切り上げ）、WCU（1KB 単位）、トランザクションは2倍。choice：読み取りレイテンシーをマイクロ秒にするには（DAX）' },
      'lab-global-network': { chapter: 'ch4', domain: 3, task: '3.4', title: 'グローバル配信アーキテクチャラボ', plan: 'slots：静的コンテンツ（CloudFront＋OAC＋S3）、ゲームの UDP 通信（Global Accelerator＋NLB）、API の最寄りリージョン振り分け（Route 53 レイテンシー）。terminal：aws cloudfront create-invalidation でキャッシュ無効化' },
      'lab-kinesis-pipeline': { chapter: 'ch4', domain: 3, task: '3.5', title: 'ストリーミング分析パイプラインラボ', plan: 'calc：必要シャード数（書き込み 1MB/s または 1,000 レコード/s、読み取り 2MB/s）。slots：KDS → Managed Service for Apache Flink → Data Firehose → S3（Parquet）→ Glue Data Catalog → Athena' },
      'lab-s3-lifecycle': { chapter: 'ch5', domain: 4, task: '4.1', title: 'S3 ライフサイクル・コストラボ', plan: 'sim s3cost：ログデータ（30日は頻繁、以降はほぼ参照なし、監査で12時間以内に取得できればよい、7年保管）で40%以上削減。terminal：aws s3api put-bucket-lifecycle-configuration --bucket ... --lifecycle-configuration file://lifecycle.json（files に lifecycle.json）' },
      'lab-purchase-options': { chapter: 'ch5', domain: 4, task: '4.2', title: '購入オプション最適化ラボ', plan: 'match：6つのワークロード → オンデマンド / Compute Savings Plans / EC2 Instance Savings Plans / スタンダード RI / スポット / Dedicated Hosts。calc：割引率から年間削減額を計算（学習用の概算値）' },
      'lab-db-cost': { chapter: 'ch6', domain: 4, task: '4.3', title: 'データベースコスト最適化ラボ', plan: 'match：DB ワークロード → Aurora Serverless v2 / リザーブド DB インスタンス / DynamoDB オンデマンド / DynamoDB プロビジョンド＋Auto Scaling / Standard-IA テーブルクラス。calc：オンデマンドとプロビジョンドの月額比較（学習用の概算単価を明示）' },
      'lab-nat-endpoint': { chapter: 'ch6', domain: 4, task: '4.4', title: 'NAT ゲートウェイ コスト削減ラボ', plan: 'calc：NAT のデータ処理料金（学習用の概算単価）を計算。terminal：aws ec2 create-vpc-endpoint --vpc-id ... --vpc-endpoint-type Gateway --service-name com.amazonaws.ap-northeast-1.s3 --route-table-ids ...。verdict：どの通信が NAT を経由し続けるか判定' }
    }
  };
})();
