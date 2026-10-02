// 講義スライド：第6章 コスト最適化②（データベースとネットワーク）
(function () {
  'use strict';
  SAA.registerSlides([
    {
      id: 'ch6-db-cost', chapter: 'ch6',
      title: 'データベースのコスト最適化',
      layout: 'table',
      columns: ['状況', '打ち手', 'ポイント'],
      rows: [
        ['断続的・変動が大きい', 'Aurora Serverless v2', '使った ACU だけ課金'],
        ['24時間365日・安定', 'リザーブド DB インスタンス', '1/3年、前払いほど割引大'],
        ['DynamoDB・予測可能', 'プロビジョンド＋Auto Scaling', 'オンデマンドより安くなりやすい'],
        ['DynamoDB・予測不能／新規', 'オンデマンド', '計画不要・リクエスト課金'],
        ['DynamoDB・ストレージが大半', 'Standard-IA テーブルクラス', 'ストレージ単価が安い'],
        ['期限切れデータ', 'DynamoDB TTL', '**無料**で自動削除'],
        ['同じデータの繰り返し読み取り', 'ElastiCache でオフロード', 'DB の大型化より安い'],
        ['Aurora の I/O 料金が大きい', 'Aurora I/O-Optimized', 'I/O 料金なし・予測しやすい'],
        ['商用 DB のライセンス', 'SCT＋DMS で Aurora へ', 'ライセンス費をなくす']
      ],
      note: 'まず請求書の**内訳**を見る。インスタンス・ストレージ・I/O・ライセンスのどれが大きいかで打ち手が変わる。',
      keywords: ['Aurora Serverless v2', 'リザーブド DB インスタンス', 'DynamoDB', 'TTL', 'Aurora I/O-Optimized']
    },
    {
      id: 'ch6-data-transfer', chapter: 'ch6',
      title: 'データ転送料金マップ',
      layout: 'table',
      lead: 'データ転送は「高速道路の料金所」。どこを通ると通行料がかかるかを覚えよう（単価は概算・リージョンにより異なる）。',
      columns: ['経路', '料金', 'ひとこと'],
      rows: [
        ['インターネット → AWS（イン）', '**無料**', 'アップロードは基本無料'],
        ['同じ AZ 内（プライベート IP）', '**無料**', 'パブリック IP 経由は課金されることがある'],
        ['AZ 間', '課金（双方向）', 'マルチ AZ の通信量に注意'],
        ['リージョン間', '課金', 'レプリケーション対象を絞る'],
        ['AWS → インターネット（アウト）', '課金（最も高い傾向）', 'CloudFront 経由で削減'],
        ['AWS オリジン → CloudFront', '**無料**', 'エッジでキャッシュして配信'],
        ['同一リージョンの EC2 ↔ S3', '**無料**', 'ただし NAT 経由だと NAT の処理料金'],
        ['Direct Connect 経由のアウト', '課金（インターネットより安い）', '大量転送なら有利']
      ],
      note: '「同じ AZ の中にとどめる」「CloudFront を挟む」「NAT を通さない（エンドポイント）」が三大節約術。',
      keywords: ['データ転送料金', 'AZ 間', 'リージョン間', 'CloudFront', 'Direct Connect']
    },
    {
      id: 'ch6-nat-endpoints', chapter: 'ch6',
      title: 'NAT ゲートウェイ vs VPC エンドポイントのコスト',
      layout: 'compare',
      items: [
        { title: 'NAT ゲートウェイ', tag: '時間＋処理 GB', body: 'プライベートサブネットからインターネットへ出る出口。**処理したデータ量に課金**。AZ ごとのリソース（AZ ごとに置くのが基本）。' },
        { title: 'ゲートウェイ型エンドポイント', tag: '追加料金なし', body: '**S3 と DynamoDB** 専用。ルートテーブルに経路を追加するだけ。NAT を通る S3 通信はこれに切り替える。' },
        { title: 'インターフェイス型エンドポイント', tag: '時間＋処理 GB（NAT より安い単価）', body: 'S3/DynamoDB 以外の多くのサービス（ECR、CloudWatch、SSM…）。大量通信なら NAT より安くなることが多い。' },
        { title: 'Egress-Only インターネットゲートウェイ', tag: '時間料金なし', body: '**IPv6** のアウトバウンド専用の出口。IPv6 なら NAT は不要。' }
      ],
      note: '請求書で「NatGateway-Bytes」が大きい → まず通信先を調べ、S3/DynamoDB はゲートウェイ型へ、それ以外の AWS サービスはインターフェイス型を検討。',
      keywords: ['NAT ゲートウェイ', 'ゲートウェイ型エンドポイント', 'インターフェイス型エンドポイント', 'Egress-Only IGW', 'データ処理料金']
    },
    {
      id: 'ch6-network-cost', chapter: 'ch6',
      title: 'VPC 接続方式のコスト比較',
      layout: 'table',
      columns: ['方式', '主な料金要素', 'コストが有利な場面'],
      rows: [
        ['VPC ピアリング', '接続料金なし（AZ 間・リージョン間の転送料金のみ）', '**少数の VPC**、大量通信'],
        ['Transit Gateway', 'アタッチメント時間料金＋処理 GB', '**多数の VPC＋オンプレ**、管理の簡素化'],
        ['AWS PrivateLink', 'エンドポイント時間料金＋処理 GB', 'サービス単位の公開、CIDR 重複'],
        ['Site-to-Site VPN', '接続時間料金＋インターネットへの転送料金', '小〜中規模、すぐに使いたい'],
        ['Direct Connect', 'ポート時間料金＋（安い）転送料金', '**大量・継続的**なデータ転送']
      ],
      note: '「便利さ」と「コスト」はトレードオフ。2つの VPC を結ぶだけなら VPC ピアリング、数十の VPC を束ねるなら Transit Gateway。',
      keywords: ['VPC ピアリング', 'Transit Gateway', 'PrivateLink', 'Site-to-Site VPN', 'Direct Connect']
    }
  ]);
})();
