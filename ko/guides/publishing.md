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

## wippy.yaml

모듈 매니페스트:

```yaml
organization: acme
module: http-utils
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
| `description` | 아니오 | 짧은 설명 |
| `license` | 아니오 | SPDX 식별자 (MIT, Apache-2.0) |
| `repository` | 아니오 | 소스 저장소 URL |
| `homepage` | 아니오 | 프로젝트 홈페이지 |
| `keywords` | 아니오 | 검색 키워드 |

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

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

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

### 정적 파일 임베딩

`fs.directory` 엔트리(정적 자산, 템플릿, 공개 파일)가 있는 모듈은 게시된 패키지에 포함하려면 `--embed`를 사용해야 합니다. 그렇지 않으면 `fs.directory` 엔트리는 제외됩니다.

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

`--embed` 플래그는 `fs.directory` 엔트리와 일치하는 엔트리 ID 또는 이름을 받습니다. `wippy pack`에서도 동일한 플래그를 사용할 수 있습니다.

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
    default: "1000"

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
