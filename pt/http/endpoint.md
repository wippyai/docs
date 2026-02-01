# Endpoints HTTP

Endpoints (`http.endpoint`) definem handlers de rota HTTP que executam funcoes Lua.

## Definicao

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Configuracao

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `router` | registry.ID | Roteador pai (opcional se apenas um roteador) |
| `method` | string | Metodo HTTP |
| `path` | string | Padrao de caminho URL |
| `func` | registry.ID | Funcao a executar |

## Metodos HTTP

Metodos suportados:

| Metodo | Caso de Uso |
|--------|-------------|
| `GET` | Recuperar recursos |
| `POST` | Criar recursos |
| `PUT` | Substituir recursos |
| `PATCH` | Atualizacao parcial |
| `DELETE` | Remover recursos |
| `HEAD` | Apenas headers |
| `OPTIONS` | Preflight CORS (tratado automaticamente) |

## Parametros de Caminho

Use sintaxe `{param}` para parametros de URL:

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
function(req, res)
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
function(req, res)
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## Funcao Handler

Funcoes de endpoint recebem objetos de requisicao e resposta:

```lua
function(req, res)
    -- Le requisicao
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Processa
    local user = get_user(user_id)

    -- Escreve resposta
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### Objeto Request

| Metodo | Retorna | Descricao |
|--------|---------|-----------|
| `req:method()` | string | Metodo HTTP |
| `req:path()` | string | Caminho da requisicao |
| `req:param(name)` | string | Parametro de URL |
| `req:query(name)` | string | Parametro de query |
| `req:header(name)` | string | Header da requisicao |
| `req:headers()` | table | Todos os headers |
| `req:body()` | string | Corpo da requisicao |
| `req:cookie(name)` | string | Valor do cookie |
| `req:remote_addr()` | string | Endereco IP do cliente |

### Objeto Response

| Metodo | Descricao |
|--------|-----------|
| `res:set_status(code)` | Define status HTTP |
| `res:set_header(name, value)` | Define header |
| `res:set_cookie(name, value, opts)` | Define cookie |
| `res:write(data)` | Escreve corpo |
| `res:redirect(url, code?)` | Redireciona (padrao 302) |

## Padrao de API JSON

Padrao comum para APIs JSON:

```lua
local json = require("json")

function(req, res)
    -- Analisa corpo JSON
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "JSON invalido"}))
        return
    end

    -- Processa requisicao
    local result = process(data)

    -- Retorna resposta JSON
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## Respostas de Erro

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
            return api_error(res, 404, "USER_NOT_FOUND", "Usuario nao encontrado")
        end
        return api_error(res, 500, "INTERNAL_ERROR", "Erro do servidor")
    end

    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(user))
end
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

### Endpoint Protegido

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

## Veja Tambem

- [Roteador](http-router.md) - Agrupamento de rotas
- [Modulo HTTP](lua-http.md) - API de requisicao/resposta
- [Middleware](http-middleware.md) - Processamento de requisicao
