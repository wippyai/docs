---
title: "Cloud Storage"
description: "<secondary-label ref='external'/"
---

# Cloud Storage
<secondary-label ref="external"/>

S3 兼容的对象存储，支持预签名 URL。

## Entry 类型

| Kind | 描述 |
|------|------|
| `config.aws` | AWS 凭据和区域配置 |
| `cloudstorage.s3` | S3 存储桶连接 |

## AWS 配置

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `region` | string | 条件 | AWS 区域。除非设置了 `region_env`，否则必填 |
| `region_env` | string | 条件 | 持有区域值的环境变量名 |
| `access_key_id_env` | string | 否 | 访问密钥的环境变量名 |
| `secret_access_key_env` | string | 否 | 密钥的环境变量名 |

凭据从指定的环境变量加载。`access_key_id_env` 和 `secret_access_key_env` 都必须解析为非空值，静态凭据才会生效；否则使用 AWS SDK 默认凭据链（IAM 角色、实例配置文件等）。

请求由 AWS SDK 使用解析出的凭据以 AWS Signature Version 4 签名。无需任何签名配置。

<note>
当某个值在不同部署间有差异时，使用 <code>_env</code> 变体（<code>region_env</code>，以及下文的 <code>bucket_env</code>/<code>endpoint_env</code>）。变量名在启动时从环境注册表解析。
</note>

<note>
AWS 配置计划在未来版本中与其他 AWS 服务（SQS 等）共享。
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
| `bucket` | string | 条件 | S3 存储桶名称。除非设置了 `bucket_env`，否则必填 |
| `bucket_env` | string | 条件 | 持有存储桶名称的环境变量名 |
| `config` | reference | 是 | AWS 配置 entry 引用 |
| `endpoint` | string | 否 | S3 兼容服务的自定义端点 |
| `endpoint_env` | string | 否 | 持有自定义端点的环境变量名 |

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

## Lua API

参见 [Cloud Storage 模块](lua/storage/cloud.md) 了解操作方法（list、upload、download、delete、预签名 URL）。

## 另请参阅

- [Cloud Storage 模块](lua/storage/cloud.md) - Lua API 参考
- [Filesystem](system/filesystem.md) - 本地文件系统条目
- [Queue](system/queue.md) - SQS 处理器共享相同的 `config.aws` 条目
