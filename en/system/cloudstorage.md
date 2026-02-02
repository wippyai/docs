# Cloud Storage
<secondary-label ref="external"/>

S3-compatible object storage with presigned URLs.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `config.aws` | AWS credentials and region configuration |
| `cloudstorage.s3` | S3 bucket connection |

## AWS Configuration

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `region` | string | Yes | AWS region |
| `access_key_id_env` | string | No | Environment variable name for access key |
| `secret_access_key_env` | string | No | Environment variable name for secret key |

Credentials load from the specified environment variables. If omitted, falls back to AWS SDK default credential chain (IAM roles, instance profiles, etc.).

<note>
AWS configuration is planned to be shared with other AWS services (SQS, etc.) in future releases.
</note>

## S3 Storage

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bucket` | string | Yes | S3 bucket name |
| `config` | reference | Yes | AWS config entry reference |
| `endpoint` | string | No | Custom endpoint for S3-compatible services |

### S3-Compatible Services

For MinIO or other S3-compatible services, set a custom endpoint:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

When an endpoint is provided, path-style access is enabled automatically.

## Lua API

See [Cloud Storage Module](lua/storage/cloud.md) for operations (list, upload, download, delete, presigned URLs).
