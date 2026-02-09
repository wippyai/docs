# Funcoes WASM

Funcoes WASM sao entradas de registro que executam codigo WebAssembly. Dois tipos de entrada estao disponiveis: `function.wat` para codigo WAT inline e `function.wasm` para binarios pre-compilados.

## Funcoes WAT Inline

Defina funcoes WASM pequenas diretamente no seu `_index.yaml` usando o formato WebAssembly Text:

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

Para fontes WAT maiores, use uma referencia a arquivo:

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### Campos de Configuracao WAT

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `source` | Sim | Fonte WAT inline ou referencia `file://` |
| `method` | Sim | Nome da funcao exportada a ser chamada |
| `wit` | Nao | Assinatura WIT para modulos raw/core |
| `pool` | Nao | Configuracao do pool de workers |
| `transport` | Nao | Mapeamento de entrada/saida (padrao: `payload`) |
| `imports` | Nao | Imports do host a habilitar (ex.: `wasi:cli`, `wasi:io`) |
| `wasi` | Nao | Configuracao WASI (args, env, mounts) |
| `limits` | Nao | Limites de execucao |

## Funcoes WASM Pre-compiladas

Carregue binarios `.wasm` compilados a partir de uma entrada de sistema de arquivos:

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### Campos de Configuracao WASM

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `fs` | Sim | ID da entrada de sistema de arquivos contendo o binario |
| `path` | Sim | Caminho para o arquivo `.wasm` dentro do sistema de arquivos |
| `hash` | Sim | Hash SHA-256 para verificacao de integridade (`sha256:...`) |
| `method` | Sim | Nome da funcao exportada a ser chamada |
| `wit` | Nao | Assinatura WIT para modulos raw/core |
| `pool` | Nao | Configuracao do pool de workers |
| `transport` | Nao | Mapeamento de entrada/saida (padrao: `payload`) |
| `imports` | Nao | Imports do host a habilitar |
| `wasi` | Nao | Configuracao WASI |
| `limits` | Nao | Limites de execucao |

## Pools de Workers

Cada funcao WASM usa um pool de instancias pre-compiladas. O tipo do pool controla a concorrencia e o uso de recursos.

| Tipo | Descricao |
|------|-----------|
| `inline` | Sincrono, single-threaded. Nova instancia por chamada. |
| `lazy` | Zero workers ociosos. Escala sob demanda ate `max_size`. |
| `static` | Numero fixo de workers com fila de requisicoes. |
| `adaptive` | Pool elastico com auto-escalonamento. |

### Configuracao do Pool

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
  warm_start: true   # Pre-instantiate initial workers
```

O maximo padrao do pool elastico e 100 workers quando `max_size` nao e especificado.

## Transportes

Transportes controlam como entrada e saida sao mapeados entre o runtime e o modulo WASM.

| Transporte | Descricao |
|------------|-----------|
| `payload` | Mapeia payloads do runtime diretamente para argumentos de chamada WASM (padrao) |
| `wasi-http` | Mapeia contexto de requisicao/resposta HTTP para argumentos e resultados WASM |

### Transporte Payload

O transporte padrao passa argumentos diretamente. Valores Lua sao transcodificados para tipos Go, depois rebaixados para tipos WIT:

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
-- result: 42
```

### Transporte WASI HTTP

O transporte `wasi-http` mapeia requisicoes HTTP para WASM e escreve os resultados de volta na resposta HTTP. Use isso para expor funcoes WASM como endpoints HTTP:

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## Limites de Execucao

Defina um tempo maximo de execucao para uma funcao:

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

Quando o limite e excedido, a execucao e cancelada e um erro e retornado.

## Configuracao WASI

Configure capacidades WASI para o modulo guest:

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| Campo | Descricao |
|-------|-----------|
| `args` | Argumentos de linha de comando passados ao guest |
| `cwd` | Diretorio de trabalho dentro do guest (deve ser absoluto) |
| `env` | Variaveis de ambiente mapeadas de entradas env do registro |
| `mounts` | Montagens de sistema de arquivos a partir de entradas de sistema de arquivos do registro |

Variaveis de ambiente sao resolvidas a partir do registro de ambiente no momento da chamada. Variaveis obrigatorias causam um erro se nao forem encontradas.

Caminhos de montagem devem ser absolutos e unicos. Cada montagem mapeia uma entrada de sistema de arquivos do runtime para um caminho de diretorio do guest.

## Exemplos

### Pipeline de Transformacao de Dados

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)

-- Filter: returns only active users
local active, err = funcs.call("myns:filter_active", users)
```

### Componente JavaScript

Qualquer linguagem que compila para o WebAssembly Component Model funciona. Aqui esta uma funcao compilada a partir de JavaScript:

```yaml
  - name: js_add
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /js_calculator.wasm
    hash: sha256:eda7db3925a40c12b5e8c36b0d228a4be4f2c79ee8b5c86b912cf8b3d9a70a7c
    method: add
    pool:
      type: inline
```

```lua
local result, err = funcs.call("myns:js_add", 10, 20)
-- result: 30
```

### Sleep Assincrono com WASI Clocks

Componentes WASM que importam `wasi:clocks` e `wasi:io` podem usar relogios e polling. O mecanismo de yield assincrono se integra com o dispatcher do Wippy:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:clocks
    pool:
      type: inline
```

O separador `#` no campo method referencia um metodo de interface: `test-sleep#sleep-ms` chama a funcao `sleep-ms` da interface `test-sleep`.

## Veja Tambem

- [Visao Geral](wasm/overview.md) - Visao geral do runtime WebAssembly
- [Funcoes Host](wasm/hosts.md) - Interfaces host disponiveis
- [Processos](wasm/processes.md) - Executando WASM como processos
- [Tipos de Entradas](guides/entry-kinds.md) - Todos os tipos de entrada do registro
