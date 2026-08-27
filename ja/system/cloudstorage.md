---
title: "クラウドストレージ"
description: "AWS 認証情報と S3 互換オブジェクトストレージを設定します。"
---

# クラウドストレージ
<secondary-label ref="external"/>

クラウドストレージエントリは、Lua ストレージ API が使用する AWS 認証情報と S3 互換バケットを設定します。このページは設定リファレンスです。スニペットでは、指定されたバケットと認証情報、または SDK の認証情報チェーンがすでに存在することを前提としています。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `config.aws` | AWS 認証情報とリージョンの設定 |
| `cloudstorage.s3` | S3 バケット接続 |

## AWS 設定

環境変数システムを通じて登録する静的認証情報:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

AWS SDK のデフォルト認証情報チェーン（IAM ロールやインスタンスプロファイルなど）:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `region` | string | はい | AWS リージョン。デプロイごとに異なる場合は `${env:NAME}` で指定 |
| `access_key_id` | string | いいえ | AWS アクセスキー ID（インラインまたは `${env:NAME}`） |
| `secret_access_key` | string | いいえ | AWS シークレットアクセスキー（インラインまたは `${env:NAME}`） |

認証情報フィールドは、デコード時に[環境変数レジストリ](./env.md)から解決されます。デフォルトのない最新の `${env:NAME}` プレースホルダーは、変数が見つからない場合にデコードを失敗させます。そのため、AWS SDK のデフォルト認証情報チェーンを使用するには、`access_key_id` と `secret_access_key` を省略してください。静的認証情報は、両方のフィールドが空でない値に解決された場合にのみ適用されます。

リクエストは、解決された認証情報を使用して AWS SDK によって AWS Signature Version 4 で署名されます。署名の設定は不要です。

<note>
古い設定では、環境変数レジストリを同じように検索する兄弟キーの <code>&lt;field&gt;_env</code> ディレクティブ（<code>region_env</code>、<code>access_key_id_env</code>、<code>secret_access_key_env</code>）を使用します。デフォルトのない最新のプレースホルダーとは異なり、未登録または空の従来の検索では、インライン値またはゼロ値が保持されます。従来の形式は<b>非推奨</b>です。意図的に移行し、同等のフォールバック動作が必要な場合はプレースホルダーにデフォルトを追加してください。
</note>

<note>
単一の <code>config.aws</code> エントリを複数の AWS バックエンドサービスで再利用できます。<code>queue.driver.sqs</code> は、その <code>config:</code> フィールドを通じて同じエントリを参照します。
</note>

## S3 ストレージ

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `bucket` | string | はい | S3 バケット名。デプロイごとに異なる場合は `${env:NAME}` で指定 |
| `config` | reference | はい | AWS 設定エントリの参照 |
| `endpoint` | string | いいえ | S3 互換サービス用のカスタムエンドポイント（インラインまたは `${env:NAME}`） |

### S3 互換サービス

MinIO または他の S3 互換サービスには、カスタムエンドポイントを設定します。

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

エンドポイントを指定すると、パススタイルアクセスが自動的に有効になります。

## Lua API

操作（一覧取得、アップロード、ダウンロード、削除、署名付き URL）については、[クラウドストレージモジュール](../lua/storage/cloud.md)を参照してください。

## 関連項目

- [クラウドストレージモジュール](../lua/storage/cloud.md) - Lua API リファレンス
- [ファイルシステム](./filesystem.md) - ローカルファイルシステムエントリ
- [キュー](./queue.md) - SQS ハンドラーは同じ `config.aws` エントリを共有
