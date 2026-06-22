# 클라우드 스토리지
<secondary-label ref="external"/>

사전 서명 URL이 있는 S3 호환 오브젝트 스토리지.

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

## Lua API

작업(list, upload, download, delete, 사전 서명 URL)은 [클라우드 스토리지 모듈](lua/storage/cloud.md)을 참조하세요.

## 참고

- [클라우드 스토리지 모듈](lua/storage/cloud.md) - Lua API 레퍼런스
- [파일시스템](system/filesystem.md) - 로컬 파일시스템 엔트리
- [큐](system/queue.md) - SQS 핸들러는 동일한 `config.aws` 엔트리를 공유합니다
