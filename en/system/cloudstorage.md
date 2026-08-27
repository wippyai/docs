---
title: "Cloud Storage"
description: "Configure AWS credentials and S3-compatible object storage."
---

# Cloud Storage
<secondary-label ref="external"/>

Cloud storage entries configure AWS credentials and S3-compatible buckets used by the Lua storage API. This page is a configuration reference; the snippets assume the named bucket and credentials or SDK credential chain already exist.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `config.aws` | AWS credentials and region configuration |
| `cloudstorage.s3` | S3 bucket connection |

## AWS Configuration

Static credentials registered through the environment system:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

AWS SDK default credential chain (for example, IAM roles or instance profiles):

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `region` | string | Yes | AWS region. Supply via `${env:NAME}` when it differs per deployment |
| `access_key_id` | string | No | AWS access key ID (inline or `${env:NAME}`) |
| `secret_access_key` | string | No | AWS secret access key (inline or `${env:NAME}`) |

Credential fields resolve from the [environment registry](./env.md) at decode time. A modern `${env:NAME}` placeholder without a default fails decoding when its variable is missing, so omit `access_key_id` and `secret_access_key` to use the AWS SDK default credential chain. Static credentials apply only when both fields resolve to non-empty values.

Requests are signed with AWS Signature Version 4 by the AWS SDK using the resolved credentials. No signing configuration is required.

<note>
Older configurations use a sibling <code>&lt;field&gt;_env</code> directive (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>) that also looks up the environment registry. Unlike a modern placeholder without a default, an unregistered or empty legacy lookup preserves the inline or zero value. The legacy form is <b>deprecated</b> — migrate it deliberately, adding placeholder defaults where equivalent fallback behavior is required.
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
| `bucket` | string | Yes | S3 bucket name. Supply via `${env:NAME}` when it differs per deployment |
| `config` | reference | Yes | AWS config entry reference |
| `endpoint` | string | No | Custom endpoint for S3-compatible services (inline or `${env:NAME}`) |

### S3-Compatible Services

Set a custom endpoint for MinIO or another S3-compatible service:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

When an endpoint is provided, path-style access is enabled automatically.

## Lua API

See [Cloud Storage Module](../lua/storage/cloud.md) for operations (list, upload, download, delete, presigned URLs).

## See Also

- [Cloud Storage Module](../lua/storage/cloud.md) - Lua API reference
- [Filesystem](./filesystem.md) - Local filesystem entries
- [Queue](./queue.md) - SQS handler shares the same `config.aws` entries
