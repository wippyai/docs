---
title: "파일시스템"
description: "디렉토리 및 임베디드 파일시스템 접근."
---

# 파일시스템

디렉토리 및 임베디드 파일시스템 접근.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `fs.directory` | 디렉토리 기반 파일시스템 |
| `fs.embed` | 읽기 전용 임베디드 파일시스템 |

## 디렉토리 파일시스템

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `directory` | string | 필수 | 루트 경로 |
| `auto_init` | bool | false | 없으면 디렉토리 생성 |
| `mode` | string | 0755 | Unix 권한 모드 (8진수) |
| `base` | string | - | 상대 경로의 기준: `project` (프로세스 작업 디렉토리) 또는 `module` (엔트리를 소유한 모듈의 로드 루트) |

절대 경로는 `base` 값과 무관하게 주어진 그대로 사용됩니다.

상대 경로의 경우 `base: project`는 프로세스 작업 디렉토리를 기준으로 유지합니다. `base: module`과 `base`를 설정하지 않은 경우는 모두, 레지스트리 소유자를 통해 조회한 엔트리 소유 모듈의 로드 루트를 기준으로 해석됩니다. 엔트리에 소유 모듈이 없거나 해당 모듈에 해석 가능한 리소스 루트가 없으면, 경로는 프로세스 작업 디렉토리 기준으로 남습니다.

그 외의 값은 `invalid directory base`로 거부됩니다.

모드는 모든 파일 작업을 제한합니다. 읽기 비트가 있으면 실행 비트가 자동으로 추가됩니다.

<note>
경로는 정규화되고 검증됩니다. 설정된 루트 디렉토리 외부의 파일에 접근하는 것은 불가능합니다.
</note>

## 임베디드 파일시스템

```yaml
- name: static
  kind: fs.embed
```

임베디드 파일시스템은 엔트리 ID를 사용하여 팩 리소스에서 로드합니다. 읽기 전용입니다.

<warning>
임베디드 파일시스템은 내부 메커니즘입니다. 수동 설정은 일반적으로 필요하지 않습니다.
</warning>

## 작업

두 파일시스템 타입 모두 다음을 구현합니다:

| 작업 | 디렉토리 | 임베드 |
|-----------|-----------|-------|
| Open/Read | 예 | 예 |
| Stat | 예 | 예 |
| ReadDir | 예 | 예 |
| OpenFile (쓰기) | 예 | 아니오 |
| Remove | 예 | 아니오 |
| Mkdir | 예 | 아니오 |

임베디드 파일시스템에서의 쓰기 작업은 에러를 반환합니다.

## Lua API

파일 작업은 [파일시스템 모듈](lua/storage/filesystem.md)을 참조하세요.

## 참고

- [파일시스템 모듈](lua/storage/filesystem.md) - Lua API 레퍼런스
- [클라우드 스토리지](system/cloudstorage.md) - S3 호환 객체 스토리지
- [템플릿](system/template.md) - 파일시스템에서 로드되는 템플릿
