# HTTP 엔드포인트

엔드포인트(`http.endpoint`)는 Lua 함수를 실행하는 HTTP 라우트 핸들러를 정의합니다.

## 정의

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## 설정

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `router` | registry.ID | 부모 라우터 (라우터가 하나면 선택적) |
| `method` | string | HTTP 메서드 |
| `path` | string | URL 경로 패턴 |
| `func` | registry.ID | 실행할 함수 |

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
function(req, res)
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
function(req, res)
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## 핸들러 함수

엔드포인트 함수는 요청 및 응답 객체를 받습니다:

```lua
function(req, res)
    -- 요청 읽기
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- 처리
    local user = get_user(user_id)

    -- 응답 쓰기
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### Request 객체

| 메서드 | 반환값 | 설명 |
|--------|---------|-------------|
| `req:method()` | string | HTTP 메서드 |
| `req:path()` | string | 요청 경로 |
| `req:param(name)` | string | URL 파라미터 |
| `req:query(name)` | string | 쿼리 파라미터 |
| `req:header(name)` | string | 요청 헤더 |
| `req:headers()` | table | 모든 헤더 |
| `req:body()` | string | 요청 본문 |
| `req:cookie(name)` | string | 쿠키 값 |
| `req:remote_addr()` | string | 클라이언트 IP 주소 |

### Response 객체

| 메서드 | 설명 |
|--------|-------------|
| `res:set_status(code)` | HTTP 상태 설정 |
| `res:set_header(name, value)` | 헤더 설정 |
| `res:set_cookie(name, value, opts)` | 쿠키 설정 |
| `res:write(data)` | 본문 쓰기 |
| `res:redirect(url, code?)` | 리다이렉트 (기본값 302) |

## JSON API 패턴

JSON API의 일반적인 패턴:

```lua
local json = require("json")

function(req, res)
    -- JSON 본문 파싱
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "Invalid JSON"}))
        return
    end

    -- 요청 처리
    local result = process(data)

    -- JSON 응답 반환
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## 에러 응답

```lua
local function api_error(res, status, code, message)
    res:set_status(status)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode({
        error = {
            code = code,
            message = message
        }
    }))
end

function(req, res)
    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, 404, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, 500, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(user))
end
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
    router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### 보호된 엔드포인트

```yaml
- name: admin_endpoint
  kind: http.endpoint
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

- [라우터](http-router.md) - 라우트 그룹화
- [HTTP 모듈](lua-http.md) - 요청/응답 API
- [미들웨어](http-middleware.md) - 요청 처리
