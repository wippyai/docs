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
| `region` | string | 是 | AWS 区域 |
| `access_key_id_env` | string | 否 | 访问密钥的环境变量名 |
| `secret_access_key_env` | string | 否 | 密钥的环境变量名 |

凭据从指定的环境变量加载。如果省略，则回退到 AWS SDK 默认凭据链（IAM 角色、实例配置文件等）。

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
| `bucket` | string | 是 | S3 存储桶名称 |
| `config` | reference | 是 | AWS 配置 entry 引用 |
| `endpoint` | string | 否 | S3 兼容服务的自定义端点 |

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
