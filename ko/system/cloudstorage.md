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
| `region` | string | 예 | AWS 리전 |
| `access_key_id_env` | string | 아니오 | 액세스 키용 환경 변수 이름 |
| `secret_access_key_env` | string | 아니오 | 시크릿 키용 환경 변수 이름 |

자격 증명은 지정된 환경 변수에서 로드됩니다. 생략하면 AWS SDK 기본 자격 증명 체인(IAM 역할, 인스턴스 프로필 등)으로 폴백합니다.

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
| `bucket` | string | 예 | S3 버킷 이름 |
| `config` | reference | 예 | AWS 설정 엔트리 참조 |
| `endpoint` | string | 아니오 | S3 호환 서비스용 커스텀 엔드포인트 |

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
