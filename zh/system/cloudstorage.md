---
title: "Cloud Storage"
description: "<secondary-label ref='external'/"
---

# Cloud Storage
<secondary-label ref="external"/>

S3 兼容的对象存储，支持预签名 URL、分段上传和范围读取。

## Entry 类型

| Kind | 描述 |
|------|------|
| `config.aws` | AWS 凭据和区域配置 |
| `cloudstorage.s3` | S3 存储桶连接 |

## AWS 配置

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `region` | string | 是 | AWS 区域。当各部署间不同时，通过 `${env:NAME}` 提供 |
| `access_key_id` | string | 否 | AWS 访问密钥 ID（内联或 `${env:NAME}`） |
| `secret_access_key` | string | 否 | AWS 私有访问密钥（内联或 `${env:NAME}`） |

凭据在解码时从[环境注册表](system/env.md)解析。`access_key_id` 和 `secret_access_key` 都必须解析为非空值，静态凭据才会生效；否则使用 AWS SDK 默认凭据链（IAM 角色、实例配置文件等）。

请求由 AWS SDK 使用解析出的凭据以 AWS Signature Version 4 签名。无需任何签名配置。

<note>
较旧的配置使用同级的 <code>&lt;field&gt;_env</code> 指令（<code>region_env</code>、<code>access_key_id_env</code>、<code>secret_access_key_env</code>），其解析方式相同。该形式已<b>废弃</b>——请迁移到上文所示的 <code>${env:NAME}</code> 占位符。
</note>

<note>
单个 <code>config.aws</code> 条目可在多个基于 AWS 的服务间复用。<code>queue.driver.sqs</code> 通过其 <code>config:</code> 字段引用同一个条目。
</note>

## S3 存储

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `bucket` | string | 条件 | S3 存储桶名称。当各部署间不同时，通过 `${env:NAME}` 提供 |
| `config` | reference | 是 | AWS 配置 entry 引用 |
| `endpoint` | string | 否 | S3 兼容服务的自定义端点（内联或 `${env:NAME}`） |

### S3 兼容服务

对于 MinIO 或其他 S3 兼容服务，设置自定义端点：

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

提供端点时，会自动启用路径风格访问。

## 分段上传

预签名分段上传是提供方的能力，而非运行时特性。`cloudstorage.s3` 类型实现了它们；不支持分段协议的提供方会让 `create_multipart_upload`、`presigned_part_urls`、`complete_multipart_upload` 和 `abort_multipart_upload` 以 `errors.UNAVAILABLE` 失败。

从未完成或中止的上传，其分段会一直被存储并计费。应用会在每条失败路径上执行中止，但客户端崩溃时就没有什么能去执行该中止了。请在存储桶上配置 `AbortIncompleteMultipartUpload` 生命周期规则作为兜底：

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

## 范围读取

`open_reader` 通过范围 GET 读取对象，并在每次读取时用 `If-Match` 固定对象的 ETag。在初始 stat 中不返回 ETag 的提供方会让该调用以 `errors.UNAVAILABLE` 失败，而忽略 `If-Match` 的提供方会失去覆盖保护——此时读取无法察觉自己混合了对象的两个版本。

## Lua API

参见 [Cloud Storage 模块](lua/storage/cloud.md) 了解操作方法（list、upload、download、delete、预签名 URL、分段上传、范围读取器）。

## 另请参阅

- [Cloud Storage 模块](lua/storage/cloud.md) - Lua API 参考
- [Filesystem](system/filesystem.md) - 本地文件系统条目
- [Queue](system/queue.md) - SQS 处理器共享相同的 `config.aws` 条目
