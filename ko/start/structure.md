# YAML 및 프로젝트 구조

프로젝트 레이아웃, YAML 정의 파일, 명명 규칙.

## 디렉토리 레이아웃

```
myapp/
├── .wippy.yaml          # 런타임 설정
├── wippy.lock           # 소스 디렉토리 설정
├── .wippy/              # 설치된 모듈
└── src/                 # 애플리케이션 소스
    ├── _index.yaml      # 엔트리 정의
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

### 파일 구조

`version`과 `namespace`가 있는 모든 YAML 파일이 유효합니다:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: ID로 사용자 조회
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: 사용자 API 엔드포인트
    method: GET
    path: /users/{id}
    func: get_user
```

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `version` | 예 | 스키마 버전 (현재 `"1.0"`) |
| `namespace` | 예 | 이 파일의 엔트리 네임스페이스 |
| `entries` | 예 | 엔트리 정의 배열 |

### 명명 규칙

의미 단위 구분에는 점(`.`)을, 단어 구분에는 밑줄(`_`)을 사용합니다:

```yaml
# 함수와 엔드포인트
- name: get_user              # 함수
- name: get_user.endpoint     # HTTP 엔드포인트

# 같은 함수에 대한 여러 엔드포인트
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# 라우터
- name: api.public            # 퍼블릭 API 라우터
- name: api.admin             # 관리자 API 라우터
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

`wippy.lock` 파일은 Wippy가 정의를 로드하는 위치를 정의합니다:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy는 이러한 디렉토리를 재귀적으로 스캔하여 YAML 파일을 찾습니다.

## 엔트리 정의

`entries` 배열의 각 엔트리입니다. 속성은 루트 레벨에 위치합니다 (`data:` 래퍼 없음):

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: hello world 반환
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello 엔드포인트
    method: GET
    path: /hello
    func: hello
```

### 메타데이터

UI 표시용 정보는 `meta`에 지정합니다:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: 결제 프로세서
    comment: Stripe 결제 처리
  source: file://payment.lua
```

`meta.title`과 `meta.comment`는 관리 UI에 표시됩니다.

### 애플리케이션 엔트리

애플리케이션 수준 설정에는 `registry.entry` kind를 사용합니다:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: 애플리케이션 설정
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## 일반적인 엔트리 종류

| Kind | 목적 |
|------|---------|
| `registry.entry` | 범용 데이터 |
| `function.lua` | 호출 가능한 Lua 함수 |
| `process.lua` | 장기 실행 프로세스 |
| `http.service` | HTTP 서버 |
| `http.router` | 라우트 그룹 |
| `http.endpoint` | HTTP 핸들러 |
| `process.host` | 프로세스 슈퍼바이저 |

전체 레퍼런스는 [엔트리 종류 가이드](guides/entry-kinds.md)를 참조하세요.

## 설정 파일

### .wippy.yaml

프로젝트 루트의 런타임 설정:

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

모든 옵션은 [설정 가이드](guides/configuration.md)를 참조하세요.

### wippy.lock

소스 디렉토리 정의:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## 엔트리 참조

전체 ID 또는 상대 이름으로 엔트리를 참조합니다:

```yaml
# 전체 ID (네임스페이스 간)
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# 같은 네임스페이스 - 이름만 사용
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
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

- [엔트리 종류 가이드](guides/entry-kinds.md) - 사용 가능한 엔트리 종류
- [설정 가이드](guides/configuration.md) - 런타임 옵션
- [커스텀 엔트리 종류](internals/kinds.md) - 핸들러 구현 (고급)
