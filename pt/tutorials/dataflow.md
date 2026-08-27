---
title: "Dataflow: Execute um DAG Durável"
description: "Crie e execute um pequeno workflow wippy/dataflow com estado persistido, migrações automáticas e dois nós de função."
---

# Dataflow: Execute um DAG Durável

**Classificação: tutorial executável.** Esta página cria um projeto `wippy/dataflow` completo e independente de provedor. Ele não usa embeddings nem LLM; para esse caso, consulte [Geração Aumentada por Recuperação](./rag.md).

O workflow envia uma entrada por dois nós de função:

O Dataflow persiste workflow, nós, comandos, wakes e ativações em SQL. O comando aguarda o bootloader de migrações criar essas tabelas antes de iniciar o fluxo.

## Pré-requisitos

- Um projeto Wippy com diretório fonte `./src`.
- Runtime Wippy `v0.3.32a` ou mais recente.
- Acesso ao registro de módulos para a instalação inicial das dependências.

Nenhum provedor de modelo nem chave de API é necessário.

## Estrutura do Projeto

```text
{ values = { 2, 4, 6 } } -> double -> summarize -> { count = 3, total = 24 }
```

## Configure o Runtime

Crie `src/_index.yaml`:

```text
dataflow-demo/
├── wippy.lock                 # generated
└── src/
    ├── _index.yaml
    ├── double.lua
    ├── summarize.lua
    └── run.lua
```

O `wippy/dataflow` possui as entradas de migração. A dependência `wippy/migration` é transitiva, enquanto `wippy/bootloader` executa seu bootloader de migrações na inicialização. Os parâmetros explícitos acima vinculam ambos a `app:db`.

A política ampla mantém este tutorial isolado focado no comportamento do workflow. Comandos de produção devem substituí-la pelas ações exatas de função, banco e processo necessárias.

## Implemente os Nós

Crie `src/double.lua`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./.wippy/dataflow.db
    lifecycle:
      auto_start: true

  - name: env_storage
    kind: env.storage.file
    file_path: ./.wippy/dataflow.env
    auto_create: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Dataflow includes session views, so its standalone configuration supplies
  # the router those transitive entries target. The HTTP service need not start.
  - name: gateway
    kind: http.service
    addr: ":18080"
    lifecycle:
      auto_start: false

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "0.7.6"
    parameters:
      - name: userspace.dataflow:target_db
        value: app:db
      - name: userspace.dataflow:process_host
        value: app:processes
      - name: wippy.migration:app_db
        value: app:db

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: wippy.bootloader:application_host
        value: app:processes
      - name: wippy.bootloader:env_storage
        value: app:env_storage

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: wippy.llm:process_host
        value: app:processes
      - name: wippy.llm:env_storage
        value: app:env_storage

  - name: dep.session
    kind: ns.dependency
    component: wippy/session
    version: "*"
    parameters:
      - name: wippy.session:database_resource
        value: app:db
      - name: wippy.session:api_router
        value: app:api.public
      - name: wippy.session:env_storage
        value: app:env_storage
      - name: wippy.session:delegation_func_id
        value: userspace.dataflow.session:delegate

  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: wippy.views:api_router
        value: app:api.public
      - name: wippy.views:env_storage
        value: app:env_storage

  - name: demo_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow

  - name: double
    kind: function.lua
    source: file://double.lua
    method: handler

  - name: summarize
    kind: function.lua
    source: file://summarize.lua
    method: handler

  - name: run
    kind: process.lua
    meta:
      command:
        name: dataflow-demo
        short: Run the Dataflow tutorial DAG
        security:
          actor:
            id: app:dataflow-demo
          policies:
            - app:demo_policy
    source: file://run.lua
    method: main
    modules:
      - io
      - sql
      - time
    imports:
      flow: userspace.dataflow.flow:flow
```

Crie `src/summarize.lua`:

```lua
local function handler(input)
    local result = { values = {} }
    for _, value in ipairs(input.values or {}) do
        table.insert(result.values, value * 2)
    end
    return result
end

return { handler = handler }
```

## Crie e Execute o Fluxo

Crie `src/run.lua`:

```lua
local function handler(input)
    local total = 0
    for _, value in ipairs(input.values or {}) do
        total = total + value
    end
    return { count = #(input.values or {}), total = total }
end

return { handler = handler }
```

```lua
local io = require("io")
local sql = require("sql")
local time = require("time")
local flow = require("flow")

local function wait_for_schema()
    for _ = 1, 100 do
        local db, err = sql.get("app:db")
        if not err then
            local rows, query_err = db:query(
                "SELECT name FROM sqlite_master " ..
                "WHERE type='table' AND name='dataflows'"
            )
            db:release()
            if not query_err and rows and #rows > 0 then
                return true
            end
        end
        time.sleep("100ms")
    end
    return nil, "Dataflow migrations did not finish within 10 seconds"
end

local function main()
    local ready, ready_err = wait_for_schema()
    if not ready then
        io.print("dataflow failed: " .. ready_err)
        return 1
    end

    local result, err = flow.create()
        :with_title("Double and summarize")
        :with_input({ values = { 2, 4, 6 } })
        :func("app:double")
        :as("double")
        :to("summarize", "default")
        :func("app:summarize")
        :as("summarize")
        :run()

    if err then
        io.print("dataflow failed: " .. tostring(err))
        return 1
    end

    io.print(string.format("count=%d total=%d", result.count, result.total))
    return 0
end

return { main = main }
```

Inicialize o lock, resolva e instale o grafo de dependências e execute o comando nomeado com logs do console:

```bash
wippy init
wippy update
wippy install
wippy run -c dataflow-demo
```

Na primeira execução, o bootloader aplica as migrações do Dataflow. O comando imprime:

```text
count=3 total=24
```

Execuções posteriores informam que as migrações já foram aplicadas e executam um novo workflow persistido.

## Verifique a Persistência

O arquivo SQLite é `./.wippy/dataflow.db`. Após uma execução bem-sucedida, ele contém as tabelas do módulo para workflows, nós, dados, commits, wakes e ativações. Aplicações devem inspecioná-las pelo cliente Dataflow ou Keeper, sem gravá-las diretamente.

Use `:start()` em vez de `:run()` quando o chamador precisar receber imediatamente o ID do workflow. Use o cliente Dataflow para ler status e saída ou cancelar, terminar, reviver e sinalizar um workflow assíncrono.

## Próximos Passos

- [Framework Dataflow](../framework/dataflow.md) — Roteamento, nós paralelos, ciclos, agentes, sinais e API do cliente
- [Geração Aumentada por Recuperação](./rag.md) — Recuperação apoiada por embeddings
- [Keeper por MCP](./keeper-mcp.md) — Inspecione workflows em execução por um cliente MCP
