---
title: "YAML 및 프로젝트 구조"
description: "프로젝트 레이아웃, YAML 정의 파일, 명명 규칙."
---

# YAML 및 프로젝트 구조

## 디렉토리 레이아웃

```
myapp/
├── .wippy.yaml          # Runtime configuration
├── wippy.lock           # Source directories config
├── .wippy/              # Installed modules
└── src/                 # Application source
    ├── _index.yaml      # Entry definitions
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## YAML 정의 파일

<note>
YAML 정의는 시작 시 레지스트리에 로드됩니다. 레지스트리가 실제 데이터의 원본입니다. YAML 파일은 레지스트리를 채우는 방법 중 하나이며, 엔트리는 다른 소스에서 가져오거나 프로그래밍 방식으로 생성할 수도 있습니다.
</note>

### 정의 파일 형식

정의 파일은 `namespace`와 `entries` 배열 또는 top-level `name` 및 `kind` 필드를 포함합니다. 선택적인 `version` marker는 관례적으로 `"1.0"`이며 v0.3.32a loader는 이를 요구하지 않습니다.

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Fetches user by ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: User API endpoint
    method: GET
    path: /users/{id}
    func: get_user
```

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `version` | No | manifest version marker(관례적으로 `"1.0"`) |
| `namespace` | Yes | 이 파일의 엔트리 namespace |
| `entries` | Conditional | 엔트리 정의 배열; top-level `name`과 `kind`를 사용할 때만 생략 |

### 명명 규칙

의미 단위 구분에는 점(`.`)을, 단어 구분에는 밑줄(`_`)을 사용합니다:

```yaml
# Function and its endpoint
- name: get_user              # The function
- name: get_user.endpoint     # Its HTTP endpoint

# Multiple endpoints for same function
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Public API router
- name: api.admin             # Admin API router
```

<tip>
패턴: <code>base_name.variant</code> - 점은 의미 단위를 구분하고, 밑줄은 단위 내 단어를 구분합니다.
</tip>

### 네임스페이스

네임스페이스는 점으로 구분된 식별자입니다:

```
app
app.api
app.api.v2
app.workers
```

엔트리 전체 ID는 네임스페이스와 이름을 결합합니다: `app.api:get_user`

### 소스 디렉토리

`wippy.lock` 파일은 애플리케이션 source root와 locked module을 resolve할 base directory를 지정합니다.

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy는 `directories.src`를 애플리케이션 load path로 추가합니다. `directories.modules`는 하나의 raw source tree로 scan되지 않습니다. 각 locked module은 versioned `.wapp` archive 또는 unpacked module path로 resolve되고, 각 replacement는 설정된 entry root로 resolve됩니다. loader는 애플리케이션 source와 선택된 directory 기반 module 또는 replacement root에서 `.yaml`, `.yml`, `.json` manifest를 재귀적으로 scan하며 `.wapp` module은 archive로 읽습니다. `namespace`가 있는 object-shaped file만 registry manifest로 취급하고 `node_modules` directory는 건너뜁니다. `_index.yaml`은 프로젝트 관례이지 유일하게 허용되는 filename은 아닙니다.

## 엔트리 정의

`entries` 배열의 각 item은 하나의 엔트리를 정의합니다. 다음 예와 같이 kind-specific field는 `name`, `kind`, `meta` 옆에 둘 수 있습니다.

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Returns hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello endpoint
    method: GET
    path: /hello
    func: hello
```

명시적 `data:` 필드도 지원됩니다. 이 필드가 있으면 그 값이 kind-specific payload 전체이므로 sibling kind-specific field와 함께 사용하지 마십시오.

```yaml
entries:
  - name: config
    kind: registry.entry
    data:
      environment: production
      features:
        dark_mode: true
```

### 메타데이터

UI 표시용 정보는 `meta`에 지정합니다:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Payment Processor
    comment: Handles Stripe payments
  source: file://payment.lua
```

`meta.title`과 `meta.comment`는 registry consumer와 management interface가 표시할 수 있는 설명 정보에 사용합니다.

### 애플리케이션 엔트리

애플리케이션 수준 설정에는 `registry.entry` kind를 사용합니다:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Application Settings
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## 일반적인 엔트리 종류

| 종류 | 목적 |
|------|---------|
| `registry.entry` | 일반 event dispatch 없이 저장되는 범용 데이터 |
| `function.lua` | 호출 가능한 Lua 함수 |
| `process.lua` | 장기 실행 프로세스 |
| `http.service` | HTTP 서버 |
| `http.router` | 라우트 그룹 |
| `http.endpoint` | HTTP 핸들러 |
| `process.host` | 프로세스 실행 host |

엔트리 kind 레퍼런스는 [엔트리 종류 가이드](../guides/entry-kinds.md)를 참조하십시오.

## 설정 파일

### .wippy.yaml

프로젝트 루트의 런타임 설정:

```yaml
version: "1.0"

logger:
  encoding: json

logmanager:
  min_level: 0

supervisor:
  host:
    worker_count: 16
```

런타임 설정 필드는 [설정 가이드](../guides/configuration.md)를 참조하십시오.

### wippy.lock

소스 디렉토리 정의:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## 엔트리 참조

entry kind가 지원하는 경우 full ID 또는 relative name으로 엔트리를 참조합니다. HTTP router와 endpoint는 parent-side child list가 아니라 `meta.server` 및 `meta.router`를 통해 연결됩니다.

```yaml
# Router declares itself against a server
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# Endpoint references router by registry ID (cross-namespace works the same way)
- name: get_user.endpoint
  kind: http.endpoint
  meta:
    router: app.api:api
  method: GET
  path: /users/{id}
  func: app.api:get_user
```

## 예제 프로젝트

```
myapp/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml           # namespace: app
    ├── api/
    │   ├── _index.yaml       # namespace: app.api
    │   ├── users.lua
    │   └── orders.lua
    ├── lib/
    │   ├── _index.yaml       # namespace: app.lib
    │   └── database.lua
    └── workers/
        ├── _index.yaml       # namespace: app.workers
        └── email_sender.lua
```

## 참고

- [애플리케이션 아키텍처](../concepts/architecture.md) — 애플리케이션을 slice와 layer로 구성하기
- [엔트리 종류 가이드](../guides/entry-kinds.md) — 사용 가능한 엔트리 kind 검토하기
- [설정 가이드](../guides/configuration.md) — 런타임 옵션 설정하기
- [커스텀 엔트리 종류](../internals/kinds.md) — handler 구현하기(고급)
