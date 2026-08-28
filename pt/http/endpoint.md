---
title: "Endpoints HTTP"
description: "Endpoints (http.endpoint) associam métodos e caminhos HTTP a funções handler Lua."
---

# Endpoints HTTP

Uma entrada `http.endpoint` associa um método e um caminho HTTP a uma função handler Lua.

**Classificação: referência de configuração e API.** Os blocos YAML são fragmentos do registro que pressupõem a existência das entradas de servidor, roteador, middleware, função e políticas de segurança referenciadas. Os blocos Lua se concentram nos contratos do handler e identificam explicitamente as chamadas pertencentes à aplicação.

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
| `meta.router` | registry.ID | Sim | Roteador pai, referenciado pelo ID do registro |
| `method` | string | Sim | Método HTTP |
| `path` | string | Sim | Padrão do caminho da URL |
| `func` | registry.ID | Sim | Função a executar |

## Métodos HTTP

Métodos compatíveis:

| Método | Caso de uso |
|--------|-------------|
| `GET` | Recuperar recursos |
| `POST` | Criar recursos |
| `PUT` | Substituir recursos |
| `PATCH` | Atualização parcial |
| `DELETE` | Remover recursos |
| `HEAD` | Somente headers |
| `OPTIONS` | Preflight CORS, tratado automaticamente |
| `TRACE` | Loopback de diagnóstico |
| `*` | Corresponder a qualquer método HTTP |

## Parâmetros de caminho

Use a sintaxe `{param}` para parâmetros de URL:

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

Acesse-os no handler:

```lua
local http = require("http")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local user_id, user_err = req:param("user_id")
    if user_err then return nil, user_err end
    local post_id, post_err = req:param("post_id")
    if post_err then return nil, post_err end
    return {user_id = user_id, post_id = post_id}
end
```

## Caminhos curinga

Use `{path...}` para corresponder a todos os segmentos de caminho restantes:

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

Esse segmento catch-all faz a rota corresponder a requisições como `/files/docs/readme.md`. Nessa requisição, `req:param("path")` retorna `docs/readme.md`.

## Função handler

As funções de endpoint obtêm os objetos de requisição e resposta pelo módulo `http`:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end

    local user, call_err = funcs.call("app.users:get_user", user_id)
    if call_err then return nil, call_err end

    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

### Objeto Request

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `req:method()` | string, error | Método HTTP |
| `req:path()` | string, error | Caminho da requisição |
| `req:param(name)` | string ou nil, error | Parâmetro da URL |
| `req:params()` | table, error | Todos os parâmetros de caminho |
| `req:query(name)` | string ou nil, error | Parâmetro de query |
| `req:query_params()` | table, error | Todos os parâmetros de query |
| `req:header(name)` | string ou nil, error | Header da requisição |
| `req:body()` | string, error | Corpo da requisição |
| `req:body_json()` | value, error | Analisa o corpo JSON |
| `req:has_body()` | boolean, error | Verifica se existe um corpo |
| `req:content_type()` | string ou nil, error | Tipo de conteúdo |
| `req:content_length()` | number, error | Tamanho do corpo em bytes |
| `req:host()` | string, error | Header Host |
| `req:remote_addr()` | string, error | Endereço do cliente no formato `IP:port`, a menos que um middleware o reescreva |
| `req:accepts(type)` | boolean, error | Negociação de conteúdo |
| `req:is_content_type(type)` | boolean, error | Verifica o tipo de conteúdo |
| `req:stream()` | Stream, error | Corpo como stream para arquivos grandes |
| `req:parse_multipart(max?)` | table, error | Analisa um formulário multipart |

### Objeto Response

| Método | Descrição |
|--------|-----------|
| `res:set_status(code)` | Define o status HTTP; retorna um erro se os headers já tiverem sido enviados |
| `res:set_header(name, value)` | Define um header de resposta; retorna um erro se os headers já tiverem sido enviados |
| `res:set_content_type(type)` | Define o tipo de conteúdo; retorna um erro se os headers já tiverem sido enviados |
| `res:write(data)` | Escreve o corpo bruto; retorna um erro em caso de falha |
| `res:write_json(data)` | Escreve uma resposta JSON; retorna um erro em caso de falha |
| `res:write_event(data)` | Envia e descarrega um evento SSE; retorna um erro em caso de falha |
| `res:set_transfer(encoding)` | Define o modo de transferência `chunked` ou `sse`; retorna um erro se os headers já tiverem sido enviados |
| `res:flush()` | Descarrega a resposta; retorna um valor de erro |

## Padrão de API JSON

Um handler de API JSON pode analisar o corpo da requisição, rejeitar entradas inválidas e escrever um resultado JSON:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local data, err = req:body_json()
    if err then
        local status_err = res:set_status(http.STATUS.BAD_REQUEST)
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = "Invalid JSON"})
        if write_err then return nil, write_err end
        return true
    end

    local result, process_err = funcs.call("app.api:process_request", data)
    if process_err then return nil, process_err end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(result)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## Respostas de erro

```lua
local http = require("http")
local funcs = require("funcs")

local function api_error(res, status, code, message)
    local status_err = res:set_status(status)
    if status_err then return nil, status_err end
    local write_err = res:write_json({
        error = {
            code = code,
            message = message
        }
    })
    if write_err then return nil, write_err end
    return true
end

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.users:get_user", user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## Exemplos

### Endpoints CRUD

```yaml
entries:
  - name: users_router
    kind: http.router
    meta:
      server: gateway
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

### Endpoint protegido

O middleware de autorização é configurado no roteador pai, não no endpoint. O middleware de pós-match, como `endpoint_firewall`, é executado depois da correspondência da rota e se aplica a todos os endpoints sob o roteador:

```yaml
- name: admin_router
  kind: http.router
  meta:
    server: gateway
  prefix: /admin
  middleware:
    - cors
    - token_auth
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"

- name: admin_endpoint
  kind: http.endpoint
  meta:
    router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
```

## Veja também

- [Roteador](http/router.md) - Agrupamento de rotas
- [Módulo HTTP](lua/http/http.md) - API de requisição e resposta
- [Middleware](http/middleware.md) - Processamento de requisições
