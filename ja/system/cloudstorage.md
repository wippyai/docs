---
title: "クラウドストレージ"
description: "署名付きURL、マルチパートアップロード、範囲指定読み取りに対応したS3互換オブジェクトストレージ。"
---

# クラウドストレージ

署名付きURL、マルチパートアップロード、範囲指定読み取りに対応したS3互換オブジェクトストレージ。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `config.aws` | AWS認証情報とリージョン設定 |
| `cloudstorage.s3` | S3バケット接続 |

## AWS設定

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `region` | string | はい | AWSリージョン。デプロイごとに異なる場合は `${env:NAME}` で指定します |
| `access_key_id` | string | いいえ | AWS アクセスキー ID（インラインまたは `${env:NAME}`） |
| `secret_access_key` | string | いいえ | AWS シークレットアクセスキー（インラインまたは `${env:NAME}`） |

認証情報はデコード時に[環境レジストリ](system/env.md)から解決されます。静的な認証情報を適用するには `access_key_id` と `secret_access_key` の両方が空でない値に解決される必要があります。そうでない場合は、AWS SDK のデフォルト認証チェーン（IAM ロール、インスタンスプロファイルなど）が使用されます。

リクエストは、解決された認証情報を使用して AWS SDK によって AWS Signature Version 4 で署名されます。署名の設定は不要です。

<note>
古い設定では、同じ方法で解決される兄弟ディレクティブ <code>&lt;field&gt;_env</code>（<code>region_env</code>、<code>access_key_id_env</code>、<code>secret_access_key_env</code>）が使われています。この形式は<b>非推奨</b>です — 上記の <code>${env:NAME}</code> プレースホルダーへ移行してください。
</note>

<note>
1 つの <code>config.aws</code> エントリは、AWS をバックエンドとする複数のサービスで再利用できます。<code>queue.driver.sqs</code> は <code>config:</code> フィールドで同じエントリを参照します。
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
| `bucket` | string | 条件付き | S3バケット名。デプロイごとに異なる場合は `${env:NAME}` で指定します |
| `config` | reference | はい | AWS設定エントリ参照 |
| `endpoint` | string | いいえ | S3互換サービス用カスタムエンドポイント（インラインまたは `${env:NAME}`） |

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

## マルチパートアップロード

署名付きマルチパートアップロードは、ランタイムの機能ではなくプロバイダーの機能です。`cloudstorage.s3`種別はこれを実装しています。マルチパートプロトコルをサポートしないプロバイダーでは、`create_multipart_upload`、`presigned_part_urls`、`complete_multipart_upload`、`abort_multipart_upload`が`errors.UNAVAILABLE`で失敗します。

完了も中止もされなかったアップロードのパートは保存されたまま残り、課金対象になります。アプリケーションはすべての失敗経路で中止処理を行いますが、クライアントがクラッシュした場合はその中止処理を実行するものが残りません。バケットに`AbortIncompleteMultipartUpload`ライフサイクルルールを設定して、最後の防波堤としてください:

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
```

## 範囲指定読み取り

`open_reader`は範囲指定GETでオブジェクトを読み取り、読み取りのたびに`If-Match`でオブジェクトのETagを固定します。最初のstatでETagを返さないプロバイダーでは、この呼び出しは`errors.UNAVAILABLE`で失敗します。`If-Match`を無視するプロバイダーでは上書き保護が失われ、読み取りが2つのオブジェクト世代を混在させたことを検出できなくなります。

## Lua API

操作（list、upload、download、delete、署名付きURL、マルチパートアップロード、範囲指定リーダー）については[クラウドストレージモジュール](lua/storage/cloud.md)を参照してください。

## 関連項目

- [クラウドストレージモジュール](lua/storage/cloud.md) - Lua APIリファレンス
- [ファイルシステム](system/filesystem.md) - ローカルファイルシステムエントリ
- [キュー](system/queue.md) - SQSハンドラは同じ`config.aws`エントリを共有します
