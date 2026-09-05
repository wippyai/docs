---
title: "클라우드 스토리지"
description: "<secondary-label ref='external'/"
---

# 클라우드 스토리지
<secondary-label ref="external"/>

사전 서명 URL, 멀티파트 업로드, 범위 읽기를 갖춘 S3 호환 오브젝트 스토리지.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `config.aws` | AWS 자격 증명 및 리전 설정 |
| `cloudstorage.s3` | S3 버킷 연결 |

## AWS 설정

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `region` | string | 예 | AWS 리전. 배포마다 다를 때는 `${env:NAME}`으로 제공하세요 |
| `access_key_id` | string | 아니오 | AWS 액세스 키 ID(인라인 또는 `${env:NAME}`) |
| `secret_access_key` | string | 아니오 | AWS 시크릿 액세스 키(인라인 또는 `${env:NAME}`) |

자격 증명은 디코드 시점에 [환경 레지스트리](system/env.md)에서 해석됩니다. 정적 자격 증명이 적용되려면 `access_key_id`와 `secret_access_key`가 모두 비어 있지 않은 값으로 해석되어야 합니다. 그렇지 않으면 AWS SDK 기본 자격 증명 체인(IAM 역할, 인스턴스 프로필 등)이 사용됩니다.

요청은 AWS SDK가 해석된 자격 증명을 사용하여 AWS Signature Version 4로 서명합니다. 별도의 서명 설정은 필요하지 않습니다.

<note>
과거 설정에서는 형제 필드인 <code>&lt;field&gt;_env</code> 디렉티브(<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>)를 사용하며 동일한 방식으로 해석됩니다. 이 형식은 <b>더 이상 사용되지 않습니다</b> — 위에 표시된 <code>${env:NAME}</code> 플레이스홀더로 마이그레이션하세요.
</note>

<note>
하나의 <code>config.aws</code> 엔트리는 AWS 기반 서비스 전반에서 재사용할 수 있습니다. <code>queue.driver.sqs</code>는 자신의 <code>config:</code> 필드를 통해 동일한 엔트리를 참조합니다.
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
| `bucket` | string | 조건부 | S3 버킷 이름. 배포마다 다를 때는 `${env:NAME}`으로 제공하세요 |
| `config` | reference | 예 | AWS 설정 엔트리 참조 |
| `endpoint` | string | 아니오 | S3 호환 서비스용 커스텀 엔드포인트(인라인 또는 `${env:NAME}`) |

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

## 멀티파트 업로드

사전 서명 멀티파트 업로드는 런타임 기능이 아니라 제공자 기능입니다. `cloudstorage.s3` kind는 이를 구현하며; 멀티파트 프로토콜을 지원하지 않는 제공자는 `create_multipart_upload`, `presigned_part_urls`, `complete_multipart_upload`, `abort_multipart_upload`를 `errors.UNAVAILABLE`로 실패시킵니다.

완료도 중단도 되지 않은 업로드의 파트는 저장된 채로 남아 과금됩니다. 애플리케이션은 모든 실패 경로에서 중단하지만, 클라이언트가 크래시하면 그 중단을 실행할 주체가 남지 않습니다. 최후의 보루로 버킷에 `AbortIncompleteMultipartUpload` 수명 주기 규칙을 설정하세요:

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

## 범위 읽기

`open_reader`는 범위 GET으로 오브젝트를 읽고 모든 읽기에서 `If-Match`로 오브젝트의 ETag를 고정합니다. 최초 stat에서 ETag를 반환하지 않는 제공자는 호출을 `errors.UNAVAILABLE`로 실패시키며, `If-Match`를 무시하는 제공자는 덮어쓰기 보호를 잃습니다 - 이 경우 읽기가 두 세대의 오브젝트를 섞었다는 사실을 감지할 수 없습니다.

## Lua API

작업(list, upload, download, delete, 사전 서명 URL, 멀티파트 업로드, 범위 리더)은 [클라우드 스토리지 모듈](lua/storage/cloud.md)을 참조하세요.

## 참고

- [클라우드 스토리지 모듈](lua/storage/cloud.md) - Lua API 레퍼런스
- [파일시스템](system/filesystem.md) - 로컬 파일시스템 엔트리
- [큐](system/queue.md) - SQS 핸들러는 동일한 `config.aws` 엔트리를 공유합니다
