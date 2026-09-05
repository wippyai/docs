---
title: "의존성 관리"
description: "Wippy는 잠금 파일 기반의 의존성 시스템을 사용합니다. 모듈은 허브에 게시되고, 소스에서 의존성으로 선언되며, 정확한 버전을 추적하는 wippy.lock 파일로 해석됩니다."
---

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
| `modules[].hash` | 다운로드된 팩이 일치해야 하는 아티팩트 다이제스트. 접두사 없는 16진수 값은 `sha256`으로 읽힙니다 |
| `modules[].root` | 선택된 배포 루트를 표시. 최대 하나의 모듈만 가질 수 있습니다 |
| `options.unpack_modules` | 팩을 `.wapp` 파일로 로드하는 대신 디렉토리로 추출 (기본값: `false`) |

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

### 해결 규칙

- 각 모듈은 의존성 그래프 전체에서 **선언된 모든 범위의 교집합**에 대해 해결됩니다. 호환되지 않는 범위(다이아몬드 충돌)는 한쪽을 조용히 선택하는 대신 명시적인 오류로 해결에 실패합니다.
- 전체 `wippy update`는 모든 모듈을 선언된 범위에서 해결합니다. 대상을 지정한 업데이트와 부트 시 복구는 살아 있는 모든 범위를 여전히 만족하는 고정 버전을 유지합니다.
- **루트 파라미터가 전이적 파라미터보다 우선합니다**: 앱과 의존성이 같은 요구사항을 함께 바인딩하는 경우, 앱의 `ns.dependency`에 있는 파라미터가 우선합니다. 버전 범위는 결코 재정의되지 않으며, 모든 선언이 교집합에 참여합니다.
- 여러 루트 `ns.dependency` 엔트리가 선언한 컴포넌트는 그중 하나가 제어합니다 — 새 선언보다 기존 선언이, 파라미터가 없는 선언보다 파라미터를 가진 선언이 우선하고, 동률이면 엔트리 ID가 가장 작은 것이 선택됩니다 — 나머지는 그것에 대한 참조로 접힙니다. 제어 선언과 파라미터가 어긋나는 중복 선언은 충돌 오류로 거부됩니다. 대신 기존 의존성을 업데이트하세요.

두 가지 해결 실패는 구분해서 보고됩니다. 어떤 릴리스로도 만족시킬 수 없는 제약 표현 — 살아 있는 범위들의 교집합이 비어 있는 경우 — 은 충돌이며, 오류에 모듈 이름과 범위를 기여한 모든 요청자가 명시됩니다. 범위 집합 자체는 유효하지만 허브가 현재 일치하는 버전을 게시하지 않은 경우는 가용성 실패입니다: 선언을 전혀 바꾸지 않아도 이후 릴리스가 나오면 해결될 수 있습니다.

런타임은 해결된 각 그래프를 레지스트리 히스토리에 지속하고 부트 시 다시 해결하는 대신 리플레이하므로, 배포된 애플리케이션은 의존성 변경이 적용되었을 때 해결된 정확히 그 버전들로 부팅됩니다. `wippy.lock`은 소스 프로젝트를 위한 이식 가능한 스냅샷으로 남습니다.

### 엔트리 출처

출처 정보는 엔트리 메타데이터가 아니라 레지스트리가 소유합니다. 엔트리가 로드될 때 레지스트리는 각 엔트리에 그것을 공급한 배포 소스를 기록합니다:

| 필드 | 설명 |
|-------|-------------|
| `registry.owner` | 엔트리를 공급한 모듈 이름(`org/module`). 애플리케이션 소스의 경우 비어 있음 |
| `registry.root` | 배포 루트가 공급한 `ns.dependency` 엔트리에 설정되어 루트 선언임을 표시 |

엔트리 작성자는 이 필드를 절대 작성하지 않습니다. 로딩 중에 할당되며 `_index.yaml`에서 위조할 수 없습니다. `wippy registry list --registry-meta --json`으로 확인하세요.

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
wippy install --refresh            # 모든 모듈 다시 가져오기 (--force와 --repair는 별칭)
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
      http-v1.2.0.wapp
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

언패킹은 팩을 버리지 않습니다. 검증된 정규 `.wapp`은 추출된 디렉토리 옆에 그대로 남는데, 그것이 모듈에 대한 유일한 콘텐츠 주소 기반 증거이며 아티팩트 구체화와 복구가 그 안에서 리소스를 다시 읽어오기 때문입니다. 설치 여부를 확인할 때 보는 것도 `.wapp`입니다: 팩이 없는 디렉토리는 설치되지 않은 것으로 간주되어 모듈이 다시 다운로드됩니다. 설치할 때마다 검증된 아카이브에서 디렉토리를 새로 추출하므로, 벤더링된 디렉토리에 대한 수동 편집은 유지되지 않습니다.

[워크스페이스 교체](#교체를-통한-로컬-개발)에서 해결된 모듈은 다운로드되거나 벤더링되지 않고 로컬 경로에서 로드됩니다.

## 교체를 통한 로컬 개발

개발을 위해 허브 모듈을 로컬 디렉토리로 대체합니다. 교체는 런타임 설정 파일의 `workspace` 섹션에 선언합니다 — 일반적으로 `.wippy.yaml` 위에 합성되는 비공개, git-ignore된 파일입니다:

```yaml
# .wippy.workspace.yaml
version: "1.0"
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: ../local-sql
```

```bash
wippy run --config .wippy.yaml --config .wippy.workspace.yaml
```

키는 `org/module`, 값은 디렉토리입니다 (상대 경로는 첫 번째 `--config` 파일의 디렉토리를 기준으로 해석됩니다). 교체를 `null`로 설정하면 이전 설정 레이어나 프로파일에서 상속된 교체가 비활성화됩니다. 교체는 [프로파일](guides/configuration.md#profiles) 안에도 둘 수 있어 `--profile workspace`와 함께할 때만 활성화됩니다.

경로가 존재해야 하고 디렉토리여야 한다는 요구는 lock 그래프가 실제로 선택하는 모듈에만 적용됩니다. 아무것도 의존하지 않는 모듈에 대해 선언된 교체는 부트 입력이 아니라 해결 입력입니다: 이 머신에 체크아웃되지 않은 디렉토리를 가리켜도 검증에 실패하지 않습니다.

교체는 모듈의 소스가 어디에서 오는지를 바꿀 뿐, 어떤 릴리스가 선택되었는지를 바꾸지 않습니다. 로드 경로는 lock이 그 모듈에 대해 선택한 버전과 다이제스트를 유지하며 교체로 표시됩니다. 거기서 로드된 엔트리는 같은 ID의 벤더링된 엔트리를 가립니다. lock이 버전을 고정하지 않은 모듈에 교체가 선언되면, 해결은 허브에 릴리스 버전을 요청하며, 더 강한 증거가 하나를 선택하기 전까지는 로컬 전용 zero 버전을 유지합니다.

워크스페이스 교체는 부트 시 로드 그래프에 영향을 주며 `wippy.lock`에는 절대 기록되지 않습니다. 로컬 소스의 변경은 허브에 접속하지 않고 직접 반영됩니다. 모듈의 `wippy.yaml`에 있는 소스 `exclude:` 글롭은 교체 디렉토리에도 적용됩니다 — 엔트리를 로드할 때와 콘텐츠를 해싱할 때 모두.

`wippy.lock`의 `replacements:` 섹션은 더 이상 사용되지 않습니다: 여전히 로드되지만 경고를 출력합니다. 해당 엔트리를 설정 파일의 `workspace.replacements`로 옮기세요.

## 로드 순서

부팅 시 Wippy는 다음 순서로 디렉토리에서 엔트리를 로드합니다:

1. 소스 디렉토리 (`src`)
2. 교체 디렉토리
3. 벤더 모듈 디렉토리

활성 교체가 있는 모듈은 벤더 경로를 건너뜁니다.

## 무결성 검증

잠금 파일의 모든 모듈은 아티팩트 다이제스트를 가집니다. 부팅은 lock 엔트리에 다이제스트가 없는 모듈의 로드를 거부합니다. `wippy install`은 그런 엔트리를 받아들이고 허브가 다운로드와 함께 제공한 다이제스트를 기록합니다.

부팅 시 다운로드는 스테이징됩니다: 팩은 최종 위치 옆의 임시 파일에 기록되고, `wippy.lock`에 고정된 다이제스트와 허브가 다운로드 URL과 함께 제공한 다이제스트(및 제공된 크기) 양쪽에 대해 검증된 뒤에야 제자리로 rename됩니다. 검증에 실패한 스테이징 파일은 삭제됩니다. `wippy install`은 다운로드를 검증하기 전에 벤더 경로로 rename하고, 제공된 다이제스트와 크기에 대해서만 검사하며, 실패 시 삭제하고, 제공된 것과 다른 lock 다이제스트는 강제하는 대신 교체합니다.

다이제스트 불일치는 재시도 불가능한 강한 실패입니다. 부팅 시에는 `PermissionDenied`, "module integrity verification failed"이며, 새로 다운로드한 팩과 이미 벤더링된 팩 모두에 대해 발생합니다. 벤더링된 팩은 엔트리가 로드되기 전에 lock 다이제스트에 대해 다시 검증됩니다. `wippy install`은 이를 `Internal`로 보고합니다: 벤더 디렉토리에 이미 있는 팩에는 "verify cached WAPP: digest mismatch"를 감싼 "failed to store module", 새 다운로드에는 "verify downloaded WAPP: digest mismatch"를 감싼 "failed to download module"입니다. 어떤 것도 재시도하거나, 불일치를 덮어쓰며 다시 다운로드하거나, 제공된 콘텐츠로 폴백하지 않습니다.

해결 과정도 같은 검사로 보호됩니다. 허브가 lock에 고정된 것과 다른 다이제스트의 매니페스트를 제공하면 매니페스트 캐시를 한 번 갱신하고 다시 비교합니다. 그래도 일치하지 않으면 두 다이제스트를 모두 명시하며 해결이 실패합니다.

추출된 디렉토리는 자체적으로 기록된 다이제스트, 크기, 트리 다이제스트를 가지며 기록된 값에 대해 다시 검증되므로, 변경된 벤더링 트리는 로드되지 않고 감지됩니다.

교체 소스도 콘텐츠 주소 기반입니다. 런타임은 교체 트리의 다이제스트를 계산하고, 해결된 그래프가 이미 그 모듈에 대해 다른 다이제스트나 크기를 고정하고 있으면 이를 거부합니다. 따라서 교체가 일치하지 않는 콘텐츠를 조용히 대신할 수 없습니다.

## 빌드 타임 아티팩트

모듈은 `meta.artifact.format`으로 표시된 파일시스템 리소스를 제공할 수 있으며, 소비자는 이를 런타임에 읽는 대신 디스크에 구체화합니다. 전체 및 대상 지정 `wippy install`과 `wippy update`, 콜드 부트, 런타임 의존성 작업은 모듈 그래프를 변경하는 것과 동일한 트랜잭션의 일부로 그 출력들을 조정합니다. `artifact.materialization_root`가 출력 루트를 설정합니다. [빌드 타임 아티팩트](guides/artifacts.md)를 참조하세요.

## 같이 보기

- [빌드 타임 아티팩트](guides/artifacts.md) - 아티팩트 리소스의 선언, 구체화, 조정
- [컴포넌트 구축](guides/components.md) - 작성자 측: `ns.requirement`와 `parameters`를 통한 값 공급
- [CLI](guides/cli.md) - 명령어 참조
- [게시](guides/publishing.md) - 허브에 모듈 게시
- [프로젝트 구조](start/structure.md) - 프로젝트 레이아웃
