---
title: "Relay"
description: "O módulo wippy/relay fornece infraestrutura de relay WebSocket com uma arquitetura de hub de duas camadas. Um hub central gerencia hubs por usuário,…"
---

# Relay

O módulo `wippy/relay` fornece infraestrutura de relay WebSocket com uma arquitetura de hub de duas camadas. Um hub central gerencia hubs por usuário, que por sua vez gerenciam conexões de clientes WebSocket e roteiam mensagens para plugins.

## Arquitetura

```
Central Hub
├── User Hub (alice)
│   ├── Plugin: session_
│   ├── Plugin: ai_
│   ├── WebSocket Client 1
│   └── WebSocket Client 2
├── User Hub (bob)
│   ├── Plugin: session_
│   └── WebSocket Client 1
└── ...
```

O hub central executa como um serviço. Quando um cliente WebSocket se conecta, o hub central busca ou cria um hub de usuário para aquele usuário. O hub de usuário gerencia o tempo de vida do cliente e roteia mensagens para plugins com base em prefixos de comando.

## Configuração

Adicione o módulo ao seu projeto:

```bash
wippy add wippy/relay
wippy install
```

Declare a dependência com os parâmetros obrigatórios:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.relay
    kind: ns.dependency
    component: wippy/relay
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
      - name: user_security_scope
        value: app.security:user_scope
```

### Parâmetros de Configuração

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|----------|---------|-------------|
| `application_host` | sim | — | Host de processos para os processos do relay |
| `env_storage` | não | interno | Armazenamento de variáveis de ambiente |
| `user_security_scope` | sim | — | Escopo de segurança para hubs de usuário |
| `max_connections_per_user` | não | `5` | Conexões WebSocket por usuário |
| `queue_multiplier` | não | `100` | Fila de mensagens = conexões × multiplicador |
| `user_hub_inactivity_timeout` | não | `7200s` | Tempo ocioso antes da limpeza do hub |

## Fluxo de Conexão do Cliente

1. O cliente WebSocket conecta com `user_id` nos metadados
2. O hub central valida a conexão e verifica os limites por usuário
3. O hub central cria ou reutiliza um hub de usuário para o usuário
4. O hub de usuário envia uma mensagem `welcome` ao cliente:

```json
{
    "user_id": "alice",
    "client_count": 1,
    "plugins": [
        { "prefix": "session_", "process_id": "...", "status": "running" },
        { "prefix": "ai_", "process_id": "...", "status": "pending" }
    ]
}
```

O `status` do plugin e um dos seguintes: `"not_started"` (registrado, nunca iniciado), `"pending"` (inicializacao em andamento), `"running"`, `"failed"` ou `"stopped"`.

## Roteamento de Mensagens

Clientes enviam mensagens JSON com um campo `type`. O hub de usuário compara o prefixo do tipo com os plugins registrados e roteia a mensagem:

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

O prefixo `session_` corresponde ao plugin de sessão. O hub remove o prefixo e envia a mensagem para o processo do plugin com o tipo sem prefixo como o tópico:

```lua
-- process topic: "get_state"
-- payload:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- tipo completo original preservado
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

Plugins respondem enviando mensagens de volta para `conn_pid`.

## Plugins

Plugins são entradas `process.lua` com `meta.type: relay.plugin`:

```yaml
entries:
  - name: session_plugin
    kind: process.lua
    meta:
      type: relay.plugin
      command_prefix: session_
      auto_start: true
    source: file://session_plugin.lua
    modules: [json, time, logger]
    method: run
```

### Metadados do Plugin

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `meta.type` | string | Deve ser `relay.plugin` |
| `meta.command_prefix` | string | Prefixo de tipo de mensagem que este plugin trata |
| `meta.auto_start` | boolean | Iniciar quando o hub de usuário inicializar |
| `meta.default_host` | string | Sobrescreve o host de processos |

### Ciclo de Vida do Plugin

Plugins são gerados pelo hub de usuário. Na inicialização, o plugin recebe:

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

O plugin `session_` recebe mensagens de ciclo de vida:

| Mensagem | Quando |
|---------|------|
| `"resume"` | Primeiro cliente se conecta ao hub de usuário |
| `"shutdown"` | Último cliente se desconecta do hub de usuário |

Plugins recebem 1 reinício automático em caso de crash. Após um segundo crash, o plugin é marcado como `"failed"` e não é reiniciado.

### Implementação do Plugin

Plugins recebem mensagens em sua caixa de entrada de processo. Cada mensagem tem um tópico (o prefixo de comando removido) e um payload contendo os dados originais da mensagem junto com `conn_pid` para enviar respostas de volta ao cliente.

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        process.send(payload.conn_pid, "ws.message", json.encode({
            type = "session_state",
            data = { status = "active" }
        }))
    end
end

local function run(args)
    local user_id = args.user_id
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local result = channel.select({
            inbox:case_receive(),
            events:case_receive()
        })
        if not result.ok then break end

        if result.channel == inbox then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "resume" then
                -- primeiro cliente conectado
            elseif topic == "shutdown" then
                -- último cliente desconectado
            else
                handle_message(topic, payload)
            end
        elseif result.channel == events then
            local event = result.value
            if event.kind == process.event.CANCEL then
                break
            end
        end
    end
end

return { run = run }
```

## Tratamento de Erros

O relay envia mensagens de erro estruturadas aos clientes:

| Código de Erro | Descrição |
|------------|-------------|
| `max_connections_reached` | Usuário no limite de conexões |
| `missing_user_id` | Sem user_id nos metadados da conexão |
| `hub_creation_failed` | Falha ao gerar o hub de usuário |
| `invalid_json` | Erro de decodificação da mensagem |
| `unknown_command` | Mensagem sem campo type |
| `plugin_not_found` | Nenhum plugin corresponde ao prefixo de comando |
| `plugin_failed` | Plugin indisponível ou com crash |

## Ciclo de Vida do Hub

### Criação do Hub de Usuário

Hubs de usuário são criados sob demanda quando o primeiro cliente para um usuário se conecta. O hub é gerado com o ator e escopo de segurança do usuário.

### Coleta de Lixo

O hub central verifica periodicamente hubs de usuário inativos. Um hub sem clientes conectados por mais tempo que `user_hub_inactivity_timeout` (padrão 2 horas) é encerrado graciosamente com um timeout de cancelamento de 10 segundos.

O intervalo de verificação do GC é derivado automaticamente: `inactivity_timeout / 2.5`.

### Segurança

O hub central executa sob seu próprio grupo de segurança (`wippy.relay.security:root`) com acesso total. Cada hub de usuário é gerado com o `user_security_scope` configurado, isolando operações a nível de usuário.

## Tópicos Internos

| Tópico | Direção | Descrição |
|-------|-----------|-------------|
| `ws.join` | Cliente → Central/User Hub | Solicitação de conexão |
| `ws.leave` | Cliente → Central/User Hub | Desconexão |
| `ws.message` | Cliente → User Hub | Mensagem WebSocket |
| `ws.cancel` | Central → User Hub | Encerramento gracioso |
| `ws.control` | Central → User Hub | Controle de roteamento |
| `hub.activity_update` | User Hub → Central | Atualização de contagem de clientes |

## Veja Também

- [WebSocket Relay](http/websocket-relay.md) - Configuração de endpoint WebSocket HTTP
- [Modelo de Processos](concepts/process-model.md) - Ciclo de vida e mensageria de processos
- [Segurança](system/security.md) - Atores e escopos de segurança
- [Visão Geral do Framework](framework/overview.md) - Uso do módulo do framework
