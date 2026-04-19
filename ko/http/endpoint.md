# HTTP 엔드포인트

엔드포인트(`http.endpoint`)는 Lua 함수를 실행하는 HTTP 라우트 핸들러를 정의합니다.

## 정의

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## 설정

| 필드 | 타입 | 필수 | 설명 |
|-------|------|------|-------------|
| `meta.router` | registry.ID | 아니오 | 부모 라우터 (정확히 하나의 라우터가 등록된 경우 해당 라우터가 기본값) |
| `method` | string | 예 | HTTP 메서드 |
| `path` | string | 예 | URL 경로 패턴 |
| `func` | registry.ID | 예 | 실행할 함수 |

## HTTP 메서드

지원되는 메서드:

| 메서드 | 사용 사례 |
|--------|----------|
| `GET` | 리소스 조회 |
| `POST` | 리소스 생성 |
| `PUT` | 리소스 교체 |
| `PATCH` | 부분 업데이트 |
| `DELETE` | 리소스 삭제 |
| `HEAD` | 헤더만 |
| `OPTIONS` | CORS 프리플라이트 (자동 처리) |
| `TRACE` | 진단 루프백 |

## 경로 파라미터

URL 파라미터에 `{param}` 구문 사용:

```yaml
- name: get_user
  kind: http.endpoint
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

핸들러에서 접근:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## 와일드카드 경로

`{path...}`로 나머지 경로 캡처:

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

```lua
local function handler()
    local req = http.request()
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## 핸들러 함수

엔드포인트 함수는 `http` 모듈에서 요청 및 응답 객체를 가져옵니다:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- 요청 읽기
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- 처리
    local user = get_user(user_id)

    -- 응답 쓰기
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### Request 객체

| 메서드 | 반환값 | 설명 |
|--------|---------|-------------|
| `req:method()` | string | HTTP 메서드 |
| `req:path()` | string | 요청 경로 |
| `req:param(name)` | string | URL 파라미터 |
| `req:params()` | table | 모든 경로 파라미터 |
| `req:query(name)` | string | 쿼리 파라미터 |
| `req:query_params()` | table | 모든 쿼리 파라미터 |
| `req:header(name)` | string | 요청 헤더 |
| `req:body()` | string | 요청 본문 |
| `req:body_json()` | table, error | JSON 본문 파싱 |
| `req:has_body()` | boolean | 본문 존재 여부 확인 |
| `req:content_type()` | string | 콘텐츠 타입 |
| `req:content_length()` | number | 본문 크기 (바이트) |
| `req:host()` | string | 호스트명 |
| `req:remote_addr()` | string | 클라이언트 IP 주소 |
| `req:accepts(type)` | boolean | 콘텐츠 협상 |
| `req:is_content_type(type)` | boolean | 콘텐츠 타입 확인 |
| `req:stream()` | Stream | 대용량 파일용 스트림으로 본문 |
| `req:parse_multipart(max?)` | table, error | 멀티파트 폼 파싱 |

### Response 객체

| 메서드 | 설명 |
|--------|-------------|
| `res:set_status(code)` | HTTP 상태 코드 설정 |
| `res:set_header(name, value)` | 응답 헤더 설정 |
| `res:set_content_type(type)` | 콘텐츠 타입 설정 |
| `res:write(data)` | 원시 본문 쓰기 |
| `res:write_json(data)` | JSON 응답 쓰기 |
| `res:write_event(data)` | SSE 이벤트 전송 |
| `res:set_transfer(encoding)` | 전송 모드 설정 (SSE, chunked) |
| `res:flush()` | 클라이언트로 응답 플러시 |

## JSON API 패턴

JSON API의 일반적인 패턴:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local res = http.response()

    local data, err = req:body_json()
    if err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "Invalid JSON"})
        return
    end

    local result = process(data)

    res:set_status(http.STATUS.OK)
    res:write_json(result)
end

return { handler = handler }
```

## 에러 응답

```lua
local http = require("http")

local function api_error(res, status, code, message)
    res:set_status(status)
    res:write_json({
        error = {
            code = code,
            message = message
        }
    })
end

local function handler()
    local req = http.request()
    local res = http.response()

    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

## 예제

### CRUD 엔드포인트

```yaml
entries:
  - name: users_router
    kind: http.router
    prefix: /api/users
    middleware:
      - cors
      - compress

  - name: list_users
    kind: http.endpoint
    meta:
      router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    meta:
      router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    meta:
      router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    meta:
      router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    meta:
      router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### 보호된 엔드포인트

```yaml
- name: admin_endpoint
  kind: http.endpoint
  meta:
    router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"
```

## 참고

- [라우터](http/router.md) - 라우트 그룹화
- [HTTP 모듈](lua/http/http.md) - 요청/응답 API
- [미들웨어](http/middleware.md) - 요청 처리
