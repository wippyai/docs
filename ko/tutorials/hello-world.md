# Hello World

첫 번째 Wippy 애플리케이션 - JSON을 반환하는 간단한 HTTP API.

## 만들 것

하나의 엔드포인트가 있는 최소한의 웹 API:

```
GET /hello → {"message": "hello world"}
```

## 프로젝트 구조

```
hello-world/
├── wippy.lock           # 생성된 lock 파일
└── src/
    ├── _index.yaml      # 엔트리 정의
    └── hello.lua        # 핸들러 코드
```

## 1단계: 프로젝트 디렉토리 생성

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## 2단계: 엔트리 정의

`src/_index.yaml` 생성:

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP 서버
  - name: gateway
    kind: http.service
    addr: :8080
    lifecycle:
      auto_start: true

  # 라우터
  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /

  # 핸들러 함수
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # 엔드포인트
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: hello
    path: /hello
```

**네 개의 엔트리가 함께 작동합니다:**

1. `gateway` - 포트 8080에서 리스닝하는 HTTP 서버
2. `api` - `meta.server`를 통해 gateway에 연결된 라우터
3. `hello` - 요청을 처리하는 Lua 함수
4. `hello.endpoint` - `GET /hello`를 함수로 라우팅

## 3단계: 핸들러 코드

`src/hello.lua` 생성:

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

`http` 모듈은 요청/응답 객체에 대한 접근을 제공합니다. 함수는 내보내진 `handler` 메서드가 있는 테이블을 반환합니다.

## 4단계: 초기화 및 실행

```bash
# 소스에서 lock 파일 생성
wippy init

# 런타임 시작 (-c는 컬러 콘솔 출력)
wippy run -c
```

다음과 같은 출력을 볼 수 있습니다:

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## 5단계: 테스트

```bash
curl http://localhost:8080/hello
```

응답:

```json
{"message":"hello world"}
```

## 작동 방식

1. `gateway`가 포트 8080에서 TCP 연결 수락
2. `api` 라우터가 경로 접두사 `/` 매칭
3. `hello.endpoint`가 `GET /hello` 매칭
4. `hello` 함수가 실행되고 JSON 응답 작성

## CLI 레퍼런스

| 명령어 | 설명 |
|---------|-------------|
| `wippy init` | `src/`에서 lock 파일 생성 |
| `wippy run` | lock 파일에서 런타임 시작 |
| `wippy run -c` | 컬러 콘솔 출력과 함께 시작 |
| `wippy run -v` | 상세 디버그 로깅과 함께 시작 |
| `wippy run -s` | 사일런트 모드로 시작 (콘솔 로그 없음) |

## 다음 단계

- [에코 서비스](echo-service.md) - 요청 파라미터 처리
- [태스크 큐](task-queue.md) - 백그라운드 처리가 있는 REST API
- [HTTP 라우터](http-router.md) - 라우팅 패턴
