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
| `region` | string | はい | AWSリージョン |
| `access_key_id_env` | string | いいえ | アクセスキー用環境変数名 |
| `secret_access_key_env` | string | いいえ | シークレットキー用環境変数名 |

認証情報は指定された環境変数からロードされます。省略した場合、AWS SDKのデフォルト認証チェーン（IAMロール、インスタンスプロファイルなど）にフォールバックします。

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
| `bucket` | string | はい | S3バケット名 |
| `config` | reference | はい | AWS設定エントリ参照 |
| `endpoint` | string | いいえ | S3互換サービス用カスタムエンドポイント |

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
