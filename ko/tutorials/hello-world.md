---
title: "Hello World"
description: "JSON을 반환하는 최소 Wippy HTTP API를 만들고 실행합니다."
---

# Hello World

JSON을 반환하는 HTTP 엔드포인트 하나로 최소 Wippy 애플리케이션을 만듭니다.

**분류:** 실행 가능한 튜토리얼. 로컬 HTTP 애플리케이션의 완전한 레지스트리와 Lua 소스, 시작 및 검증 명령을 제공합니다.

## 만들 항목

엔드포인트 하나가 있는 최소 웹 API입니다:

```
GET /hello → {"message": "hello world"}
```

## 사전 요구 사항

- `wippy` 명령으로 사용할 수 있는 Wippy 런타임 `v0.3.32a`. `wippy version --short`로 확인하세요.
- `curl` 또는 다른 HTTP 클라이언트.
- 로컬 머신에서 사용 가능한 8080 포트.

## 프로젝트 구조

```
hello-world/
├── wippy.lock           # Generated lock file
└── src/
    ├── _index.yaml      # Entry definitions
    └── hello.lua        # Handler code
```

## 1단계: 프로젝트 디렉터리 만들기

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## 2단계: 엔트리 정의

`src/_index.yaml`을 만듭니다:

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP server
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router
  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /

  # Handler function
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # Endpoint
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: app:hello
    path: /hello
```

애플리케이션은 네 엔트리를 사용합니다:

1. `gateway` — 8080 포트에서 수신하는 HTTP 서버
2. `api` — `meta.server`를 통해 gateway에 연결된 라우터
3. `hello` — 요청을 처리하는 Lua 함수
4. `hello.endpoint` — `GET /hello`를 함수로 연결하는 경로

## 3단계: 핸들러 코드

`src/hello.lua`를 만듭니다:

```lua
local http = require("http")

local function handler()
    local res, response_err = http.response()
    if response_err then
        error("cannot create response: " .. tostring(response_err))
    end

    local content_type_err = res:set_content_type(http.CONTENT.JSON)
    if content_type_err then
        error("cannot set content type: " .. tostring(content_type_err))
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then
        error("cannot set status: " .. tostring(status_err))
    end

    local write_err = res:write_json({message = "hello world"})
    if write_err then
        error("cannot write response: " .. tostring(write_err))
    end
end

return {
    handler = handler
}
```

`http` 모듈은 요청 및 응답 객체에 접근하게 해줍니다. 함수는 내보낸 `handler` 메서드가 있는 테이블을 반환합니다.

## 4단계: 초기화 및 실행

```bash
# Generate lock file from source
wippy init

# Start the runtime (-c for colorful console output)
wippy run -c
```

`wippy init`은 `wippy.lock`을 기록합니다. 엔드포인트를 테스트하는 동안 `wippy run -c`를 계속 실행하세요. 로그 형식은 빌드마다 달라지므로 아래 HTTP 응답을 준비 상태 검사로 사용합니다.

## 5단계: 테스트

```bash
curl http://localhost:8080/hello
```

예상 응답:

```json
{"message":"hello world"}
```

요청은 HTTP 상태 200과 `Content-Type: application/json`을 반환해야 합니다.

## 작동 방식

1. `gateway`가 8080 포트에서 TCP 연결을 수락합니다.
2. `api` 라우터가 `/` 경로 접두사를 일치시킵니다.
3. `hello.endpoint`가 `GET /hello`를 일치시킵니다.
4. `hello` 함수가 JSON 응답을 기록합니다.

## CLI 참조

| 명령 | 설명 |
|---------|-------------|
| `wippy init` | `./src`를 소스 디렉터리로 사용해 `wippy.lock` 생성 |
| `wippy run` | lock 파일에서 런타임 시작 |
| `wippy run -c` | 컬러 콘솔 출력과 함께 시작 |
| `wippy run -v` | 자세한 디버그 로깅과 함께 시작 |
| `wippy run -s` | 무음 모드로 시작(콘솔 로그 없음) |

## 문제 해결 및 정리

- `wippy init`이 엔트리를 찾지 못하면 `hello-world/`에서 실행했는지와 `src/_index.yaml`이 있는지 확인하세요.
- 시작 시 주소가 이미 사용 중이라고 보고되면 8080 포트를 사용하는 프로세스를 중지하거나 `addr`과 테스트 URL을 같은 빈 포트로 바꾸세요.
- 404 응답은 보통 라우터 또는 엔드포인트 엔트리가 위 정의와 다르다는 뜻입니다. `meta.server`, `meta.router`, `/hello`를 정확히 확인하세요.
- 런타임 터미널에서 Ctrl+C를 눌러 애플리케이션을 중지합니다. 디렉터리에서 나온 뒤 일회용 연습 프로젝트라면 `hello-world/`를 삭제하세요.

## 다음 단계

- [에코 서비스](echo-service.md) — 다중 프로세스 CLI 서비스 구축
- [태스크 큐](task-queue.md) — REST API와 백그라운드 처리 결합
- [HTTP 라우터](../http/router.md) — 라우팅 패턴 검토
