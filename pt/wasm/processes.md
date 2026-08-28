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
    method: compute
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
| `limits` | Não | Limites de execução |

<note>
`process.wasm` compartilha sua estrutura de configuração com `function.wasm`, portanto um bloco `pool` é aceito pelo esquema, mas ignorado: processos são executados sob o host de processos, não sob um pool de funções.
</note>

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

Um `terminal.host` deve estar presente para comandos CLI. Ele possui o agendador usado pelo processo do comando, portanto não é necessário um `process.host` separado. Quando houver vários hosts de terminal, selecione um com `--host`.

## Ciclo de Vida do Processo

Processos WASM seguem o modelo de ciclo de vida Init/Step/Close:

1. **Init** - O contexto da chamada, o método e os argumentos de entrada são capturados.
2. **Step** - O primeiro passo instancia e inicia o módulo. Passos posteriores avançam operações com bridge do dispatcher; uma execução síncrona pode terminar no primeiro passo.
3. **Close** - Os recursos da instância são liberados.

## Iniciando a partir de Lua

Inicie um processo WASM e monitore-o até a conclusão:

```lua
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

Processos WASM podem ceder a execução em operações de host que o runtime conecta ao dispatcher, incluindo polling de relógio e HTTP de saída. O agendador suspende o processo até a operação pendente terminar e então o retoma:

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

O mecanismo de yield/resume é transparente para o guest nessas operações asyncificadas. Não suponha que toda chamada WASI bloqueante ceda a execução: leituras e escritas de streams são síncronas no runtime fixado.

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
