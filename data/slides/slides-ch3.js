// 講義スライド：第3章 高性能アーキテクチャ①（ストレージとコンピューティング）
(function () {
  'use strict';
  SAA.registerSlides([
    {
      id: 'ch3-ebs-types', chapter: 'ch3',
      title: 'EBS ボリュームタイプ早見表',
      layout: 'table',
      columns: ['タイプ', '種別', '特徴', '代表的な用途'],
      rows: [
        ['**gp3**', 'SSD', 'ベースライン 3,000 IOPS・125 MiB/s。**容量と独立に**性能を追加', 'ほとんどのワークロード（既定の選択）'],
        ['gp2', 'SSD', '性能は**容量に比例**（3 IOPS/GiB）', '旧世代。gp3 への移行が推奨'],
        ['**io2 Block Express**', 'SSD', '最高クラスの IOPS、**サブミリ秒**、耐久性 99.999%', 'ミッションクリティカルな DB'],
        ['io1', 'SSD', 'プロビジョンド IOPS（旧世代）', '高 IOPS の DB'],
        ['**st1**', 'HDD', '**スループット最適化**、シーケンシャル向け', 'ログ処理、ビッグデータ、DWH'],
        ['**sc1**', 'HDD', '最も安価、低スループット', 'アクセスの少ないコールドデータ']
      ],
      note: 'HDD（st1・sc1）は**ブートボリュームに使えない**。「消えてもよい一時データで最速」→ EBS ではなく**インスタンスストア**。',
      keywords: ['EBS', 'gp3', 'io2 Block Express', 'st1', 'sc1', 'IOPS']
    },
    {
      id: 'ch3-file-storage', chapter: 'ch3',
      title: 'EFS / FSx / S3 / インスタンスストアの使い分け',
      layout: 'table',
      columns: ['ストレージ', 'プロトコル・形態', 'キーワード'],
      rows: [
        ['Amazon EFS', 'NFS（Linux）・マルチ AZ', '多数の Linux から共有、Elastic スループット'],
        ['FSx for Windows File Server', 'SMB・AD 統合', 'Windows のファイル共有、DFS'],
        ['FSx for Lustre', '並列ファイルシステム', 'HPC・機械学習、**S3 とのリンク**'],
        ['FSx for NetApp ONTAP', 'NFS・SMB・iSCSI', '**マルチプロトコル**、NetApp からの移行'],
        ['FSx for OpenZFS', 'NFS', 'ZFS からの移行、低レイテンシー'],
        ['Amazon S3', 'オブジェクト（HTTP API）', '容量無制限、静的コンテンツ、データレイク'],
        ['インスタンスストア', 'ブロック（ホスト直結）', '**一時データ**、最高のランダム I/O']
      ],
      note: '「Linux で共有」→ EFS、「Windows・SMB・AD」→ FSx for Windows、「HPC」→ FSx for Lustre、「NFS と SMB の両方」→ FSx for NetApp ONTAP。',
      keywords: ['EFS', 'FSx for Windows File Server', 'FSx for Lustre', 'FSx for NetApp ONTAP', 'インスタンスストア']
    },
    {
      id: 'ch3-s3-performance', chapter: 'ch3',
      title: 'S3 パフォーマンス最適化',
      layout: 'bullets',
      bullets: [
        'リクエスト性能は**プレフィックスごと**に毎秒 3,500 件の PUT/COPY/POST/DELETE、5,500 件の GET/HEAD',
        '  - プレフィックスを分散すれば、並列にいくらでも伸ばせる（プレフィックス数に上限なし）',
        '**マルチパートアップロード**：100 MB を超えたら推奨、**5 GB 超は必須**（1回の PUT は最大 5 GB、オブジェクトは最大 5 TB）',
        '**S3 Transfer Acceleration**：エッジロケーション経由で**遠隔地からの転送**を高速化（追加料金）',
        '**バイト範囲フェッチ**：Range ヘッダーで大きなオブジェクトを並列ダウンロード',
        '繰り返し読まれるコンテンツは **CloudFront** でエッジキャッシュ',
        '503 Slow Down が出たら、プレフィックスの分散と再試行（指数バックオフ）'
      ],
      note: '「大きいファイル」→ マルチパート、「遠い場所から」→ Transfer Acceleration、「503」→ プレフィックス分散。',
      keywords: ['S3', 'プレフィックス', 'マルチパートアップロード', 'Transfer Acceleration', 'バイト範囲フェッチ']
    },
    {
      id: 'ch3-ec2-families', chapter: 'ch3',
      title: 'EC2 インスタンスファミリーとプレイスメントグループ',
      layout: 'table',
      columns: ['分類', '代表', '向いているワークロード'],
      rows: [
        ['汎用', 'M、T（バースト）', 'Web アプリ、中小規模の DB'],
        ['コンピューティング最適化', 'C', 'バッチ、エンコード、科学計算'],
        ['メモリ最適化', 'R、X', 'インメモリ DB・分析、大規模キャッシュ'],
        ['ストレージ最適化', 'I、D', '高い I/O、NoSQL、データウェアハウス'],
        ['高速コンピューティング', 'P、G、Inf、Trn', '機械学習、GPU、推論・学習'],
        ['PG：クラスター', '1 AZ に近接配置', '**低レイテンシー**の HPC（EFA と併用）'],
        ['PG：パーティション', 'パーティション間でハード非共有', 'HDFS、HBase、Cassandra'],
        ['PG：スプレッド', '個別のハードに分散（AZ あたり7台）', '少数の**重要インスタンス**の同時障害回避']
      ],
      note: '「何が足りないか」でファミリーを選ぶ。MPI で密に通信する HPC → **EFA＋クラスタープレイスメントグループ**。',
      keywords: ['インスタンスファミリー', 'プレイスメントグループ', 'クラスター', 'パーティション', 'スプレッド', 'EFA']
    },
    {
      id: 'ch3-asg-policies', chapter: 'ch3',
      title: 'Auto Scaling ポリシーの種類',
      layout: 'table',
      columns: ['ポリシー', '仕組み', '使いどころ'],
      rows: [
        ['ターゲット追跡', '指標を**目標値に保つ**（例：CPU 50%）', 'まず最初に検討。設計が楽'],
        ['ステップ', 'アラームの超過幅ごとに増減数を決める', '細かく制御したい'],
        ['シンプル', '1アラーム→決まった数、クールダウン待ち', '旧来。基本は使わない'],
        ['スケジュール', '**決まった時刻**に容量を変更', '毎朝9時のピークなど'],
        ['予測スケーリング', '過去の**周期パターン**から先回り', '日次・週次で繰り返す負荷'],
        ['ウォームプール', '初期化済みインスタンスを停止状態で待機', '**起動・初期化が遅い**アプリ']
      ],
      note: 'ターゲット追跡・ステップは負荷が上がってから反応する。**予測できるピーク**や**起動が遅いアプリ**には、先回り（スケジュール・予測・ウォームプール）を組み合わせる。',
      keywords: ['Auto Scaling', 'ターゲット追跡', 'スケジュール', '予測スケーリング', 'ウォームプール']
    },
    {
      id: 'ch3-lambda-containers', chapter: 'ch3',
      title: 'Lambda / Fargate / ECS / EKS / Batch の選び方',
      layout: 'table',
      columns: ['サービス', '特徴', '決め手のキーワード'],
      rows: [
        ['AWS Lambda', 'イベント駆動、**最大 15 分**、CPU は**メモリに比例**', '短い処理、使った分だけ課金'],
        ['Lambda の同時実行', 'プロビジョニング＝事前初期化、予約＝枠の確保と上限', 'コールドスタート対策 → プロビジョニング'],
        ['ECS on Fargate', 'サーバー管理不要のコンテナ', '「インスタンスを管理したくない」'],
        ['ECS（EC2 起動タイプ）', '自分の EC2 上でコンテナ', 'GPU、特定のインスタンスタイプ'],
        ['Amazon EKS', 'マネージド Kubernetes', '既存の Kubernetes 資産・ツール'],
        ['AWS Batch', 'ジョブキュー＋リソース自動調整', '大量のバッチジョブ、スポット活用']
      ],
      note: '15 分を超える処理は Lambda では動かせない → Fargate や Batch。「Kubernetes」と書いてあれば EKS。',
      keywords: ['Lambda', 'Fargate', 'ECS', 'EKS', 'AWS Batch', 'プロビジョニングされた同時実行']
    }
  ]);
})();
