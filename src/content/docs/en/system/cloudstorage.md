---
title: "Cloud Storage"
---

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
| `region` | string | Conditional | AWS region. Required unless `region_env` is set |
| `region_env` | string | Conditional | Env variable name holding the region |
| `access_key_id_env` | string | No | Environment variable name for access key |
| `secret_access_key_env` | string | No | Environment variable name for secret key |

Credentials load from the specified environment variables. Both `access_key_id_env` and `secret_access_key_env` must resolve to non-empty values for static credentials to apply; otherwise the AWS SDK default credential chain is used (IAM roles, instance profiles, etc.).

Requests are signed with AWS Signature Version 4 by the AWS SDK using the resolved credentials. No signing configuration is required.

<note>
Use the <code>_env</code> variants (<code>region_env</code>, and <code>bucket_env</code>/<code>endpoint_env</code> below) when a value differs per deployment. The variable name is resolved from the environment registry at startup.
</note>

<note>
A single <code>config.aws</code> entry can be reused across AWS-backed services. <code>queue.driver.sqs</code> references the same entry via its <code>config:</code> field.
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
| `bucket` | string | Conditional | S3 bucket name. Required unless `bucket_env` is set |
| `bucket_env` | string | Conditional | Env variable name holding the bucket name |
| `config` | reference | Yes | AWS config entry reference |
| `endpoint` | string | No | Custom endpoint for S3-compatible services |
| `endpoint_env` | string | No | Env variable name holding the custom endpoint |

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

## See Also

- [Cloud Storage Module](lua/storage/cloud.md) - Lua API reference
- [Filesystem](system/filesystem.md) - Local filesystem entries
- [Queue](system/queue.md) - SQS handler shares the same `config.aws` entries
