---
title: "모듈 게시"
description: "Wippy Hub에서 재사용 가능한 코드를 공유합니다."
---

# 모듈 게시

Wippy Hub에서 재사용 가능한 코드를 공유합니다.

## 사전 요구사항

1. [hub.wippy.ai](https://hub.wippy.ai)에서 계정 생성
2. 조직 생성 또는 가입
3. 조직 아래에 모듈 이름 등록

## 모듈 구조

```
mymodule/
├── wippy.yaml      # 모듈 매니페스트
├── src/
│   ├── _index.yaml # 엔트리 정의
│   └── *.lua       # 소스 파일
└── README.md       # 문서 (선택)
```

## wippy.yaml {#wippy-yaml}

모듈 매니페스트:

```yaml
organization: acme
module: http-utils
type: library
description: HTTP utilities and helpers
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `organization` | 예 | Hub의 조직 이름 |
| `module` | 예 | 모듈 이름 |
| `type` | 아니오 | 모듈 타입: `library`, `application`, `agent`, 또는 `plugin` |
| `description` | 아니오 | 짧은 설명 |
| `license` | 아니오 | SPDX 식별자 (MIT, Apache-2.0) |
| `repository` | 아니오 | 소스 저장소 URL |
| `homepage` | 아니오 | 프로젝트 홈페이지 |
| `keywords` | 아니오 | 검색 키워드 |

`type`은 허브가 모듈을 분류하는 방식의 원천이며 이후 게시에서 변경할 수 있습니다; `--module-type`은 단일 게시에 한해 이를 재정의합니다. 생략하면 새로 생성되는 모듈은 사용 중단 경고와 함께 `application`을 기본값으로 사용합니다.

## 엔트리 정의

엔트리는 `_index.yaml`에 정의됩니다:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations
    readme: file://README.md
    wiki:
      GUIDE.md: file://docs/GUIDE.md
      examples/auth.md: file://docs/auth.md

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

`ns.definition`의 `wiki:` 맵은 readme 옆에 추가 문서 페이지를 게시합니다: 키는 페이지 경로, 값은 `file://` 참조입니다. 내용은 팩 시점에 인라인되며 허브가 모듈별로 탐색 가능한 위키로 제공합니다.

## 의존성

다른 모듈에 대한 의존성을 선언합니다:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

버전 제약:

| 제약 | 의미 |
|------------|---------|
| `*` | 모든 버전 |
| `1.0.0` | 정확한 버전 |
| `>=1.0.0` | 최소 버전 |
| `^1.0.0` | 호환 (동일한 메이저) |

## 요구사항

소비자가 제공해야 하는 설정을 정의합니다:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API endpoint URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

타겟은 값이 주입될 위치를 지정합니다:
- `entry` - 설정할 전체 엔트리 ID
- `path` - 값 주입을 위한 JSONPath

`default`는 모든 스칼라 타입을 받습니다 — `default: 20`은 숫자 타겟에 문자열이 아닌 숫자로 흘러갑니다. `ns.dependency` 엔트리의 `parameters[].value`에도 동일하게 적용되며, 둘 다 `${env:NAME}` 참조를 받습니다 — 참조는 그대로 전달되고 타겟 엔트리가 디코드될 때 해석됩니다.

소비자는 오버라이드를 통해 설정합니다. `-o` 플래그는 `namespace:entry:field=value` 트리플을 받습니다:

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## 임포트

다른 엔트리를 참조합니다:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # 동일한 네임스페이스
    utils: acme.utils:helpers          # 다른 네임스페이스
    base_registry: :registry           # 내장
```

Lua에서:

```lua
local client = require("client")
local utils = require("utils")
```

## 계약

공개 인터페이스 정의:

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Perform GET request
    - name: post
      description: Perform POST request

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## 게시 워크플로우

### 1. 인증

```bash
wippy auth login
```

### 2. 준비

```bash
wippy init
wippy update
wippy lint
```

### 3. 검증

```bash
wippy publish --dry-run
```

### 4. 게시

```bash
wippy publish --version 1.0.0
```

릴리스 노트와 함께:

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

### 추가 플래그

| 플래그 | 설명 |
|------|-------------|
| `--label <name>` | 불변 버전 대신 가변 레이블(예: `latest`, `beta`)로 게시 |
| `--protected` | 게시된 버전을 보호됨으로 표시 (삭제 또는 덮어쓰기 불가) |
| `--registry <url>` | 이 게시에 대해 레지스트리 URL 재정의 |
| `--config <dir>` | `wippy.yaml`을 포함한 디렉토리 (기본값: 현재 디렉토리) |
| `--create` | 모듈이 아직 존재하지 않으면 허브에 등록한 뒤 게시 |
| `--module-visibility <v>` | `--create`에 대한 가시성: `private`(기본값) 또는 `public` |
| `--module-type <t>` | 모듈 타입: `library`, `application`, `agent`, 또는 `plugin` (wippy.yaml의 `type:`을 재정의) |
| `--module-display-name <n>` | `--create`에 대한 표시 이름 |

### 정적 파일 임베딩

`fs.directory` 엔트리(정적 자산, 템플릿, 공개 파일)가 있는 모듈은 게시된 패키지에 포함하려면 `--embed`를 사용해야 합니다. 그렇지 않으면 `fs.directory` 엔트리는 제외됩니다.

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

`--embed` 플래그는 `fs.directory` 엔트리와 일치하는 엔트리 ID 또는 이름을 받습니다. `wippy pack`에서도 동일한 플래그를 사용할 수 있습니다.

### 최초 게시

모듈을 처음 게시할 때는 허브에 자동으로 등록되며(기본값은 private), 게시가 한 번 재시도됩니다. `--create`를 전달하면 모듈을 미리 등록하고 속성을 설정할 수 있습니다:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create`는 멱등적입니다 — 이미 등록된 모듈에 대해서는 create 단계가 아무 동작도 하지 않습니다. 계정이 해당 조직에서 모듈을 생성할 수 없는 경우, 허브는 게시 대신 권한 오류를 반환합니다.

### 로컬 허브에 게시

`--registry`를 로컬에서 실행 중인 허브로 지정하면 공개 레지스트리 없이 게시하고 설치할 수 있습니다. 평문 HTTP는 로컬 호스트에서만 허용됩니다 — `localhost`, `127.0.0.1`, 그리고 컨테이너 별칭인 `host.docker.internal`(Docker Desktop / OrbStack)과 `host.containers.internal`(Podman). 그 외의 호스트는 HTTPS를 사용해야 합니다.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

레지스트리와 토큰은 `WIPPY_REGISTRY` 및 `WIPPY_TOKEN` 환경 변수로도 지정할 수 있습니다. 설정하지 않으면 레지스트리는 기본적으로 `https://hub.wippy.ai`가 됩니다.

### 할당량

조직의 private 모듈 할당량이 소진되면 게시는 `cannot publish: Private-module quota exhausted (5 of 5)...`와 같은 메시지와 함께 실패합니다. 모듈을 public으로 만들거나 조직 관리자에게 할당량 상향을 요청하세요. 업로드와 다운로드는 일시적인 네트워크 오류 발생 시 자동으로 재시도됩니다.

## 런타임 기본값 게시 {#publishing-runtime-defaults}

애플리케이션(`type: application` 전용)은 `wippy.yaml`의 `publish.runtime`을 통해 팩 안에 런타임 설정 기본값을 실어 보낼 수 있습니다:

```yaml
type: application
publish:
  runtime:
    source: .wippy.yaml            # default: .wippy.yaml
    sections: [security, registry, override]
    vars: [public_url]
```

| 필드 | 설명 |
|-------|-------------|
| `source` | 섹션을 읽어올 설정 파일 (기본값: `.wippy.yaml`) |
| `sections` | 기본값으로 팩 메타데이터에 복사되는 런타임 설정 섹션 |
| `vars` | 참조되지 않아도 팩에 포함할 변수의 명시적 허용 목록 |

규칙:

- 선택된 섹션이나 게시된 프로파일이 참조하는 변수만 팩에 포함됩니다 (전이적으로 추적됨); 그 외에는 `vars` 항목이 필요합니다.
- 내보내는 설정 안의 `${env:...}` 참조는 거부됩니다 — 게시자의 환경은 절대 팩으로 유출되지 않습니다.
- 머신 로컬 섹션인 `boot`, `extensions`, `workspace`는 내보낼 수 없습니다.
- 메인 애플리케이션 팩만 호스트 런타임 기본값을 제공합니다; 의존성 팩의 런타임 메타데이터는 무시됩니다.

대상 환경에서 설정은 낮은 것부터 높은 것 순으로 적용됩니다: 앱 팩 기본값, 런타임 내장 기본값, 로컬 설정 파일, 선택된 프로파일, CLI 오버라이드.

## 프로파일 게시 {#publishing-profiles}

루트 애플리케이션 프로파일은 팩의 `runtime.profiles` 메타데이터로 내보내집니다. 게시는 프로파일을 선택하거나 굽지 않습니다 — 소비자가 실행 시점에 `wippy run --profile <name>`으로 선택합니다:

```yaml
publish:
  profiles:
    enabled: true
    source: config/profiles.yaml   # default: .wippy.yaml
    include: [production]          # omit to publish all non-workspace profiles
```

`include: []`는 아무것도 게시하지 않습니다; 알 수 없는 이름은 게시를 실패시킵니다. `workspace` 하위 섹션은 게시된 프로파일 안에서도 절대 내보내지지 않습니다. 프로파일 선언은 [설정](guides/configuration.md#profiles)을 참조하세요.

## 게시된 모듈 사용

### 의존성 추가

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### 요구사항 설정

런타임에 값 재정의:

```bash
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

또는 `.wippy.yaml`에서:

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
```

### 코드에서 임포트

```yaml
# your src/_index.yaml
entries:
  - name: __dependency.acme.http
    kind: ns.dependency
    component: acme/http-utils
    version: ">=1.0.0"

  - name: my_handler
    kind: function.lua
    source: file://handler.lua
    imports:
      http: acme.http:client
```

## 전체 예제

**wippy.yaml:**
```yaml
organization: acme
module: cache
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml:**
```yaml
version: "1.0"
namespace: acme.cache

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: Cache Module

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximum cache entries
    targets:
      - entry: acme.cache:cache
        path: ".meta.max_size"
    default: 1000

  - name: cache
    kind: library.lua
    meta:
      max_size: 1000
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}
local max_size = 1000

function cache.set(key, value, ttl)
    if #store >= max_size then
        cache.evict_oldest()
    end
    store[key] = {
        value = value,
        expires = ttl and (time.now():unix() + ttl) or nil
    }
end

function cache.get(key)
    local entry = store[key]
    if not entry then return nil end
    if entry.expires and time.now():unix() > entry.expires then
        store[key] = nil
        return nil
    end
    return entry.value
end

return cache
```

게시:

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## 참고

- [CLI 참조](guides/cli.md)
- [엔트리 종류](guides/entry-kinds.md)
- [설정](guides/configuration.md)
