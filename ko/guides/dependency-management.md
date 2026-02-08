# 의존성 관리

Wippy는 잠금 파일 기반의 의존성 시스템을 사용합니다. 모듈은 허브에 게시되고, 소스에서 의존성으로 선언되며, 정확한 버전을 추적하는 `wippy.lock` 파일로 해석됩니다.

## 프로젝트 파일

### wippy.lock

잠금 파일은 프로젝트의 디렉토리 구조와 고정된 의존성을 추적합니다:

```yaml
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
  - name: acme/sql
    version: v2.0.1
    hash: b3f9c8e12a456d7890abcdef1234567890abcdef1234567890abcdef12345678
```

| 필드 | 설명 |
|------|------|
| `directories.modules` | 다운로드된 모듈이 저장되는 위치 (기본값: `.wippy`) |
| `directories.src` | 소스 코드가 위치하는 곳 (기본값: `./src`) |
| `modules[].name` | `org/module` 형식의 모듈 식별자 |
| `modules[].version` | 고정된 시맨틱 버전 |
| `modules[].hash` | 무결성 검증을 위한 콘텐츠 해시 |

### wippy.yaml

게시를 위한 모듈 메타데이터입니다. 자체 모듈을 게시할 때만 필요합니다:

```yaml
organization: acme
module: http
version: 1.2.0
description: HTTP utilities for Wippy
license: MIT
repository: https://github.com/acme/wippy-http
keywords:
  - http
  - web
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `organization` | 예 | 소문자, 영숫자 및 하이픈 |
| `module` | 예 | 소문자, 영숫자 및 하이픈 |
| `version` | 아니오 | 시맨틱 버전 (게시 시 설정) |
| `description` | 아니오 | 모듈 설명 |
| `license` | 아니오 | SPDX 라이선스 식별자 |
| `repository` | 아니오 | 소스 저장소 URL |
| `homepage` | 아니오 | 프로젝트 홈페이지 |
| `keywords` | 아니오 | 검색용 키워드 |
| `authors` | 아니오 | 저자 목록 |

## 의존성 선언

`_index.yaml`에 `ns.dependency` 엔트리를 추가합니다:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dependency.http
    kind: ns.dependency
    component: acme/http
    version: "^1.0.0"

  - name: dependency.sql
    kind: ns.dependency
    component: acme/sql
    version: ">=2.0.0"
```

### 버전 제약 조건

| 제약 조건 | 예시 | 일치 범위 |
|-----------|------|-----------|
| 정확 | `1.2.3` | 1.2.3만 해당 |
| 캐럿 | `^1.2.0` | >=1.2.0, <2.0.0 |
| 틸드 | `~1.2.0` | >=1.2.0, <1.3.0 |
| 범위 | `>=1.0.0` | 1.0.0 이상 |
| 와일드카드 | `*` | 모든 버전 (최신 선택) |
| 조합 | `>=1.0.0 <2.0.0` | 1.0.0과 2.0.0 사이 |

## 워크플로우

### 새 프로젝트 시작

```bash
wippy init
```

기본 디렉토리가 포함된 `wippy.lock`을 생성합니다.

### 의존성 추가

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

잠금 파일이 업데이트됩니다. 그런 다음 설치합니다:

```bash
wippy install
```

### 소스에서 해석

소스에 이미 `ns.dependency` 엔트리가 선언되어 있는 경우:

```bash
wippy update
```

소스 디렉토리를 스캔하고 모든 의존성 제약 조건을 해석하며 잠금 파일을 업데이트하고 모듈을 설치합니다.

### 의존성 업데이트

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

특정 모듈을 업데이트할 때 다른 모듈은 현재 버전에 고정된 상태를 유지합니다. 업데이트로 인해 대상이 아닌 모듈의 변경이 필요한 경우 확인을 요청합니다.

### 잠금 파일에서 설치

```bash
wippy install                      # Install all from lock
wippy install --force              # Bypass cache, re-download
```

## 모듈 저장소

다운로드된 모듈은 `.wippy/vendor/` 디렉토리에 저장됩니다:

```
project/
  wippy.lock
  src/
    _index.yaml
  .wippy/
    vendor/
      acme/
        http-v1.2.0.wapp
        sql-v2.0.1.wapp
```

기본적으로 모듈은 `.wapp` 파일로 유지됩니다. 디렉토리로 추출하려면:

```yaml
# wippy.lock
options:
  unpack_modules: true
```

언패킹을 활성화하면:

```
.wippy/
  vendor/
    acme/
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

## 교체를 통한 로컬 개발

개발을 위해 허브 모듈을 로컬 디렉토리로 대체합니다:

```yaml
# wippy.lock
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: ...
replacements:
  - from: acme/http
    to: ../local-http
```

교체 경로는 잠금 파일 기준 상대 경로입니다. 교체가 활성화되면 벤더 모듈 대신 로컬 디렉토리가 사용됩니다. 교체는 `wippy update` 작업 시에도 유지됩니다.

## 로드 순서

부팅 시 Wippy는 다음 순서로 디렉토리에서 엔트리를 로드합니다:

1. 소스 디렉토리 (`src`)
2. 교체 디렉토리
3. 벤더 모듈 디렉토리

활성 교체가 있는 모듈은 벤더 경로를 건너뜁니다.

## 무결성 검증

잠금 파일의 각 모듈에는 콘텐츠 해시가 있습니다. 설치 중에 다운로드된 모듈은 예상 해시와 대조하여 검증됩니다. 불일치하는 모듈은 거부되고 레지스트리에서 다시 다운로드됩니다.

## 같이 보기

- [CLI](guides/cli.md) - 명령어 참조
- [게시](guides/publishing.md) - 허브에 모듈 게시
- [프로젝트 구조](start/structure.md) - 프로젝트 레이아웃
