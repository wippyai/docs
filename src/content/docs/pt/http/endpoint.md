---
title: "Endpoints HTTP"
---

# Endpoints HTTP

Endpoints (`http.endpoint`) definem handlers de rota HTTP que executam funções Lua.

## Definição

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Configuração

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `meta.router` | registry.ID | Não | Roteador pai (padrão: o único roteador se exatamente um estiver registrado) |
| `method` | string | Sim | Método HTTP |
| `path` | string | Sim | Padrão de caminho URL |
| `func` | registry.ID | Sim | Função a executar |

## Métodos HTTP

Métodos suportados:

| Método | Caso de Uso |
|--------|-------------|
| `GET` | Recuperar recursos |
| `POST` | Criar recursos |
| `PUT` | Substituir recursos |
| `PATCH` | Atualização parcial |
| `DELETE` | Remover recursos |
| `HEAD` | Apenas headers |
| `OPTIONS` | Preflight CORS (tratado automaticamente) |
| `TRACE` | Loopback de diagnóstico |

## Parâmetros de Caminho

Use sintaxe `{param}` para parâmetros de URL:

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

Acesso no handler:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## Caminhos Curinga

Capture caminho restante com `{path...}`:

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

## Função Handler

Funções de endpoint obtêm objetos de requisição e resposta do módulo `http`:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Lê requisição
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Processa
    local user = get_user(user_id)

    -- Escreve resposta
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### Objeto Request

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `req:method()` | string | Método HTTP |
| `req:path()` | string | Caminho da requisição |
| `req:param(name)` | string | Parâmetro de URL |
| `req:params()` | table | Todos os parâmetros de caminho |
| `req:query(name)` | string | Parâmetro de query |
| `req:query_params()` | table | Todos os parâmetros de query |
| `req:header(name)` | string | Header da requisição |
| `req:body()` | string | Corpo da requisição |
| `req:body_json()` | table, error | Analisa corpo JSON |
| `req:has_body()` | boolean | Verifica se existe corpo |
| `req:content_type()` | string | Tipo de conteúdo |
| `req:content_length()` | number | Tamanho do corpo em bytes |
| `req:host()` | string | Nome do host |
| `req:remote_addr()` | string | Endereço IP do cliente |
| `req:accepts(type)` | boolean | Negociação de conteúdo |
| `req:is_content_type(type)` | boolean | Verifica tipo de conteúdo |
| `req:stream()` | Stream | Corpo como stream para arquivos grandes |
| `req:parse_multipart(max?)` | table, error | Analisa formulário multipart |

### Objeto Response

| Método | Descrição |
|--------|-----------|
| `res:set_status(code)` | Define código de status HTTP |
| `res:set_header(name, value)` | Define header de resposta |
| `res:set_content_type(type)` | Define tipo de conteúdo |
| `res:write(data)` | Escreve corpo bruto |
| `res:write_json(data)` | Escreve resposta JSON |
| `res:write_event(data)` | Envia evento SSE |
| `res:set_transfer(encoding)` | Define modo de transferência (SSE, chunked) |
| `res:flush()` | Descarrega resposta para o cliente |

## Padrão de API JSON

Padrão comum para APIs JSON:

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

## Respostas de Erro

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

## Exemplos

### Endpoints CRUD

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

### Endpoint Protegido

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

## Veja Também

- [Roteador](http/router.md) - Agrupamento de rotas
- [Módulo HTTP](lua/http/http.md) - API de requisição/resposta
- [Middleware](http/middleware.md) - Processamento de requisição
