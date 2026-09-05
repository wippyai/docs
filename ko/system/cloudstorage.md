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
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `region` | string | 조건부 | AWS 리전. `region_env`가 설정되지 않은 경우 필수 |
| `region_env` | string | 조건부 | 리전을 담은 환경 변수 이름 |
| `access_key_id_env` | string | 아니오 | 액세스 키용 환경 변수 이름 |
| `secret_access_key_env` | string | 아니오 | 시크릿 키용 환경 변수 이름 |

자격 증명은 지정된 환경 변수에서 로드됩니다. 정적 자격 증명이 적용되려면 `access_key_id_env`와 `secret_access_key_env`가 모두 비어 있지 않은 값으로 해석되어야 합니다. 그렇지 않으면 AWS SDK 기본 자격 증명 체인(IAM 역할, 인스턴스 프로필 등)이 사용됩니다.

요청은 AWS SDK가 해석된 자격 증명을 사용하여 AWS Signature Version 4로 서명합니다. 별도의 서명 설정은 필요하지 않습니다.

<note>
값이 배포마다 다를 때는 <code>_env</code> 변형(<code>region_env</code>, 아래의 <code>bucket_env</code>/<code>endpoint_env</code>)을 사용하세요. 변수 이름은 시작 시 환경 레지스트리에서 해석됩니다.
</note>

<note>
AWS 설정은 향후 릴리스에서 다른 AWS 서비스(SQS 등)와 공유될 예정입니다.
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
| `bucket` | string | 조건부 | S3 버킷 이름. `bucket_env`가 설정되지 않은 경우 필수 |
| `bucket_env` | string | 조건부 | 버킷 이름을 담은 환경 변수 이름 |
| `config` | reference | 예 | AWS 설정 엔트리 참조 |
| `endpoint` | string | 아니오 | S3 호환 서비스용 커스텀 엔드포인트 |
| `endpoint_env` | string | 아니오 | 커스텀 엔드포인트를 담은 환경 변수 이름 |

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
