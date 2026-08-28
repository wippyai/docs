---
title: "클라우드 스토리지"
description: "AWS credential 및 S3 호환 object storage를 설정합니다."
---

# 클라우드 스토리지
<secondary-label ref="external"/>

cloud storage 엔트리는 Lua storage API가 사용하는 AWS credential과 S3 호환 bucket을 설정합니다. 이 페이지는 설정 레퍼런스이며 snippet은 이름이 지정된 bucket과 credential 또는 SDK credential chain이 이미 존재한다고 가정합니다.

## 엔트리 종류

| 종류 | 설명 |
|------|-------------|
| `config.aws` | AWS 자격 증명 및 리전 설정 |
| `cloudstorage.s3` | S3 버킷 연결 |

## AWS 설정

environment system을 통해 등록한 static credential:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

AWS SDK 기본 credential chain(예: IAM role 또는 instance profile):

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `region` | string | 예 | AWS region. deployment마다 다르면 `${env:NAME}`으로 제공 |
| `access_key_id` | string | 아니오 | AWS access key ID(inline 또는 `${env:NAME}`) |
| `secret_access_key` | string | 아니오 | AWS secret access key(inline 또는 `${env:NAME}`) |

credential field는 decode 시점에 [environment registry](./env.md)에서 resolve됩니다. default가 없는 modern `${env:NAME}` placeholder는 변수가 없으면 decode에 실패하므로 AWS SDK 기본 credential chain을 사용하려면 `access_key_id`와 `secret_access_key`를 생략하십시오. 두 field가 모두 비어 있지 않은 값으로 resolve될 때만 static credential이 적용됩니다.

요청은 AWS SDK가 해석된 자격 증명을 사용하여 AWS Signature Version 4로 서명합니다. 별도의 서명 설정은 필요하지 않습니다.

<note>
이전 설정은 environment registry도 조회하는 sibling <code>&lt;field&gt;_env</code> directive(<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>)를 사용합니다. default가 없는 modern placeholder와 달리 등록되지 않았거나 비어 있는 legacy lookup은 inline 또는 zero value를 유지합니다. legacy 형식은 <b>deprecated</b>입니다. 동등한 fallback 동작에 필요한 placeholder default를 추가하면서 의도적으로 migrate하십시오.
</note>

<note>
하나의 <code>config.aws</code> 엔트리를 AWS-backed service 전체에서 재사용할 수 있습니다. <code>queue.driver.sqs</code>는 <code>config:</code> 필드로 같은 엔트리를 참조합니다.
</note>

## S3 스토리지

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `bucket` | string | 예 | S3 bucket name. deployment마다 다르면 `${env:NAME}`으로 제공 |
| `config` | reference | 예 | AWS 설정 엔트리 참조 |
| `endpoint` | string | 아니오 | S3 호환 service용 custom endpoint(inline 또는 `${env:NAME}`) |

### S3 호환 서비스

MinIO 또는 기타 S3 호환 서비스의 경우 커스텀 엔드포인트를 설정하세요:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

엔드포인트가 제공되면 경로 스타일 접근이 자동으로 활성화됩니다.

## Lua API

작업(list, upload, download, delete, presigned URL)은 [클라우드 스토리지 모듈](lua/storage/cloud.md)을 참조하십시오.

## 참고

- [클라우드 스토리지 모듈](lua/storage/cloud.md) - Lua API 레퍼런스
- [파일시스템](system/filesystem.md) - 로컬 파일시스템 엔트리
- [큐](system/queue.md) - SQS handler는 같은 `config.aws` 엔트리를 공유
