// 講義スライド：第4章 高性能アーキテクチャ②（データベース・ネットワーク・データ分析）
(function () {
  'use strict';
  SAA.registerSlides([
    {
      id: 'ch4-db-select', chapter: 'ch4',
      title: '目的別データベースの選び方',
      layout: 'table',
      columns: ['データベース', 'モデル', 'キーワード'],
      rows: [
        ['RDS', 'リレーショナル', '既存の MySQL/PostgreSQL/Oracle/SQL Server'],
        ['Aurora', 'リレーショナル（クラウド最適化）', '高性能、最大15レプリカ、Serverless v2'],
        ['DynamoDB', 'キーバリュー／ドキュメント', 'ミリ秒、無制限のスケール、サーバーレス'],
        ['ElastiCache', 'インメモリ', 'キャッシュ、セッション、ランキング'],
        ['Redshift', '列指向 DWH', '大量データの分析 SQL、BI'],
        ['Neptune', 'グラフ', 'SNS の関係、レコメンド、不正検知'],
        ['DocumentDB', 'ドキュメント（MongoDB 互換）', 'MongoDB からの移行'],
        ['Timestream／Keyspaces', '時系列／Cassandra 互換', 'IoT の時系列、Cassandra 移行']
      ],
      note: '問題文の「データの形」と「互換性」で選ぶ。MongoDB → DocumentDB、Cassandra → Keyspaces、関係性 → Neptune、全文検索 → OpenSearch。',
      keywords: ['RDS', 'Aurora', 'DynamoDB', 'Redshift', 'Neptune', 'DocumentDB']
    },
    {
      id: 'ch4-caching', chapter: 'ch4',
      title: 'キャッシュ戦略',
      layout: 'compare',
      lead: 'よく使う調味料は手元に置く。何を、いつ置き、いつ捨てるかがキャッシュ戦略だ。',
      items: [
        { title: '遅延読み込み（Lazy loading）', tag: 'メモリ効率', body: 'キャッシュミスのときだけ DB から読んで格納。**使うデータだけ**が載る。\n弱点：初回は遅い、データが**古くなり得る**。' },
        { title: '書き込みスルー（Write-through）', tag: '常に新しい', body: 'DB への書き込みと同時にキャッシュも更新。**常に最新**。\n弱点：**使われないデータ**も載り、書き込みが少し遅くなる。' },
        { title: 'TTL（有効期限）', tag: '鮮度の保険', body: '一定時間でキャッシュを自動で無効化。どちらの戦略とも組み合わせられる。' },
        { title: 'DAX と ElastiCache', tag: '使い分け', body: '**DAX**：DynamoDB 専用、API 互換で**マイクロ秒**。\n**ElastiCache**：RDS など何でも。Valkey/Redis OSS は**データ構造・レプリケーション**、Memcached は**シンプル・マルチスレッド**。' }
      ],
      note: '「参照されたデータだけをキャッシュ」→ 遅延読み込み、「古いデータを残さない」→ TTL、「ランキング」→ Valkey/Redis OSS のソート済みセット。',
      keywords: ['キャッシュ戦略', '遅延読み込み', '書き込みスルー', 'TTL', 'DAX', 'ElastiCache']
    },
    {
      id: 'ch4-elb', chapter: 'ch4',
      title: 'ALB / NLB / GWLB 比較',
      layout: 'table',
      columns: ['項目', 'ALB', 'NLB', 'GWLB'],
      rows: [
        ['レイヤー', 'L7（HTTP/HTTPS/gRPC）', 'L4（TCP/UDP/TLS）', 'L3（IP パケット）'],
        ['ルーティング', 'パス・ホスト・ヘッダー', 'ポート', 'アプライアンスへ透過的に'],
        ['固定 IP', 'なし', '**AZ ごとに静的 IP、EIP 可**', '—'],
        ['性能', '高い', '**超低レイテンシー・数百万 rps**', '—'],
        ['典型例', 'マイクロサービス、Web', 'ゲーム、金融、独自プロトコル', 'ファイアウォール・IDS の挿入']
      ],
      note: '「パスで振り分け」→ ALB、「固定 IP・TCP/UDP・極低レイテンシー」→ NLB、「サードパーティのセキュリティアプライアンス」→ GWLB。',
      keywords: ['ALB', 'NLB', 'GWLB', 'ロードバランサー', '静的 IP']
    },
    {
      id: 'ch4-edge', chapter: 'ch4',
      title: 'CloudFront vs Global Accelerator vs Route 53',
      layout: 'compare',
      items: [
        { title: 'Amazon CloudFront', tag: 'CDN（キャッシュあり）', body: 'エッジで**コンテンツをキャッシュ**して配信。HTTP/HTTPS。OAC で S3 を保護、WAF と連携。\n例：静的サイト、動画、API の高速化。' },
        { title: 'AWS Global Accelerator', tag: 'ネットワーク高速化（キャッシュなし）', body: '**2つの静的エニーキャスト IP**。**TCP/UDP**。AWS のバックボーン経由で最適なリージョンへ、**数十秒以内のフェイルオーバー**。\n例：ゲーム、IoT、固定 IP が必要。' },
        { title: 'Amazon Route 53', tag: 'DNS', body: '名前解決でリージョンやエンドポイントを選ぶ（レイテンシー・位置情報・フェイルオーバー）。DNS キャッシュ（TTL）の影響を受ける。' }
      ],
      note: '「宅配ロッカー（CloudFront）」は荷物を近くに置いておく。「高速道路（Global Accelerator）」は荷物を置かず、速い道で本社まで運ぶ。',
      keywords: ['CloudFront', 'Global Accelerator', 'Route 53', 'エニーキャスト', 'エッジ']
    },
    {
      id: 'ch4-hybrid-network', chapter: 'ch4',
      title: 'ハイブリッド接続と VPC 間接続',
      layout: 'table',
      columns: ['方式', '特徴', 'キーワード'],
      rows: [
        ['Site-to-Site VPN', 'インターネット上の IPsec。すぐ使える・安い', '暗号化、短期間で構築、DX のバックアップ'],
        ['Direct Connect', '**専用線**。安定した帯域・低レイテンシー（既定で暗号化なし）', '大容量・安定、DX 上の VPN／MACsec で暗号化'],
        ['Transit Gateway', 'VPC・VPN・DX の**ハブ**（推移的ルーティング）', '多数の VPC、ハブアンドスポーク'],
        ['VPC ピアリング', '2つの VPC を直接接続。**推移しない**、CIDR 重複不可', '少数の VPC、低コスト'],
        ['AWS PrivateLink', '**サービス単位**でプライベート公開（NLB の背後）', 'SaaS 提供、CIDR 重複 OK']
      ],
      note: '「多数の VPC＋オンプレ」→ Transit Gateway。「自社サービスを他社 VPC に」→ PrivateLink。「安定した帯域」→ Direct Connect（＋ VPN で冗長化）。',
      keywords: ['Site-to-Site VPN', 'Direct Connect', 'Transit Gateway', 'VPC ピアリング', 'PrivateLink']
    },
    {
      id: 'ch4-streaming', chapter: 'ch4',
      title: 'ストリーミングサービス比較',
      layout: 'table',
      columns: ['サービス', 'ひとことで', '決め手'],
      rows: [
        ['Kinesis Data Streams', 'リアルタイムのベルトコンベア', '複数コンシューマー、**順序**、**リプレイ**、シャード'],
        ['Amazon Data Firehose（旧 Kinesis Data Firehose）', 'S3・Redshift などへ**運ぶ**係', '**運用不要**、ニアリアルタイム、**形式変換（Parquet）**'],
        ['Managed Service for Apache Flink（旧 Kinesis Data Analytics）', '流れの中で**分析**', 'ウィンドウ集計、異常検知、秒単位'],
        ['Amazon MSK', 'マネージド Apache Kafka', '既存の **Kafka** アプリの移行']
      ],
      note: 'KDS のシャード：書き込み **1 MB/秒 または 1,000 レコード/秒**、読み取り **2 MB/秒**（拡張ファンアウトはコンシューマーごとに 2 MB/秒）。オンデマンドモードならシャード管理不要。',
      keywords: ['Kinesis Data Streams', 'Data Firehose', 'Apache Flink', 'MSK', 'シャード']
    },
    {
      id: 'ch4-analytics', chapter: 'ch4',
      title: '分析とデータ移行サービス',
      layout: 'table',
      columns: ['サービス', 'ひとことで', 'キーワード'],
      rows: [
        ['AWS Glue', 'サーバーレス ETL＋Data Catalog', 'クローラー、スキーマ管理、Parquet 変換'],
        ['Amazon Athena', 'S3 を直接 SQL で分析', 'サーバーレス、**スキャン量課金**'],
        ['Amazon EMR', 'Spark／Hadoop クラスター', '大規模分散処理、スポット活用'],
        ['Amazon Redshift', '列指向データウェアハウス', 'BI、Spectrum、同時実行スケーリング'],
        ['AWS Lake Formation', 'データレイクの権限管理', '**列・行レベル**のアクセス制御'],
        ['Amazon QuickSight', 'BI ダッシュボード', '可視化'],
        ['AWS DataSync', 'オンライン転送・同期', 'NFS/SMB → S3/EFS/FSx、検証・再試行'],
        ['Snowball Edge／Transfer Family／DMS', 'オフライン移行／SFTP／DB 移行', '帯域不足／ファイル受け渡し／DB の移行']
      ],
      note: 'Athena を速く安く：**Parquet（列指向）＋圧縮＋パーティション分割**。帯域が十分なら DataSync、足りないなら Snowball Edge。',
      keywords: ['Glue', 'Athena', 'EMR', 'Redshift', 'Lake Formation', 'DataSync']
    }
  ]);
})();
