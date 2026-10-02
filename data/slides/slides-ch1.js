// 講義スライド：第1章 セキュアなアーキテクチャ
(function () {
  'use strict';
  SAA.registerSlides([
    {
      id: 'ch1-iam-eval', chapter: 'ch1',
      title: 'IAM ポリシー評価ロジック',
      layout: 'flow',
      lead: 'リクエストが許可されるかどうかは、次の順に評価される。**どこかで明示的な Deny に当たったら即「拒否」**。',
      steps: [
        { title: '明示的な Deny はあるか？', body: 'すべてのポリシーのどこかに Deny があれば**拒否**（最優先）。' },
        { title: 'SCP（Organizations）', body: 'SCP で許可されていない操作は**拒否**。SCP は権限を与えない「ガードレール」。' },
        { title: 'リソースベースポリシー', body: 'S3 バケットポリシーなど。同一アカウントなら、ここで Allow されれば許可されることもある。' },
        { title: 'アイデンティティベースポリシー', body: 'ユーザー・ロールにアタッチした IAM ポリシーで Allow が必要。' },
        { title: '権限の境界', body: '設定されていれば、その範囲内でしか許可されない。' },
        { title: 'セッションポリシー', body: 'AssumeRole 時などに渡した場合、その範囲に制限される。' },
        { title: '最終判定', body: 'どこにも Allow がなければ**暗黙的な Deny（拒否）**。' }
      ],
      note: '**クロスアカウント**のアクセスでは、呼び出し側の IAM ポリシー**と**相手側のリソースベースポリシー（または信頼ポリシー）の**両方**で許可が必要。',
      keywords: ['IAM', 'ポリシー評価', '明示的な Deny', 'SCP', '権限の境界']
    },
    {
      id: 'ch1-iam-identities', chapter: 'ch1',
      title: 'ユーザー・グループ・ロール・フェデレーション',
      layout: 'compare',
      lead: '「誰が」「どんな認証情報で」AWS を使うのかを整理しよう。',
      items: [
        { title: 'IAM ユーザー', tag: '長期の認証情報', body: 'パスワード・アクセスキーを持つ。**アプリやサーバーに埋め込まない**。人の利用は Identity Center への移行が推奨。' },
        { title: 'IAM グループ', tag: '権限のまとめ役', body: 'ユーザーをまとめてポリシーを付与する。グループ自体はログインできない。' },
        { title: 'IAM ロール', tag: '一時的な認証情報', body: 'EC2・Lambda・他アカウント・フェデレーションユーザーが**引き受けて（AssumeRole）**使う。キーの管理が不要。' },
        { title: 'IAM Identity Center／フェデレーション', tag: 'SSO', body: '外部 IdP（SAML／OIDC）の ID で複数アカウントへ**シングルサインオン**。権限セットで一元管理。' }
      ],
      note: '「アクセスキーを使わずに」「一時的な認証情報」「別アカウントへ」→ **IAM ロール**。「社員の ID で複数アカウントにログイン」→ **IAM Identity Center**。',
      keywords: ['IAM ユーザー', 'IAM ロール', 'AssumeRole', 'IAM Identity Center', 'フェデレーション']
    },
    {
      id: 'ch1-sg-nacl', chapter: 'ch1',
      title: 'セキュリティグループ vs ネットワーク ACL',
      layout: 'table',
      columns: ['項目', 'セキュリティグループ', 'ネットワーク ACL'],
      rows: [
        ['適用単位', 'ENI（インスタンス）', 'サブネット'],
        ['状態', '**ステートフル**', '**ステートレス**'],
        ['戻りの通信', '自動で許可', '**明示的に許可が必要**（エフェメラルポート）'],
        ['ルール', '**許可のみ**', '許可と**拒否**'],
        ['評価', 'すべてのルールを評価', '**番号の小さい順**、最初に一致したもの'],
        ['既定（カスタム作成時）', 'インバウンドはすべて拒否、アウトバウンドはすべて許可', 'すべて拒否']
      ],
      note: '「特定の IP を**拒否**したい」→ NACL（または WAF）。セキュリティグループには拒否ルールがない。NACL は戻り通信用に **1024–65535** を忘れずに。',
      keywords: ['セキュリティグループ', 'ネットワーク ACL', 'ステートフル', 'ステートレス', 'エフェメラルポート']
    },
    {
      id: 'ch1-vpc-endpoints', chapter: 'ch1',
      title: 'VPC エンドポイント：ゲートウェイ型 vs インターフェイス型',
      layout: 'compare',
      lead: 'インターネットや NAT を通らずに AWS のサービスへアクセスするための「専用の入口」。',
      items: [
        { title: 'ゲートウェイ型', tag: 'S3・DynamoDB のみ', body: '**ルートテーブル**にエンドポイント向けの経路を追加する。**追加料金なし**。オンプレミスや他リージョンからは使えない。' },
        { title: 'インターフェイス型（PrivateLink）', tag: '多数のサービス', body: 'サブネットに **ENI（プライベート IP）** を作る。**時間料金＋データ処理料金**。Direct Connect／VPN 経由でオンプレミスからも使える。' }
      ],
      note: 'バケットポリシーの `aws:SourceVpce`（エンドポイント ID）や `aws:SourceVpc` で、エンドポイント経由のアクセスだけに制限できる。',
      keywords: ['VPC エンドポイント', 'ゲートウェイ型', 'インターフェイス型', 'PrivateLink', 'aws:SourceVpce']
    },
    {
      id: 'ch1-threat-services', chapter: 'ch1',
      title: 'セキュリティサービスの使い分け',
      layout: 'table',
      columns: ['サービス', 'ひとことで', '試験のキーワード'],
      rows: [
        ['AWS WAF', 'L7 の Web 攻撃をブロック', 'SQL インジェクション、XSS、レートベース、IP セット'],
        ['Shield Standard／Advanced', 'DDoS 対策', 'Advanced：専門チーム（SRT）支援、コスト保護'],
        ['Amazon GuardDuty', 'ログから脅威を**検出**', 'VPC フローログ・DNS・CloudTrail、不審な挙動'],
        ['Amazon Macie', 'S3 の機密データを**検出**', '個人情報（PII）、データ分類'],
        ['Amazon Inspector', '脆弱性を**スキャン**', 'EC2・ECR イメージ・Lambda の CVE'],
        ['AWS Security Hub', '検出結果の**集約**とベストプラクティス評価', 'セキュリティ基準、一元管理'],
        ['AWS Network Firewall', 'VPC のステートフル検査', 'ドメインフィルタ、IPS']
      ],
      note: '「検出する」サービス（GuardDuty・Macie・Inspector）は、それ自体では通信を**遮断しない**。止めるのは WAF・NACL・Network Firewall など。',
      keywords: ['WAF', 'Shield', 'GuardDuty', 'Macie', 'Inspector', 'Security Hub']
    },
    {
      id: 'ch1-encryption', chapter: 'ch1',
      title: '暗号化とシークレット管理',
      layout: 'table',
      columns: ['方式・サービス', '特徴', '選ぶ場面'],
      rows: [
        ['SSE-S3', 'S3 が鍵を管理（既定の暗号化）', 'とにかく暗号化できればよい'],
        ['SSE-KMS', 'KMS の鍵。**キーポリシーで制御**、CloudTrail で**監査**', '鍵の利用を監査・制御したい'],
        ['SSE-C', '鍵は**利用者が用意**しリクエストごとに渡す', '鍵を AWS に保管したくない'],
        ['AWS KMS', 'カスタマーマネージドキー、自動ローテーション、マルチリージョンキー', '暗号鍵の一元管理'],
        ['AWS Certificate Manager', 'TLS 証明書の発行と**自動更新**', 'ALB・CloudFront（CloudFront 用は us-east-1）'],
        ['Secrets Manager', '**自動ローテーション**付きのシークレット管理', 'DB パスワードを自動で変えたい'],
        ['Parameter Store', '設定値・シークレット（SecureString）', '安価に設定値を管理（ローテーションは自前）']
      ],
      note: '暗号化されていない既存の EBS／RDS は、**スナップショットを暗号化してコピー → 復元**で暗号化する。',
      keywords: ['SSE-KMS', 'KMS', 'ACM', 'Secrets Manager', 'Parameter Store', '暗号化']
    }
  ]);
})();
