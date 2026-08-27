---
title: "Hello World"
description: "Crie e execute uma API HTTP Wippy mínima que retorna JSON."
---

# Hello World

Crie uma aplicação Wippy mínima com um endpoint HTTP que retorna JSON.

**Classificação:** tutorial executável. Ele fornece o registro e o código Lua completos para uma aplicação HTTP local, além dos comandos de inicialização e verificação.

## O Que Vamos Construir

Uma API web mínima com um endpoint:

```
GET /hello → {"message": "hello world"}
```

## Pré-requisitos

- Runtime Wippy `v0.3.32a` disponível como `wippy`; confirme com `wippy version --short`.
- `curl` ou outro cliente HTTP.
- Porta 8080 disponível na máquina local.

## Estrutura do Projeto

```
hello-world/
├── wippy.lock           # Generated lock file
└── src/
    ├── _index.yaml      # Entry definitions
    └── hello.lua        # Handler code
```

## Etapa 1: Criar o Projeto

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## Etapa 2: Definir as Entradas

Crie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP server
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router
  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /

  # Handler function
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
    func: app:hello
    path: /hello
```

A aplicação usa quatro entradas; `http` é o módulo do protocolo e `handler` é o método exportado:

1. `gateway` — servidor HTTP na porta 8080
2. `api` — router anexado ao gateway por `meta.server`
3. `hello` — função Lua que trata requisições
4. `hello.endpoint` — rota de `GET /hello` para a função

## Etapa 3: Código do Handler

Crie `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res, response_err = http.response()
    if response_err then
        error("cannot create response: " .. tostring(response_err))
    end

    local content_type_err = res:set_content_type(http.CONTENT.JSON)
    if content_type_err then
        error("cannot set content type: " .. tostring(content_type_err))
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then
        error("cannot set status: " .. tostring(status_err))
    end

    local write_err = res:write_json({message = "hello world"})
    if write_err then
        error("cannot write response: " .. tostring(write_err))
    end
end

return {
    handler = handler
}
```

## Etapa 4: Inicializar e Executar

```bash
# Generate lock file from source
wippy init

# Start the runtime (-c for colorful console output)
wippy run -c
```

`wippy init` grava `wippy.lock`. Mantenha `wippy run -c` em execução enquanto testa o endpoint. O formato dos logs varia entre builds; use a resposta HTTP abaixo como verificação de prontidão.

## Etapa 5: Testar

Em outro terminal:

```bash
curl http://localhost:8080/hello
```

Resposta esperada:

```json
{"message":"hello world"}
```

A requisição deve retornar status HTTP 200 com `Content-Type: application/json`.

## Como Funciona

1. `gateway` aceita a conexão TCP na porta 8080.
2. O router `api` corresponde ao prefixo `/`.
3. `hello.endpoint` corresponde a `GET /hello`.
4. A função `hello` escreve a resposta JSON.

## Referência da CLI

| Comando | Descrição |
|---------|-----------|
| `wippy init` | Cria `wippy.lock` com `./src` como diretório fonte |
| `wippy run` | Inicia o runtime pelo lock file |
| `wippy run -c` | Inicia com saída colorida no console |
| `wippy run -v` | Inicia com logs verbose de debug |
| `wippy run -s` | Inicia silenciosamente, sem logs no console |

## Solução de Problemas e Limpeza

- Se `wippy init` não encontrar as entradas, execute-o em `hello-world/` e confirme que `src/_index.yaml` existe.
- Se a inicialização informar que o endereço já está em uso, encerre o processo que usa a porta 8080 ou altere `addr` e a URL de teste para a mesma porta livre.
- Uma resposta 404 geralmente indica divergência no router ou endpoint. Confira `meta.server`, `meta.router` e `/hello` exatamente.
- Pressione Ctrl+C no terminal do runtime para parar a aplicação. Depois de sair do diretório, exclua `hello-world/` se era apenas um exercício descartável.

## Próximos Passos

- [Serviço Echo](echo-service.md) — Crie um serviço CLI multiprocesso
- [Fila de Tarefas](task-queue.md) — Combine uma API REST com processamento em background
- [Router HTTP](../http/router.md) — Revise padrões de roteamento
