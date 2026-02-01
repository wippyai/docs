# Roteamento

Roteadores agrupam endpoints sob prefixos de URL e aplicam middleware compartilhado. Endpoints definem handlers HTTP.

## Arquitetura

```mermaid
flowchart TB
    S[http.service<br/>:8080] --> R1[http.router<br/>/api]
    S --> R2[http.router<br/>/admin]
    S --> ST[http.static<br/>/]

    R1 --> E1[GET /users]
    R1 --> E2[POST /users]
    R1 --> E3["GET /users/{id}"]

    R2 --> E4[GET /stats]
    R2 --> E5[POST /config]
```

Entradas referenciam pais via metadados:
- Roteadores: `meta.server: app:gateway`
- Endpoints: `meta.router: app:api`

## Configuracao do Roteador

```yaml
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api/v1
  middleware:
    - cors
    - compress
  options:
    cors.allow.origins: "*"
  post_middleware:
    - endpoint_firewall
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `meta.server` | ID do Registro | Servidor HTTP pai |
| `prefix` | string | Prefixo de URL para todas as rotas |
| `middleware` | []string | Middleware pre-match |
| `options` | map | Opcoes de middleware |
| `post_middleware` | []string | Middleware pos-match |
| `post_options` | map | Opcoes de middleware pos-match |

## Configuracao de Endpoint

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `meta.router` | ID do Registro | Roteador pai |
| `method` | string | Metodo HTTP (GET, POST, PUT, DELETE, PATCH, HEAD) |
| `path` | string | Padrao de caminho URL (comeca com `/`) |
| `func` | ID do Registro | Funcao handler |

## Parametros de Caminho

Use sintaxe `{param}` para parametros de URL:

```yaml
- name: get_post
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

Acesso no handler:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local user_id = req:param("user_id")
    local post_id = req:param("post_id")

    -- ...
end
```

### Caminhos Curinga

Capture segmentos de caminho restantes com `{param...}`:

```yaml
- name: serve_files
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /files/{filepath...}
  func: serve_file
```

```lua
-- Requisicao: GET /api/v1/files/docs/guides/readme.md
local file_path = req:param("filepath")  -- "docs/guides/readme.md"
```

O curinga deve ser o ultimo segmento no caminho.

## Funcoes Handler

Handlers de endpoint usam o modulo `http` para acessar objetos de requisicao e resposta. Veja [Modulo HTTP](lua-http.md) para a API completa.

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    local user_id = req:param("id")
    local user = get_user(user_id)

    res:status(200)
    res:write(json.encode(user))
end

return { handler = handler }
```

## Opcoes de Middleware

Opcoes de middleware usam notacao de ponto com o nome do middleware como prefixo:

```yaml
middleware:
  - cors
  - ratelimit
  - token_auth
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.methods: "GET,POST,PUT,DELETE"
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  token_auth.store: "app:tokens"
  token_auth.header.name: "Authorization"
```

Middleware pos-match usa `post_options`:

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.default_policy: "deny"
```

## Middleware Pre-Match vs Pos-Match

**Pre-match** (`middleware`) executa antes do match de rota:
- CORS (trata preflight OPTIONS)
- Compressao
- Rate limiting
- Deteccao de IP real
- Autenticacao por token (enriquecimento de contexto)

**Pos-match** (`post_middleware`) executa apos a rota ser correspondida:
- Firewall de endpoint (precisa de info da rota para autorizacao)
- Firewall de recurso
- Relay WebSocket

```yaml
middleware:        # Pre-match: todas as requisicoes para este roteador
  - cors
  - compress
  - token_auth     # Enriquece contexto com ator/escopo

post_middleware:   # Pos-match: apenas rotas correspondidas
  - endpoint_firewall  # Usa ator do token_auth
```

<tip>
Autenticacao por token pode ser pre-match porque apenas enriquece contexto - nao bloqueia requisicoes. Autorizacao acontece em middleware pos-match como <code>endpoint_firewall</code> que usa o ator definido por <code>token_auth</code>.
</tip>

## Exemplo Completo

```yaml
version: "1.0"
namespace: app

entries:
  # Servidor
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Roteador da API
  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api/v1
    middleware:
      - cors
      - compress
      - ratelimit
    options:
      cors.allow.origins: "https://app.example.com"
      ratelimit.requests: "100"
      ratelimit.window: "1m"

  # Funcao handler
  - name: get_users
    kind: function.lua
    source: file://handlers/users.lua
    method: list
    modules:
      - http
      - json
      - sql

  # Endpoints
  - name: list_users
    kind: http.endpoint
    meta:
      router: api
    method: GET
    path: /users
    func: get_users

  - name: get_user
    kind: http.endpoint
    meta:
      router: api
    method: GET
    path: /users/{id}
    func: app:get_user_by_id

  - name: create_user
    kind: http.endpoint
    meta:
      router: api
    method: POST
    path: /users
    func: app:create_user
```

## Rotas Protegidas

Padrao comum com autenticacao:

```yaml
entries:
  # Rotas publicas (sem auth)
  - name: public
    kind: http.router
    meta:
      server: gateway
    prefix: /api/public
    middleware:
      - cors

  # Rotas protegidas
  - name: protected
    kind: http.router
    meta:
      server: gateway
    prefix: /api
    middleware:
      - cors
      - token_auth
    options:
      token_store: app:tokens
    post_middleware:
      - endpoint_firewall
```

## Veja Tambem

- [Servidor](http-server.md) - Configuracao do servidor HTTP
- [Arquivos Estaticos](http-static.md) - Servindo arquivos estaticos
- [Middleware](http-middleware.md) - Middleware disponivel
- [Modulo HTTP](lua-http.md) - API HTTP Lua
