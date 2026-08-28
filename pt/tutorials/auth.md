---
title: "Ticker de Criptomoedas"
description: "Construa uma demonstração de ticker com troca de API key, autenticação por bearer token, WebSockets e mensagens entre processos."
---

# Ticker de Criptomoedas

Construa um ticker de criptomoedas em tempo real com autenticação por API key e streaming WebSocket. Este tutorial demonstra segurança baseada em token, configuração de middleware e tratamento de WebSocket baseado em processos.

**Classificação:** Tutorial local executável. Inclui o registro, os fontes Lua, o cliente de navegador, comandos de inicialização ordenados e a verificação no navegador. As políticas permissivas e o token store em memória são deliberadamente limitados a uma demonstração em loopback.

## Visão Geral

- **Troca de API key** — POST de uma API key devolve um token bearer assinado com HMAC
- **Middleware de token** — Valida um bearer token, restaura seu contexto de segurança e rejeita requisições sem ator
- **Fan-out WebSocket** — Um processo ticker transmite para múltiplos handlers de conexão
- **Ativos estáticos** — `http.static` serve o cliente do navegador
- **Armazenamento** — Mantém API keys no SQLite e os dados dos tokens em memória

## Pré-requisitos

- Runtime Wippy `v0.3.32a`.
- Um navegador com suporte a WebSocket.
- Um diretório de trabalho vazio. Crie os diretórios do projeto antes de adicionar os arquivos abaixo:

  ```bash
  mkdir auth-ticker
  cd auth-ticker
  mkdir -p src/public data
  ```

  No PowerShell:

  ```powershell
  New-Item -ItemType Directory -Path auth-ticker\src\public -Force
  New-Item -ItemType Directory -Path auth-ticker\data -Force
  Set-Location auth-ticker
  ```

## Estrutura do Projeto

```
auth-ticker/
├── data/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── auth_token.lua
    ├── ws_ticker.lua
    ├── ws_handler.lua
    ├── ticker.lua
    ├── migrate.lua
    └── public/
        └── index.html
```

## Arquitetura

```mermaid
flowchart TB
    subgraph Clients
        Browser[Browser Client]
        API[API Client]
    end

    subgraph "HTTP Layer"
        Server[http.service<br/>gateway :8081]
        Static[http.static<br/>public/]

        subgraph "Public Router"
            CORS1[cors middleware]
            AuthEndpoint[auth_token<br/>POST /auth/token]
        end

        subgraph "WS Router /ws"
            CORS2[cors middleware]
            TokenAuth[token_auth middleware]
            WSEndpoint[ws_ticker<br/>GET /ws/ticker]
            WSRelay[websocket_relay]
        end
    end

    subgraph "Security Layer"
        TokenStore[security.token_store<br/>tokens]
        Policy[security.policy<br/>user_policy]
        MemStore[store.memory<br/>token_data]
    end

    subgraph "Storage"
        DB[db.sql.sqlite<br/>auth.db]
    end

    subgraph "Process Layer"
        Supervisor[process.host<br/>processes]
        WSHandler[ws_handler<br/>per-connection]
        Ticker[ticker<br/>singleton]
    end

    %% Client connections
    Browser -->|"GET /"| Static
    API -->|"POST /auth/token"| CORS1
    Browser -->|"WS /ws/ticker"| CORS2

    %% API flow
    CORS1 --> AuthEndpoint
    AuthEndpoint -->|validate| TokenStore
    AuthEndpoint -->|"issue token"| API

    %% WS flow
    CORS2 --> TokenAuth
    TokenAuth -->|validate| TokenStore
    TokenAuth --> WSEndpoint
    WSEndpoint -->|spawn| Supervisor
    Supervisor --> WSHandler
    WSEndpoint --> WSRelay
    WSRelay <-->|"messages"| WSHandler

    %% Token store deps
    MemStore --> TokenStore
    Policy -->|attached to token| TokenStore

    %% Auth uses DB for API keys
    AuthEndpoint -->|lookup API key| DB

    %% Process communication
    WSHandler -->|subscribe| Ticker
    Ticker -->|broadcast| WSHandler
    WSRelay <-->|"ws frames"| Browser

```

## Fluxo de Segurança

1. **Troca de API Key**: Cliente faz POST da API key para `/auth/token`. Handler valida contra banco de dados, cria um ator com a `user_policy` e emite um token assinado com HMAC.

2. **Autenticação por Token**: Conexões WebSocket passam pelo middleware `token_auth` que valida o Bearer token e restaura o contexto de segurança (ator + políticas).

3. **Criação de Processo**: O endpoint WebSocket cria um processo handler. Como o token inclui a `user_policy`, o spawn é autorizado.

4. **Roteamento de Mensagens**: O middleware `websocket_relay` roteia frames WebSocket para o processo handler como mensagens.

## Configuração

Crie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Database for API keys
  - name: db
    kind: db.sql.sqlite
    file: "./data/auth.db"
    lifecycle:
      auto_start: true

  # Token backing store
  - name: token_data
    kind: store.memory
    lifecycle:
      auto_start: true

  # Token store with HMAC signing
  - name: tokens
    kind: security.token_store
    store: app:token_data
    token_length: 32
    default_expiration: "1h"
    token_key: "local-demo-signing-key-do-not-deploy"

  # Security policy for authenticated users
  - name: user_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow
    groups:
      - user

  # Capabilities for trusted background services
  - name: service_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow

  # Capabilities for the public token-exchange handler
  - name: token_issuer_policy
    kind: security.policy
    policy:
      actions:
        - db.get
        - security.actor.create
        - security.policy.get
        - security.scope.create
        - security.token_store.get
        - security.token.create
      resources: "*"
      effect: allow

  # Process host
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Terminal host used by `wippy run -x app:migrate`
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # Database migration
  - name: migrate
    kind: process.lua
    source: file://migrate.lua
    method: main
    modules: [sql, logger, crypto]
    security:
      actor:
        id: app:migrate
      policies:
        - app:service_policy

  # Ticker broadcaster
  - name: ticker
    kind: process.lua
    source: file://ticker.lua
    method: main
    modules: [logger, time, json, crypto]
    security:
      actor:
        id: app:ticker
      policies:
        - app:service_policy

  - name: ticker-service
    kind: process.service
    process: app:ticker
    host: app:processes
    lifecycle:
      auto_start: true

  # WebSocket handler (spawned per connection)
  - name: ws_handler
    kind: process.lua
    source: file://ws_handler.lua
    method: main
    modules: [logger, json]

  # HTTP server
  - name: gateway
    kind: http.service
    addr: "127.0.0.1:8081"
    lifecycle:
      auto_start: true
      requires:
        - app:ticker-service

  # Public router (no auth)
  - name: public_router
    kind: http.router
    meta:
      server: app:gateway
    middleware:
      - cors
    options:
      cors.allow.origins: "http://127.0.0.1:8081"

  # WebSocket router (with auth)
  - name: ws_router
    kind: http.router
    meta:
      server: app:gateway
    prefix: /ws
    middleware:
      - cors
      - token_auth
    options:
      cors.allow.origins: "http://127.0.0.1:8081"
      token_auth.store: "app:tokens"
    post_middleware:
      - websocket_relay
    post_options:
      wsrelay.allowed.origins: "http://127.0.0.1:8081"

  # Static files
  - name: public_fs
    kind: fs.directory
    directory: ./src/public

  - name: static
    kind: http.static
    meta:
      server: app:gateway
    path: /
    fs: app:public_fs
    static_options:
      spa: true
      index: index.html

  # Auth token exchange
  - name: auth_token
    kind: function.lua
    source: file://auth_token.lua
    method: handler
    modules: [http, sql, crypto, security, json]
    security:
      actor:
        id: app:token-issuer
      policies:
        - app:token_issuer_policy

  - name: auth_token.endpoint
    kind: http.endpoint
    meta:
      router: app:public_router
    method: POST
    path: /auth/token
    func: app:auth_token

  # WebSocket ticker endpoint
  - name: ws_ticker
    kind: function.lua
    source: file://ws_ticker.lua
    method: handler
    modules: [http, json, security, logger]

  - name: ws_ticker.endpoint
    kind: http.endpoint
    meta:
      router: app:ws_router
    method: GET
    path: /ticker
    func: app:ws_ticker
```

A chave de assinatura, a política curinga de usuário, o armazenamento bruto de API keys e o token store em memória são apropriados apenas para esta demonstração em loopback. Em produção, use `token_key_env`, aplique hash às API keys antes do armazenamento, restrinja as ações e os recursos das políticas, limite as origens permitidas e use um token store durável. Consulte o [Sistema de Ambiente](system/env.md).

## Troca de Token

`auth_token.lua` - valida API keys e emite tokens assinados com HMAC:

```lua
local http = require("http")
local sql = require("sql")
local security = require("security")

local function handler()
    local req = http.request()
    local res = http.response()

    local body, parse_err = req:body_json()
    if parse_err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "invalid JSON"})
        return
    end

    local api_key = body.api_key
    if not api_key or #api_key == 0 then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "api_key required"})
        return
    end

    local db, db_err = sql.get("app:db")
    if db_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "database unavailable"})
        return
    end

    local rows, query_err = db:query(
        "SELECT user_id, role FROM api_keys WHERE api_key = ?",
        {api_key}
    )
    db:release()

    if query_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "lookup failed"})
        return
    end
    if #rows == 0 then
        res:set_status(http.STATUS.UNAUTHORIZED)
        res:write_json({error = "invalid API key"})
        return
    end

    local user = rows[1]

    -- Create actor with user identity
    local actor = security.new_actor("user:" .. user.user_id, {
        role = user.role,
        user_id = user.user_id
    })

    -- Attach user_policy to the scope
    local policy, _ = security.policy("app:user_policy")
    local scope = policy and security.new_scope({policy}) or security.new_scope()

    -- Issue HMAC-signed token
    local store, store_err = security.token_store("app:tokens")
    if store_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "token store unavailable"})
        return
    end

    local token, token_err = store:create(actor, scope, {
        expiration = "1h",
        meta = {ip = req:remote_addr()}
    })
    store:close()

    if token_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "token creation failed"})
        return
    end

    res:write_json({
        token = token,
        user_id = user.user_id,
        role = user.role,
        expires_in = 3600
    })
end

return { handler = handler }
```

## Endpoint WebSocket

`ws_ticker.lua` - cria um processo handler para cada conexão autenticada:

```lua
local http = require("http")
local json = require("json")
local security = require("security")
local logger = require("logger")

local function handler()
    local req = http.request()
    local res = http.response()

    if req:method() ~= http.METHOD.GET then
        res:set_status(http.STATUS.METHOD_NOT_ALLOWED)
        res:write_json({error = "method not allowed"})
        return
    end

    -- Actor is set by token_auth middleware
    local actor = security.actor()
    if not actor then
        res:set_status(http.STATUS.UNAUTHORIZED)
        res:write_json({error = "authentication required"})
        return
    end

    local user_id = actor:id()

    -- Spawn handler process (authorized by user_policy in token)
    local pid, err = process.spawn("app:ws_handler", "app:processes", user_id)
    if err then
        logger:error("spawn failed", {error = tostring(err)})
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({error = "failed to create handler"})
        return
    end

    -- Configure websocket_relay to route messages to handler
    res:set_header("X-WS-Relay", json.encode({
        target_pid = tostring(pid),
        metadata = {user_id = user_id, auth_time = os.time()}
    }))
end

return { handler = handler }
```

## Handler de Conexão

O middleware `websocket_relay` automaticamente envia mensagens de ciclo de vida para o processo handler:
- `ws.join` - Conexão estabelecida, inclui `client_pid` para enviar respostas
- `ws.message` - Cliente enviou uma mensagem
- `ws.leave` — Conexão fechada; inclui o mesmo `client_pid` e os mesmos metadados de `ws.join`

`ws_handler.lua` - trata essas mensagens de ciclo de vida:

```lua
local logger = require("logger")
local json = require("json")

local function main(user_id)
    local inbox = process.inbox()
    local client_pid = nil
    local subscribed = false

    logger:info("handler started", {user_id = user_id})

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "ws.join" then
            client_pid = data.client_pid

            -- Subscribe with our PID for crash monitoring
            local _, subscribe_err = process.send("ticker", "subscribe", {
                client_pid = client_pid,
                handler_pid = process.pid()
            })
            if subscribe_err then
                error("failed to subscribe to ticker: " .. tostring(subscribe_err))
            end
            subscribed = true

            -- Send welcome
            process.send(client_pid, "ws.send", {
                type = "text",
                data = json.encode({type = "welcome", user_id = user_id})
            })

            logger:info("client joined", {user_id = user_id, client_pid = client_pid})

        elseif topic == "ws.message" then
            -- Text WebSocket frames arrive as string payloads.
            local content = json.decode(data)
            if content and content.type == "ping" then
                process.send(client_pid, "ws.send", {
                    type = "text",
                    data = json.encode({type = "pong"})
                })
            end

        elseif topic == "ws.leave" then
            -- Relay sends this automatically on disconnect
            logger:info("client left", {user_id = user_id, client_pid = data.client_pid})
            if subscribed then
                process.send("ticker", "unsubscribe", {handler_pid = process.pid()})
            end
            break
        end
    end

    return 0
end

return { main = main }
```

## Broadcasting

`ticker.lua` - mantém inscrições e faz broadcast de atualizações de preço:

```lua
local logger = require("logger")
local time = require("time")
local json = require("json")
local crypto = require("crypto")

-- handler_pid -> client_pid mapping
local subscriptions = {}

local prices = {
    ["BTC-USD"] = 42000.00,
    ["ETH-USD"] = 2500.00,
    ["SOL-USD"] = 95.00
}

local function broadcast(message)
    local data = json.encode(message)
    for _, client_pid in pairs(subscriptions) do
        process.send(client_pid, "ws.send", {type = "text", data = data})
    end
end

local function update_prices()
    for symbol, price in pairs(prices) do
        local bytes, random_err = crypto.random.bytes(2)
        if random_err then
            error("failed to generate price movement: " .. tostring(random_err))
        end
        local rand = (bytes:byte(1) * 256 + bytes:byte(2)) / 65535.0
        local factor = (rand - 0.5) * 0.002
        prices[symbol] = price * (1 + factor)
        prices[symbol] = tonumber(string.format("%.2f", prices[symbol]))
    end
end

local function get_updates()
    local updates = {}
    for symbol, price in pairs(prices) do
        table.insert(updates, {symbol = symbol, price = price, timestamp = os.time()})
    end
    return updates
end

local function main()
    local inbox = process.inbox()
    local events = process.events()

    local ticker, ticker_err = time.ticker("1s")
    if ticker_err then
        logger:error("failed to create ticker", {error = tostring(ticker_err)})
        error("failed to create ticker: " .. tostring(ticker_err))
    end
    local tick_ch = ticker:response()

    local _, register_err = process.registry.register("ticker")
    if register_err then
        error("failed to register ticker: " .. tostring(register_err))
    end
    logger:info("ticker started", {pid = process.pid()})

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive(),
            tick_ch:case_receive()
        }

        if r.channel == tick_ch then
            update_prices()
            if next(subscriptions) then
                broadcast({type = "ticker", data = get_updates()})
            end

        elseif r.channel == events then
            local event = r.value
            if event.kind == process.event.EXIT then
                -- Handler exited, remove subscription
                if subscriptions[event.from] then
                    logger:info("handler exited", {handler_pid = event.from})
                    subscriptions[event.from] = nil
                end
            end

        else
            local msg = r.value
            local topic = msg:topic()
            local data = msg:payload():data()

            if topic == "subscribe" then
                local handler_pid = data.handler_pid
                local client_pid = data.client_pid

                subscriptions[handler_pid] = client_pid
                process.monitor(handler_pid)

                logger:info("subscribed", {handler_pid = handler_pid, client_pid = client_pid})

                process.send(client_pid, "ws.send", {
                    type = "text",
                    data = json.encode({type = "ticker", data = get_updates()})
                })

            elseif topic == "unsubscribe" then
                subscriptions[data.handler_pid] = nil
                logger:info("unsubscribed", {handler_pid = data.handler_pid})
            end
        end
    end
end

return { main = main }
```

## Migração do Banco de Dados

`migrate.lua` - cria a tabela de API keys e gera uma key demo:

```lua
local sql = require("sql")
local logger = require("logger")
local crypto = require("crypto")

local function main()
    local db, err = sql.get("app:db")
    if err then
        logger:error("failed to connect", {error = tostring(err)})
        error("failed to connect: " .. tostring(err))
    end

    local _, exec_err = db:execute([[
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key TEXT UNIQUE NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at INTEGER NOT NULL
        )
    ]])

    if exec_err then
        db:release()
        logger:error("migration failed", {error = tostring(exec_err)})
        error("migration failed: " .. tostring(exec_err))
    end

    -- Create one random local-demo key. It is printed only on first creation.
    local rows, query_err = db:query(
        "SELECT api_key FROM api_keys WHERE user_id = ?",
        {"demo"}
    )
    if query_err then
        db:release()
        error("failed to query demo API key: " .. tostring(query_err))
    end

    if #rows == 0 then
        local demo_key, key_err = crypto.random.string(32)
        if key_err then
            db:release()
            error("failed to generate demo API key: " .. tostring(key_err))
        end

        local _, insert_err = db:execute(
            "INSERT INTO api_keys (api_key, user_id, role, created_at) VALUES (?, ?, ?, ?)",
            {demo_key, "demo", "user", os.time()}
        )
        if insert_err then
            db:release()
            error("failed to store demo API key: " .. tostring(insert_err))
        end
        logger:info("demo API key created", {api_key = demo_key})
    else
        logger:info("demo API key already exists; use the value saved from its first creation")
    end

    db:release()
    return 0
end

return { main = main }
```

A chave bruta da demonstração aparece nos logs apenas quando é gerada pela primeira vez. Salve-a para a etapa do navegador. Se ela for perdida, pare a aplicação, remova `data/auth.db` e execute a migração novamente. Não insira uma credencial de produção neste banco de dados de demonstração.

## Cliente de Navegador

Crie `src/public/index.html`. O navegador troca a API key por um token de curta duração, mantém esse token apenas em memória e o envia pelo parâmetro de consulta `x-auth-token` do middleware, porque a API WebSocket do navegador não permite definir um header `Authorization`.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wippy Crypto Ticker</title>
</head>
<body>
  <main>
    <h1>Crypto Ticker</h1>
    <form id="connect-form">
      <label for="api-key">Demo API key</label>
      <input id="api-key" name="api-key" autocomplete="off" required>
      <button type="submit">Connect</button>
    </form>
    <p id="status">Disconnected</p>
    <ul id="prices"></ul>
  </main>

  <script>
    const form = document.querySelector('#connect-form');
    const input = document.querySelector('#api-key');
    const status = document.querySelector('#status');
    const prices = document.querySelector('#prices');
    let socket;

    function setStatus(message) {
      status.textContent = message;
    }

    function renderPrices(items) {
      prices.replaceChildren(...items.map((item) => {
        const row = document.createElement('li');
        row.textContent = `${item.symbol}: $${Number(item.price).toFixed(2)}`;
        return row;
      }));
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (socket) socket.close();
      setStatus('Authenticating...');

      try {
        const response = await fetch('/auth/token', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({api_key: input.value}),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);

        const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${scheme}://${location.host}/ws/ticker?x-auth-token=${encodeURIComponent(result.token)}`;
        socket = new WebSocket(url);

        socket.addEventListener('open', () => setStatus(`Connected as ${result.user_id}`));
        socket.addEventListener('close', () => setStatus('Disconnected'));
        socket.addEventListener('error', () => setStatus('WebSocket error'));
        socket.addEventListener('message', (message) => {
          const event = JSON.parse(message.data);
          if (event.type === 'ticker') renderPrices(event.data);
        });
      } catch (error) {
        setStatus(error.message);
      }
    });
  </script>
</body>
</html>
```

Bearer tokens em query strings podem aparecer em logs de acesso e no histórico do navegador. Esta demonstração usa um token de uma hora em loopback; a autenticação de navegador em produção deve usar um cookie seguro e HttpOnly ou um ticket WebSocket de uso único criado especificamente para esse fim.

## Executando

Inicialize o lock, execute a migração até o fim e depois inicie os serviços de longa duração. Executar a migração como um comando separado impede que o endpoint de token dispute a criação da tabela.

```bash
wippy init
wippy run -x app:migrate
wippy run
```

Abra `http://127.0.0.1:8081` e insira a API key da demonstração mostrada no log da migração. A página deve mostrar `Connected as demo`, seguida pelos preços de BTC, ETH e SOL atualizados uma vez por segundo.

Você também pode verificar a troca antes de abrir o navegador:

```bash
curl -X POST http://127.0.0.1:8081/auth/token \
  -H "Content-Type: application/json" \
  -d '{"api_key":"<demo-key-from-migration>"}'
```

No PowerShell:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8081/auth/token `
  -ContentType 'application/json' `
  -Body '{"api_key":"<demo-key-from-migration>"}'
```

Uma resposta bem-sucedida contém `token`, `user_id: "demo"`, `role: "user"` e `expires_in: 3600`. Uma chave inválida retorna HTTP 401.

## Solução de Problemas e Limpeza

- `no such table: api_keys` significa que o comando de migração foi ignorado ou falhou. Pare o runtime e execute `wippy run -x app:migrate` novamente antes de reiniciá-lo.
- Um 401 de `/auth/token` significa que a API key não corresponde à linha em `data/auth.db`. Redefina o banco de dados se o valor exibido uma única vez no log foi perdido.
- Um 401 ou fechamento imediato do WebSocket geralmente significa que o parâmetro de consulta foi removido ou que o token store em memória foi redefinido por uma reinicialização do runtime. Troque a API key novamente após cada reinicialização.
- Uma rejeição de origem significa que a URL do navegador não corresponde exatamente a `http://127.0.0.1:8081`; use essa URL ou atualize em conjunto as duas opções de origem.
- Pare o runtime com Ctrl+C. Exclua `data/auth.db` para remover a API key da demonstração.

## Próximos Passos

- [Relay WebSocket](http/websocket-relay.md) — Configuração do middleware
- [Módulo de Segurança](lua/security/security.md) — Atores, políticas e token stores
- [Gerenciamento de Processos](lua/core/process.md) — Criação de processos e mensagens
