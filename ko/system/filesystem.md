---
title: "파일시스템"
description: "directory-backed 및 read-only embedded 파일 시스템을 설정합니다."
---

# 파일시스템

파일 시스템 엔트리는 directory-backed 또는 read-only embedded storage를 런타임 모듈에 노출합니다. 이 페이지는 설정 레퍼런스이며 YAML 블록은 완전한 프로젝트가 아닌 개별 entry fragment입니다.

## 엔트리 종류

| 종류 | 설명 |
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
| `base` | string | inferred | 상대 경로 기준: `project`(process working directory) 또는 `module`(소유 module resource root) |

module 소유 엔트리에서 `base`를 생략하면 상대 directory는 소유 module resource root에서 resolve됩니다. host가 작성한 엔트리는 process working directory 기준을 유지합니다. module 엔트리에 working-directory resolution을 강제하려면 `base: project`, module-root resolution을 명시적으로 요청하려면 `base: module`을 설정하십시오. module ownership 또는 resource root를 사용할 수 없으면 런타임은 상대 경로를 변경하지 않습니다.

설정된 mode는 owner bit로 작업을 제한하고 새 파일 및 directory에 요청한 permission은 해당 mode로 mask됩니다. 모든 read bit가 있고 execute bit가 없으면 런타임이 execute bit를 추가합니다(예: `0444`는 `0555`가 됨). backing directory에는 운영체제 permission도 계속 적용됩니다.

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
| Lstat | 예 | 예 |
| ReadDir | 예 | 예 |
| OpenFile (쓰기) | 예 | 아니오 |
| Remove | 예 | 아니오 |
| Mkdir | 예 | 아니오 |
| Rename | 예 | 아니오 |
| Truncate | 예 | 아니오 |
| Chtimes | 예 | 아니오 |

임베디드 파일시스템에서의 쓰기 작업은 에러를 반환합니다.

## Lua API

파일 작업은 [파일시스템 모듈](../lua/storage/filesystem.md)을 참조하십시오.

## 참고

- [파일시스템 모듈](../lua/storage/filesystem.md) - Lua API 레퍼런스
- [클라우드 스토리지](./cloudstorage.md) - S3 호환 객체 스토리지
- [템플릿](./template.md) - 파일시스템에서 로드되는 template
