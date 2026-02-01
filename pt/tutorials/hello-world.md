# Hello World

Sua primeira aplicacao Wippy - uma API HTTP simples que retorna JSON.

## O Que Vamos Construir

Uma API web minima com um endpoint:

```
GET /hello → {"message": "hello world"}
```

## Estrutura do Projeto

```
hello-world/
├── wippy.lock           # Arquivo lock gerado
└── src/
    ├── _index.yaml      # Definicoes de entradas
    └── hello.lua        # Codigo do handler
```

## Passo 1: Criar Diretorio do Projeto

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## Passo 2: Definicoes de Entradas

Crie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Servidor HTTP
  - name: gateway
    kind: http.service
    addr: :8080
    lifecycle:
      auto_start: true

  # Router
  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /

  # Funcao handler
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
    func: hello
    path: /hello
```

**Quatro entradas trabalham juntas:**

1. `gateway` - Servidor HTTP escutando na porta 8080
2. `api` - Router anexado ao gateway via `meta.server`
3. `hello` - Funcao Lua que processa requisicoes
4. `hello.endpoint` - Roteia `GET /hello` para a funcao

## Passo 3: Codigo do Handler

Crie `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

O modulo `http` fornece acesso aos objetos request/response. A funcao retorna uma tabela com o metodo `handler` exportado.

## Passo 4: Inicializar e Executar

```bash
# Gerar arquivo lock a partir do source
wippy init

# Iniciar o runtime (-c para saida colorida no console)
wippy run -c
```

Voce vera uma saida como:

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## Passo 5: Testar

```bash
curl http://localhost:8080/hello
```

Resposta:

```json
{"message":"hello world"}
```

## Como Funciona

1. `gateway` aceita a conexao TCP na porta 8080
2. `api` router faz match do prefixo de caminho `/`
3. `hello.endpoint` faz match de `GET /hello`
4. funcao `hello` executa e escreve a resposta JSON

## Referencia CLI

| Comando | Descricao |
|---------|-----------|
| `wippy init` | Gerar arquivo lock a partir de `src/` |
| `wippy run` | Iniciar runtime a partir do arquivo lock |
| `wippy run -c` | Iniciar com saida colorida no console |
| `wippy run -v` | Iniciar com logging verbose de debug |
| `wippy run -s` | Iniciar em modo silencioso (sem logs no console) |

## Proximos Passos

- [Echo Service](echo-service.md) - Tratar parametros de requisicao
- [Task Queue](task-queue.md) - REST API com processamento em background
- [HTTP Router](http-router.md) - Padroes de roteamento
