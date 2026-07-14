---
title: "クラウドストレージ"
---

# クラウドストレージ

署名付きURL付きのS3互換オブジェクトストレージ。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `config.aws` | AWS認証情報とリージョン設定 |
| `cloudstorage.s3` | S3バケット接続 |

## AWS設定

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `region` | string | 条件付き | AWSリージョン。`region_env` が設定されていない限り必須 |
| `region_env` | string | 条件付き | リージョンを保持する環境変数名 |
| `access_key_id_env` | string | いいえ | アクセスキー用環境変数名 |
| `secret_access_key_env` | string | いいえ | シークレットキー用環境変数名 |

認証情報は指定された環境変数からロードされます。静的な認証情報を適用するには `access_key_id_env` と `secret_access_key_env` の両方が空でない値に解決される必要があります。そうでない場合は、AWS SDK のデフォルト認証チェーン（IAM ロール、インスタンスプロファイルなど）が使用されます。

リクエストは、解決された認証情報を使用して AWS SDK によって AWS Signature Version 4 で署名されます。署名の設定は不要です。

<note>
値がデプロイごとに異なる場合は、<code>_env</code> バリアント（<code>region_env</code>、および後述の <code>bucket_env</code>/<code>endpoint_env</code>）を使用してください。変数名は起動時に環境レジストリから解決されます。
</note>

<note>
AWS設定は将来のリリースで他のAWSサービス（SQSなど）と共有される予定です。
</note>

## S3ストレージ

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `bucket` | string | 条件付き | S3バケット名。`bucket_env` が設定されていない限り必須 |
| `bucket_env` | string | 条件付き | バケット名を保持する環境変数名 |
| `config` | reference | はい | AWS設定エントリ参照 |
| `endpoint` | string | いいえ | S3互換サービス用カスタムエンドポイント |
| `endpoint_env` | string | いいえ | カスタムエンドポイントを保持する環境変数名 |

### S3互換サービス

MinIOまたは他のS3互換サービスの場合、カスタムエンドポイントを設定：

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

エンドポイントが提供されると、パススタイルアクセスが自動的に有効になります。

## Lua API

操作（list、upload、download、delete、署名付きURL）については[クラウドストレージモジュール](lua/storage/cloud.md)を参照してください。

## 関連項目

- [クラウドストレージモジュール](lua/storage/cloud.md) - Lua APIリファレンス
- [ファイルシステム](system/filesystem.md) - ローカルファイルシステムエントリ
- [キュー](system/queue.md) - SQSハンドラは同じ`config.aws`エントリを共有します
