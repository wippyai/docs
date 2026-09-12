---
title: "Processos WASM"
description: "Execute módulos WASM sob um host de processos do Wippy com process.wasm."
---

# Processos WASM

Uma entrada `process.wasm` executa um módulo WASM sob um host de processos do Wippy, com criação, monitoramento e encerramento supervisionado.

**Classificação: referência de configuração e ciclo de vida de processos.** Blocos baseados em binários pressupõem um build externo do componente e entradas pertencentes à aplicação para sistema de arquivos, host de processos, ambiente e políticas. Hashes de placeholder devem ser substituídos pelo digest exato do binário.

## Configuração da entrada

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: run
    imports:
      - wippy:actor
      - wasi:io
      - wasi:poll
    options:
      limits:
        memory_bytes: 67108864
      mailbox:
        capacity: 128
        bytes: 8388608
        message_bytes: 1048576
```

### Campos de configuração

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `fs` | Sim | ID da entrada de sistema de arquivos que contém o binário |
| `path` | Sim | Caminho para o arquivo `.wasm` dentro do sistema de arquivos |
| `hash` | Sim | Hash SHA-256 para verificação de integridade |
| `method` | Sim | Nome da função exportada a ser executada |
| `transport` | Não | Transporte de invocação: `payload` (padrão) ou `wasi-http` |
| `wit` | Não | Assinatura WIT para módulos raw/core |
| `imports` | Não | Imports do host a habilitar |
| `wasi` | Não | Configuração WASI (`args`, `cwd`, `env` e `mounts`) |
| `options` | Não | Controles do ator: `worker_class`, `limits` e `mailbox` |

<note>
Um ator `process.wasm` possui uma instância do módulo durante toda a vida do PID
e preserva o estado do guest entre mensagens. Portanto, pooling de funções não
se aplica e um bloco `pool` é rejeitado. Os limites do ator ficam em
`options.limits`; as grafias antigas `limits` e `meta.options` são aceitas
temporariamente com um aviso de depreciação.
</note>

### Atores WASM com estado

O import de componente `wippy:actor` expõe `self`, `send`, `try-receive`,
`receive` e `subscribe` por `wippy:actor/process@0.1.0`. Cada PID tem uma caixa
de mensagens limitada (por padrão, 128 mensagens, 8 MiB no total e 1 MiB por
mensagem). `send` é autorizado como `process.send` para o PID de destino. Os
formatos de payload suportados são `bytes`, `text` UTF-8 e `json` UTF-8. A
classe de worker padrão é `wasm`; o limite de memória é 64 MiB, até 4 GiB em
múltiplos de 64 KiB.

## Comandos CLI

Registre um processo WASM como um comando nomeado com `meta.command`:

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

Execute com:

```bash
wippy run greet
```

Liste os comandos disponíveis:

```bash
wippy run list
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `name` | Sim | Nome do comando usado com `wippy run <name>` |
| `short` | Não | Descrição curta mostrada em `wippy run list` |
| `main` | Não | Marca a entrada como comando padrão de um pack ou módulo do Hub |
| `use_case` | Não | Categoria do entrypoint; o padrão é `run` |
| `security` | Não | Contexto de segurança aplicado apenas quando o launcher confiável do terminal inicia o comando |

Um `terminal.host` deve estar presente para que comandos CLI funcionem; ele e o host de processos que executa o comando.

## Ciclo de Vida do Processo

Processos WASM seguem o modelo de ciclo de vida Init/Step/Close:

1. **Init** - O contexto da chamada, o método e os argumentos de entrada são capturados.
2. **Step** - O primeiro passo instancia e inicia o módulo. Passos posteriores avançam operações com bridge do dispatcher; uma execução síncrona pode terminar no primeiro passo.
3. **Close** - Os recursos da instância são liberados.

## Iniciando a partir de Lua

Inicie um processo WASM e monitore-o até a conclusão:

```lua
local errors = require("errors")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process host
    6, 7                     -- arguments passed to the WASM function
)

if err then
    return nil, err
end

-- Wait for the process to complete
local events = process.events()
while true do
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
    end
end
```

## Execução assíncrona

Actors WASM podem ceder a execução em operações de host que o runtime conecta
ao dispatcher, incluindo recebimento e envio pela mailbox, polling, relógios,
sockets, DNS, streams do sistema de arquivos e HTTP de saída. O agendador
suspende o processo até a operação terminar e então retoma a mesma instância
guest:

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

O mecanismo de yield/resume é transparente para um módulo core asyncificado ou
um componente que use as interfaces pollable compatíveis.

## Configuração WASI

Processos aceitam a mesma configuração WASI que funções:

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## Veja também

- [Visão geral](wasm/overview.md) - Visão geral do runtime WebAssembly
- [Funções](wasm/functions.md) - Configuração de funções WASM
- [Funções do host](wasm/hosts.md) - Interfaces de host disponíveis
- [Modelo de processos](concepts/process-model.md) - Ciclo de vida de processos
- [Supervisão](guides/supervision.md) - Árvores de supervisão de processos
