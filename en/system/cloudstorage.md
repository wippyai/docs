---
title: "Cloud Storage"
description: "<secondary-label ref='external'/"
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
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `region` | string | Yes | AWS region. Supply via `${env:NAME}` when it differs per deployment |
| `access_key_id` | string | No | AWS access key ID (inline or `${env:NAME}`) |
| `secret_access_key` | string | No | AWS secret access key (inline or `${env:NAME}`) |

Credentials resolve from the [environment registry](system/env.md) at decode time. Both `access_key_id` and `secret_access_key` must resolve to non-empty values for static credentials to apply; otherwise the AWS SDK default credential chain is used (IAM roles, instance profiles, etc.).

Requests are signed with AWS Signature Version 4 by the AWS SDK using the resolved credentials. No signing configuration is required.

<note>
Older configurations use a sibling <code>&lt;field&gt;_env</code> directive (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>) that resolves the same way. This form is <b>deprecated</b> — migrate it to the <code>${env:NAME}</code> placeholder shown above.
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
| `bucket` | string | Conditional | S3 bucket name. Supply via `${env:NAME}` when it differs per deployment |
| `config` | reference | Yes | AWS config entry reference |
| `endpoint` | string | No | Custom endpoint for S3-compatible services (inline or `${env:NAME}`) |

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
