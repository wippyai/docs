# Processos WASM

Modulos WASM podem ser executados como processos atraves do tipo de entrada `process.wasm`. Processos sao executados dentro do host de processos do Wippy e suportam o ciclo de vida completo do processo: criacao, monitoramento e encerramento supervisionado.

## Configuracao da Entrada

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

### Campos de Configuracao

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `fs` | Sim | ID da entrada de sistema de arquivos contendo o binario |
| `path` | Sim | Caminho para o arquivo `.wasm` dentro do sistema de arquivos |
| `hash` | Sim | Hash SHA-256 para verificacao de integridade |
| `method` | Sim | Nome da funcao exportada a ser executada |
| `imports` | Nao | Imports do host a habilitar |
| `wasi` | Nao | Configuracao WASI (args, env, mounts) |
| `limits` | Nao | Limites de execucao |

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

Liste os comandos disponiveis:

```bash
wippy run list
```

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `name` | Sim | Nome do comando usado com `wippy run <name>` |
| `short` | Nao | Descricao curta mostrada em `wippy run list` |

Um `terminal.host` e um `process.host` devem estar presentes para que comandos CLI funcionem.

## Ciclo de Vida do Processo

Processos WASM seguem o modelo de ciclo de vida Init/Step/Close:

1. **Init** - O modulo e instanciado, argumentos de entrada sao capturados
2. **Step** - A execucao avanca. Para modulos assincronos, o agendador conduz ciclos de yield/resume. Para modulos sincronos, a execucao e concluida em um unico passo.
3. **Close** - Recursos da instancia sao liberados

## Criando a partir de Lua

Crie um processo WASM e monitore-o ate a conclusao:

```lua
local process = require("process")
local time = require("time")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process group
    6, 7                     -- arguments passed to the WASM function
)

if err then
    error("spawn failed: " .. tostring(err))
end

-- Wait for the process to complete
local event = process.receive(time.seconds(10))
if event and event.type == "EXIT" then
    local result = event.value  -- return value from the WASM function
end
```

## Execucao Assincrona

Processos WASM que importam interfaces WASI podem realizar operacoes assincronas. O agendador suspende o processo durante I/O e o retoma quando a operacao e concluida:

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

O mecanismo de yield/resume e transparente para o codigo WASM. Chamadas bloqueantes padrao no guest (sleep, read, write, requisicoes HTTP) cedem controle automaticamente ao dispatcher.

## Configuracao WASI

Processos suportam a mesma configuracao WASI que funcoes:

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

## Veja Tambem

- [Visao Geral](wasm/overview.md) - Visao geral do runtime WebAssembly
- [Funcoes](wasm/functions.md) - Configuracao de funcoes WASM
- [Funcoes Host](wasm/hosts.md) - Interfaces host disponiveis
- [Modelo de Processos](concepts/process-model.md) - Ciclo de vida de processos
- [Supervisao](guides/supervision.md) - Arvores de supervisao de processos
